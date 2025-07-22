import { createClient } from '@clickhouse/client'

// ClickHouse client for time-series and analytical data
export const clickhouse = createClient({
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'trading_analytics',
})

// Time-series data schemas for ClickHouse
export const schemas = {
  // Market tick data table
  tickData: `
    CREATE TABLE IF NOT EXISTS tick_data (
      timestamp DateTime64(3),
      instrument_id String,
      symbol String,
      price Decimal(20, 8),
      volume UInt64,
      bid Decimal(20, 8),
      ask Decimal(20, 8),
      side Enum8('BUY' = 1, 'SELL' = 2)
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (symbol, timestamp)
    SETTINGS index_granularity = 8192
  `,

  // OHLCV candlestick data
  ohlcv: `
    CREATE TABLE IF NOT EXISTS ohlcv (
      timestamp DateTime,
      instrument_id String,
      symbol String,
      interval Enum8('1m' = 1, '5m' = 2, '15m' = 3, '30m' = 4, '1h' = 5, '4h' = 6, '1d' = 7),
      open Decimal(20, 8),
      high Decimal(20, 8),
      low Decimal(20, 8),
      close Decimal(20, 8),
      volume UInt64,
      trades UInt32
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (symbol, interval, timestamp)
    SETTINGS index_granularity = 8192
  `,

  // Technical indicators time-series
  indicators: `
    CREATE TABLE IF NOT EXISTS technical_indicators (
      timestamp DateTime,
      instrument_id String,
      symbol String,
      indicator String,
      timeframe String,
      value Decimal(20, 8),
      signal String
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (symbol, indicator, timestamp)
    SETTINGS index_granularity = 8192
  `,

  // User activity analytics
  userActivity: `
    CREATE TABLE IF NOT EXISTS user_activity (
      timestamp DateTime,
      user_id String,
      action String,
      resource String,
      details String,
      ip_address String,
      user_agent String
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (user_id, timestamp)
    SETTINGS index_granularity = 8192
  `,

  // Trade execution analytics
  tradeAnalytics: `
    CREATE TABLE IF NOT EXISTS trade_analytics (
      timestamp DateTime,
      trade_id String,
      user_id String,
      instrument_id String,
      symbol String,
      side Enum8('BUY' = 1, 'SELL' = 2),
      quantity UInt64,
      price Decimal(20, 8),
      fees Decimal(20, 8),
      pnl Decimal(20, 8),
      execution_time_ms UInt32
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (user_id, timestamp)
    SETTINGS index_granularity = 8192
  `
}

// Helper functions for common queries
export const timeseries = {
  // Insert tick data
  async insertTick(data: {
    timestamp: Date
    instrument_id: string
    symbol: string
    price: number
    volume: number
    bid: number
    ask: number
    side: 'BUY' | 'SELL'
  }): Promise<void> {
    await clickhouse.insert({
      table: 'tick_data',
      values: [data],
      format: 'JSONEachRow',
    })
  },

  // Insert OHLCV data in batch
  async insertOHLCV(data: Array<any>): Promise<void> {
    await clickhouse.insert({
      table: 'ohlcv',
      values: data,
      format: 'JSONEachRow',
    })
  },

  // Query recent ticks
  async getRecentTicks(symbol: string, limit: number = 100): Promise<any[]> {
    const result = await clickhouse.query({
      query: `
        SELECT * FROM tick_data
        WHERE symbol = {symbol:String}
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { symbol, limit },
      format: 'JSONEachRow',
    })
    return result.json()
  },

  // Get OHLCV data for charting
  async getOHLCV(
    symbol: string,
    interval: string,
    start: Date,
    end: Date
  ): Promise<any[]> {
    const result = await clickhouse.query({
      query: `
        SELECT * FROM ohlcv
        WHERE symbol = {symbol:String}
          AND interval = {interval:String}
          AND timestamp >= {start:DateTime}
          AND timestamp <= {end:DateTime}
        ORDER BY timestamp ASC
      `,
      query_params: { symbol, interval, start, end },
      format: 'JSONEachRow',
    })
    return result.json()
  },

  // Analytics queries
  async getVolumeProfile(symbol: string, days: number = 30): Promise<any[]> {
    const result = await clickhouse.query({
      query: `
        SELECT 
          toStartOfHour(timestamp) as hour,
          sum(volume) as total_volume,
          avg(price) as vwap,
          count() as trades
        FROM tick_data
        WHERE symbol = {symbol:String}
          AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        GROUP BY hour
        ORDER BY hour ASC
      `,
      query_params: { symbol, days },
      format: 'JSONEachRow',
    })
    return result.json()
  }
} 