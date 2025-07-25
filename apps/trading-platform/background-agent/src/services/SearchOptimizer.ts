import { createLogger } from '../utils/logger'
import { CacheService } from './CacheService'

const logger = createLogger('search-optimizer')

export interface SearchRequest {
  id: string
  symbol: string
  query: string
  searchType: 'comprehensive' | 'news' | 'earnings' | 'filings' | 'analysis'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  maxResults: number
  cacheKey?: string
}

export interface OptimizedQuery {
  combinedQuery: string
  symbols: string[]
  searchTypes: string[]
  maxResults: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface RateLimit {
  provider: string
  requestsPerMinute: number
  requestsRemaining: number
  resetTime: Date
  lastRequestTime: Date
}

export class SearchOptimizer {
  private rateLimits: Map<string, RateLimit> = new Map()
  private requestQueue: SearchRequest[] = []
  private isProcessing = false
  private cacheService: CacheService

  constructor() {
    this.cacheService = new CacheService()
    this.initializeRateLimits()
  }

  /**
   * Initialize rate limits for different providers
   */
  private initializeRateLimits() {
    // Conservative rate limits based on typical API tiers
    this.rateLimits.set('tavily', {
      provider: 'tavily',
      requestsPerMinute: 20, // Conservative estimate
      requestsRemaining: 20,
      resetTime: new Date(Date.now() + 60000),
      lastRequestTime: new Date(0)
    })

    this.rateLimits.set('exa', {
      provider: 'exa',
      requestsPerMinute: 10, // More conservative for paid API
      requestsRemaining: 10,
      resetTime: new Date(Date.now() + 60000),
      lastRequestTime: new Date(0)
    })

    this.rateLimits.set('serp', {
      provider: 'serp',
      requestsPerMinute: 15, // SERP API typical limits
      requestsRemaining: 15,
      resetTime: new Date(Date.now() + 60000),
      lastRequestTime: new Date(0)
    })
  }

  /**
   * Add search request to queue with intelligent batching
   */
  async addSearchRequest(request: SearchRequest): Promise<string> {
    // Check cache first
    const cacheKey = request.cacheKey || this.generateCacheKey(request)
    const cached = await this.cacheService.getJSON(cacheKey)
    
    if (cached) {
      logger.info(`Cache hit for search: ${request.query.substring(0, 50)}...`)
      return cached
    }

    // Add to queue
    this.requestQueue.push({ ...request, cacheKey })
    logger.info(`Added search request to queue: ${request.symbol} (${request.priority})`)

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue()
    }

    return cacheKey
  }

  /**
   * Process search queue with intelligent batching and rate limiting
   */
  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return
    }

    this.isProcessing = true
    logger.info(`Processing search queue with ${this.requestQueue.length} requests`)

    try {
      while (this.requestQueue.length > 0) {
        // Group requests by priority and searchability
        const batch = this.createOptimalBatch()
        
        if (batch.length === 0) {
          // No requests can be processed due to rate limits
          const waitTime = this.getMinWaitTime()
          logger.info(`Rate limit reached. Waiting ${waitTime}ms before next batch`)
          await this.sleep(waitTime)
          continue
        }

        // Process batch
        await this.processBatch(batch)
        
        // Small delay between batches to be respectful
        await this.sleep(1000)
      }
    } catch (error) {
      logger.error('Error processing search queue:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        queueLength: this.requestQueue.length
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Create optimal batch of requests based on rate limits and priority
   */
  private createOptimalBatch(): SearchRequest[] {
    const batch: SearchRequest[] = []
    const now = new Date()

    // Update rate limit counters
    this.updateRateLimits(now)

    // Get available providers
    const availableProviders = Array.from(this.rateLimits.entries())
      .filter(([_, limit]) => limit.requestsRemaining > 0)
      .map(([provider, _]) => provider)

    if (availableProviders.length === 0) {
      return []
    }

    // Sort queue by priority
    this.requestQueue.sort((a, b) => {
      const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    // Select requests for batch (max 3 to avoid overwhelming)
    const maxBatchSize = Math.min(3, availableProviders.length)
    
    for (let i = 0; i < Math.min(maxBatchSize, this.requestQueue.length); i++) {
      batch.push(this.requestQueue.shift()!)
    }

    return batch
  }

  /**
   * Process a batch of search requests
   */
  private async processBatch(batch: SearchRequest[]) {
    logger.info(`Processing batch of ${batch.length} search requests`)

    // Create optimized queries by combining similar requests
    const optimizedQueries = this.optimizeQueries(batch)

    for (const optimizedQuery of optimizedQueries) {
      try {
        // This would call the actual search service
        // For now, we'll simulate the result
        const result = await this.executeOptimizedSearch(optimizedQuery)
        
        // Cache results for individual requests
        for (const request of batch) {
          if (optimizedQuery.symbols.includes(request.symbol)) {
            await this.cacheService.set(
              request.cacheKey!, 
              result, 
              3600 // 1 hour cache
            )
          }
        }

        // Update rate limits
        this.decrementRateLimit('tavily')
        
        logger.info(`Processed optimized query for symbols: ${optimizedQuery.symbols.join(', ')}`)
        
      } catch (error) {
        logger.error('Failed to process optimized query:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          symbols: optimizedQuery.symbols
        })
      }
    }
  }

  /**
   * Optimize queries by combining similar searches
   */
  private optimizeQueries(batch: SearchRequest[]): OptimizedQuery[] {
    const optimized: OptimizedQuery[] = []

    // Group by search type and combine symbols
    const grouped = batch.reduce((acc, request) => {
      const key = `${request.searchType}-${request.priority}`
      if (!acc[key]) {
        acc[key] = {
          searchType: request.searchType,
          priority: request.priority,
          symbols: [],
          maxResults: 0
        }
      }
      acc[key].symbols.push(request.symbol)
      acc[key].maxResults = Math.max(acc[key].maxResults, request.maxResults)
      return acc
    }, {} as Record<string, any>)

    // Create optimized queries
    for (const group of Object.values(grouped)) {
      const { searchType, priority, symbols, maxResults } = group as any
      
      const combinedQuery = this.createCombinedQuery(symbols, searchType)
      
      optimized.push({
        combinedQuery,
        symbols,
        searchTypes: [searchType],
        maxResults: Math.min(maxResults * symbols.length, 50), // Cap at 50 total
        priority
      })
    }

    return optimized
  }

  /**
   * Create a combined query for multiple symbols
   */
  private createCombinedQuery(symbols: string[], searchType: string): string {
    const symbolsStr = symbols.length > 1 
      ? `(${symbols.join(' OR ')})` 
      : symbols[0]

    switch (searchType) {
      case 'news':
        return `${symbolsStr} stock news latest earnings results`
      case 'earnings':
        return `${symbolsStr} quarterly earnings results transcript`
      case 'filings':
        return `${symbolsStr} SEC filing annual report 10-K`
      case 'analysis':
        return `${symbolsStr} analyst rating price target investment analysis`
      default:
        return `${symbolsStr} financial results business news market analysis`
    }
  }

  /**
   * Execute optimized search (placeholder for actual implementation)
   */
  private async executeOptimizedSearch(query: OptimizedQuery): Promise<any> {
    // This would integrate with the actual WebSearchService
    // For now, return a placeholder result
    return {
      query: query.combinedQuery,
      symbols: query.symbols,
      results: [],
      timestamp: new Date()
    }
  }

  /**
   * Update rate limit counters
   */
  private updateRateLimits(now: Date) {
    for (const [provider, limit] of this.rateLimits.entries()) {
      if (now >= limit.resetTime) {
        // Reset the counter
        limit.requestsRemaining = limit.requestsPerMinute
        limit.resetTime = new Date(now.getTime() + 60000)
        logger.debug(`Rate limit reset for ${provider}`)
      }
    }
  }

  /**
   * Decrement rate limit for a provider
   */
  private decrementRateLimit(provider: string) {
    const limit = this.rateLimits.get(provider)
    if (limit && limit.requestsRemaining > 0) {
      limit.requestsRemaining--
      limit.lastRequestTime = new Date()
    }
  }

  /**
   * Get minimum wait time before next request
   */
  private getMinWaitTime(): number {
    let minWait = Infinity
    const now = new Date()

    for (const limit of this.rateLimits.values()) {
      if (limit.requestsRemaining === 0) {
        const waitTime = limit.resetTime.getTime() - now.getTime()
        minWait = Math.min(minWait, Math.max(0, waitTime))
      }
    }

    return minWait === Infinity ? 1000 : minWait
  }

  /**
   * Generate cache key for search request
   */
  private generateCacheKey(request: SearchRequest): string {
    return `search:${request.symbol}:${request.searchType}:${request.query.substring(0, 50)}`
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): Record<string, RateLimit> {
    const status: Record<string, RateLimit> = {}
    for (const [provider, limit] of this.rateLimits.entries()) {
      status[provider] = { ...limit }
    }
    return status
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing,
      priorityBreakdown: {
        HIGH: this.requestQueue.filter(r => r.priority === 'HIGH').length,
        MEDIUM: this.requestQueue.filter(r => r.priority === 'MEDIUM').length,
        LOW: this.requestQueue.filter(r => r.priority === 'LOW').length
      }
    }
  }
} 