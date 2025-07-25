import { prisma } from '@yobi/database'
import { cache } from '@yobi/database/src/redis'
import { createLogger } from '../utils/logger'
import { Exchange, AssetClass } from '@yobi/shared-types'

const logger = createLogger('instrument-discovery')

export interface InstrumentInfo {
  symbol: string
  name: string
  exchange: Exchange
  assetClass: AssetClass
  sector?: string
  industry?: string
  currency: string
  marketCap?: number
  avgVolume?: number
  isActive: boolean
  discoveredAt: Date
  lastSearched?: Date
  searchCount: number
  priority: number
}

export class InstrumentDiscoveryService {
  private readonly MAX_INSTRUMENTS = 1000
  private readonly VOLUME_THRESHOLD = 100000 // Minimum daily volume
  private readonly CACHE_TTL = 3600 // 1 hour

  /**
   * Get current tracked instruments ordered by priority
   */
  async getTrackedInstruments(limit: number = this.MAX_INSTRUMENTS): Promise<InstrumentInfo[]> {
    try {
      const instruments = await prisma.instrument.findMany({
        where: { isActive: true },
        include: {
          marketData: {
            orderBy: { timestamp: 'desc' },
            take: 1
          },
          fundamentals: true
        },
        orderBy: [
          { searchCount: 'desc' }, // User interest
          { avgVolume: 'desc' },   // Trading volume
          { lastSearched: 'desc' } // Recency
        ],
        take: limit
      })

      return instruments.map(this.formatInstrumentInfo)
    } catch (error) {
      logger.error('Failed to get tracked instruments:', error)
      return []
    }
  }

  /**
   * Discover and add new instrument when user searches for it
   */
  async discoverInstrument(symbol: string): Promise<InstrumentInfo | null> {
    try {
      symbol = symbol.toUpperCase()
      logger.info(`Discovering new instrument: ${symbol}`)

      // Check if already exists
      const existing = await this.findExistingInstrument(symbol)
      if (existing) {
        // Update search count and last searched
        await this.incrementSearchCount(symbol)
        return existing
      }

      // Discover from multiple sources
      const instrumentData = await this.fetchInstrumentMetadata(symbol)
      if (!instrumentData) {
        logger.warn(`Could not discover metadata for ${symbol}`)
        return null
      }

      // Create new instrument
      const newInstrument = await prisma.instrument.create({
        data: {
          symbol: instrumentData.symbol,
          name: instrumentData.name,
          assetClass: instrumentData.assetClass,
          exchange: instrumentData.exchange,
          sector: instrumentData.sector,
          industry: instrumentData.industry,
          currency: instrumentData.currency,
          isActive: true,
          searchCount: 1,
          lastSearched: new Date(),
          discoveredAt: new Date(),
          priority: this.calculatePriority(instrumentData)
        }
      })

      logger.info(`Successfully discovered and added: ${symbol}`)

      // Trigger initial data collection for new instrument
      await this.triggerInitialDataCollection(symbol)

      return this.formatInstrumentInfo(newInstrument)

    } catch (error) {
      logger.error(`Failed to discover instrument ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get top instruments by volume across all exchanges
   */
  async getTopInstrumentsByVolume(limit: number = 100): Promise<string[]> {
    try {
      const cacheKey = `top_instruments_by_volume:${limit}`
      const cached = await cache.get(cacheKey)
      if (cached) return cached as string[]

      const result = await prisma.marketData.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          },
          volume: {
            gte: BigInt(this.VOLUME_THRESHOLD)
          }
        },
        include: {
          instrument: true
        },
        orderBy: {
          volume: 'desc'
        },
        take: limit,
        distinct: ['instrumentId']
      })

      const symbols = result.map((data: any) => data.instrument.symbol)
      
      // Cache for 1 hour
      await cache.set(cacheKey, symbols, this.CACHE_TTL)
      
      return symbols

    } catch (error) {
      logger.error('Failed to get top instruments by volume:', error)
      return []
    }
  }

  /**
   * Discover trending instruments from market data APIs
   */
  async discoverTrendingInstruments(): Promise<string[]> {
    try {
      logger.info('Discovering trending instruments from market APIs')
      
      const trending: string[] = []

      // Get trending from different sources
      const sources = [
        () => this.getTrendingFromYahoo(),
        () => this.getTrendingFromFinnhub(),
        () => this.getGainersLosers()
      ]

      for (const source of sources) {
        try {
          const symbols = await source()
          trending.push(...symbols)
        } catch (error) {
          logger.warn('Trending discovery source failed:', error)
        }
      }

      // Remove duplicates and limit
      const uniqueTrending = [...new Set(trending)].slice(0, 50)
      
      logger.info(`Discovered ${uniqueTrending.length} trending instruments`)
      return uniqueTrending

    } catch (error) {
      logger.error('Failed to discover trending instruments:', error)
      return []
    }
  }

  /**
   * Clean up low-priority instruments to maintain limit
   */
  async maintainInstrumentLimit(): Promise<void> {
    try {
      const totalCount = await prisma.instrument.count({ where: { isActive: true } })
      
      if (totalCount <= this.MAX_INSTRUMENTS) {
        return
      }

      const excessCount = totalCount - this.MAX_INSTRUMENTS
      logger.info(`Cleaning up ${excessCount} low-priority instruments`)

      // Get lowest priority instruments
      const lowPriority = await prisma.instrument.findMany({
        where: { isActive: true },
        orderBy: [
          { searchCount: 'asc' },
          { lastSearched: 'asc' },
          { avgVolume: 'asc' }
        ],
        take: excessCount
      })

      // Deactivate instead of delete (preserve historical data)
      await prisma.instrument.updateMany({
        where: {
          id: { in: lowPriority.map((i: any) => i.id) }
        },
        data: { isActive: false }
      })

      logger.info(`Deactivated ${excessCount} low-priority instruments`)

    } catch (error) {
      logger.error('Failed to maintain instrument limit:', error)
    }
  }

  /**
   * Update instrument priorities based on usage and market data
   */
  async updateInstrumentPriorities(): Promise<void> {
    try {
      logger.info('Updating instrument priorities')

      const instruments = await prisma.instrument.findMany({
        where: { isActive: true },
        include: {
          marketData: {
            orderBy: { timestamp: 'desc' },
            take: 1
          }
        }
      })

      for (const instrument of instruments) {
        const priority = this.calculatePriority({
          searchCount: instrument.searchCount,
          lastSearched: instrument.lastSearched,
          volume: instrument.marketData[0]?.volume ? Number(instrument.marketData[0].volume) : 0,
          discoveredAt: instrument.discoveredAt
        })

        await prisma.instrument.update({
          where: { id: instrument.id },
          data: { priority }
        })
      }

      logger.info(`Updated priorities for ${instruments.length} instruments`)

    } catch (error) {
      logger.error('Failed to update instrument priorities:', error)
    }
  }

  private async findExistingInstrument(symbol: string): Promise<InstrumentInfo | null> {
    try {
      const instrument = await prisma.instrument.findFirst({
        where: { 
          symbol: symbol.toUpperCase(),
          isActive: true 
        },
        include: {
          marketData: {
            orderBy: { timestamp: 'desc' },
            take: 1
          },
          fundamentals: true
        }
      })

      return instrument ? this.formatInstrumentInfo(instrument) : null
    } catch (error) {
      logger.error(`Failed to find existing instrument ${symbol}:`, error)
      return null
    }
  }

  private async incrementSearchCount(symbol: string): Promise<void> {
    try {
      await prisma.instrument.updateMany({
        where: { symbol: symbol.toUpperCase() },
        data: { 
          searchCount: { increment: 1 },
          lastSearched: new Date()
        }
      })
    } catch (error) {
      logger.error(`Failed to increment search count for ${symbol}:`, error)
    }
  }

  private async fetchInstrumentMetadata(symbol: string): Promise<any> {
    try {
      // Try multiple sources to get instrument metadata
      const sources = [
        () => this.getMetadataFromYahoo(symbol),
        () => this.getMetadataFromFinnhub(symbol),
        () => this.inferFromSymbol(symbol)
      ]

      for (const source of sources) {
        try {
          const metadata = await source()
          if (metadata) return metadata
        } catch (error) {
          continue
        }
      }

      return null
    } catch (error) {
      logger.error(`Failed to fetch metadata for ${symbol}:`, error)
      return null
    }
  }

  private async getMetadataFromYahoo(symbol: string): Promise<any> {
    // Implement Yahoo Finance API call for instrument metadata
    // This would fetch name, exchange, sector, industry, etc.
    return null // Placeholder
  }

  private async getMetadataFromFinnhub(symbol: string): Promise<any> {
    // Implement Finnhub API call for instrument metadata
    return null // Placeholder
  }

  private inferFromSymbol(symbol: string): any {
    // Basic inference from symbol patterns
    const isIndian = this.isIndianSymbol(symbol)
    
    return {
      symbol: symbol.toUpperCase(),
      name: symbol,
      exchange: isIndian ? Exchange.NSE : Exchange.NASDAQ,
      assetClass: AssetClass.STOCK,
      currency: isIndian ? 'INR' : 'USD',
      sector: 'Unknown',
      industry: 'Unknown'
    }
  }

  private isIndianSymbol(symbol: string): boolean {
    // Common Indian stock patterns
    const indianPatterns = [
      /LTD$/i, /LIMITED$/i, // Company suffixes
      /BANK$/i, /FIN$/i,    // Financial institutions
      /MOTORS$/i, /STEEL$/i, /POWER$/i // Industry patterns
    ]
    
    return indianPatterns.some(pattern => pattern.test(symbol))
  }

  private calculatePriority(data: any): number {
    let priority = 0
    
    // User interest (40% weight)
    priority += (data.searchCount || 0) * 40
    
    // Volume (30% weight) 
    const volume = data.volume || 0
    priority += Math.min(volume / 1000000, 30) // Cap at 30
    
    // Recency (20% weight)
    const daysSinceSearch = data.lastSearched ? 
      (Date.now() - data.lastSearched.getTime()) / (1000 * 60 * 60 * 24) : 999
    priority += Math.max(0, 20 - daysSinceSearch)
    
    // Discovery recency (10% weight)
    const daysSinceDiscovery = data.discoveredAt ?
      (Date.now() - data.discoveredAt.getTime()) / (1000 * 60 * 60 * 24) : 999
    priority += Math.max(0, 10 - (daysSinceDiscovery / 30)) // Decay over 30 days
    
    return Math.round(priority)
  }

  private async triggerInitialDataCollection(symbol: string): Promise<void> {
    try {
      // Trigger data collection for new instrument
      const dataCollectorUrl = process.env.DATA_COLLECTOR_URL || 'http://localhost:3004'
      
      fetch(`${dataCollectorUrl}/collect/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [symbol] })
      }).catch(err => logger.warn(`Failed to trigger data collection for ${symbol}:`, err))

    } catch (error) {
      logger.warn(`Failed to trigger initial data collection for ${symbol}:`, error)
    }
  }

  private async getTrendingFromYahoo(): Promise<string[]> {
    // Implement Yahoo Finance trending/gainers API
    return []
  }

  private async getTrendingFromFinnhub(): Promise<string[]> {
    // Implement Finnhub trending API
    return []
  }

  private async getGainersLosers(): Promise<string[]> {
    // Get top gainers/losers from existing market data
    try {
      const result = await prisma.marketData.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        include: { instrument: true },
        orderBy: { changePercent: 'desc' },
        take: 20
      })

      return result.map((data: any) => data.instrument.symbol)
    } catch (error) {
      return []
    }
  }

  private formatInstrumentInfo(instrument: any): InstrumentInfo {
    return {
      symbol: instrument.symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      assetClass: instrument.assetClass,
      sector: instrument.sector,
      industry: instrument.industry,
      currency: instrument.currency,
      marketCap: instrument.fundamentals?.marketCap,
      avgVolume: instrument.avgVolume,
      isActive: instrument.isActive,
      discoveredAt: instrument.discoveredAt || instrument.createdAt,
      lastSearched: instrument.lastSearched,
      searchCount: instrument.searchCount || 0,
      priority: instrument.priority || 0
    }
  }
}

export const instrumentDiscoveryService = new InstrumentDiscoveryService() 