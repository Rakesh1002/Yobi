import { PrismaClient } from '@prisma/client'

export class TimescaleDBService {
  constructor(private prisma: PrismaClient) {}

  // ========================================
  // TECHNICAL INDICATORS METHODS
  // ========================================

  /**
   * Insert a single technical indicator data point
   */
  async insertTechnicalIndicator(data: {
    timestamp: Date
    instrumentId: string
    symbol: string
    indicatorName: string
    timeframe: string
    value: number
    signal?: string
    metadata?: any
  }) {
    return this.prisma.technicalIndicator.create({ 
      data: {
        timestamp: data.timestamp,
        instrumentId: data.instrumentId,
        symbol: data.symbol,
        indicatorName: data.indicatorName,
        timeframe: data.timeframe,
        value: data.value,
        signal: data.signal,
        metadata: data.metadata
      }
    })
  }

  /**
   * Batch insert technical indicators for better performance
   */
  async batchInsertTechnicalIndicators(indicators: Array<{
    timestamp: Date
    instrumentId: string
    symbol: string
    indicatorName: string
    timeframe: string
    value: number
    signal?: string
    metadata?: any
  }>) {
    const formattedIndicators = indicators.map(indicator => ({
      ...indicator,
      value: indicator.value.toString()
    }))

    return this.prisma.technicalIndicator.createMany({
      data: formattedIndicators,
      skipDuplicates: true
    })
  }

  /**
   * Get technical indicators for a specific symbol and indicator
   */
  async getTechnicalIndicators(
    symbol: string,
    indicatorName: string,
    timeframe: string,
    from: Date,
    to: Date = new Date(),
    limit: number = 1000
  ) {
    return this.prisma.technicalIndicator.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        indicatorName,
        timeframe,
        timestamp: {
          gte: from,
          lte: to
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    })
  }

  /**
   * Get latest technical indicators for multiple symbols
   */
  async getLatestTechnicalIndicators(symbols: string[], indicatorName: string, timeframe: string = '1d') {
    return this.prisma.$queryRaw`
      SELECT DISTINCT ON (symbol) 
        symbol, 
        indicator_name,
        timeframe,
        value,
        signal,
        timestamp
      FROM technical_indicators 
      WHERE symbol = ANY(${symbols}) 
        AND indicator_name = ${indicatorName}
        AND timeframe = ${timeframe}
      ORDER BY symbol, timestamp DESC;
    `
  }

  /**
   * Get technical indicator summary for all symbols
   */
  async getTechnicalIndicatorSummary(indicatorName: string, timeframe: string = '1d') {
    return this.prisma.$queryRaw`
      WITH latest_indicators AS (
        SELECT DISTINCT ON (symbol) 
          symbol,
          value,
          signal,
          timestamp
        FROM technical_indicators 
        WHERE indicator_name = ${indicatorName}
          AND timeframe = ${timeframe}
          AND timestamp >= NOW() - INTERVAL '7 days'
        ORDER BY symbol, timestamp DESC
      )
      SELECT 
        COUNT(*) as total_instruments,
        AVG(value::float) as avg_value,
        COUNT(CASE WHEN signal = 'BUY' THEN 1 END) as buy_signals,
        COUNT(CASE WHEN signal = 'SELL' THEN 1 END) as sell_signals,
        COUNT(CASE WHEN signal = 'HOLD' THEN 1 END) as hold_signals
      FROM latest_indicators;
    `
  }

  // ========================================
  // PORTFOLIO PERFORMANCE METHODS
  // ========================================

  /**
   * Store portfolio performance snapshot
   */
  async storePortfolioPerformance(performance: {
    timestamp: Date
    portfolioId: string
    userId: string
    totalValue: number
    cashValue: number
    investedValue: number
    dayPnl: number
    totalPnl: number
    dayReturnPct?: number
    totalReturnPct?: number
    benchmarkReturn?: number
    alpha?: number
    beta?: number
    sharpeRatio?: number
    maxDrawdown?: number
    positionsCount?: number
    metadata?: any
  }) {
    const formattedPerformance = {
      ...performance,
      totalValue: performance.totalValue.toString(),
      cashValue: performance.cashValue.toString(),
      investedValue: performance.investedValue.toString(),
      dayPnl: performance.dayPnl.toString(),
      totalPnl: performance.totalPnl.toString(),
      dayReturnPct: performance.dayReturnPct?.toString(),
      totalReturnPct: performance.totalReturnPct?.toString(),
      benchmarkReturn: performance.benchmarkReturn?.toString(),
      alpha: performance.alpha?.toString(),
      beta: performance.beta?.toString(),
      sharpeRatio: performance.sharpeRatio?.toString(),
      maxDrawdown: performance.maxDrawdown?.toString()
    }

    return this.prisma.portfolioPerformance.create({
      data: formattedPerformance
    })
  }

  /**
   * Get portfolio performance history
   */
  async getPortfolioPerformance(
    portfolioId: string,
    from: Date,
    to: Date = new Date(),
    limit: number = 1000
  ) {
    return this.prisma.portfolioPerformance.findMany({
      where: {
        portfolioId,
        timestamp: {
          gte: from,
          lte: to
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    })
  }

  /**
   * Get portfolio performance aggregated by day/week/month
   */
  async getPortfolioPerformanceAggregated(
    portfolioId: string,
    interval: 'day' | 'week' | 'month',
    from: Date,
    to: Date = new Date()
  ) {
    const intervalSQL = interval === 'day' ? 'day' : interval === 'week' ? 'week' : 'month'
    
    return this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${intervalSQL}, timestamp) as period,
        FIRST_VALUE(total_value) OVER (PARTITION BY DATE_TRUNC(${intervalSQL}, timestamp) ORDER BY timestamp) as period_start_value,
        LAST_VALUE(total_value) OVER (PARTITION BY DATE_TRUNC(${intervalSQL}, timestamp) ORDER BY timestamp RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as period_end_value,
        SUM(day_pnl) as period_pnl,
        AVG(day_return_pct) as avg_daily_return,
        MAX(total_value) as period_high,
        MIN(total_value) as period_low
      FROM portfolio_performance 
      WHERE portfolio_id = ${portfolioId}
        AND timestamp >= ${from}
        AND timestamp <= ${to}
      GROUP BY DATE_TRUNC(${intervalSQL}, timestamp)
      ORDER BY period DESC;
    `
  }

  /**
   * Get user's all portfolios performance summary
   */
  async getUserPortfoliosSummary(userId: string, days: number = 30) {
    return this.prisma.$queryRaw`
      WITH latest_performance AS (
        SELECT DISTINCT ON (portfolio_id) 
          portfolio_id,
          total_value,
          total_pnl,
          total_return_pct,
          sharpe_ratio,
          max_drawdown,
          timestamp
        FROM portfolio_performance 
        WHERE user_id = ${userId}
          AND timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY portfolio_id, timestamp DESC
      )
      SELECT 
        portfolio_id,
        total_value,
        total_pnl,
        total_return_pct,
        sharpe_ratio,
        max_drawdown,
        timestamp as last_updated
      FROM latest_performance
      ORDER BY total_value DESC;
    `
  }

  // ========================================
  // MARKET DATA METHODS (TimescaleDB Optimized)
  // ========================================

  /**
   * Get OHLCV data using TimescaleDB continuous aggregates
   */
  async getOHLCVData(
    symbol: string,
    timeframe: '1m' | '5m' | '1h' | '1d',
    from: Date,
    to: Date = new Date(),
    limit: number = 1000
  ) {
    // For now, use regular MarketData table until continuous aggregates are set up
    // This will be optimized after TimescaleDB extension is enabled
    return this.prisma.marketData.findMany({
      where: {
        instrument: {
          symbol: symbol.toUpperCase()
        },
        timestamp: {
          gte: from,
          lte: to
        }
      },
      orderBy: { timestamp: 'asc' },
      take: limit,
      select: {
        timestamp: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true
      }
    })
  }

  /**
   * Get real-time market data aggregated by time buckets
   */
  async getMarketDataAggregated(
    symbols: string[],
    interval: '1m' | '5m' | '15m' | '1h',
    from: Date,
    to: Date = new Date()
  ) {
    const intervalMinutes = interval === '1m' ? 1 : interval === '5m' ? 5 : interval === '15m' ? 15 : 60

    return this.prisma.$queryRaw`
      SELECT 
        i.symbol,
        DATE_TRUNC('hour', m.timestamp) + 
        INTERVAL '${intervalMinutes} minutes' * FLOOR(EXTRACT(MINUTE FROM m.timestamp)::int / ${intervalMinutes}) as time_bucket,
        FIRST_VALUE(m.open) OVER w as open,
        MAX(m.high) OVER w as high,
        MIN(m.low) OVER w as low,
        LAST_VALUE(m.close) OVER w as close,
        SUM(m.volume) OVER w as volume,
        COUNT(*) OVER w as trades
      FROM "MarketData" m
      JOIN "Instrument" i ON m."instrumentId" = i.id
      WHERE i.symbol = ANY(${symbols})
        AND m.timestamp >= ${from}
        AND m.timestamp <= ${to}
      WINDOW w AS (
        PARTITION BY i.symbol, DATE_TRUNC('hour', m.timestamp) + 
        INTERVAL '${intervalMinutes} minutes' * FLOOR(EXTRACT(MINUTE FROM m.timestamp)::int / ${intervalMinutes})
        ORDER BY m.timestamp
        RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
      )
      ORDER BY i.symbol, time_bucket;
    `
  }

  // ========================================
  // USER ACTIVITY TRACKING
  // ========================================

  /**
   * Track user activity
   */
  async trackUserActivity(activity: {
    timestamp: Date
    userId: string
    action: string
    resource?: string
    details?: any
    ipAddress?: string
    userAgent?: string
    sessionId?: string
  }) {
    return this.prisma.userActivity.create({ data: activity })
  }

  /**
   * Get user activity analytics
   */
  async getUserActivityStats(userId: string, days: number = 30) {
    return this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', timestamp) as day,
        action,
        COUNT(*) as count
      FROM user_activity 
      WHERE user_id = ${userId}
        AND timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY day, action
      ORDER BY day DESC;
    `
  }

  /**
   * Get platform activity summary
   */
  async getPlatformActivitySummary(days: number = 7) {
    return this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', timestamp) as day,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_actions,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as logins,
        COUNT(CASE WHEN action = 'search' THEN 1 END) as searches,
        COUNT(CASE WHEN action = 'view_instrument' THEN 1 END) as instrument_views,
        COUNT(CASE WHEN action = 'generate_analysis' THEN 1 END) as analysis_generated
      FROM user_activity 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY day
      ORDER BY day DESC;
    `
  }

  /**
   * Get most active users
   */
  async getMostActiveUsers(days: number = 30, limit: number = 10) {
    return this.prisma.$queryRaw`
      SELECT 
        user_id,
        COUNT(*) as total_actions,
        COUNT(DISTINCT action) as unique_actions,
        MAX(timestamp) as last_activity,
        COUNT(CASE WHEN action = 'search' THEN 1 END) as searches,
        COUNT(CASE WHEN action = 'view_instrument' THEN 1 END) as views
      FROM user_activity 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY user_id
      ORDER BY total_actions DESC
      LIMIT ${limit};
    `
  }

  // ========================================
  // PERFORMANCE & ANALYTICS
  // ========================================

  /**
   * Get TimescaleDB statistics and performance info
   */
  async getTimescaleDBStats() {
    try {
      // Check if TimescaleDB is enabled
      const hypertables = await this.prisma.$queryRaw`
        SELECT hypertable_name, num_chunks, compression_enabled
        FROM timescaledb_information.hypertables;
      `

      const compressionStats = await this.prisma.$queryRaw`
        SELECT 
          hypertable_name,
          compression_enabled,
          compress_after,
          compress_orderby
        FROM timescaledb_information.compression_settings;
      `

      return {
        hypertables,
        compressionStats,
        timescaleEnabled: true
      }
    } catch (error) {
      return {
        hypertables: [],
        compressionStats: [],
        timescaleEnabled: false,
        error: 'TimescaleDB extension not enabled'
      }
    }
  }

  /**
   * Health check for TimescaleDB service
   */
  async healthCheck() {
    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1 as health_check`
      
      // Get table sizes
      const tableSizes = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE tablename IN ('MarketData', 'technical_indicators', 'portfolio_performance', 'user_activity')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `

      const stats = await this.getTimescaleDBStats()

      return {
        status: 'healthy',
        tableSizes,
        timescaleDB: stats,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  // ========================================
  // CLEANUP & MAINTENANCE
  // ========================================

  /**
   * Clean up old data based on retention policies
   */
  async cleanupOldData() {
    try {
      // Clean user activity older than 1 year
      const deletedActivity = await this.prisma.userActivity.deleteMany({
        where: {
          timestamp: {
            lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
          }
        }
      })

      // Clean technical indicators older than 2 years
      const deletedIndicators = await this.prisma.technicalIndicator.deleteMany({
        where: {
          timestamp: {
            lt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) // 2 years ago
          }
        }
      })

      return {
        deletedUserActivity: deletedActivity.count,
        deletedTechnicalIndicators: deletedIndicators.count,
        cleanupTimestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Export singleton instance
let timescaleService: TimescaleDBService | null = null

export function getTimescaleDBService(prisma: PrismaClient): TimescaleDBService {
  if (!timescaleService) {
    timescaleService = new TimescaleDBService(prisma)
  }
  return timescaleService
}

export default TimescaleDBService 