import axios from 'axios'
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'alpha-vantage-provider' },
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

export class AlphaVantageProvider {
  private baseUrl = 'https://www.alphavantage.co/query'
  private apiKey: string

  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || ''
    if (!this.apiKey) {
      logger.warn('Alpha Vantage API key not provided')
    }
  }

  async getQuote(symbol: string): Promise<Quote> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: this.apiKey
        },
        timeout: 15000
      })

      const data = response.data
      const quote = data['Global Quote']

      if (!quote || Object.keys(quote).length === 0) {
        throw new Error(`No quote data found for symbol ${symbol}`)
      }

      const currentPrice = parseFloat(quote['05. price']) || 0
      const change = parseFloat(quote['09. change']) || 0
      const changePercent = parseFloat(quote['10. change percent']?.replace('%', '')) || 0
      const volume = parseInt(quote['06. volume']) || 0
      const high = parseFloat(quote['03. high']) || 0
      const low = parseFloat(quote['04. low']) || 0
      const open = parseFloat(quote['02. open']) || 0
      const previousClose = parseFloat(quote['08. previous close']) || 0

      return {
        symbol: symbol.toUpperCase(),
        name: undefined, // Alpha Vantage doesn't provide company name in quote
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: volume,
        marketCap: undefined,
        high: high,
        low: low,
        open: open,
        previousClose: previousClose,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Alpha Vantage quote fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async getHistoricalData(symbol: string, period: string = '1y'): Promise<HistoricalData> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'TIME_SERIES_DAILY_ADJUSTED',
          symbol: symbol,
          outputsize: period === '1y' ? 'compact' : 'full',
          apikey: this.apiKey
        },
        timeout: 30000
      })

      const data = response.data
      const timeSeries = data['Time Series (Daily)']

      if (!timeSeries) {
        throw new Error(`No historical data found for symbol ${symbol}`)
      }

      const dates = Object.keys(timeSeries).sort()
      const limitedDates = this.limitByPeriod(dates, period)

      const historicalData: HistoricalDataPoint[] = limitedDates.map(date => {
        const dayData = timeSeries[date]
        return {
          date: date,
          open: parseFloat(dayData['1. open']),
          high: parseFloat(dayData['2. high']),
          low: parseFloat(dayData['3. low']),
          close: parseFloat(dayData['5. adjusted close']),
          volume: parseInt(dayData['6. volume'])
        }
      })

      return {
        symbol: symbol.toUpperCase(),
        period,
        interval: '1d',
        data: historicalData
      }
    } catch (error) {
      logger.error(`Alpha Vantage historical data fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async getFundamentalData(symbol: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'OVERVIEW',
          symbol: symbol,
          apikey: this.apiKey
        },
        timeout: 15000
      })

      const data = response.data

      if (!data || Object.keys(data).length === 0 || data.Note) {
        throw new Error(`No fundamental data found for symbol ${symbol}`)
      }

      return {
        symbol: symbol.toUpperCase(),
        marketCap: parseFloat(data.MarketCapitalization) || 0,
        peRatio: parseFloat(data.PERatio) || 0,
        pegRatio: parseFloat(data.PEGRatio) || 0,
        pbRatio: parseFloat(data.PriceToBookRatio) || 0,
        psRatio: parseFloat(data.PriceToSalesRatioTTM) || 0,
        evToRevenue: parseFloat(data.EVToRevenue) || 0,
        evToEbitda: parseFloat(data.EVToEBITDA) || 0,
        beta: parseFloat(data.Beta) || 0,
        eps: parseFloat(data.EPS) || 0,
        dividendYield: parseFloat(data.DividendYield) || 0,
        sector: data.Sector || '',
        industry: data.Industry || '',
        description: data.Description || '',
        revenueGrowth: parseFloat(data.QuarterlyRevenueGrowthYOY) || 0,
        earningsGrowth: parseFloat(data.QuarterlyEarningsGrowthYOY) || 0,
        grossMargin: parseFloat(data.GrossProfitTTM) || 0,
        operatingMargin: parseFloat(data.OperatingMarginTTM) || 0,
        netMargin: parseFloat(data.ProfitMargin) || 0,
        roe: parseFloat(data.ReturnOnEquityTTM) || 0,
        roa: parseFloat(data.ReturnOnAssetsTTM) || 0,
        debtToEquity: parseFloat(data.DebtToEquity) || 0,
        currentRatio: parseFloat(data.CurrentRatio) || 0,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Alpha Vantage fundamental data fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async getTechnicalIndicators(symbol: string, indicator: string, interval: string = 'daily'): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: indicator,
          symbol: symbol,
          interval: interval,
          time_period: 14,
          series_type: 'close',
          apikey: this.apiKey
        },
        timeout: 15000
      })

      const data = response.data
      const technicalData = data[`Technical Analysis: ${indicator}`]

      if (!technicalData) {
        throw new Error(`No technical indicator data found for ${symbol}`)
      }

      return {
        symbol: symbol.toUpperCase(),
        indicator,
        interval,
        data: technicalData,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Alpha Vantage technical indicator fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  private limitByPeriod(dates: string[], period: string): string[] {
    if (period === 'max') {
      return dates
    }

    const now = new Date()
    const daysMap: { [key: string]: number } = {
      '1d': 1,
      '5d': 5,
      '1m': 30,
      '3m': 90,
      '6m': 180,
      '1y': 365,
      '2y': 730,
      '5y': 1825
    }

    const daysBack = daysMap[period] || 365
    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    const cutoffString = cutoffDate.toISOString().split('T')[0] || cutoffDate.toISOString().substring(0, 10)

    return dates.filter(date => date >= cutoffString)
  }

  async getStatus(): Promise<any> {
    try {
      if (!this.apiKey) {
        return {
          status: 'offline',
          provider: 'Alpha Vantage',
          error: 'API key not configured',
          lastChecked: new Date().toISOString()
        }
      }

      // Test with a simple quote request
      await this.getQuote('AAPL')
      return {
        status: 'online',
        provider: 'Alpha Vantage',
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'offline',
        provider: 'Alpha Vantage',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      }
    }
  }
} 