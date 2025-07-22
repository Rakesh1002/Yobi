import axios from 'axios'
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'yahoo-finance-provider' },
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

export class YahooFinanceProvider {
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart'
  private quoteSummaryUrl = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary'
  private searchUrl = 'https://query1.finance.yahoo.com/v1/finance/search'

  async getQuote(symbol: string): Promise<Quote> {
    try {
      const response = await axios.get(`${this.baseUrl}/${symbol}`, {
        params: {
          interval: '1d',
          range: '1d'
        },
        timeout: 10000
      })

      const data = response.data
      if (!data.chart?.result?.[0]) {
        throw new Error(`No data found for symbol ${symbol}`)
      }

      const result = data.chart.result[0]
      const meta = result.meta
      const quote = result.indicators?.quote?.[0]

      if (!quote) {
        throw new Error(`No quote data found for symbol ${symbol}`)
      }

      const currentPrice = meta.regularMarketPrice || meta.previousClose || 0
      const previousClose = meta.previousClose || 0
      const change = currentPrice - previousClose
      const changePercent = previousClose ? (change / previousClose) * 100 : 0

      return {
        symbol: symbol.toUpperCase(),
        name: meta.longName || meta.shortName,
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: meta.regularMarketVolume || 0,
        marketCap: meta.marketCap,
        high: meta.regularMarketDayHigh || 0,
        low: meta.regularMarketDayLow || 0,
        open: meta.regularMarketOpen || 0,
        previousClose: previousClose,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Yahoo Finance quote fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async getHistoricalData(symbol: string, period: string = '1y', interval: string = '1d'): Promise<HistoricalData> {
    try {
      const response = await axios.get(`${this.baseUrl}/${symbol}`, {
        params: {
          period1: this.getPeriodStart(period),
          period2: Math.floor(Date.now() / 1000),
          interval: interval
        },
        timeout: 30000
      })

      const data = response.data
      if (!data.chart?.result?.[0]) {
        throw new Error(`No historical data found for symbol ${symbol}`)
      }

      const result = data.chart.result[0]
      const timestamps = result.timestamp || []
      const quote = result.indicators?.quote?.[0]

      if (!quote || !timestamps.length) {
        throw new Error(`No historical quote data found for symbol ${symbol}`)
      }

      const historicalData: HistoricalDataPoint[] = timestamps.map((timestamp: number, index: number) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: quote.open?.[index] || 0,
        high: quote.high?.[index] || 0,
        low: quote.low?.[index] || 0,
        close: quote.close?.[index] || 0,
        volume: quote.volume?.[index] || 0
      })).filter((point: HistoricalDataPoint) => 
        point.open > 0 && point.high > 0 && point.low > 0 && point.close > 0
      )

      return {
        symbol: symbol.toUpperCase(),
        period,
        interval,
        data: historicalData
      }
    } catch (error) {
      logger.error(`Yahoo Finance historical data fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async searchInstruments(query: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await axios.get(this.searchUrl, {
        params: {
          q: query,
          quotesCount: limit,
          newsCount: 0
        },
        timeout: 10000
      })

      const results = response.data?.quotes || []
      
      return results.map((item: any) => ({
        symbol: item.symbol,
        name: item.longname || item.shortname,
        type: item.quoteType,
        exchange: item.exchange,
        sector: item.sector,
        industry: item.industry
      }))
    } catch (error) {
      logger.error(`Yahoo Finance search failed for query ${query}:`, error)
      throw error
    }
  }

  private getPeriodStart(period: string): number {
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    
    switch (period) {
      case '1d':
        return Math.floor((now - oneDay) / 1000)
      case '5d':
        return Math.floor((now - 5 * oneDay) / 1000)
      case '1m':
        return Math.floor((now - 30 * oneDay) / 1000)
      case '3m':
        return Math.floor((now - 90 * oneDay) / 1000)
      case '6m':
        return Math.floor((now - 180 * oneDay) / 1000)
      case '1y':
        return Math.floor((now - 365 * oneDay) / 1000)
      case '2y':
        return Math.floor((now - 2 * 365 * oneDay) / 1000)
      case '5y':
        return Math.floor((now - 5 * 365 * oneDay) / 1000)
      default:
        return Math.floor((now - 365 * oneDay) / 1000)
    }
  }

  async getStatus(): Promise<any> {
    try {
      // Test with a simple quote request
      await this.getQuote('AAPL')
      return {
        status: 'online',
        provider: 'Yahoo Finance',
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'offline',
        provider: 'Yahoo Finance',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      }
    }
  }
} 