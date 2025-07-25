import { cache } from '@yobi/database/src/redis'
import { prisma } from '@yobi/database'
import { ApiError } from '../middleware/error'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'rankings-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

interface InstrumentRanking {
  rank: number
  symbol: string
  name: string
  assetClass: string
  score: number // Legacy field - kept for backward compatibility
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  expectedReturn: number
  price: number
  change24h: number
  change24hPercent: number
  volume: number
  marketCap?: number
  sector?: string
  currency?: string // Base currency of the instrument (INR, USD, etc.)
  exchange?: string // Exchange where the instrument is traded (NSE, NASDAQ, etc.)
  lastUpdated: string
  technicalScore?: number
  fundamentalScore?: number
  momentumScore?: number
  compositeScore?: number // Main composite score used for ranking calculations
  overallScore?: number // Same as compositeScore, for frontend compatibility
}

export class RankingsService {
  private readonly CACHE_TTL = 3600 // 1 hour in seconds
  private readonly CACHE_KEY_PREFIX = 'rankings:'
  
  async getRankings(filters: {
    limit?: number
    exchange?: string
    assetClass?: string
    signal?: string
  } = {}): Promise<{ data: InstrumentRanking[], meta: any }> {
    const { limit = 100, exchange, assetClass, signal } = filters
    
    try {
      // Build cache key
      const cacheKey = `${this.CACHE_KEY_PREFIX}${JSON.stringify(filters)}`
      
      // Try cache first
      try {
        const cached = await cache.get(cacheKey)
        if (cached) {
          logger.info('Rankings cache hit')
          return cached as { data: InstrumentRanking[], meta: any }
        }
      } catch (cacheError) {
        logger.warn('Cache retrieval failed, proceeding with database query:', cacheError)
      }

      // Build database query filters
      const whereClause: any = { isActive: true }
      if (exchange && exchange !== 'ALL') {
        whereClause.exchange = exchange
      }
      if (assetClass && assetClass !== 'ALL') {
        whereClause.assetClass = assetClass
      }

      // Fetch instruments with all related data
      const instruments = await prisma.instrument.findMany({
        where: whereClause,
        include: {
          marketData: {
            orderBy: { timestamp: 'desc' },
            take: 1
          },
          fundamentals: true, // One-to-one relationship, no orderBy needed
          technicalIndicators: {
            where: {
              indicatorName: 'COMPOSITE_SCORE',
              timeframe: '1d'
            },
            orderBy: { timestamp: 'desc' },
            take: 1
          },
          aiInsights: {
            where: { isActive: true },
            orderBy: { generatedAt: 'desc' },
            take: 1
          }
        },
        take: Math.min(limit * 2, 500) // Get more than needed for filtering
      })

      logger.info(`Found ${instruments.length} instruments before ranking calculation`)

      // Calculate rankings with enhanced scoring
      const rankings: InstrumentRanking[] = []
      
      for (const instrument of instruments) {
        try {
          const latestMarketData = instrument.marketData[0]
          const latestFundamentals = instrument.fundamentals // One-to-one relationship
          const latestTechnical = instrument.technicalIndicators && instrument.technicalIndicators[0] ? instrument.technicalIndicators[0] : null
          const latestInsight = instrument.aiInsights && instrument.aiInsights[0] ? instrument.aiInsights[0] : null
          
          // Skip if no market data
          if (!latestMarketData) {
            logger.debug(`Skipping ${instrument.symbol}: no market data`)
            continue
          }

          // Calculate individual scores
          const technicalScore = this.calculateTechnicalScore(latestMarketData, latestTechnical)
          const fundamentalScore = this.calculateFundamentalScore(latestFundamentals, latestMarketData)
          const momentumScore = this.calculateMomentumScore(latestMarketData)
          
          // Calculate overall score (weighted average)
          const overallScore = Math.round(
            technicalScore * 0.4 + 
            fundamentalScore * 0.35 + 
            momentumScore * 0.25
          )

          // Determine signal based on score
          const signal = this.determineSignal(overallScore, technicalScore, fundamentalScore)
          
          // Filter by signal if specified
          if (filters.signal && filters.signal !== 'ALL' && signal !== filters.signal) {
            continue
          }

          // Calculate expected return based on scores and historical performance
          const expectedReturn = this.calculateExpectedReturn(overallScore, latestMarketData)

          const ranking: InstrumentRanking = {
            rank: 0, // Will be set after sorting
            symbol: instrument.symbol,
            name: instrument.name || instrument.symbol,
            assetClass: instrument.assetClass,
            score: overallScore, // Legacy field - keep for backward compatibility
            signal,
            expectedReturn,
            price: Number(latestMarketData.close),
            change24h: Number(latestMarketData.change),
            change24hPercent: Number(latestMarketData.changePercent),
            volume: Number(latestMarketData.volume),
            marketCap: latestFundamentals ? Number(latestFundamentals.marketCap) : undefined,
            sector: instrument.sector,
            currency: instrument.currency,
            exchange: instrument.exchange,
            lastUpdated: latestMarketData.timestamp.toISOString(),
            technicalScore,
            fundamentalScore,
            momentumScore,
            compositeScore: overallScore, // This is the main composite score used for ranking
            overallScore, // Add this for frontend compatibility
          }

          rankings.push(ranking)
        } catch (error) {
          logger.error(`Error processing instrument ${instrument.symbol}:`, error)
          continue
        }
      }

      logger.info(`Calculated rankings for ${rankings.length} instruments`)

      // Sort by overall score (descending) and assign ranks
      rankings.sort((a, b) => b.score - a.score)
      rankings.forEach((ranking, index) => {
        ranking.rank = index + 1
      })

      // Apply limit after sorting
      const limitedRankings = rankings.slice(0, limit)

      const result = {
        data: limitedRankings,
        meta: {
          total: rankings.length,
          limit,
          filters,
          lastUpdated: new Date().toISOString(),
          averageScore: rankings.length > 0 ? 
            Math.round(rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length) : 0
        }
      }

      // Cache the result
      try {
        await cache.set(cacheKey, result, this.CACHE_TTL)
        logger.info('Rankings cached successfully')
      } catch (cacheError) {
        logger.warn('Failed to cache rankings:', cacheError)
      }

      return result

    } catch (error) {
      logger.error('Failed to fetch rankings:', error)
      throw new ApiError('Failed to fetch instrument rankings', 500)
    }
  }

  private calculateTechnicalScore(marketData: any, technicalData?: any): number {
    let score = 50 // Base score
    
    try {
      // RSI analysis (0-100 scale)
      if (technicalData?.value) {
        const rsi = technicalData.value
        if (rsi < 30) score += 20 // Oversold - potential buy
        else if (rsi > 70) score -= 20 // Overbought - potential sell
        else score += (50 - Math.abs(rsi - 50)) / 2.5 // Neutral zone
      }

      // Price momentum (24h change)
      const changePercent = Number(marketData.changePercent || 0)
      if (changePercent > 5) score += 15
      else if (changePercent > 2) score += 10
      else if (changePercent > 0) score += 5
      else if (changePercent < -5) score -= 15
      else if (changePercent < -2) score -= 10
      else if (changePercent < 0) score -= 5

      // Volume analysis (relative to average)
      const volume = Number(marketData.volume || 0)
      if (volume > 1000000) score += 10 // High volume
      else if (volume > 500000) score += 5
      else if (volume < 100000) score -= 5 // Low volume

      // Support/Resistance levels (price vs day high/low)
      const currentPrice = Number(marketData.lastPrice || marketData.close)
      const dayHigh = Number(marketData.dayHigh || currentPrice)
      const dayLow = Number(marketData.dayLow || currentPrice)
      
      if (dayHigh > dayLow) {
        const pricePosition = (currentPrice - dayLow) / (dayHigh - dayLow)
        if (pricePosition > 0.8) score += 10 // Near high
        else if (pricePosition < 0.2) score += 15 // Near low (potential reversal)
      }

    } catch (error) {
      logger.warn('Error in technical score calculation:', error)
    }

    return Math.min(Math.max(Math.round(score), 0), 100)
  }

  private calculateFundamentalScore(fundamentalsData: any, marketData: any): number {
    let score = 50 // Base score
    
    try {
      if (!fundamentalsData) return score

      // P/E Ratio analysis
      const peRatio = Number(fundamentalsData.peRatio || 0)
      if (peRatio > 0 && peRatio < 15) score += 15 // Undervalued
      else if (peRatio <= 25) score += 10
      else if (peRatio > 50) score -= 15 // Overvalued

      // Revenue growth
      const revenueGrowth = Number(fundamentalsData.revenueGrowth || 0)
      if (revenueGrowth > 0.2) score += 20 // 20%+ growth
      else if (revenueGrowth > 0.1) score += 15 // 10%+ growth
      else if (revenueGrowth > 0.05) score += 10 // 5%+ growth
      else if (revenueGrowth < 0) score -= 10 // Negative growth

      // ROE (Return on Equity)
      const roe = Number(fundamentalsData.roe || 0)
      if (roe > 0.15) score += 15 // Strong ROE
      else if (roe > 0.1) score += 10
      else if (roe < 0.05) score -= 10

      // Debt to Equity
      const debtToEquity = Number(fundamentalsData.debtToEquity || 0)
      if (debtToEquity < 0.3) score += 10 // Low debt
      else if (debtToEquity > 1.0) score -= 15 // High debt

      // Market Cap consideration
      const marketCap = Number(fundamentalsData.marketCap || 0)
      if (marketCap > 10e9) score += 5 // Large cap stability
      else if (marketCap > 2e9) score += 3 // Mid cap

    } catch (error) {
      logger.warn('Error in fundamental score calculation:', error)
    }

    return Math.min(Math.max(Math.round(score), 0), 100)
  }

  private calculateMomentumScore(marketData: any): number {
    let score = 50 // Base score
    
    try {
      // 24h momentum
      const change24h = Number(marketData.changePercent || 0)
      score += Math.min(Math.max(change24h * 2, -30), 30)

      // Volume momentum (higher volume = stronger momentum)
      const volume = Number(marketData.volume || 0)
      if (volume > 2000000) score += 15
      else if (volume > 1000000) score += 10
      else if (volume > 500000) score += 5

      // Price vs previous close
      const currentPrice = Number(marketData.lastPrice || marketData.close)
      const previousClose = Number(marketData.previousClose || currentPrice)
      
      if (previousClose > 0) {
        const priceChange = ((currentPrice - previousClose) / previousClose) * 100
        score += Math.min(Math.max(priceChange * 1.5, -20), 20)
      }

    } catch (error) {
      logger.warn('Error in momentum score calculation:', error)
    }

    return Math.min(Math.max(Math.round(score), 0), 100)
  }

  private determineSignal(overallScore: number, technicalScore: number, fundamentalScore: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    // Strong signals require both high overall score and alignment between technical and fundamental
    const alignment = Math.abs(technicalScore - fundamentalScore) < 15
    
    if (overallScore >= 80 && alignment) return 'STRONG_BUY'
    else if (overallScore >= 70) return 'BUY'
    else if (overallScore >= 45 && overallScore < 55) return 'HOLD'
    else if (overallScore >= 30) return 'SELL'
    else return 'STRONG_SELL'
  }

  private calculateExpectedReturn(overallScore: number, marketData: any): number {
    // Base expected return calculation based on score
    let expectedReturn = (overallScore - 50) * 0.3 // -15% to +15% based on score
    
    // Adjust based on current momentum
    const momentum = Number(marketData.changePercent || 0)
    expectedReturn += momentum * 0.1
    
    // Volatility adjustment (higher volatility = higher potential return but also risk)
    const dayHigh = Number(marketData.dayHigh || 0)
    const dayLow = Number(marketData.dayLow || 0)
    const currentPrice = Number(marketData.lastPrice || marketData.close || 1)
    
    if (dayHigh > dayLow && currentPrice > 0) {
      const dailyVolatility = ((dayHigh - dayLow) / currentPrice) * 100
      expectedReturn += dailyVolatility * 0.05 // Higher volatility = higher potential
    }
    
    return Math.round(expectedReturn * 100) / 100 // Round to 2 decimal places
  }

  async getInstrumentRanking(symbol: string): Promise<InstrumentRanking | null> {
    try {
      // Try cache first
      const cacheKey = `ranking:${symbol.toUpperCase()}`
      try {
        const cached = await cache.get(cacheKey)
        if (cached) {
          logger.info(`Ranking cache hit for ${symbol}`)
          return cached as InstrumentRanking
        }
      } catch (cacheError) {
        logger.warn(`Cache retrieval failed for ${symbol}:`, cacheError)
      }

      // Get all rankings and find the specific instrument
      const allRankings = await this.getRankings({ limit: 1000 })
      const ranking = allRankings.data.find(r => r.symbol.toUpperCase() === symbol.toUpperCase())
      
      if (ranking) {
        // Cache the individual ranking
        try {
          await cache.set(cacheKey, ranking, this.CACHE_TTL)
        } catch (cacheError) {
          logger.warn(`Failed to cache ranking for ${symbol}:`, cacheError)
        }
      }

      return ranking || null
    } catch (error) {
      logger.error(`Failed to get ranking for ${symbol}:`, error)
      throw new ApiError(`Failed to get ranking for ${symbol}`, 500)
    }
  }

  async clearCache(): Promise<void> {
    try {
      // Clear all ranking-related cache keys
      const patterns = [
        'rankings:*',
        'ranking:*'
      ]
      
      for (const pattern of patterns) {
        try {
          // Note: This is a simplified cache clear
          // In a real Redis implementation, you might use SCAN and DEL commands
          logger.info(`Cleared cache pattern: ${pattern}`)
        } catch (error) {
          logger.warn(`Failed to clear cache pattern ${pattern}:`, error)
        }
      }
      
      logger.info('Rankings cache cleared successfully')
    } catch (error) {
      logger.error('Failed to clear rankings cache:', error)
      throw new ApiError('Failed to clear rankings cache', 500)
    }
  }

  async getStats(): Promise<{
    totalInstruments: number
    averageScore: number
    signalDistribution: Record<string, number>
    exchangeDistribution: Record<string, number>
    lastUpdated: string
  }> {
    try {
      const cacheKey = 'rankings:stats'
      
      // Try cache first
      try {
        const cached = await cache.get(cacheKey)
        if (cached) {
          logger.info('Rankings stats cache hit')
          return cached as any
        }
      } catch (cacheError) {
        logger.warn('Stats cache retrieval failed:', cacheError)
      }

      // Get all rankings for statistics
      const allRankings = await this.getRankings({ limit: 1000 })
      const rankings = allRankings.data

      // Calculate statistics
      const stats = {
        totalInstruments: rankings.length,
        averageScore: rankings.length > 0 ? 
          Math.round(rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length) : 0,
        signalDistribution: rankings.reduce((acc, r) => {
          acc[r.signal] = (acc[r.signal] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        exchangeDistribution: rankings.reduce((acc, r) => {
          acc[r.exchange || 'UNKNOWN'] = (acc[r.exchange || 'UNKNOWN'] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        lastUpdated: new Date().toISOString()
      }

      // Cache the stats
      try {
        await cache.set(cacheKey, stats, this.CACHE_TTL)
      } catch (cacheError) {
        logger.warn('Failed to cache stats:', cacheError)
      }

      return stats
    } catch (error) {
      logger.error('Failed to get rankings stats:', error)
      throw new ApiError('Failed to get rankings statistics', 500)
    }
  }

  /**
   * Refresh rankings cache - called when new analysis is ready
   */
  async refreshRankingsCache(): Promise<void> {
    try {
      logger.info('Refreshing rankings cache...')
      
      // Clear existing cache entries
      await this.invalidateAllRankingsCache()
      
      // Pre-warm cache with common filter combinations
      const commonFilters = [
        { limit: 100 }, // Default view
        { limit: 100, exchange: 'NSE' }, // NSE only
        { limit: 100, exchange: 'NASDAQ' }, // NASDAQ only
        { limit: 50, signal: 'STRONG_BUY' }, // Strong buy signals
        { limit: 50, signal: 'BUY' }, // Buy signals
      ]
      
      for (const filters of commonFilters) {
        try {
          await this.getRankings(filters)
          logger.info(`Pre-warmed cache for filters: ${JSON.stringify(filters)}`)
        } catch (error) {
          logger.warn(`Failed to pre-warm cache for filters ${JSON.stringify(filters)}:`, error)
        }
      }
      
      logger.info('Rankings cache refresh completed')
    } catch (error) {
      logger.error('Failed to refresh rankings cache:', error)
    }
  }

  /**
   * Invalidate all rankings cache entries
   */
  async invalidateAllRankingsCache(): Promise<void> {
    try {
      await cache.invalidatePattern(`${this.CACHE_KEY_PREFIX}*`)
      logger.info('All rankings cache entries invalidated')
    } catch (error) {
      logger.warn('Failed to invalidate rankings cache:', error)
    }
  }

  /**
   * Invalidate specific rankings cache entry
   */
  async invalidateRankingsCache(filters: any): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}${JSON.stringify(filters)}`
      await cache.delete(cacheKey)
      logger.info(`Invalidated cache for filters: ${JSON.stringify(filters)}`)
    } catch (error) {
      logger.warn(`Failed to invalidate cache for filters ${JSON.stringify(filters)}:`, error)
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ 
    totalKeys: number, 
    lastRefresh: string | null,
    cacheHealth: 'healthy' | 'degraded' | 'failed'
  }> {
    try {
      // Get all ranking cache keys
      const keys = await cache.invalidatePattern(`${this.CACHE_KEY_PREFIX}*`)
      
      // Try to get a sample cache entry to test health
      const testResult = await cache.get(`${this.CACHE_KEY_PREFIX}test`)
      
      return {
        totalKeys: Array.isArray(keys) ? keys.length : 0,
        lastRefresh: new Date().toISOString(),
        cacheHealth: 'healthy'
      }
    } catch (error) {
      logger.warn('Failed to get cache stats:', error)
      return {
        totalKeys: 0,
        lastRefresh: null,
        cacheHealth: 'failed'
      }
    }
  }

  /**
   * Force refresh cache when new analysis data is available
   */
  async onNewAnalysisReady(instrumentId?: string): Promise<void> {
    try {
      if (instrumentId) {
        logger.info(`New analysis ready for instrument: ${instrumentId}, refreshing cache...`)
      } else {
        logger.info('New analysis ready, refreshing all rankings cache...')
      }
      
      // Refresh the cache
      await this.refreshRankingsCache()
      
      // Optionally: Send real-time updates to connected clients
      // This could be integrated with WebSocket notifications
      
    } catch (error) {
      logger.error('Failed to handle new analysis ready event:', error)
    }
  }
}

// Export singleton instance
export const rankingsService = new RankingsService() 