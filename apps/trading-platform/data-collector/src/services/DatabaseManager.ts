import { prisma } from '@yobi/database/src/prisma'
import { cache } from '@yobi/database/src/redis'
import { createLogger } from '../utils/logger'
import { Exchange } from '@yobi/shared-types'

const logger = createLogger('database-manager')

// Helper function to detect exchange and currency from symbol
function getExchangeAndCurrency(symbol: string): { exchange: Exchange, currency: string } {
  const nseSymbols = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK',
    'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'ASIANPAINT', 'AXISBANK', 'MARUTI', 'HCLTECH',
    'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'ONGC', 'TATAMOTORS', 'SUNPHARMA',
    'NTPC', 'POWERGRID', 'M&M', 'TECHM', 'TITAN', 'COALINDIA', 'INDUSINDBK', 'ADANIPORTS',
    'BAJAJFINSV', 'HDFCLIFE', 'SBILIFE', 'BRITANNIA', 'DIVISLAB', 'DRREDDY', 'EICHERMOT',
    'BAJAJ-AUTO', 'HEROMOTOCO', 'HINDALCO', 'CIPLA', 'GRASIM', 'TATASTEEL', 'UPL',
    'JSWSTEEL', 'APOLLOHOSP', 'TATACONSUM', 'ADANIENT', 'LTIM', 'BPCL', 'INDIGO'
  ]
  
  const isNse = nseSymbols.includes(symbol.toUpperCase())
  return {
    exchange: isNse ? Exchange.NSE : Exchange.NASDAQ,
    currency: isNse ? 'INR' : 'USD'
  }
}

interface Quote {
  symbol: string
  name?: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: string
  exchange?: string
  currency?: string
  sector?: string
  industry?: string
}

interface HistoricalDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export class DatabaseManager {
  async storeQuote(symbol: string, quote: Quote): Promise<void> {
    try {
      const exchange = quote.exchange || 'NASDAQ'
      const currency = quote.currency || 'USD'
      
      // First, ensure the instrument exists
      await this.ensureInstrument(symbol, exchange as Exchange, currency, quote.name, quote.sector, quote.industry)

      // Store market data in PostgreSQL
      await prisma.marketData.create({
        data: {
          instrument: {
            connect: { 
              symbol_exchange: {
                symbol: symbol.toUpperCase(),
                exchange: exchange as Exchange
              }
            }
          },
          timestamp: new Date(quote.timestamp),
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.price,
          previousClose: quote.previousClose,
          volume: BigInt(quote.volume),
          value: quote.price * quote.volume,
          trades: 0, // Not available from quote data
          vwap: quote.price, // Use current price as vwap approximation
          change: quote.change,
          changePercent: quote.changePercent,
          dayHigh: quote.high,
          dayLow: quote.low,
          weekHigh52: null, // Not available from quote data
          weekLow52: null // Not available from quote data
        }
      })

      // Cache the latest quote in Redis for fast access
      await cache.setMarketData(symbol, quote, 300) // 5 minute cache

      logger.debug(`Stored quote for ${symbol}: $${quote.price}`)
    } catch (error) {
      logger.error(`Failed to store quote for ${symbol}:`, error)
      throw error
    }
  }

  async storeHistoricalData(symbol: string, data: HistoricalDataPoint[]): Promise<void> {
    try {
      const { exchange, currency } = getExchangeAndCurrency(symbol)
      
      // Ensure the instrument exists
      await this.ensureInstrument(symbol, exchange, currency)

      // Batch insert historical data
      const marketDataRecords = data.map(point => ({
        instrumentId: symbol.toUpperCase(), // Will be resolved by Prisma
        timestamp: new Date(point.date),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        previousClose: 0, // Not available in historical data
        volume: point.volume,
        value: point.close * point.volume,
        trades: 0,
        bid: 0,
        ask: 0,
        bidSize: 0,
        askSize: 0,
        lastPrice: point.close,
        lastSize: 0,
        change: 0, // Would need to calculate from previous day
        changePercent: 0,
        dayHigh: point.high,
        dayLow: point.low,
        weekHigh52: 0,
        weekLow52: 0,
        vwap: point.close
      }))

      // Store in PostgreSQL - using create instead of upsert since there's no unique constraint
      for (const record of marketDataRecords) {
        // Check if record already exists to avoid duplicates
        const existing = await prisma.marketData.findFirst({
          where: {
            instrumentId: symbol.toUpperCase(),
            timestamp: record.timestamp
          }
        })

                 if (!existing) {
           const { instrumentId, ...recordData } = record
           await prisma.marketData.create({
             data: {
               ...recordData,
               instrument: {
                 connect: { 
                   symbol_exchange: {
                     symbol: symbol.toUpperCase(),
                     exchange: exchange  // Use detected exchange
                   }
                 }
               }
             }
           })
        }
      }

      logger.info(`Stored ${data.length} historical data points for ${symbol}`)
    } catch (error) {
      logger.error(`Failed to store historical data for ${symbol}:`, error)
      throw error
    }
  }

  async storeFundamentalData(symbol: string, data: any): Promise<void> {
    try {
      const { exchange, currency } = getExchangeAndCurrency(symbol)
      
      // Ensure the instrument exists
      await this.ensureInstrument(symbol, exchange, currency)

      // Store fundamental data with corrected schema
      await prisma.fundamentalData.upsert({
        where: {
          instrumentId: symbol.toUpperCase()
        },
        update: {
          marketCap: data.marketCap || null,
          peRatio: data.peRatio || null,
          pbRatio: data.pbRatio || null,
          debtToEquity: data.debtToEquity || null,
          roe: data.roe || null,
          eps: data.eps || null,
          revenue: data.revenue || null,
          revenueGrowth: data.revenueGrowth || null,
          netMargin: data.netMargin || null,
          dividendYield: data.dividendYield || null,
          beta: data.beta || null,
          data: data, // Store all data as JSON
          lastUpdated: new Date()
        },
        create: {
          instrument: {
            connect: { 
              symbol_exchange: {
                symbol: symbol.toUpperCase(),
                exchange: exchange
              }
            }
          },
          marketCap: data.marketCap || null,
          peRatio: data.peRatio || null,
          pbRatio: data.pbRatio || null,
          debtToEquity: data.debtToEquity || null,
          roe: data.roe || null,
          eps: data.eps || null,
          revenue: data.revenue || null,
          revenueGrowth: data.revenueGrowth || null,
          netMargin: data.netMargin || null,
          dividendYield: data.dividendYield || null,
          beta: data.beta || null,
          data: data, // Store all data as JSON
          lastUpdated: new Date()
        }
      })

      logger.info(`Stored fundamental data for ${symbol}`)
    } catch (error) {
      logger.error(`Failed to store fundamental data for ${symbol}:`, error)
      throw error
    }
  }

  private async ensureInstrument(symbol: string, exchange: Exchange, currency: string, name?: string, sector?: string, industry?: string): Promise<void> {
    try {
      await prisma.instrument.upsert({
        where: { 
          symbol_exchange: {
            symbol: symbol.toUpperCase(),
            exchange: exchange
          }
        },
        update: {
          ...(name && { name }),
          ...(sector && { sector }),
          ...(industry && { industry }),
          currency,
          updatedAt: new Date()
        },
        create: {
          symbol: symbol.toUpperCase(),
          name: name || symbol.toUpperCase(),
          assetClass: 'STOCK', // Default, could be improved with detection
          exchange: exchange,
          sector: sector || 'Unknown',
          industry: industry || 'Unknown',
          currency: currency,
          lotSize: 1,
          tickSize: 0.01,
          isActive: true
        }
      })
    } catch (error) {
      logger.error('Failed to ensure instrument exists', { 
        symbol, 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  async getLatestQuote(symbol: string): Promise<any> {
    try {
      // Try cache first
      const cached = await cache.getMarketData(symbol)
      if (cached) {
        return cached
      }

      // Fallback to database
      const marketData = await prisma.marketData.findFirst({
        where: {
          instrument: { symbol: symbol.toUpperCase() }
        },
        orderBy: { timestamp: 'desc' },
        include: {
          instrument: true
        }
      })

      return marketData
    } catch (error) {
      logger.error(`Failed to get latest quote for ${symbol}:`, error)
      throw error
    }
  }

  async getHistoricalData(symbol: string, days: number = 365): Promise<any[]> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const data = await prisma.marketData.findMany({
        where: {
          instrument: { symbol: symbol.toUpperCase() },
          timestamp: {
            gte: startDate
          }
        },
        orderBy: { timestamp: 'asc' },
        select: {
          timestamp: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true
        }
      })

      return data
    } catch (error) {
      logger.error(`Failed to get historical data for ${symbol}:`, error)
      throw error
    }
  }

  async getStatus(): Promise<any> {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`
      
      // Test Redis connection
      await cache.set('health_check', 'ok', 10)
      const redisStatus = await cache.get('health_check')

      return {
        postgres: 'online',
        redis: redisStatus === 'ok' ? 'online' : 'offline',
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      return {
        postgres: 'offline',
        redis: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      }
    }
  }

  async getDataCoverage(): Promise<any> {
    try {
      const instrumentCount = await prisma.instrument.count()
      const marketDataCount = await prisma.marketData.count()
      const fundamentalDataCount = await prisma.fundamentalData.count()
      
      const latestMarketData = await prisma.marketData.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
      })

      return {
        instruments: instrumentCount,
        marketDataPoints: marketDataCount,
        fundamentalDataPoints: fundamentalDataCount,
        latestDataTimestamp: latestMarketData?.timestamp || null,
        coverage: {
          hasRecentData: latestMarketData ? 
            (Date.now() - latestMarketData.timestamp.getTime()) < 24 * 60 * 60 * 1000 : false
        }
      }
    } catch (error) {
      logger.error('Failed to get data coverage:', error)
      throw error
    }
  }
} 