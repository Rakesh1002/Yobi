import express, { Router } from 'express'
import { marketDataService } from '../services/market.service'
import { rankingsService } from '../services/rankings.service'
import { prisma } from '@yobi/database'
import { cache } from '@yobi/database/src/redis'
import authRoutes from './auth.routes'
import marketRoutes from './market.routes'
import portfolioRoutes from './portfolio.routes'
import analysisRoutes from './analysis.routes'
import rankingsRoutes from './rankings.routes'
import instrumentsRoutes from './instruments.routes'
import currencyRoutes from './currency.routes'

const router: express.Router = Router()

// Health check endpoint with service status
router.get('/health', async (req, res) => {
  try {
    const [marketStatus, rankingStats] = await Promise.allSettled([
      marketDataService.getServiceStatus(),
      rankingsService.getRankingStats()
    ])

    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        apiGateway: 'healthy',
        market: marketStatus.status === 'fulfilled' ? marketStatus.value : { status: 'error', error: marketStatus.reason },
        rankings: rankingStats.status === 'fulfilled' ? rankingStats.value : { status: 'error', error: rankingStats.reason }
      },
      version: '1.0.0'
    }

    // Determine overall health
    const isHealthy = marketStatus.status === 'fulfilled' && 
                     rankingStats.status === 'fulfilled' &&
                     (marketStatus.value?.status === 'healthy' || marketStatus.value?.database === 'connected')

    res.status(isHealthy ? 200 : 503).json(health)
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      version: '1.0.0'
    })
  }
})

// Database test endpoint
router.get('/db-test', async (req, res) => {
  try {
    const instruments = await prisma.instrument.count()
    const marketData = await prisma.marketData.count()
    const recentData = await prisma.marketData.count({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
    
    res.json({
      status: 'OK',
      database: 'connected',
      counts: {
        instruments,
        marketData,
        recentData
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Exchange distribution debug endpoint
router.get('/debug/exchanges', async (req, res) => {
  try {
    // Get exchange distribution
    const exchangeDistribution = await prisma.instrument.groupBy({
      by: ['exchange'],
      _count: {
        _all: true
      }
    })

    // Get sample instruments by exchange
    const nasdaqSamples = await prisma.instrument.findMany({
      where: { exchange: 'NASDAQ' },
      select: { symbol: true, name: true, sector: true, currency: true },
      take: 5
    })

    const nseSamples = await prisma.instrument.findMany({
      where: { exchange: 'NSE' },
      select: { symbol: true, name: true, sector: true, currency: true },
      take: 5
    })

    // Get instruments with recent market data by exchange
    const recentByExchange = await prisma.instrument.groupBy({
      by: ['exchange'],
      where: {
        marketData: {
          some: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }
      },
      _count: {
        _all: true
      }
    })

    res.json({
      exchangeDistribution,
      recentByExchange,
      samples: {
        nasdaq: nasdaqSamples,
        nse: nseSamples
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Fix exchange assignments without deleting (avoids foreign key issues)
router.post('/debug/fix-exchanges-safe', async (req, res) => {
  try {
    // Define proper exchange assignments
    const nseSymbols = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK',
      'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'ASIANPAINT', 'AXISBANK', 'MARUTI', 'HCLTECH',
      'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'ONGC', 'TATAMOTORS', 'SUNPHARMA',
      'NTPC', 'POWERGRID', 'M&M', 'TECHM', 'TITAN', 'COALINDIA', 'INDUSINDBK', 'ADANIPORTS',
      'BAJAJFINSV', 'HDFCLIFE', 'SBILIFE', 'BRITANNIA', 'DIVISLAB', 'DRREDDY', 'EICHERMOT',
      'BAJAJ-AUTO', 'HEROMOTOCO', 'HINDALCO', 'CIPLA', 'GRASIM', 'TATASTEEL', 'UPL',
      'JSWSTEEL', 'APOLLOHOSP', 'TATACONSUM', 'ADANIENT', 'LTIM', 'BPCL', 'INDIGO',
      'ADANIGREEN', 'AMBUJACEM', 'BANDHANBNK', 'BIOCON', 'DIXON'
    ]

    const usSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
      'AMD', 'INTC', 'ORCL', 'CRM', 'ADBE', 'QCOM', 'IBM', 'PYPL', 'CSCO', 'AVGO',
      'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'SCHW', 'BLK', 'SPGI',
      'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN'
    ]

    const results = {
      fixedToNSE: 0,
      fixedToNASDAQ: 0,
      clearedCache: 0,
      errors: [] as string[]
    }

    // Step 1: Fix NSE symbols - ensure they're assigned to NSE with INR currency
    for (const symbol of nseSymbols) {
      try {
        const updated = await prisma.instrument.updateMany({
          where: {
            symbol: symbol.toUpperCase(),
            OR: [
              { exchange: { not: 'NSE' } },
              { currency: { not: 'INR' } }
            ]
          },
          data: {
            exchange: 'NSE',
            currency: 'INR',
            sector: 'Indian Stock'
          }
        })
        results.fixedToNSE += updated.count
      } catch (error) {
        results.errors.push(`Failed to fix ${symbol} to NSE: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Step 2: Fix US symbols - ensure they're assigned to NASDAQ with USD currency  
    for (const symbol of usSymbols) {
      try {
        const updated = await prisma.instrument.updateMany({
          where: {
            symbol: symbol.toUpperCase(),
            OR: [
              { exchange: 'NSE' },
              { currency: { not: 'USD' } }
            ]
          },
          data: {
            exchange: 'NASDAQ',
            currency: 'USD', 
            sector: 'US Stock'
          }
        })
        results.fixedToNASDAQ += updated.count
      } catch (error) {
        results.errors.push(`Failed to fix ${symbol} to NASDAQ: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Step 3: Clear all rankings cache
    try {
      const cacheKeys = ['rankings:all', 'rankings:NSE', 'rankings:NASDAQ', 'rankings:']
      for (const key of cacheKeys) {
        await cache.delete(key)
        results.clearedCache++
      }
    } catch (error) {
      results.errors.push(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    res.json({
      success: true,
      results,
      message: `Fixed ${results.fixedToNSE} symbols to NSE, ${results.fixedToNASDAQ} symbols to NASDAQ/USD`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Aggressive database cleanup - delete all wrong assignments
router.post('/debug/reset-exchanges', async (req, res) => {
  try {
    // Define proper exchange assignments
    const nseSymbols = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK',
      'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'ASIANPAINT', 'AXISBANK', 'MARUTI', 'HCLTECH',
      'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'ONGC', 'TATAMOTORS', 'SUNPHARMA',
      'NTPC', 'POWERGRID', 'M&M', 'TECHM', 'TITAN', 'COALINDIA', 'INDUSINDBK', 'ADANIPORTS',
      'BAJAJFINSV', 'HDFCLIFE', 'SBILIFE', 'BRITANNIA', 'DIVISLAB', 'DRREDDY', 'EICHERMOT',
      'BAJAJ-AUTO', 'HEROMOTOCO', 'HINDALCO', 'CIPLA', 'GRASIM', 'TATASTEEL', 'UPL',
      'JSWSTEEL', 'APOLLOHOSP', 'TATACONSUM', 'ADANIENT', 'LTIM', 'BPCL', 'INDIGO',
      'ADANIGREEN', 'AMBUJACEM', 'BANDHANBNK', 'BIOCON', 'DIXON'
    ]

    const usSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
      'AMD', 'INTC', 'ORCL', 'CRM', 'ADBE', 'QCOM', 'IBM', 'PYPL', 'CSCO', 'AVGO',
      'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'SCHW', 'BLK', 'SPGI',
      'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN'
    ]

    const results = {
      deletedWrongNSE: 0,
      deletedWrongNASDAQ: 0,
      clearedCache: 0,
      errors: [] as string[]
    }

    // Step 1: Delete ALL US symbols from NSE (they should never be there)
    for (const symbol of usSymbols) {
      try {
        const deleted = await prisma.instrument.deleteMany({
          where: {
            symbol: symbol.toUpperCase(),
            exchange: 'NSE'
          }
        })
        results.deletedWrongNSE += deleted.count
      } catch (error) {
        results.errors.push(`Failed to delete ${symbol} from NSE: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Step 2: Delete ALL Indian symbols from NASDAQ/NYSE (they should never be there)
    for (const symbol of nseSymbols) {
      try {
        const deleted = await prisma.instrument.deleteMany({
          where: {
            symbol: symbol.toUpperCase(),
            exchange: { in: ['NASDAQ', 'NYSE'] }
          }
        })
        results.deletedWrongNASDAQ += deleted.count
      } catch (error) {
        results.errors.push(`Failed to delete ${symbol} from NASDAQ: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Step 3: Clear all rankings cache
    try {
      const cacheKeys = ['rankings:all', 'rankings:NSE', 'rankings:NASDAQ', 'rankings:']
      for (const key of cacheKeys) {
        await cache.delete(key)
        results.clearedCache++
      }
    } catch (error) {
      results.errors.push(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    res.json({
      success: true,
      results,
      message: `Reset complete: Removed ${results.deletedWrongNSE} US stocks from NSE, ${results.deletedWrongNASDAQ} Indian stocks from NASDAQ`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Force refresh rankings cache
router.post('/debug/refresh-cache', async (req, res) => {
  try {
    // Clear rankings cache - using delete for specific keys
    const cacheKeys = ['rankings:all', 'rankings:NSE', 'rankings:NASDAQ']
    for (const key of cacheKeys) {
      await cache.delete(key)
    }
    
    res.json({
      success: true,
      message: 'Rankings cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Targeted fix for specific symbol misassignments
router.post('/debug/fix-symbol-exchanges', async (req, res) => {
  try {
    // Known US symbols that should NEVER be in NSE
    const usSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
      'AMD', 'INTC', 'ORCL', 'CRM', 'ADBE', 'QCOM', 'IBM', 'PYPL', 'CSCO'
    ]

    // Known NSE symbols
    const nseSymbols = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK',
      'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'ASIANPAINT', 'AXISBANK', 'MARUTI', 'HCLTECH',
      'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'ONGC', 'TATAMOTORS', 'SUNPHARMA'
    ]

    const results = {
      fixedUSSymbols: 0,
      fixedNSESymbols: 0,
      errors: [] as string[]
    }

    // Fix US symbols - delete from NSE if they exist there
    for (const symbol of usSymbols) {
      try {
        // Delete incorrect NSE entry for US symbols
        const deletedNSE = await prisma.instrument.deleteMany({
          where: {
            symbol: symbol.toUpperCase(),
            exchange: 'NSE'
          }
        })
        if (deletedNSE.count > 0) {
          results.fixedUSSymbols += deletedNSE.count
        }

        // Ensure US symbol exists correctly in NASDAQ
        await prisma.instrument.upsert({
          where: {
            symbol_exchange: {
              symbol: symbol.toUpperCase(),
              exchange: 'NASDAQ'
            }
          },
          update: {
            currency: 'USD',
            sector: 'US Stock'
          },
          create: {
            symbol: symbol.toUpperCase(),
            name: `${symbol} Inc.`,
            exchange: 'NASDAQ',
            currency: 'USD',
            sector: 'US Stock',
            isActive: true
          }
        })
      } catch (error) {
        results.errors.push(`Failed to fix US symbol ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Fix NSE symbols - ensure they're correctly in NSE with INR
    for (const symbol of nseSymbols) {
      try {
        await prisma.instrument.upsert({
          where: {
            symbol_exchange: {
              symbol: symbol.toUpperCase(),
              exchange: 'NSE'
            }
          },
          update: {
            currency: 'INR',
            sector: 'Indian Stock'
          },
          create: {
            symbol: symbol.toUpperCase(),
            name: `${symbol} Ltd.`,
            exchange: 'NSE',
            currency: 'INR',
            sector: 'Indian Stock',
            isActive: true
          }
        })
        results.fixedNSESymbols++
      } catch (error) {
        results.errors.push(`Failed to fix NSE symbol ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Clear cache after fixing
    try {
      const cacheKeys = ['rankings:all', 'rankings:NSE', 'rankings:NASDAQ']
      for (const key of cacheKeys) {
        await cache.delete(key)
      }
    } catch (error) {
      results.errors.push(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    res.json({
      success: true,
      results,
      message: `Fixed ${results.fixedUSSymbols} US symbols, ensured ${results.fixedNSESymbols} NSE symbols are correct`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Simple exchange correction - update only, no delete/create
router.post('/debug/simple-exchange-fix', async (req, res) => {
  try {
    // Known US symbols that should be NASDAQ
    const usSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'
    ]

    const results = {
      updatedToNASDAQ: 0,
      errors: [] as string[]
    }

    // Update US symbols to be correctly assigned to NASDAQ with USD
    for (const symbol of usSymbols) {
      try {
        const updated = await prisma.instrument.updateMany({
          where: {
            symbol: symbol.toUpperCase(),
            exchange: 'NSE' // Find US stocks incorrectly in NSE
          },
          data: {
            exchange: 'NASDAQ',
            currency: 'USD',
            sector: 'US Stock'
          }
        })
        results.updatedToNASDAQ += updated.count
      } catch (error) {
        results.errors.push(`Failed to update ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Clear cache after fixing
    try {
      const cacheKeys = ['rankings:all', 'rankings:NSE', 'rankings:NASDAQ']
      for (const key of cacheKeys) {
        await cache.delete(key)
      }
    } catch (error) {
      results.errors.push(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    res.json({
      success: true,
      results,
      message: `Updated ${results.updatedToNASDAQ} US symbols from NSE to NASDAQ`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Remove duplicate US symbols from NSE (with cascade delete)
router.post('/debug/remove-us-from-nse', async (req, res) => {
  try {
    // Known US symbols that should NOT be in NSE
    const usSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
      'AMD', 'INTC', 'ORCL', 'CRM', 'ADBE', 'QCOM', 'IBM', 'PYPL', 'CSCO'
    ]

    const results = {
      deletedMarketData: 0,
      deletedInstruments: 0,
      errors: [] as string[]
    }

    // Delete US symbols from NSE only (keep them in NASDAQ)
    for (const symbol of usSymbols) {
      try {
        // First get the instrument ID for this symbol in NSE
        const nseInstrument = await prisma.instrument.findFirst({
          where: {
            symbol: symbol.toUpperCase(),
            exchange: 'NSE'
          },
          select: { id: true }
        })

        if (nseInstrument) {
          // Delete related market data first
          const deletedMarketData = await prisma.marketData.deleteMany({
            where: {
              instrumentId: nseInstrument.id
            }
          })
          results.deletedMarketData += deletedMarketData.count

          // Delete related fundamentals
          await prisma.fundamentalData.deleteMany({
            where: {
              instrumentId: nseInstrument.id
            }
          })

          // Delete related recommendations
          await prisma.recommendation.deleteMany({
            where: {
              instrumentId: nseInstrument.id
            }
          })

          // Now delete the instrument itself
          const deletedInstrument = await prisma.instrument.delete({
            where: {
              id: nseInstrument.id
            }
          })
          results.deletedInstruments++
        }
      } catch (error) {
        results.errors.push(`Failed to remove ${symbol} from NSE: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Clear cache after fixing
    try {
      const cacheKeys = ['rankings:all', 'rankings:NSE', 'rankings:NASDAQ']
      for (const key of cacheKeys) {
        await cache.delete(key)
      }
    } catch (error) {
      results.errors.push(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    res.json({
      success: true,
      results,
      message: `Removed ${results.deletedInstruments} US symbols from NSE, deleted ${results.deletedMarketData} market data records`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Remove ALL USD instruments from NSE (NSE should only have INR)
router.post('/debug/remove-all-usd-from-nse', async (req, res) => {
  try {
    const results = {
      deletedMarketData: 0,
      deletedInstruments: 0,
      errors: [] as string[]
    }

    // Find all USD currency instruments in NSE (these are incorrect)
    const usdInstrumentsInNSE = await prisma.instrument.findMany({
      where: {
        exchange: 'NSE',
        currency: 'USD'
      },
      select: { id: true, symbol: true }
    })

    console.log(`Found ${usdInstrumentsInNSE.length} USD instruments incorrectly in NSE`)

    // Delete each USD instrument from NSE
    for (const instrument of usdInstrumentsInNSE) {
      try {
        // Delete related market data first
        const deletedMarketData = await prisma.marketData.deleteMany({
          where: {
            instrumentId: instrument.id
          }
        })
        results.deletedMarketData += deletedMarketData.count

        // Delete related fundamentals
        await prisma.fundamentalData.deleteMany({
          where: {
            instrumentId: instrument.id
          }
        })

        // Delete related recommendations
        await prisma.recommendation.deleteMany({
          where: {
            instrumentId: instrument.id
          }
        })

        // Now delete the instrument itself
        await prisma.instrument.delete({
          where: {
            id: instrument.id
          }
        })
        results.deletedInstruments++
        console.log(`Deleted ${instrument.symbol} from NSE`)
      } catch (error) {
        results.errors.push(`Failed to remove ${instrument.symbol} from NSE: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Clear cache after fixing
    try {
      const cacheKeys = ['rankings:all', 'rankings:NSE', 'rankings:NASDAQ']
      for (const key of cacheKeys) {
        await cache.delete(key)
      }
    } catch (error) {
      results.errors.push(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    res.json({
      success: true,
      results,
      message: `Removed ${results.deletedInstruments} USD instruments from NSE, deleted ${results.deletedMarketData} market data records`,
      foundUSDInstruments: usdInstrumentsInNSE.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Debug rankings service NSE filtering
router.get('/debug/nse-rankings', async (req, res) => {
  try {
    // Test the exact same query that /api/rankings would use for NSE
    const filters = { exchange: 'NSE', limit: '5' }
    const cacheKey = `rankings:${JSON.stringify(filters)}`
    
    // Check what's in cache
    const cachedData = await cache.get(cacheKey)
    
    // Get fresh data from database by calling the rankings service directly  
    const { rankingsService } = await import('../services/rankings.service')
    const freshData = await rankingsService.getRankings(filters)
    
    res.json({
      cacheKey,
      cachedData: cachedData ? 'EXISTS' : 'EMPTY',
      freshDataCount: freshData.rankings?.length || 0,
      freshDataSample: freshData.rankings?.slice(0, 3).map(r => ({
        symbol: r.symbol,
        exchange: r.exchange,
        currency: r.currency
      })) || [],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Mount routes
router.use('/auth', authRoutes)
router.use('/market', marketRoutes)
router.use('/portfolio', portfolioRoutes)
router.use('/analysis', analysisRoutes)
router.use('/rankings', rankingsRoutes)
router.use('/instruments', instrumentsRoutes)
router.use('/currency', currencyRoutes)

export default router 