import express, { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error'
import { prisma } from '@yobi/database'
import { cache } from '@yobi/database/src/redis'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'portfolio-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

const router: express.Router = Router()

// Portfolio interface definitions (matching UI expectations)
interface Position {
  id: string
  symbol: string
  name: string
  quantity: number
  averagePrice: number
  currentPrice: number
  totalValue: number
  totalCost: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  exchange: string
  currency: string
  sector?: string
  industry?: string
  lastUpdated: string
}

interface Portfolio {
  id: string
  name: string
  description?: string
  totalValue: number
  totalCost: number
  cash: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  dayChange: number
  dayChangePercent: number
  positions: Position[]
  riskMetrics: {
    beta: number
    sharpeRatio: number
    maxDrawdown: number
    volatility: number
    var95: number // Value at Risk 95%
  }
  allocation: {
    byExchange: { [key: string]: number }
    bySector: { [key: string]: number }
    byAssetClass: { [key: string]: number }
  }
  createdAt: string
  updatedAt: string
}

// Helper functions
async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    // Try to get cached market data first
    const cachedData = await cache.getMarketData(symbol.toUpperCase())
    if (cachedData && cachedData.price) {
      return cachedData.price
    }

    // Fallback to database - get latest market data
    const latestData = await prisma.marketData.findFirst({
      where: {
        instrument: { symbol: symbol.toUpperCase() }
      },
      orderBy: { timestamp: 'desc' }
    })

    return latestData ? Number(latestData.close) : null
  } catch (error) {
    logger.error(`Failed to get current price for ${symbol}:`, error)
    return null
  }
}

async function calculatePortfolioMetrics(positions: Position[]): Promise<Portfolio['riskMetrics']> {
  const totalValue = positions.reduce((sum, pos) => sum + pos.totalValue, 0)
  
  if (totalValue === 0) {
    return { beta: 0, sharpeRatio: 0, maxDrawdown: 0, volatility: 0, var95: 0 }
  }

  // Calculate portfolio-level risk metrics
  const weights = positions.map(pos => pos.totalValue / totalValue)
  const returns = positions.map(pos => pos.unrealizedPnLPercent / 100)
  
  const portfolioReturn = weights.reduce((sum, weight, i) => sum + weight * (returns[i] || 0), 0)
  const variance = weights.reduce((sum, weight, i) => sum + weight * Math.pow((returns[i] || 0) - portfolioReturn, 2), 0)
  const volatility = Math.sqrt(variance) * Math.sqrt(252) // Annualized

  // Get individual instrument betas and calculate portfolio beta
  let portfolioBeta = 0
  for (let i = 0; i < positions.length; i++) {
    const position = positions[i]
    const weight = weights[i]
    if (!position || weight === undefined) continue
    
    try {
      const fundamentalData = await prisma.fundamentalData.findFirst({
        where: { instrument: { symbol: position.symbol } }
      })
      const beta = fundamentalData?.beta || 1.0
      portfolioBeta += weight * beta
    } catch (error) {
      portfolioBeta += weight * 1.0 // Default beta
    }
  }

  return {
    beta: portfolioBeta,
    sharpeRatio: volatility > 0 ? portfolioReturn / volatility : 0,
    maxDrawdown: Math.min(...returns) * 100,
    volatility: volatility * 100,
    var95: totalValue * 0.05 // Simplified 5% VaR
  }
}

function calculateAllocation(positions: Position[]): Portfolio['allocation'] {
  const totalValue = positions.reduce((sum, pos) => sum + pos.totalValue, 0)
  
  const byExchange: { [key: string]: number } = {}
  const bySector: { [key: string]: number } = {}
  const byAssetClass: { [key: string]: number } = {}

  positions.forEach(pos => {
    const weight = totalValue > 0 ? (pos.totalValue / totalValue) * 100 : 0
    
    // By exchange
    byExchange[pos.exchange] = (byExchange[pos.exchange] || 0) + weight
    
    // By sector
    const sector = pos.sector || 'Unknown'
    bySector[sector] = (bySector[sector] || 0) + weight
    
    // By asset class (determine from exchange and symbol)
    const assetClass = pos.symbol.includes('ETF') || ['SPY', 'QQQ', 'IWM', 'VTI'].includes(pos.symbol) ? 'ETF' : 'STOCK'
    byAssetClass[assetClass] = (byAssetClass[assetClass] || 0) + weight
  })

  return { byExchange, bySector, byAssetClass }
}

// GET /api/portfolio - Get user portfolios
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get user ID from auth (for now, use a default user or create one)
    let userId = 'demo-user-001' // In production, get from JWT/session
    
    // Ensure demo user exists
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'demo@yobi.com',
        username: 'demo_user',
        password: 'hashed_password',
        firstName: 'Demo',
        lastName: 'User',
        role: 'TRADER'
      }
    })

    // Get user's portfolios
    const portfolios = await prisma.portfolio.findMany({
      where: { 
        userId: user.id,
        isActive: true 
      },
      include: {
        positions: {
          include: {
            instrument: true
          }
        }
      }
    })

    // If no portfolios exist, create a default one with sample positions
    if (portfolios.length === 0) {
      const defaultPortfolio = await prisma.portfolio.create({
        data: {
          userId: user.id,
          name: 'Main Portfolio',
          description: 'Primary trading portfolio with diversified holdings',
          currency: 'USD',
          isDefault: true,
          availableCash: 25000,
          totalValue: 0,
          investedAmount: 0
        },
        include: {
          positions: {
            include: {
              instrument: true
            }
          }
        }
      })

      // Create sample positions for demo
      const sampleSymbols = ['AAPL', 'RELIANCE', 'TSLA']
      for (const symbol of sampleSymbols) {
        const instrument = await prisma.instrument.findFirst({
          where: { symbol }
        })
        
        if (instrument) {
          const currentPrice = await getCurrentPrice(symbol) || 100
          const quantity = symbol === 'AAPL' ? 10 : symbol === 'RELIANCE' ? 50 : 5
          const averagePrice = currentPrice * 0.95 // Bought 5% lower
          
          await prisma.position.create({
            data: {
              portfolioId: defaultPortfolio.id,
              instrumentId: instrument.id,
              quantity,
              averagePrice,
              investedAmount: quantity * averagePrice,
              firstBuyDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
              lastTransactionDate: new Date()
            }
          })
        }
      }
      
      // Fetch the updated portfolio with positions
      portfolios.push(await prisma.portfolio.findFirst({
        where: { id: defaultPortfolio.id },
        include: {
          positions: {
            include: {
              instrument: true
            }
          }
        }
      })!)
    }

    // Transform database portfolios to UI format
    const transformedPortfolios: Portfolio[] = []
    
    for (const dbPortfolio of portfolios) {
      const positions: Position[] = []
      
      // Transform positions
      for (const dbPosition of dbPortfolio.positions) {
        const currentPrice = await getCurrentPrice(dbPosition.instrument.symbol) || dbPosition.averagePrice
        const totalValue = dbPosition.quantity * currentPrice
        const unrealizedPnL = totalValue - dbPosition.investedAmount
        const unrealizedPnLPercent = ((currentPrice - dbPosition.averagePrice) / dbPosition.averagePrice) * 100
        
        positions.push({
          id: dbPosition.id,
          symbol: dbPosition.instrument.symbol,
          name: dbPosition.instrument.name,
          quantity: dbPosition.quantity,
          averagePrice: dbPosition.averagePrice,
          currentPrice,
          totalValue,
          totalCost: dbPosition.investedAmount,
          unrealizedPnL,
          unrealizedPnLPercent,
          exchange: dbPosition.instrument.exchange,
          currency: dbPosition.instrument.currency,
          sector: dbPosition.instrument.sector,
          industry: dbPosition.instrument.industry,
          lastUpdated: dbPosition.lastTransactionDate.toISOString()
        })
      }

      const totalInvestedValue = positions.reduce((sum, pos) => sum + pos.totalValue, 0)
      const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0)
      const unrealizedPnL = totalInvestedValue - totalCost
      const totalValue = totalInvestedValue + dbPortfolio.availableCash

      // Calculate day change (simplified - in production, compare to yesterday's close)
      const dayChange = totalInvestedValue * 0.012 // Sample 1.2% day change
      const dayChangePercent = 1.2

      transformedPortfolios.push({
        id: dbPortfolio.id,
        name: dbPortfolio.name,
        description: dbPortfolio.description,
        totalValue,
        totalCost,
        cash: dbPortfolio.availableCash,
        unrealizedPnL,
        unrealizedPnLPercent: totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0,
        dayChange,
        dayChangePercent,
        positions,
        riskMetrics: await calculatePortfolioMetrics(positions),
        allocation: calculateAllocation(positions),
        createdAt: dbPortfolio.createdAt.toISOString(),
        updatedAt: dbPortfolio.updatedAt.toISOString()
      })
    }

    res.json({
      success: true,
      data: transformedPortfolios
    })

  } catch (error) {
    logger.error('Failed to fetch portfolios:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolios'
    })
  }
}))

// GET /api/portfolio/:id - Get specific portfolio details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Portfolio ID is required'
    })
  }

  try {
    const dbPortfolio = await prisma.portfolio.findFirst({
      where: { 
        id,
        isActive: true 
      },
      include: {
        positions: {
          include: {
            instrument: true
          }
        }
      }
    })

    if (!dbPortfolio) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found'
      })
    }

    // Transform to UI format (same logic as above)
    const positions: Position[] = []
    
    for (const dbPosition of dbPortfolio.positions) {
      const currentPrice = await getCurrentPrice(dbPosition.instrument.symbol) || dbPosition.averagePrice
      const totalValue = dbPosition.quantity * currentPrice
      const unrealizedPnL = totalValue - dbPosition.investedAmount
      const unrealizedPnLPercent = ((currentPrice - dbPosition.averagePrice) / dbPosition.averagePrice) * 100
      
      positions.push({
        id: dbPosition.id,
        symbol: dbPosition.instrument.symbol,
        name: dbPosition.instrument.name,
        quantity: dbPosition.quantity,
        averagePrice: dbPosition.averagePrice,
        currentPrice,
        totalValue,
        totalCost: dbPosition.investedAmount,
        unrealizedPnL,
        unrealizedPnLPercent,
        exchange: dbPosition.instrument.exchange,
        currency: dbPosition.instrument.currency,
        sector: dbPosition.instrument.sector,
        industry: dbPosition.instrument.industry,
        lastUpdated: dbPosition.lastTransactionDate.toISOString()
      })
    }

    const totalInvestedValue = positions.reduce((sum, pos) => sum + pos.totalValue, 0)
    const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0)
    const unrealizedPnL = totalInvestedValue - totalCost
    const totalValue = totalInvestedValue + dbPortfolio.availableCash
    const dayChange = totalInvestedValue * 0.015
    const dayChangePercent = 1.5

    const portfolio: Portfolio = {
      id: dbPortfolio.id,
      name: dbPortfolio.name,
      description: dbPortfolio.description,
      totalValue,
      totalCost,
      cash: dbPortfolio.availableCash,
      unrealizedPnL,
      unrealizedPnLPercent: totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0,
      dayChange,
      dayChangePercent,
      positions,
      riskMetrics: await calculatePortfolioMetrics(positions),
      allocation: calculateAllocation(positions),
      createdAt: dbPortfolio.createdAt.toISOString(),
      updatedAt: dbPortfolio.updatedAt.toISOString()
    }

    res.json({
      success: true,
      data: portfolio
    })

  } catch (error) {
    logger.error(`Failed to fetch portfolio ${id}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio details'
    })
  }
}))

// POST /api/portfolio/:id/position - Add a new position
router.post('/:id/position', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { symbol, quantity, price, orderType = 'BUY' } = req.body

  if (!symbol || !quantity || !price) {
    return res.status(400).json({
      success: false,
      error: 'Symbol, quantity, and price are required'
    })
  }

  try {
    // Get current price for validation
    const currentPrice = await getCurrentPrice(symbol.toUpperCase())
    
    if (!currentPrice) {
      return res.status(404).json({
        success: false,
        error: `Current price not available for ${symbol}`
      })
    }

    // Get instrument details
    const instrument = await prisma.instrument.findFirst({
      where: { symbol: symbol.toUpperCase() }
    })

    if (!instrument) {
      return res.status(404).json({
        success: false,
        error: `Instrument ${symbol} not found`
      })
    }

    // Get portfolio to update cash
    const portfolio = await prisma.portfolio.findFirst({
      where: { id },
      include: {
        user: true
      }
    })

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found'
      })
    }

    // Calculate total cost and invested amount for the portfolio
    const totalInvestedAmount = portfolio.investedAmount + (orderType === 'BUY' ? quantity * price : -quantity * price)
    const totalValue = portfolio.totalValue + (orderType === 'BUY' ? quantity * currentPrice : -quantity * currentPrice)

    // Update portfolio cash
    await prisma.portfolio.update({
      where: { id },
      data: {
        availableCash: portfolio.availableCash - (orderType === 'BUY' ? quantity * price : -quantity * price),
        totalValue,
        investedAmount: totalInvestedAmount
      }
    })

    // Create position record (in production, this would be stored in database)
    const position: Position = {
      id: `pos_${Date.now()}`,
      symbol: symbol.toUpperCase(),
      name: instrument.name,
      quantity: orderType === 'BUY' ? Number(quantity) : -Number(quantity),
      averagePrice: Number(price),
      currentPrice,
      totalValue: Number(quantity) * currentPrice,
      totalCost: Number(quantity) * Number(price),
      unrealizedPnL: Number(quantity) * (currentPrice - Number(price)),
      unrealizedPnLPercent: ((currentPrice - Number(price)) / Number(price)) * 100,
      exchange: instrument.exchange,
      currency: instrument.currency,
      sector: instrument.sector,
      industry: instrument.industry,
      lastUpdated: new Date().toISOString()
    }

    logger.info(`${orderType} order created: ${quantity} shares of ${symbol} at $${price}`)

    res.json({
      success: true,
      message: `${orderType} order executed successfully`,
      data: {
        position,
        executionPrice: currentPrice,
        executionTime: new Date().toISOString(),
        orderType,
        status: 'FILLED'
      }
    })

  } catch (error) {
    logger.error(`Failed to create position for ${symbol}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to execute order'
    })
  }
}))

// DELETE /api/portfolio/:id/position/:positionId - Close a position
router.delete('/:id/position/:positionId', asyncHandler(async (req: Request, res: Response) => {
  const { id, positionId } = req.params

  try {
    // In production, this would remove the position from database
    logger.info(`Position ${positionId} closed in portfolio ${id}`)

    res.json({
      success: true,
      message: 'Position closed successfully',
      data: {
        positionId,
        closedAt: new Date().toISOString(),
        status: 'CLOSED'
      }
    })

  } catch (error) {
    logger.error(`Failed to close position ${positionId}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to close position'
    })
  }
}))

// GET /api/portfolio/:id/performance - Get portfolio performance history
router.get('/:id/performance', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { period = '1M' } = req.query

  try {
    // Generate sample performance data
    const days = period === '1D' ? 1 : period === '1W' ? 7 : period === '1M' ? 30 : period === '3M' ? 90 : 365
    const performance = []
    
    const baseValue = 150000
    let currentValue = baseValue

    for (let i = days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      // Generate realistic random performance
      const dailyReturn = (Math.random() - 0.5) * 0.04 // ±2% daily volatility
      currentValue *= (1 + dailyReturn)
      
      performance.push({
        date: date.toISOString().split('T')[0],
        value: currentValue,
        return: ((currentValue - baseValue) / baseValue) * 100,
        benchmark: baseValue * (1 + (Math.random() - 0.48) * 0.03) // Slightly underperform market
      })
    }

    res.json({
      success: true,
      data: {
        period,
        performance,
        summary: {
          totalReturn: ((currentValue - baseValue) / baseValue) * 100,
          annualizedReturn: (Math.pow(currentValue / baseValue, 365 / days) - 1) * 100,
          volatility: 15.2, // Sample volatility
          sharpeRatio: 1.8,
          maxDrawdown: -8.5,
          bestDay: 3.2,
          worstDay: -2.8
        }
      }
    })

  } catch (error) {
    logger.error(`Failed to fetch performance for portfolio ${id}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio performance'
    })
  }
}))

// GET /api/portfolio/:id/alerts - Get portfolio alerts
router.get('/:id/alerts', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const alerts = [
      {
        id: 'alert_1',
        type: 'PRICE_ALERT',
        symbol: 'AAPL',
        message: 'AAPL reached your target price of $180',
        severity: 'INFO',
        timestamp: new Date().toISOString(),
        isRead: false
      },
      {
        id: 'alert_2',
        type: 'RISK_ALERT',
        symbol: 'TSLA',
        message: 'TSLA position is down -8% from your entry price',
        severity: 'WARNING',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isRead: false
      },
      {
        id: 'alert_3',
        type: 'PORTFOLIO_ALERT',
        symbol: null,
        message: 'Portfolio concentration risk: Technology sector exceeds 40%',
        severity: 'WARNING',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        isRead: true
      }
    ]

    res.json({
      success: true,
      data: alerts
    })

  } catch (error) {
    logger.error(`Failed to fetch alerts for portfolio ${id}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio alerts'
    })
  }
}))

// POST /api/portfolio/:id/rebalance - Get rebalancing suggestions
router.post('/:id/rebalance', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { targetAllocation } = req.body

  try {
    const suggestions = [
      {
        action: 'REDUCE',
        symbol: 'AAPL',
        currentWeight: 35.2,
        targetWeight: 25.0,
        suggestedQuantity: -5,
        reason: 'Reduce overweight technology exposure'
      },
      {
        action: 'INCREASE',
        symbol: 'RELIANCE',
        currentWeight: 45.8,
        targetWeight: 55.0,
        suggestedQuantity: 10,
        reason: 'Increase energy sector allocation'
      },
      {
        action: 'ADD',
        symbol: 'JNJ',
        currentWeight: 0.0,
        targetWeight: 20.0,
        suggestedQuantity: 15,
        reason: 'Add healthcare exposure for diversification'
      }
    ]

    res.json({
      success: true,
      data: {
        suggestions,
        estimatedCost: 12500,
        estimatedBenefit: {
          riskReduction: 12.5,
          diversificationImprovement: 18.3,
          expectedReturnChange: 0.8
        }
      }
    })

  } catch (error) {
    logger.error(`Failed to generate rebalancing suggestions for portfolio ${id}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate rebalancing suggestions'
    })
  }
}))

// GET /api/portfolio/watchlist - Get user's watchlist
router.get('/watchlist', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Sample watchlist items
    const watchlist = [
      {
        id: 'watch_1',
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        exchange: 'NASDAQ',
        currentPrice: 378.85,
        change24h: 2.15,
        change24hPercent: 0.57,
        addedAt: '2024-01-15T10:30:00Z',
        alerts: 1
      },
      {
        id: 'watch_2',
        symbol: 'GOOGL',
        name: 'Alphabet Inc Class A',
        exchange: 'NASDAQ',
        currentPrice: 142.56,
        change24h: -1.23,
        change24hPercent: -0.86,
        addedAt: '2024-01-20T14:45:00Z',
        alerts: 0
      },
      {
        id: 'watch_3',
        symbol: 'TCS',
        name: 'Tata Consultancy Services Limited',
        exchange: 'NSE',
        currentPrice: 3687.50,
        change24h: 45.30,
        change24hPercent: 1.24,
        addedAt: '2024-01-22T09:15:00Z',
        alerts: 2
      }
    ]

    res.json({
      success: true,
      data: watchlist,
      metadata: {
        total: watchlist.length,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('Failed to fetch watchlist:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch watchlist'
    })
  }
}))

// POST /api/portfolio/watchlist - Add instrument to watchlist
router.post('/watchlist', asyncHandler(async (req: Request, res: Response) => {
  const { symbol, name } = req.body

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol is required'
    })
  }

  try {
    // Get current price for the symbol
    const currentPrice = await getCurrentPrice(symbol.toUpperCase()) || 100.00

    const watchlistItem = {
      id: `watch_${Date.now()}`,
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      exchange: symbol.includes('.NS') ? 'NSE' : 'NASDAQ',
      currentPrice,
      change24h: (Math.random() - 0.5) * 10, // Mock 24h change
      change24hPercent: (Math.random() - 0.5) * 5, // Mock percentage change
      addedAt: new Date().toISOString(),
      alerts: 0
    }

    logger.info(`Added ${symbol} to watchlist`)

    res.json({
      success: true,
      message: `${symbol} added to watchlist successfully`,
      data: watchlistItem
    })

  } catch (error) {
    logger.error(`Failed to add ${symbol} to watchlist:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to add to watchlist'
    })
  }
}))

// DELETE /api/portfolio/watchlist/:symbol - Remove from watchlist
router.delete('/watchlist/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol is required'
    })
  }

  try {
    logger.info(`Removed ${symbol} from watchlist`)

    res.json({
      success: true,
      message: `${symbol} removed from watchlist successfully`
    })

  } catch (error) {
    logger.error(`Failed to remove ${symbol} from watchlist:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to remove from watchlist'
    })
  }
}))

export default router 