import { prisma } from '@yobi/database'
import { cache } from '@yobi/database/src/redis'
import { ApiError } from '../middleware/error'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'market-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

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
}

interface HistoricalDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface HistoricalData {
  symbol: string
  period: string
  interval: string
  data: HistoricalDataPoint[]
}

export class MarketDataService {
  private dataCollectorUrl: string
  private cacheExpiry = {
    quote: 60, // 1 minute
    historical: 300, // 5 minutes
    search: 3600, // 1 hour
  }

  constructor() {
    // URL of our data collection service
    this.dataCollectorUrl = process.env.DATA_COLLECTOR_URL || 'http://localhost:3004'
  }

  // Main quote fetching method - database first, then fallback
  async getQuote(symbol: string): Promise<Quote> {
    const cacheKey = `quote:${symbol.toUpperCase()}`
    
    try {
      // 1. Check Redis cache first
      const cached = await cache.getMarketData(symbol.toUpperCase())
      if (cached) {
        logger.info(`Quote cache hit for ${symbol}`)
        return this.formatQuote(cached, symbol)
      }

      // 2. Check database for recent data (within last 5 minutes)
      const dbQuote = await this.getQuoteFromDatabase(symbol)
      if (dbQuote) {
        logger.info(`Quote from database for ${symbol}`)
        // Cache the result
        await cache.setMarketData(symbol.toUpperCase(), dbQuote, this.cacheExpiry.quote)
        return dbQuote
      }

      // 3. Fallback: trigger data collection and return best available data
      logger.warn(`No recent quote data for ${symbol}, triggering collection`)
      await this.triggerDataCollection([symbol])
      
      // Try database again after triggering collection
      const retryDbQuote = await this.getQuoteFromDatabase(symbol, false) // Don't require recent
      if (retryDbQuote) {
        return retryDbQuote
      }

      // 4. Final fallback: return a basic quote if we have any market data
      throw new ApiError(`No quote data available for ${symbol}`, 404)

    } catch (error) {
      logger.error(`Failed to fetch quote for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(`Unable to fetch quote for ${symbol}`, 500)
    }
  }

  // Get quote from our database
  private async getQuoteFromDatabase(symbol: string, requireRecent: boolean = true): Promise<Quote | null> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      
      const marketData = await prisma.marketData.findFirst({
        where: {
          instrument: { symbol: symbol.toUpperCase() },
          ...(requireRecent && { timestamp: { gte: fiveMinutesAgo } })
        },
        orderBy: { timestamp: 'desc' },
        include: {
          instrument: true
        }
      })

      if (!marketData) {
        return null
      }

      return {
        symbol: marketData.instrument.symbol,
        name: marketData.instrument.name,
        price: Number(marketData.lastPrice),
        change: Number(marketData.change),
        changePercent: Number(marketData.changePercent),
        volume: Number(marketData.volume),
        high: Number(marketData.dayHigh),
        low: Number(marketData.dayLow),
        open: Number(marketData.open),
        previousClose: Number(marketData.previousClose),
        timestamp: marketData.timestamp.toISOString()
      }
    } catch (error) {
      logger.error(`Database query failed for ${symbol}:`, error)
      return null
    }
  }

  // Historical data fetching - database first
  async getHistoricalData(symbol: string, period: string = '1y', interval: string = '1d'): Promise<HistoricalData> {
    const cacheKey = `historical:${symbol.toUpperCase()}:${period}:${interval}`
    
    try {
             // 1. Check cache first
       const cached = await cache.get<HistoricalData>(cacheKey)
       if (cached) {
         logger.info(`Historical data cache hit for ${symbol}`)
         return cached
       }

      // 2. Get from database
      const dbData = await this.getHistoricalFromDatabase(symbol, period)
      if (dbData && dbData.data.length > 0) {
        logger.info(`Historical data from database for ${symbol}`)
        const result = {
          symbol: symbol.toUpperCase(),
          period,
          interval,
          data: dbData.data
        }
        
        // Cache the result
        await cache.set(cacheKey, result, this.cacheExpiry.historical)
        return result
      }

      // 3. Fallback: trigger historical data collection
      logger.warn(`No historical data for ${symbol}, triggering collection`)
      await this.triggerHistoricalCollection([symbol], period)
      
      // Try database again
      const retryDbData = await this.getHistoricalFromDatabase(symbol, period)
      if (retryDbData && retryDbData.data.length > 0) {
        return {
          symbol: symbol.toUpperCase(),
          period,
          interval,
          data: retryDbData.data
        }
      }

      throw new ApiError(`No historical data available for ${symbol}`, 404)

    } catch (error) {
      logger.error(`Failed to fetch historical data for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(`Unable to fetch historical data for ${symbol}`, 500)
    }
  }

  // Get historical data from database
  private async getHistoricalFromDatabase(symbol: string, period: string): Promise<{ data: HistoricalDataPoint[] } | null> {
    try {
      const days = this.getPeriodInDays(period)
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const marketData = await prisma.marketData.findMany({
        where: {
          instrument: { symbol: symbol.toUpperCase() },
          timestamp: { gte: startDate }
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

             const data: HistoricalDataPoint[] = marketData.map((item: any) => ({
         date: item.timestamp.toISOString().split('T')[0],
         open: Number(item.open),
         high: Number(item.high),
         low: Number(item.low),
         close: Number(item.close),
         volume: Number(item.volume)
       }))

      return { data }
    } catch (error) {
      logger.error(`Database historical query failed for ${symbol}:`, error)
      return null
    }
  }

  // Search instruments in database first
  async searchInstruments(query: string, limit: number = 10): Promise<any[]> {
    const cacheKey = `search:${query.toLowerCase()}:${limit}`
    
    try {
             // Check cache first
       const cached = await cache.get<any[]>(cacheKey)
       if (cached) {
         logger.info(`Search cache hit for "${query}"`)
         return cached
       }

      // Search in our database first
      const dbResults = await this.searchInDatabase(query, limit)
      
      if (dbResults.length > 0) {
        logger.info(`Search results from database for "${query}": ${dbResults.length} results`)
        await cache.set(cacheKey, dbResults, this.cacheExpiry.search)
        return dbResults
      }

      // If no results in database, return empty array
      // In a real implementation, you might want to search external APIs here
      logger.info(`No search results found for "${query}"`)
      return []

    } catch (error) {
      logger.error(`Failed to search instruments for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw new ApiError(`Unable to search instruments`, 500)
    }
  }

  // Search in our database
  private async searchInDatabase(query: string, limit: number): Promise<any[]> {
    try {
      const instruments = await prisma.instrument.findMany({
        where: {
          OR: [
            { symbol: { contains: query.toUpperCase() } },
            { name: { contains: query, mode: 'insensitive' } }
          ],
          isActive: true
        },
        take: limit,
        orderBy: [
          { symbol: 'asc' }
        ]
      })

             return instruments.map((instrument: any) => ({
         symbol: instrument.symbol,
         name: instrument.name,
         assetClass: instrument.assetClass,
         exchange: instrument.exchange,
         currency: instrument.currency
       }))
    } catch (error) {
      logger.error(`Database search failed for "${query}":`, error)
      return []
    }
  }

  // Trigger data collection service
  private async triggerDataCollection(symbols: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.dataCollectorUrl}/collect/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbols })
      })

      if (!response.ok) {
        throw new Error(`Data collection failed: ${response.statusText}`)
      }

      logger.info(`Triggered data collection for ${symbols.join(', ')}`)
    } catch (error) {
      logger.error(`Failed to trigger data collection:`, error)
      // Don't throw here, as this is a fallback mechanism
    }
  }

  // Trigger historical data collection
  private async triggerHistoricalCollection(symbols: string[], period: string): Promise<void> {
    try {
      const response = await fetch(`${this.dataCollectorUrl}/collect/historical`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbols, period })
      })

      if (!response.ok) {
        throw new Error(`Historical data collection failed: ${response.statusText}`)
      }

      logger.info(`Triggered historical data collection for ${symbols.join(', ')}`)
    } catch (error) {
      logger.error(`Failed to trigger historical data collection:`, error)
    }
  }

  // Helper methods
  private formatQuote(rawData: any, symbol: string): Quote {
    return {
      symbol: symbol.toUpperCase(),
      name: rawData.name,
      price: Number(rawData.price || 0),
      change: Number(rawData.change || 0),
      changePercent: Number(rawData.changePercent || 0),
      volume: Number(rawData.volume || 0),
      marketCap: rawData.marketCap,
      high: Number(rawData.high || 0),
      low: Number(rawData.low || 0),
      open: Number(rawData.open || 0),
      previousClose: Number(rawData.previousClose || 0),
      timestamp: rawData.timestamp || new Date().toISOString()
    }
  }

  private getPeriodInDays(period: string): number {
    switch (period) {
      case '1d': return 1
      case '5d': return 5
      case '1m': return 30
      case '3m': return 90
      case '6m': return 180
      case '1y': return 365
      case '2y': return 730
      case '5y': return 1825
      default: return 365
    }
  }

  // Health check method
  async getServiceStatus(): Promise<any> {
    try {
      // Check database connection
      const dbCheck = await prisma.$queryRaw`SELECT 1`
      
      // Check data freshness
      const latestData = await prisma.marketData.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
      })

      const dataAge = latestData ? 
        Date.now() - latestData.timestamp.getTime() : 
        null

      return {
        database: 'connected',
        dataCollectorUrl: this.dataCollectorUrl,
        latestDataAge: dataAge ? `${Math.round(dataAge / 1000 / 60)} minutes` : 'no data',
        status: dataAge && dataAge < 10 * 60 * 1000 ? 'healthy' : 'stale_data'
      }
    } catch (error) {
      return {
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'unhealthy'
      }
    }
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService() 