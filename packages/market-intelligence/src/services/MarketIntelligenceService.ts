import WebSocket from 'ws'
import axios from 'axios'
import Redis from 'ioredis'
import Queue from 'bull'
import { CronJob } from 'cron'
import { Anthropic } from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import { Logger } from 'winston'

interface MarketDataPoint {
  symbol: string
  price: number
  volume: number
  change: number
  changePercent: number
  timestamp: Date
  source: DataSource
}

interface NewsItem {
  id: string
  symbol: string
  title: string
  content: string
  url: string
  publishedAt: Date
  source: string
  sentiment: SentimentAnalysis
  impact: ImpactLevel
  credibility: number
}

interface SentimentAnalysis {
  score: number // -1 to 1
  magnitude: number // 0 to 1
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  keywords: string[]
  entities: string[]
}

interface AnalystSentiment {
  symbol: string
  firm: string
  analyst: string
  rating: AnalystRating
  targetPrice?: number
  previousRating?: AnalystRating
  changeDate: Date
  confidence: number
}

interface MarketContext {
  symbol: string
  currentPrice: number
  priceHistory: PricePoint[]
  volume24h: number
  marketCap?: number
  news: NewsItem[]
  analystSentiment: AnalystSentiment[]
  socialSentiment: SocialSentiment
  technicalIndicators: TechnicalIndicators
  fundamentalMetrics: FundamentalMetrics
  lastUpdated: Date
}

enum DataSource {
  ALPHA_VANTAGE = 'ALPHA_VANTAGE',
  FINNHUB = 'FINNHUB',
  YAHOO_FINANCE = 'YAHOO_FINANCE',
  POLYGON = 'POLYGON',
  WEBSOCKET = 'WEBSOCKET'
}

enum ImpactLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

enum AnalystRating {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  HOLD = 'HOLD',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL'
}

interface PricePoint {
  timestamp: Date
  price: number
  volume: number
}

interface SocialSentiment {
  twitterMentions: number
  redditMentions: number
  overallSentiment: number
  trending: boolean
}

interface TechnicalIndicators {
  rsi: number
  macd: number
  sma20: number
  sma50: number
  bollinger: { upper: number; middle: number; lower: number }
}

interface FundamentalMetrics {
  peRatio?: number
  pbRatio?: number
  dividendYield?: number
  eps?: number
  revenue?: number
  marketCap?: number
}

export class MarketIntelligenceService {
  private redis: Redis
  private anthropic: Anthropic
  private logger: Logger
  private wsConnections: Map<string, WebSocket> = new Map()
  private newsQueue: Queue.Queue
  private dataQueue: Queue.Queue
  private sentimentQueue: Queue.Queue
  
  constructor(logger: Logger) {
    this.logger = logger
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    })
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    })

    // Initialize Bull queues
    this.newsQueue = new Queue('news processing', process.env.REDIS_URL || 'redis://localhost:6379')
    this.dataQueue = new Queue('market data processing', process.env.REDIS_URL || 'redis://localhost:6379')
    this.sentimentQueue = new Queue('sentiment analysis', process.env.REDIS_URL || 'redis://localhost:6379')

    this.setupQueues()
    this.setupWebSocketConnections()
    this.setupScheduledJobs()
  }

  /**
   * Get comprehensive market context for a symbol
   */
  async getMarketContext(symbol: string): Promise<MarketContext> {
    try {
      const cacheKey = `market_context:${symbol}`
      const cached = await this.redis.get(cacheKey)
      
      if (cached) {
        const context = JSON.parse(cached)
        // Check if data is recent (within last 5 minutes)
        if (new Date().getTime() - new Date(context.lastUpdated).getTime() < 5 * 60 * 1000) {
          return context
        }
      }

      // Fetch fresh data
      const context = await this.buildMarketContext(symbol)
      
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(context))
      
      return context

    } catch (error) {
      this.logger.error(`Failed to get market context for ${symbol}`, { error })
      throw error
    }
  }

  /**
   * Build comprehensive market context
   */
  private async buildMarketContext(symbol: string): Promise<MarketContext> {
    const [
      currentPrice,
      priceHistory,
      news,
      analystSentiment,
      socialSentiment,
      technicalIndicators,
      fundamentalMetrics
    ] = await Promise.allSettled([
      this.getCurrentPrice(symbol),
      this.getPriceHistory(symbol, '1D'),
      this.getNews(symbol),
      this.getAnalystSentiment(symbol),
      this.getSocialSentiment(symbol),
      this.getTechnicalIndicators(symbol),
      this.getFundamentalMetrics(symbol)
    ])

    const context: MarketContext = {
      symbol,
      currentPrice: currentPrice.status === 'fulfilled' ? currentPrice.value.price : 0,
      priceHistory: priceHistory.status === 'fulfilled' ? priceHistory.value : [],
      volume24h: currentPrice.status === 'fulfilled' ? currentPrice.value.volume : 0,
      marketCap: fundamentalMetrics.status === 'fulfilled' ? fundamentalMetrics.value?.marketCap : undefined,
      news: news.status === 'fulfilled' ? news.value : [],
      analystSentiment: analystSentiment.status === 'fulfilled' ? analystSentiment.value : [],
      socialSentiment: socialSentiment.status === 'fulfilled' ? socialSentiment.value : {
        twitterMentions: 0,
        redditMentions: 0,
        overallSentiment: 0,
        trending: false
      },
      technicalIndicators: technicalIndicators.status === 'fulfilled' ? technicalIndicators.value : {
        rsi: 50,
        macd: 0,
        sma20: 0,
        sma50: 0,
        bollinger: { upper: 0, middle: 0, lower: 0 }
      },
      fundamentalMetrics: fundamentalMetrics.status === 'fulfilled' ? fundamentalMetrics.value : {},
      lastUpdated: new Date()
    }

    return context
  }

  /**
   * Get current price from multiple sources
   */
  private async getCurrentPrice(symbol: string): Promise<MarketDataPoint> {
    // Try multiple data sources with fallback
    const sources = [
      () => this.getAlphaVantagePrice(symbol),
      () => this.getFinnhubPrice(symbol),
      () => this.getYahooFinancePrice(symbol)
    ]

    for (const source of sources) {
      try {
        return await source()
      } catch (error) {
        this.logger.warn(`Price source failed for ${symbol}`, { error })
        continue
      }
    }

    throw new Error(`No price data available for ${symbol}`)
  }

  /**
   * Alpha Vantage price fetcher
   */
  private async getAlphaVantagePrice(symbol: string): Promise<MarketDataPoint> {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    })

    const quote = response.data['Global Quote']
    return {
      symbol,
      price: parseFloat(quote['05. price']),
      volume: parseInt(quote['06. volume']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      timestamp: new Date(),
      source: DataSource.ALPHA_VANTAGE
    }
  }

  /**
   * Finnhub price fetcher
   */
  private async getFinnhubPrice(symbol: string): Promise<MarketDataPoint> {
    const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
      params: {
        symbol,
        token: process.env.FINNHUB_API_KEY
      }
    })

    const data = response.data
    return {
      symbol,
      price: data.c, // current price
      volume: 0, // Finnhub doesn't provide volume in quote endpoint
      change: data.d, // change
      changePercent: data.dp, // percent change
      timestamp: new Date(data.t * 1000),
      source: DataSource.FINNHUB
    }
  }

  /**
   * Yahoo Finance price fetcher (via API)
   */
  private async getYahooFinancePrice(symbol: string): Promise<MarketDataPoint> {
    // Implementation using Yahoo Finance API
    // This would typically use a third-party library or direct API calls
    throw new Error('Yahoo Finance not implemented')
  }

  /**
   * Get price history
   */
  private async getPriceHistory(symbol: string, timeframe: string): Promise<PricePoint[]> {
    try {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'TIME_SERIES_INTRADAY',
          symbol,
          interval: '5min',
          apikey: process.env.ALPHA_VANTAGE_API_KEY
        }
      })

      const timeSeries = response.data['Time Series (5min)']
      const pricePoints: PricePoint[] = []

      for (const [timestamp, data] of Object.entries(timeSeries)) {
        pricePoints.push({
          timestamp: new Date(timestamp),
          price: parseFloat((data as any)['4. close']),
          volume: parseInt((data as any)['5. volume'])
        })
      }

      return pricePoints.slice(0, 100) // Return last 100 points

    } catch (error) {
      this.logger.warn(`Price history fetch failed for ${symbol}`, { error })
      return []
    }
  }

  /**
   * Get and analyze news
   */
  private async getNews(symbol: string): Promise<NewsItem[]> {
    try {
      const newsItems: NewsItem[] = []

      // Fetch from multiple news sources
      const [finnhubNews, alphaVantageNews] = await Promise.allSettled([
        this.getFinnhubNews(symbol),
        this.getAlphaVantageNews(symbol)
      ])

      if (finnhubNews.status === 'fulfilled') {
        newsItems.push(...finnhubNews.value)
      }

      if (alphaVantageNews.status === 'fulfilled') {
        newsItems.push(...alphaVantageNews.value)
      }

      // Analyze sentiment for each news item
      for (const item of newsItems) {
        item.sentiment = await this.analyzeSentiment(item.title + ' ' + item.content)
        item.impact = this.determineImpact(item.sentiment, item.credibility)
      }

      return newsItems.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

    } catch (error) {
      this.logger.error(`News fetch failed for ${symbol}`, { error })
      return []
    }
  }

  /**
   * Fetch news from Finnhub
   */
  private async getFinnhubNews(symbol: string): Promise<NewsItem[]> {
    const response = await axios.get('https://finnhub.io/api/v1/company-news', {
      params: {
        symbol,
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        token: process.env.FINNHUB_API_KEY
      }
    })

    return response.data.map((item: any) => ({
      id: `finnhub_${item.id}`,
      symbol,
      title: item.headline,
      content: item.summary,
      url: item.url,
      publishedAt: new Date(item.datetime * 1000),
      source: item.source,
      sentiment: { score: 0, magnitude: 0, label: 'NEUTRAL', keywords: [], entities: [] },
      impact: ImpactLevel.LOW,
      credibility: 0.8 // Finnhub generally has reliable sources
    }))
  }

  /**
   * Fetch news from Alpha Vantage
   */
  private async getAlphaVantageNews(symbol: string): Promise<NewsItem[]> {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'NEWS_SENTIMENT',
        tickers: symbol,
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    })

    return response.data.feed?.map((item: any) => ({
      id: `av_${item.time_published}`,
      symbol,
      title: item.title,
      content: item.summary,
      url: item.url,
      publishedAt: new Date(item.time_published),
      source: item.source,
      sentiment: { score: 0, magnitude: 0, label: 'NEUTRAL', keywords: [], entities: [] },
      impact: ImpactLevel.LOW,
      credibility: 0.7
    })) || []
  }

  /**
   * Analyze sentiment using Claude AI
   */
  private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analyze the sentiment of this financial news text. Provide:
1. Sentiment score (-1 to 1, where -1 is very negative, 1 is very positive)
2. Magnitude (0 to 1, how strong the sentiment is)
3. Label (POSITIVE, NEGATIVE, or NEUTRAL)
4. Key sentiment-bearing words
5. Financial entities mentioned

Text: "${text}"

Respond in JSON format:
{
  "score": number,
  "magnitude": number,
  "label": "POSITIVE|NEGATIVE|NEUTRAL",
  "keywords": ["word1", "word2"],
  "entities": ["entity1", "entity2"]
}`
        }]
      })

      const analysisText = (response.content[0] as any)?.text || '{}'
      const sentiment = JSON.parse(analysisText)
      
      return {
        score: sentiment.score || 0,
        magnitude: sentiment.magnitude || 0,
        label: sentiment.label || 'NEUTRAL',
        keywords: sentiment.keywords || [],
        entities: sentiment.entities || []
      }

    } catch (error) {
      this.logger.warn('Sentiment analysis failed', { error })
      return {
        score: 0,
        magnitude: 0,
        label: 'NEUTRAL',
        keywords: [],
        entities: []
      }
    }
  }

  /**
   * Determine news impact level
   */
  private determineImpact(sentiment: SentimentAnalysis, credibility: number): ImpactLevel {
    const impactScore = Math.abs(sentiment.score) * sentiment.magnitude * credibility

    if (impactScore > 0.8) return ImpactLevel.CRITICAL
    if (impactScore > 0.6) return ImpactLevel.HIGH
    if (impactScore > 0.3) return ImpactLevel.MEDIUM
    return ImpactLevel.LOW
  }

  /**
   * Get analyst sentiment
   */
  private async getAnalystSentiment(symbol: string): Promise<AnalystSentiment[]> {
    // Implementation would fetch from financial data providers
    // For now, return mock data
    return []
  }

  /**
   * Get social sentiment
   */
  private async getSocialSentiment(symbol: string): Promise<SocialSentiment> {
    // Implementation would integrate with Twitter API, Reddit API, etc.
    return {
      twitterMentions: 0,
      redditMentions: 0,
      overallSentiment: 0,
      trending: false
    }
  }

  /**
   * Get technical indicators
   */
  private async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
    // Implementation would calculate or fetch technical indicators
    return {
      rsi: 50,
      macd: 0,
      sma20: 0,
      sma50: 0,
      bollinger: { upper: 0, middle: 0, lower: 0 }
    }
  }

  /**
   * Get fundamental metrics
   */
  private async getFundamentalMetrics(symbol: string): Promise<FundamentalMetrics> {
    // Implementation would fetch fundamental data
    return {}
  }

  /**
   * Setup WebSocket connections for real-time data
   */
  private setupWebSocketConnections(): void {
    // Finnhub WebSocket
    if (process.env.FINNHUB_API_KEY) {
      const finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`)
      
      finnhubWs.on('open', () => {
        this.logger.info('Finnhub WebSocket connected')
      })

      finnhubWs.on('message', (data) => {
        const message = JSON.parse(data.toString())
        this.processRealtimeData(message, DataSource.FINNHUB)
      })

      this.wsConnections.set('finnhub', finnhubWs)
    }

    // Alpha Vantage WebSocket (if available)
    // Polygon WebSocket (if available)
  }

  /**
   * Process real-time data
   */
  private processRealtimeData(data: any, source: DataSource): void {
    // Queue for processing to avoid blocking
    this.dataQueue.add('process-realtime', { data, source })
  }

  /**
   * Setup scheduled jobs
   */
  private setupScheduledJobs(): void {
    // Update market context every minute during market hours
    new CronJob('0 * 9-16 * * 1-5', async () => {
      this.logger.info('Running scheduled market context update')
      // Implementation would update context for tracked symbols
    }, null, true, 'America/New_York')

    // News sentiment analysis every 15 minutes
    new CronJob('*/15 * * * *', async () => {
      this.logger.info('Running scheduled news sentiment analysis')
      // Implementation would process news queue
    }, null, true)

    // Social sentiment tracking every hour
    new CronJob('0 * * * *', async () => {
      this.logger.info('Running scheduled social sentiment tracking')
      // Implementation would update social sentiment
    }, null, true)
  }

  /**
   * Setup Bull queue processors
   */
  private setupQueues(): void {
    this.newsQueue.process('analyze-sentiment', async (job) => {
      const { newsItem } = job.data
      return this.analyzeSentiment(newsItem.title + ' ' + newsItem.content)
    })

    this.dataQueue.process('process-realtime', async (job) => {
      const { data, source } = job.data
      // Process real-time market data
      return this.storeRealtimeData(data, source)
    })

    this.sentimentQueue.process('update-sentiment', async (job) => {
      const { symbol } = job.data
      // Update comprehensive sentiment for symbol
      return this.updateSymbolSentiment(symbol)
    })
  }

  /**
   * Store real-time data in Redis
   */
  private async storeRealtimeData(data: any, source: DataSource): Promise<void> {
    // Implementation to store real-time data
  }

  /**
   * Update symbol sentiment
   */
  private async updateSymbolSentiment(symbol: string): Promise<void> {
    // Implementation to aggregate and update sentiment
  }

  /**
   * Subscribe to real-time updates for a symbol
   */
  async subscribeToSymbol(symbol: string): Promise<void> {
    // Subscribe to WebSocket feeds for the symbol
    const finnhubWs = this.wsConnections.get('finnhub')
    if (finnhubWs) {
      finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol }))
    }
  }

  /**
   * Get cached market data
   */
  async getCachedMarketData(symbol: string): Promise<MarketDataPoint | null> {
    const cached = await this.redis.get(`market_data:${symbol}`)
    return cached ? JSON.parse(cached) : null
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    return {
      status: 'healthy',
      wsConnections: this.wsConnections.size,
      queues: {
        news: await this.newsQueue.getJobCounts(),
        data: await this.dataQueue.getJobCounts(),
        sentiment: await this.sentimentQueue.getJobCounts()
      },
      redis: this.redis.status
    }
  }
} 