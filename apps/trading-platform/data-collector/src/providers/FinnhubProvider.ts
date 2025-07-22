import axios from 'axios'
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'finnhub-provider' },
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

export class FinnhubProvider {
  private baseUrl = 'https://finnhub.io/api/v1'
  private apiKey: string

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || ''
    if (!this.apiKey) {
      logger.warn('Finnhub API key not provided')
    }
  }

  async getQuote(symbol: string): Promise<Quote> {
    if (!this.apiKey) {
      throw new Error('Finnhub API key not configured')
    }

    try {
      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: {
          symbol: symbol,
          token: this.apiKey
        },
        timeout: 10000
      })

      const data = response.data

      if (!data || data.c === 0) {
        throw new Error(`No quote data found for symbol ${symbol}`)
      }

      const currentPrice = data.c || 0 // Current price
      const change = data.d || 0 // Change
      const changePercent = data.dp || 0 // Percent change
      const high = data.h || 0 // High price of the day
      const low = data.l || 0 // Low price of the day
      const open = data.o || 0 // Open price of the day
      const previousClose = data.pc || 0 // Previous close price

      return {
        symbol: symbol.toUpperCase(),
        name: undefined, // Finnhub doesn't provide company name in quote
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: 0, // Volume not available in this endpoint
        marketCap: undefined,
        high: high,
        low: low,
        open: open,
        previousClose: previousClose,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Finnhub quote fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async getCompanyProfile(symbol: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Finnhub API key not configured')
    }

    try {
      const response = await axios.get(`${this.baseUrl}/stock/profile2`, {
        params: {
          symbol: symbol,
          token: this.apiKey
        },
        timeout: 10000
      })

      const data = response.data

      if (!data || Object.keys(data).length === 0) {
        throw new Error(`No company profile found for symbol ${symbol}`)
      }

      return {
        symbol: symbol.toUpperCase(),
        name: data.name,
        country: data.country,
        currency: data.currency,
        exchange: data.exchange,
        ipo: data.ipo,
        marketCapitalization: data.marketCapitalization,
        phone: data.phone,
        shareOutstanding: data.shareOutstanding,
        ticker: data.ticker,
        weburl: data.weburl,
        logo: data.logo,
        finnhubIndustry: data.finnhubIndustry
      }
    } catch (error) {
      logger.error(`Finnhub company profile fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async getBasicFinancials(symbol: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Finnhub API key not configured')
    }

    try {
      const response = await axios.get(`${this.baseUrl}/stock/metric`, {
        params: {
          symbol: symbol,
          metric: 'all',
          token: this.apiKey
        },
        timeout: 15000
      })

      const data = response.data
      const metrics = data.metric

      if (!metrics) {
        throw new Error(`No financial metrics found for symbol ${symbol}`)
      }

      return {
        symbol: symbol.toUpperCase(),
        peRatio: metrics.peBasicExclExtraTTM,
        pbRatio: metrics.pbQuarterly,
        psRatio: metrics.psQuarterly,
        peForward: metrics.peNormalizedAnnual,
        epsAnnual: metrics.epsBasicExclExtraAnnual,
        epsGrowth: metrics.epsGrowth3Y,
        revenueGrowth: metrics.revenueGrowth3Y,
        beta: metrics.beta,
        dividendYield: metrics.dividendYieldIndicatedAnnual,
        roa: metrics.roaRfy,
        roe: metrics.roeRfy,
        grossMargin: metrics.grossMargin5Y,
        operatingMargin: metrics.operatingMargin5Y,
        netMargin: metrics.netMargin5Y,
        debtToEquity: metrics.totalDebt2TotalEquityQuarterly,
        currentRatio: metrics.currentRatioQuarterly,
        quickRatio: metrics.quickRatioQuarterly,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Finnhub basic financials fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async getNews(symbol: string, from?: string, to?: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Finnhub API key not configured')
    }

    try {
      const response = await axios.get(`${this.baseUrl}/company-news`, {
        params: {
          symbol: symbol,
          from: from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to: to || new Date().toISOString().split('T')[0],
          token: this.apiKey
        },
        timeout: 15000
      })

      const data = response.data

      if (!Array.isArray(data)) {
        return []
      }

      return data.map((article: any) => ({
        id: article.id,
        category: article.category,
        datetime: new Date(article.datetime * 1000).toISOString(),
        headline: article.headline,
        image: article.image,
        related: article.related,
        source: article.source,
        summary: article.summary,
        url: article.url
      }))
    } catch (error) {
      logger.error(`Finnhub news fetch failed for ${symbol}:`, error)
      throw error
    }
  }

  async searchSymbols(query: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Finnhub API key not configured')
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          q: query,
          token: this.apiKey
        },
        timeout: 10000
      })

      const data = response.data
      const results = data.result || []

      return results.map((item: any) => ({
        symbol: item.symbol,
        description: item.description,
        displaySymbol: item.displaySymbol,
        type: item.type
      }))
    } catch (error) {
      logger.error(`Finnhub symbol search failed for query ${query}:`, error)
      throw error
    }
  }

  async getStatus(): Promise<any> {
    try {
      if (!this.apiKey) {
        return {
          status: 'offline',
          provider: 'Finnhub',
          error: 'API key not configured',
          lastChecked: new Date().toISOString()
        }
      }

      // Test with a simple quote request
      await this.getQuote('AAPL')
      return {
        status: 'online',
        provider: 'Finnhub',
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'offline',
        provider: 'Finnhub',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      }
    }
  }
} 