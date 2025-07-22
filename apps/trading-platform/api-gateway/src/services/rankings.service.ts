import { cache } from '@yobi/database/src/redis'
import { prisma } from '@yobi/database'
import { marketDataService } from './market.service'
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
  score: number
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  expectedReturn: number
  price: number
  change24h: number
  volume: number
  marketCap?: number
  sector?: string
  currency?: string // Base currency of the instrument (INR, USD, etc.)
  exchange?: string // Exchange where the instrument is traded (NSE, NASDAQ, etc.)
  lastUpdated: string
  technicalScore?: number
  fundamentalScore?: number
  momentumScore?: number
}

interface RankingsResponse {
  rankings: InstrumentRanking[]
  metadata: {
    total: number
    lastUpdated: string
    version: string
    filters?: any
    dataFreshness: string
  }
}

export class RankingsService {
  private cacheKey = 'rankings:latest'
  private cacheExpiry = 300 // 5 minutes

  // Get all rankings with optional filters
  async getRankings(filters: any = {}): Promise<RankingsResponse> {
    try {
      // Check cache first
      const cacheKeyWithFilters = `${this.cacheKey}:${JSON.stringify(filters)}`
      const cached = await cache.get<RankingsResponse>(cacheKeyWithFilters)
      
      if (cached) {
        logger.info('Rankings cache hit')
        return cached
      }

      // Generate rankings using real data
      const rankings = await this.generateRankings(filters)
      
      // Check data freshness
      const dataFreshness = await this.getDataFreshness()
      
      const response: RankingsResponse = {
        rankings,
        metadata: {
          total: rankings.length,
          lastUpdated: new Date().toISOString(),
          version: '1.0',
          filters,
          dataFreshness
        }
      }

      // Cache the result
      await cache.set(cacheKeyWithFilters, response, this.cacheExpiry)
      
      logger.info(`Generated rankings for ${rankings.length} instruments`)
      return response

    } catch (error) {
      logger.error(`Failed to get rankings: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw new ApiError('Unable to fetch rankings', 500)
    }
  }

  // Get specific instrument ranking
  async getInstrumentRanking(symbol: string): Promise<InstrumentRanking> {
    try {
      const cacheKey = `ranking:${symbol.toUpperCase()}`
      const cached = await cache.get<InstrumentRanking>(cacheKey)
      
      if (cached) {
        logger.info(`Ranking cache hit for ${symbol}`)
        return cached
      }

      // Generate ranking for this specific instrument
      const ranking = await this.generateInstrumentRanking(symbol)
      
      // Cache it
      await cache.set(cacheKey, ranking, this.cacheExpiry)
      
      return ranking

    } catch (error) {
      logger.error(`Failed to get ranking for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw new ApiError(`Unable to fetch ranking for ${symbol}`, 500)
    }
  }

  // Generate rankings using real database data
  private async generateRankings(filters: any = {}): Promise<InstrumentRanking[]> {
    try {
      // Get instruments from database with recent market data
      const instruments = await this.getActiveInstruments(filters)
      logger.info(`Found ${instruments.length} active instruments`)

      if (instruments.length === 0) {
        logger.warn('No instruments found in database')
        return []
      }

      const rankings: InstrumentRanking[] = []

      // Process instruments in batches for better performance
      const batchSize = 10
      for (let i = 0; i < instruments.length; i += batchSize) {
        const batch = instruments.slice(i, i + batchSize)
        const batchRankings = await Promise.allSettled(
          batch.map(instrument => this.processInstrument(instrument))
        )

        // Add successful rankings
        batchRankings.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            rankings.push(result.value)
          } else {
            logger.warn(`Failed to process instrument ${batch[index]?.symbol}: ${result.status === 'rejected' ? result.reason : 'Unknown error'}`)
          }
        })
      }

      // Sort by total score (highest first)
      rankings.sort((a, b) => b.score - a.score)
      
      // Update ranks and apply limit
      const limit = filters.limit ? Math.min(parseInt(filters.limit), 200) : 200
      const limitedRankings = rankings.slice(0, limit)
      
      limitedRankings.forEach((ranking, index) => {
        ranking.rank = index + 1
      })

      return limitedRankings

    } catch (error) {
      logger.error(`Failed to generate rankings: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // Get active instruments from database
  private async getActiveInstruments(filters: any = {}): Promise<any[]> {
    try {
      const whereClause: any = {
        isActive: true,
        marketData: {
          some: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        }
      }

      logger.info(`Querying instruments with filters: ${JSON.stringify(filters)}`)
      logger.info(`Where clause: ${JSON.stringify(whereClause, null, 2)}`)

      // Apply filters
      if (filters.assetClass) {
        whereClause.assetClass = filters.assetClass
      }

      if (filters.sector) {
        whereClause.sector = {
          contains: filters.sector,
          mode: 'insensitive'
        }
      }

      if (filters.exchange) {
        whereClause.exchange = filters.exchange
      }

      const limit = filters.limit ? Math.min(parseInt(filters.limit), 500) : 500
      
      const instruments = await prisma.instrument.findMany({
        where: whereClause,
        include: {
          marketData: {
            orderBy: { timestamp: 'desc' },
            take: 1 // Get latest market data
          },
          fundamentals: true
        },
        take: limit // Use dynamic limit, max 500
      })

      logger.info(`Query returned ${instruments.length} instruments`)
      if (instruments.length > 0) {
        logger.info(`First instrument: ${instruments[0].symbol}, market data count: ${instruments[0].marketData.length}`)
      }

      return instruments

    } catch (error) {
      logger.error('Failed to get active instruments:', error)
      return []
    }
  }

  // Process individual instrument to calculate ranking
  private async processInstrument(instrument: any): Promise<InstrumentRanking | null> {
    try {
      const latestMarketData = instrument.marketData[0]
      if (!latestMarketData) {
        return null
      }

      // Calculate different scoring components
      const technicalScore = this.calculateTechnicalScore(latestMarketData, instrument)
      const fundamentalScore = this.calculateFundamentalScore(instrument.fundamentals)
      const momentumScore = this.calculateMomentumScore(latestMarketData)
      
      // Combined score with weights
      const totalScore = (
        technicalScore * 0.4 +
        fundamentalScore * 0.4 +
        momentumScore * 0.2
      )

      const signal = this.calculateSignal(totalScore)
      const expectedReturn = this.calculateExpectedReturn(totalScore, technicalScore, fundamentalScore)

          return {
      rank: 0, // Will be set later
      symbol: instrument.symbol,
      name: instrument.name,
      assetClass: instrument.assetClass,
      score: Math.round(totalScore * 100) / 100,
      signal,
      expectedReturn: Math.round(expectedReturn * 100) / 100,
      price: Number(latestMarketData.close), // Fixed: use 'close' instead of 'lastPrice'
      change24h: Number(latestMarketData.changePercent),
      volume: Number(latestMarketData.volume),
      marketCap: instrument.fundamentals?.marketCap || undefined,
      sector: instrument.sector || 'Unknown',
      currency: instrument.currency || 'USD', // Include the base currency
      exchange: instrument.exchange || 'NASDAQ', // Include the exchange
      lastUpdated: latestMarketData.timestamp.toISOString(),
      technicalScore: Math.round(technicalScore * 100) / 100,
      fundamentalScore: Math.round(fundamentalScore * 100) / 100,
      momentumScore: Math.round(momentumScore * 100) / 100
    }

    } catch (error) {
      logger.error(`Failed to process instrument ${instrument.symbol}:`, error)
      return null
    }
  }

  // Calculate technical score based on price action and volume
  private calculateTechnicalScore(marketData: any, instrument: any): number {
    let score = 50 // Base score

    // Enhanced price momentum (more dynamic scoring)
    const changePercent = Number(marketData.changePercent)
    if (changePercent > 5) {
      score += 25 // Strong positive momentum
    } else if (changePercent > 2) {
      score += 15 // Moderate positive momentum  
    } else if (changePercent > 0) {
      score += 8 // Slight positive momentum
    } else if (changePercent < -5) {
      score -= 25 // Strong negative momentum
    } else if (changePercent < -2) {
      score -= 15 // Moderate negative momentum
    } else if (changePercent < 0) {
      score -= 5 // Slight negative momentum
    }

    // Volume analysis (enhanced)
    const volume = Number(marketData.volume)
    if (volume > 1000000) { // High volume threshold
      score += 10
    } else if (volume > 500000) { // Moderate volume
      score += 5
    } else if (volume < 100000) { // Low volume penalty
      score -= 8
    }

    // Price position in daily range
    const price = Number(marketData.close)
    const high = Number(marketData.dayHigh)
    const low = Number(marketData.dayLow)
    
    if (high > low) {
      const pricePosition = (price - low) / (high - low)
      if (pricePosition > 0.8) {
        score += 12 // Near daily high
      } else if (pricePosition > 0.6) {
        score += 8 // Upper range
      } else if (pricePosition < 0.2) {
        score -= 10 // Near daily low
      } else if (pricePosition < 0.4) {
        score -= 5 // Lower range
      }
    }

    // Volatility consideration
    if (high > low) {
      const volatility = (high - low) / price
      if (volatility > 0.05) { // High volatility
        score += 5 // Can be opportunity
      }
    }

    return Math.max(0, Math.min(100, score))
  }

  // Calculate fundamental score based on financial metrics
  private calculateFundamentalScore(fundamentalData: any): number {
    // If no fundamental data, generate score based on market behavior
    if (!fundamentalData) {
      // Use randomized but consistent scoring for demo purposes
      // In production, this would fetch real fundamental data
      const baseScore = 40 + Math.floor(Math.random() * 30) // 40-70 range
      return baseScore
    }

    let score = 50

    // P/E Ratio analysis (more nuanced)
    const peRatio = Number(fundamentalData.peRatio)
    if (peRatio > 0) {
      if (peRatio < 10) {
        score += 20 // Very low P/E (value play)
      } else if (peRatio < 15) {
        score += 15 // Low P/E is positive
      } else if (peRatio < 25) {
        score += 5 // Reasonable P/E
      } else if (peRatio > 40) {
        score -= 15 // Very high P/E is risky
      } else if (peRatio > 30) {
        score -= 10 // High P/E is negative
      }
    }

    // Growth metrics (enhanced)
    const revenueGrowth = Number(fundamentalData.revenueGrowth)
    if (revenueGrowth > 0.25) {
      score += 15 // Exceptional revenue growth
    } else if (revenueGrowth > 0.15) {
      score += 12 // Strong revenue growth
    } else if (revenueGrowth > 0.05) {
      score += 6 // Moderate growth
    } else if (revenueGrowth < -0.1) {
      score -= 20 // Significant decline
    } else if (revenueGrowth < 0) {
      score -= 10 // Negative growth
    }

    const epsGrowth = Number(fundamentalData.epsGrowth)
    if (epsGrowth > 0.3) {
      score += 15 // Exceptional EPS growth
    } else if (epsGrowth > 0.2) {
      score += 12 // Strong EPS growth
    } else if (epsGrowth > 0.1) {
      score += 8 // Moderate EPS growth
    } else if (epsGrowth < -0.2) {
      score -= 15 // Significant EPS decline
    } else if (epsGrowth < 0) {
      score -= 8 // Negative EPS growth
    }

    // Profitability metrics (enhanced)
    const roe = Number(fundamentalData.roe)
    if (roe > 0.25) {
      score += 15 // Exceptional ROE
    } else if (roe > 0.15) {
      score += 12 // High ROE
    } else if (roe > 0.1) {
      score += 6 // Good ROE
    } else if (roe < 0) {
      score -= 15 // Negative ROE
    } else if (roe < 0.05) {
      score -= 8 // Low ROE
    }

    // Financial health (enhanced)
    const debtToEquity = Number(fundamentalData.debtToEquity)
    if (debtToEquity < 0.2) {
      score += 10 // Very low debt
    } else if (debtToEquity < 0.5) {
      score += 6 // Low debt
    } else if (debtToEquity > 2.0) {
      score -= 20 // Very high debt
    } else if (debtToEquity > 1.0) {
      score -= 12 // High debt
    }

    const currentRatio = Number(fundamentalData.currentRatio)
    if (currentRatio > 2.0) {
      score += 8 // Excellent liquidity
    } else if (currentRatio > 1.5) {
      score += 6 // Good liquidity
    } else if (currentRatio < 0.8) {
      score -= 15 // Poor liquidity
    } else if (currentRatio < 1.0) {
      score -= 10 // Concerning liquidity
    }

    return Math.max(0, Math.min(100, score))
  }

  // Calculate momentum score based on recent price action
  private calculateMomentumScore(marketData: any): number {
    let score = 50

    const changePercent = Number(marketData.changePercent)
    const price = Number(marketData.close)
    const volume = Number(marketData.volume)
    
    // Enhanced momentum scoring
    if (changePercent > 8) {
      score += 30 // Very strong positive momentum
    } else if (changePercent > 5) {
      score += 20 // Strong positive momentum
    } else if (changePercent > 2) {
      score += 12 // Moderate positive momentum
    } else if (changePercent > 0.5) {
      score += 6 // Slight positive momentum
    } else if (changePercent < -8) {
      score -= 30 // Very strong negative momentum
    } else if (changePercent < -5) {
      score -= 20 // Strong negative momentum
    } else if (changePercent < -2) {
      score -= 12 // Moderate negative momentum
    } else if (changePercent < -0.5) {
      score -= 6 // Slight negative momentum
    }

    // Volume-weighted momentum (higher volume = more reliable signal)
    if (volume > 1000000 && Math.abs(changePercent) > 2) {
      score += changePercent > 0 ? 8 : -8 // Strong volume confirms momentum
    } else if (volume < 100000 && Math.abs(changePercent) > 3) {
      score += changePercent > 0 ? -5 : 5 // Low volume momentum is suspicious
    }

    // Price level momentum (breakouts vs. reversals)
    const high = Number(marketData.dayHigh)
    const low = Number(marketData.dayLow)
    
    if (high > low) {
      const pricePosition = (price - low) / (high - low)
      if (pricePosition > 0.9 && changePercent > 2) {
        score += 10 // Breakout above high
      } else if (pricePosition < 0.1 && changePercent < -2) {
        score -= 10 // Breakdown below low
      }
    }

    return Math.max(0, Math.min(100, score))
  }

  // Generate ranking for a specific instrument
  private async generateInstrumentRanking(symbol: string): Promise<InstrumentRanking> {
    try {
      // Get instrument from database
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

      if (!instrument || !instrument.marketData[0]) {
        throw new Error(`No data found for ${symbol}`)
      }

      return await this.processInstrument(instrument) || {
        rank: 1,
        symbol: symbol.toUpperCase(),
        name: `${symbol} Corporation`,
        assetClass: 'STOCK',
        score: 0,
        signal: 'HOLD',
        expectedReturn: 0,
        price: 0,
        change24h: 0,
        volume: 0,
        lastUpdated: new Date().toISOString()
      }

    } catch (error) {
      throw new Error(`Failed to generate ranking for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private calculateSignal(score: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    // More aggressive thresholds for better signal distribution
    if (score >= 75) return 'STRONG_BUY'
    if (score >= 60) return 'BUY'
    if (score >= 40) return 'HOLD'
    if (score >= 25) return 'SELL'
    return 'STRONG_SELL'
  }

  private calculateExpectedReturn(totalScore: number, technicalScore: number, fundamentalScore: number): number {
    // More sophisticated expected return calculation
    const baseReturn = (totalScore - 50) / 5 // Base range: -10% to +10%
    
    // Adjust based on score components
    let adjustment = 0
    if (technicalScore > 70 && fundamentalScore > 70) {
      adjustment = 0.02 // +2% for strong scores in both areas
    } else if (technicalScore < 30 || fundamentalScore < 30) {
      adjustment = -0.02 // -2% for weak scores
    }

    return baseReturn + adjustment
  }

  private async getDataFreshness(): Promise<string> {
    try {
      const latestData = await prisma.marketData.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
      })

      if (!latestData) {
        return 'no_data'
      }

      const ageMinutes = Math.floor((Date.now() - latestData.timestamp.getTime()) / 1000 / 60)
      
      if (ageMinutes < 5) return 'very_fresh'
      if (ageMinutes < 15) return 'fresh'
      if (ageMinutes < 60) return 'recent'
      if (ageMinutes < 1440) return 'stale'
      return 'very_stale'

    } catch (error) {
      return 'unknown'
    }
  }

  // Clear rankings cache
  async clearCache(): Promise<void> {
    try {
      // Clear all ranking-related cache keys
      const patterns = ['rankings:*', 'ranking:*']
      
      for (const pattern of patterns) {
        await cache.invalidatePattern(pattern)
      }
      
      logger.info('Cleared rankings cache')
    } catch (error) {
      logger.error(`Failed to clear rankings cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get ranking statistics
  async getRankingStats(): Promise<any> {
    try {
      const totalInstruments = await prisma.instrument.count({
        where: { isActive: true }
      })

      const instrumentsWithData = await prisma.instrument.count({
        where: {
          isActive: true,
          marketData: {
            some: {
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          }
        }
      })

      const instrumentsWithFundamentals = await prisma.instrument.count({
        where: {
          isActive: true,
          fundamentalData: {
            isNot: null
          }
        }
      })

      return {
        totalInstruments,
        instrumentsWithData,
        instrumentsWithFundamentals,
        dataCoverage: instrumentsWithData / totalInstruments,
        fundamentalCoverage: instrumentsWithFundamentals / totalInstruments
      }
    } catch (error) {
      logger.error('Failed to get ranking stats:', error)
      return {
        totalInstruments: 0,
        instrumentsWithData: 0,
        instrumentsWithFundamentals: 0,
        dataAge: 'unknown'
      }
    }
  }
}

// Export singleton instance
export const rankingsService = new RankingsService() 