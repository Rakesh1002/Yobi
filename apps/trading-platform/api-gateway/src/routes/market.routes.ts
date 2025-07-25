import express, { Router, Request, Response } from 'express'
import { query } from 'express-validator'
import { asyncHandler } from '../middleware/error'
import { marketDataService } from '../services/market.service'
import { ApiError } from '../middleware/error'
import { cache } from '@yobi/database/src/redis'
import { prisma } from '@yobi/database'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'market-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

const router: express.Router = Router()

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const { validationResult } = require('express-validator')
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }
  next()
}

// GET /api/market/quote/:symbol - Get current quote
router.get('/quote/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    throw new ApiError('Symbol parameter is required', 400)
  }

  try {
    const quote = await marketDataService.getQuote(symbol)
    
    res.json({
      success: true,
      data: quote
    })
  } catch (error) {
    throw new ApiError(`Unable to fetch quote for ${symbol}`, 500)
  }
}))

// GET /api/market/historical/:symbol - Get historical data
router.get('/historical/:symbol', 
  [
    query('period')
      .optional()
      .isIn(['1d', '5d', '1m', '3m', '6m', '1y', '2y', '5y'])
      .withMessage('Period must be one of: 1d, 5d, 1m, 3m, 6m, 1y, 2y, 5y'),
    query('interval')
      .optional()
      .isIn(['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo'])
      .withMessage('Interval must be valid time interval')
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params
    const { period = '1y', interval = '1d' } = req.query
    
    if (!symbol) {
      throw new ApiError('Symbol parameter is required', 400)
    }

    try {
      const historicalData = await marketDataService.getHistoricalData(
        symbol, 
        period as string, 
        interval as string
      )
      
      res.json({
        success: true,
        data: historicalData
      })
    } catch (error) {
      throw new ApiError(`Unable to fetch historical data for ${symbol}`, 500)
    }
  })
)

// GET /api/market/search - Search instruments
router.get('/search',
  [
    query('q')
      .notEmpty()
      .isLength({ min: 1, max: 50 })
      .withMessage('Query parameter "q" is required and must be 1-50 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { q: query, limit = 10 } = req.query
    
    try {
      const results = await marketDataService.searchInstruments(
        query as string, 
        Number(limit)
      )
      
      res.json({
        success: true,
        data: results,
        metadata: {
          query,
          total: results.length,
          limit: Number(limit)
        }
      })
    } catch (error) {
      throw new ApiError('Unable to search instruments', 500)
    }
  })
)

// GET /api/market/intelligence - Comprehensive market intelligence data
router.get('/intelligence', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching comprehensive market intelligence data')
  
  try {
    // Get cache key for intelligence data
    const cacheKey = 'market:intelligence:comprehensive'
    
    // Try to get cached data first
    let cachedData
    try {
      cachedData = await cache.get(cacheKey)
      if (cachedData) {
        const parsedData = cachedData as any
        // Return cached data if it's less than 5 minutes old
        const age = Date.now() - new Date(parsedData.timestamp).getTime()
        if (age < 5 * 60 * 1000) { // 5 minutes
          logger.info('Returning cached intelligence data')
          return res.json({
            success: true,
            data: parsedData,
            cached: true,
            age: Math.floor(age / 1000)
          })
        }
      }
    } catch (cacheError) {
      logger.warn('Cache retrieval failed:', cacheError)
    }

    // Fetch fresh data if cache miss or expired
    const [
      topInstruments,
      recentDocuments,
      recentInsights,
      searchResults,
      agentStatus
    ] = await Promise.all([
      // Get top instruments with recent data
      prisma.instrument.findMany({
        where: { isActive: true },
        include: {
          marketData: {
            orderBy: { timestamp: 'desc' },
            take: 1
          },
          fundamentals: true,
          aiInsights: {
            where: { isActive: true },
            orderBy: { generatedAt: 'desc' },
            take: 1
          }
        },
        take: 50
      }),
      
      // Get recent documents
      prisma.document.findMany({
        where: {
          status: 'PROCESSED',
          processedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        include: {
          instrument: true
        },
        orderBy: { processedAt: 'desc' },
        take: 20
      }),
      
      // Get recent AI insights
      prisma.aiInsight.findMany({
        where: { 
          isActive: true,
          generatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        include: {
          instrument: true
        },
        orderBy: { generatedAt: 'desc' },
        take: 15
      }),
      
      // Get recent search results for trending topics
      prisma.searchResult.findMany({
        where: {
          discoveredAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        include: {
          instrument: true
        },
        orderBy: { relevanceScore: 'desc' },
        take: 30
      }),
      
      // Check agent status (mock for now)
      Promise.resolve({
        isRunning: true,
        tasksInQueue: Math.floor(Math.random() * 10),
        tasksProcessing: Math.floor(Math.random() * 3),
        lastUpdate: new Date().toISOString(),
        processedSymbols: Math.floor(Math.random() * 50) + 100,
        totalSymbols: 150
      })
    ])

    // Calculate market overview
    const activeInstruments = topInstruments.filter((i: any) => i.marketData.length > 0)
    const gainers = activeInstruments
      .filter((i: any) => i.marketData[0]?.changePercent > 0)
      .sort((a: any, b: any) => (b.marketData[0]?.changePercent || 0) - (a.marketData[0]?.changePercent || 0))
      .slice(0, 5)
      .map((i: any) => ({
        symbol: i.symbol,
        name: i.name,
        change: i.marketData[0]?.change || 0,
        changePercent: i.marketData[0]?.changePercent || 0,
        price: i.marketData[0]?.close || 0,
        exchange: i.exchange,
        sector: i.sector
      }))

    const losers = activeInstruments
      .filter((i: any) => i.marketData[0]?.changePercent < 0)
      .sort((a: any, b: any) => (a.marketData[0]?.changePercent || 0) - (b.marketData[0]?.changePercent || 0))
      .slice(0, 5)
      .map((i: any) => ({
        symbol: i.symbol,
        name: i.name,
        change: i.marketData[0]?.change || 0,
        changePercent: i.marketData[0]?.changePercent || 0,
        price: i.marketData[0]?.close || 0,
        exchange: i.exchange,
        sector: i.sector
      }))

    // Calculate sector performance
    const sectorPerformance = activeInstruments.reduce((acc: any, instrument: any) => {
      const sector = instrument.sector || 'Unknown'
      if (!acc[sector]) {
        acc[sector] = { total: 0, count: 0, instruments: [] }
      }
      acc[sector].total += instrument.marketData[0]?.changePercent || 0
      acc[sector].count += 1
      acc[sector].instruments.push(instrument.symbol)
      return acc
    }, {})

    const sectors = Object.entries(sectorPerformance).map(([name, data]: [string, any]) => ({
      name,
      change: data.total / data.count,
      leaders: data.instruments.slice(0, 3),
      laggards: data.instruments.slice(-3)
    })).sort((a: any, b: any) => b.change - a.change)

    // Calculate overall sentiment
    const totalChangePercent = activeInstruments.reduce((sum: number, i: any) => sum + (i.marketData[0]?.changePercent || 0), 0)
    const avgChange = totalChangePercent / activeInstruments.length
    const bullishCount = activeInstruments.filter((i: any) => (i.marketData[0]?.changePercent || 0) > 0).length
    const bearishCount = activeInstruments.filter((i: any) => (i.marketData[0]?.changePercent || 0) < 0).length
    const neutralCount = activeInstruments.length - bullishCount - bearishCount

    // Format news from search results
    const news = searchResults.map((result: any) => ({
      id: result.id,
      title: result.title,
      summary: result.snippet || '',
      url: result.url,
      source: result.domain || result.provider,
      publishedAt: result.publishedDate?.toISOString() || result.discoveredAt.toISOString(),
      sentiment: result.sentiment ? (result.sentiment > 0.1 ? 'POSITIVE' : result.sentiment < -0.1 ? 'NEGATIVE' : 'NEUTRAL') : 'NEUTRAL',
      symbols: [result.instrument?.symbol].filter(Boolean),
      category: result.contentType || 'news',
      relevance: result.relevanceScore || 0.5
    }))

    // Format insights from AI insights
    const insights = recentInsights.map((insight: any) => ({
      id: insight.id,
      symbol: insight.instrument?.symbol || '',
      type: insight.recommendation === 'BUY' ? 'OPPORTUNITY' : insight.recommendation === 'SELL' ? 'RISK' : 'TREND',
      title: `${insight.instrument?.symbol} - ${insight.recommendation}`,
      description: insight.summary,
      confidence: insight.confidence || 0.5,
      impact: insight.confidence > 0.8 ? 'HIGH' : insight.confidence > 0.5 ? 'MEDIUM' : 'LOW',
      timeframe: insight.timeHorizon,
      dataPoints: insight.keyInsights || [],
      generatedAt: insight.generatedAt.toISOString(),
      targetPrice: insight.targetPrice,
      sourcesUsed: insight.sourcesUsed || {}
    }))

    // Format documents
    const documents = recentDocuments.map((doc: any) => ({
      id: doc.id,
      symbol: doc.instrument?.symbol || '',
      title: doc.title,
      type: doc.documentType as 'EARNINGS' | 'SEC_FILING' | 'ANALYST_REPORT' | 'NEWS',
      url: doc.url || doc.sourceUrl,
      publishedAt: doc.publishedDate?.toISOString() || doc.createdAt.toISOString(),
      processed: doc.status === 'PROCESSED',
      keyPoints: doc.keyPoints || [],
      source: doc.sourceProvider,
      fileSize: Number(doc.fileSize || 0)
    }))

    const intelligenceData = {
      marketOverview: {
        sentiment: {
          overall: avgChange,
          bullish: (bullishCount / activeInstruments.length) * 100,
          bearish: (bearishCount / activeInstruments.length) * 100,
          neutral: (neutralCount / activeInstruments.length) * 100
        },
        topMovers: {
          gainers,
          losers
        },
        sectors
      },
      news,
      insights,
      documents,
      backgroundAgentStatus: agentStatus,
      metadata: {
        totalInstruments: activeInstruments.length,
        lastUpdated: new Date().toISOString(),
        dataFreshness: {
          marketData: 'real-time',
          documents: '< 7 days',
          insights: '< 24 hours',
          news: '< 24 hours'
        }
      }
    }

    // Cache the data for 5 minutes
    try {
      await cache.set(cacheKey, {
        ...intelligenceData,
        timestamp: new Date().toISOString()
      }, 300) // 5 minutes
    } catch (cacheError) {
      logger.warn('Failed to cache intelligence data:', cacheError)
    }

    res.json({
      success: true,
      data: intelligenceData,
      cached: false
    })

  } catch (error) {
    logger.error('Failed to fetch market intelligence:', error)
    throw new ApiError('Failed to fetch market intelligence data', 500)
  }
}))

// GET /api/market/overview - Quick market overview for dashboard
router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get basic market stats
    const totalInstruments = await prisma.instrument.count({ where: { isActive: true } })
    const recentMarketData = await prisma.marketData.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        instrument: true
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    })

    const gainers = recentMarketData.filter((d: any) => d.changePercent > 0).length
    const losers = recentMarketData.filter((d: any) => d.changePercent < 0).length
    const avgVolume = recentMarketData.reduce((sum: number, d: any) => sum + Number(d.volume), 0) / recentMarketData.length

    res.json({
      success: true,
      data: {
        totalInstruments,
        gainers,
        losers,
        avgVolume,
        marketStatus: 'OPEN', // This would be calculated based on market hours
        lastUpdated: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Failed to fetch market overview:', error)
    throw new ApiError('Failed to fetch market overview', 500)
  }
}))

// GET /api/market/news/:symbol - Get news for specific symbol
router.get('/news/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    throw new ApiError('Symbol parameter is required', 400)
  }
  
  try {
    const instrument = await prisma.instrument.findFirst({
      where: { symbol: symbol.toUpperCase() }
    })

    if (!instrument) {
      throw new ApiError(`Instrument ${symbol} not found`, 404)
    }

    const newsResults = await prisma.searchResult.findMany({
      where: {
        instrumentId: instrument.id,
        contentType: { in: ['news', 'article'] },
        discoveredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: { discoveredAt: 'desc' },
      take: 20
    })

    const formattedNews = newsResults.map((result: any) => ({
      id: result.id,
      title: result.title,
      summary: result.snippet || '',
      url: result.url,
      source: result.domain || result.provider,
      publishedAt: result.publishedDate?.toISOString() || result.discoveredAt.toISOString(),
      sentiment: result.sentiment ? (result.sentiment > 0.1 ? 'POSITIVE' : result.sentiment < -0.1 ? 'NEGATIVE' : 'NEUTRAL') : 'NEUTRAL',
      relevance: result.relevanceScore || 0.5,
      topics: result.topics || []
    }))

    res.json({
      success: true,
      data: formattedNews,
      symbol: symbol.toUpperCase(),
      total: formattedNews.length
    })

  } catch (error) {
    logger.error(`Failed to fetch news for ${symbol}:`, error)
    throw new ApiError(`Failed to fetch news for ${symbol}`, 500)
  }
}))

// GET /api/market/sentiment/:symbol - Get sentiment analysis for symbol
router.get('/sentiment/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    throw new ApiError('Symbol parameter is required', 400)
  }
  
  try {
    const instrument = await prisma.instrument.findFirst({
      where: { symbol: symbol.toUpperCase() }
    })

    if (!instrument) {
      throw new ApiError(`Instrument ${symbol} not found`, 404)
    }

    const sentimentData = await prisma.searchResult.findMany({
      where: {
        instrumentId: instrument.id,
        sentiment: { not: null },
        discoveredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: { discoveredAt: 'desc' }
    })

    const sentiments = sentimentData.map((d: any) => d.sentiment).filter((s: any) => s !== null) as number[]
    const avgSentiment = sentiments.length > 0 ? sentiments.reduce((sum: number, s: number) => sum + s, 0) / sentiments.length : 0
    
    const positive = sentiments.filter((s: number) => s > 0.1).length
    const negative = sentiments.filter((s: number) => s < -0.1).length
    const neutral = sentiments.length - positive - negative

    res.json({
      success: true,
      data: {
        overall: avgSentiment,
        distribution: {
          positive: (positive / sentiments.length) * 100,
          negative: (negative / sentiments.length) * 100,
          neutral: (neutral / sentiments.length) * 100
        },
        totalSources: sentiments.length,
        lastUpdated: new Date().toISOString()
      },
      symbol: symbol.toUpperCase()
    })

  } catch (error) {
    logger.error(`Failed to fetch sentiment for ${symbol}:`, error)
    throw new ApiError(`Failed to fetch sentiment for ${symbol}`, 500)
  }
}))

export default router 