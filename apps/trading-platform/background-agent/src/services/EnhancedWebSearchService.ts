import { createLogger } from '../utils/logger'
import { WebSearchService, SearchResult, SearchOptions } from './WebSearchService'
import { SearchOptimizer, SearchRequest } from './SearchOptimizer'
import { ContentProcessor, ContentResult, ProcessingOptions } from './ContentProcessor'
import { CacheService } from './CacheService'

const logger = createLogger('enhanced-web-search')

export interface EnhancedSearchOptions extends SearchOptions {
  processingOptions?: ProcessingOptions
  priority?: 'HIGH' | 'MEDIUM' | 'LOW'
  enableContentProcessing?: boolean
  maxProcessedResults?: number
}

export interface EnhancedSearchResult {
  searchResults: SearchResult[]
  processedContent: ContentResult[]
  totalUrls: number
  relevantContent: number
  processingStats: {
    duplicatesFiltered: number
    irrelevantFiltered: number
    totalProcessingTime: number
  }
  cacheStatus: {
    searchCacheHit: boolean
    contentCacheHits: number
  }
}

export class EnhancedWebSearchService {
  private webSearchService: WebSearchService
  private searchOptimizer: SearchOptimizer
  private contentProcessor: ContentProcessor
  private cacheService: CacheService

  constructor() {
    this.webSearchService = new WebSearchService()
    this.searchOptimizer = new SearchOptimizer()
    this.contentProcessor = new ContentProcessor()
    this.cacheService = new CacheService()

    logger.info('Enhanced Web Search Service initialized')
  }

  /**
   * Perform optimized search with intelligent content processing
   */
  async searchWithContentProcessing(
    symbol: string,
    companyName?: string,
    options: EnhancedSearchOptions = {}
  ): Promise<EnhancedSearchResult> {
    const startTime = Date.now()
    
    const {
      searchType = 'comprehensive',
      priority = 'MEDIUM',
      maxResults = 20,
      enableContentProcessing = true,
      maxProcessedResults = 10,
      processingOptions = {}
    } = options

    logger.info(`Starting enhanced search for ${symbol} (${searchType}, priority: ${priority})`)

    try {
      // Step 1: Check comprehensive cache first
      const comprehensiveCacheKey = `enhanced:${symbol}:${searchType}:${JSON.stringify(options)}`
      const cachedResult = await this.cacheService.getJSON(comprehensiveCacheKey)
      
      if (cachedResult) {
        logger.info(`Comprehensive cache hit for ${symbol}`)
        return {
          ...cachedResult,
          cacheStatus: { searchCacheHit: true, contentCacheHits: cachedResult.processedContent?.length || 0 }
        }
      }

      // Step 2: Optimize search requests through SearchOptimizer
      const searchResults = await this.performOptimizedSearch(symbol, options, companyName)
      
      if (!enableContentProcessing || searchResults.length === 0) {
        const result: EnhancedSearchResult = {
          searchResults,
          processedContent: [],
          totalUrls: searchResults.length,
          relevantContent: 0,
          processingStats: {
            duplicatesFiltered: 0,
            irrelevantFiltered: 0,
            totalProcessingTime: Date.now() - startTime
          },
          cacheStatus: { searchCacheHit: false, contentCacheHits: 0 }
        }

        // ⚡ OPTIMIZATION: Only cache if result is reasonable size
        const resultSize = JSON.stringify(result).length
        if (resultSize < 500000) { // Only cache if < 500KB
          await this.cacheService.set(comprehensiveCacheKey, result, 1800) // ⚡ REDUCED: 30 min
        }
        return result
      }

      // Step 3: Extract URLs and process content intelligently
      const urls = searchResults
        .filter(result => result.url && this.isValidUrl(result.url))
        .map(result => result.url)
        .slice(0, Math.min(maxResults * 2, 40)) // Process more URLs than needed to get quality content

      logger.info(`Processing ${urls.length} URLs for content analysis`)

      // Step 4: Process content with quality filtering
      const processedContent = await this.contentProcessor.processUrls(
        urls,
        symbol,
        {
          ...processingOptions,
          relevanceThreshold: processingOptions.relevanceThreshold || 0.6,
          timelinessThresholdDays: processingOptions.timelinessThresholdDays || 90
        }
      )

      // Step 5: Apply additional filtering and ranking
      const filteredContent = this.applyAdvancedFiltering(processedContent, symbol)
        .slice(0, maxProcessedResults)

      // Step 6: Calculate processing statistics
      const stats = {
        duplicatesFiltered: processedContent.filter(c => c.isDuplicate).length,
        irrelevantFiltered: processedContent.filter(c => !c.isRelevant).length,
        totalProcessingTime: Date.now() - startTime
      }

      const result: EnhancedSearchResult = {
        searchResults,
        processedContent: filteredContent,
        totalUrls: urls.length,
        relevantContent: filteredContent.length,
        processingStats: stats,
        cacheStatus: { searchCacheHit: false, contentCacheHits: 0 }
      }

      // Step 7: Cache the comprehensive result (if not too large)
      const finalResultSize = JSON.stringify(result).length
      if (finalResultSize < 500000) { // Only cache if < 500KB  
        await this.cacheService.set(comprehensiveCacheKey, result, 1800) // ⚡ REDUCED: 30 min
      } else {
        logger.debug(`Skipping cache for large comprehensive result: ${finalResultSize} bytes`)
      }

      logger.info(`Enhanced search completed for ${symbol}: ${filteredContent.length}/${urls.length} quality results in ${stats.totalProcessingTime}ms`)

      return result

    } catch (error) {
      logger.error(`Enhanced search failed for ${symbol}:`, {
        message: error instanceof Error ? error.message : String(error),
        searchType,
        priority
      })

      // Return basic search results as fallback
      const fallbackResults = await this.performOptimizedSearch(symbol, options, companyName)
      
      return {
        searchResults: fallbackResults,
        processedContent: [],
        totalUrls: fallbackResults.length,
        relevantContent: 0,
        processingStats: {
          duplicatesFiltered: 0,
          irrelevantFiltered: 0,
          totalProcessingTime: Date.now() - startTime
        },
        cacheStatus: { searchCacheHit: false, contentCacheHits: 0 }
      }
    }
  }

  /**
   * Perform optimized search using SearchOptimizer
   */
  private async performOptimizedSearch(
    symbol: string,
    options: EnhancedSearchOptions,
    companyName?: string
  ): Promise<SearchResult[]> {
    const { searchType = 'comprehensive', priority = 'MEDIUM', maxResults = 20 } = options

    // Create search request for optimizer
    const searchRequest: SearchRequest = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      query: this.buildOptimizedQuery(symbol, searchType, companyName),
      searchType,
      priority,
      maxResults
    }

    try {
      // Add to optimizer queue
      const cacheKey = await this.searchOptimizer.addSearchRequest(searchRequest)
      
      // For now, fallback to direct search (in production, this would wait for queue processing)
      return await this.webSearchService.searchCompanyInfo(symbol, companyName, searchType)
      
    } catch (error) {
      logger.error(`Optimized search failed for ${symbol}, falling back to direct search:`, {
        message: error instanceof Error ? error.message : String(error)
      })
      
      // Fallback to direct search
      return await this.webSearchService.searchCompanyInfo(symbol, companyName, searchType)
    }
  }

  /**
   * Build optimized query for better search results
   */
  private buildOptimizedQuery(symbol: string, searchType: string, companyName?: string): string {
    const baseSymbol = companyName ? `"${companyName}" (${symbol})` : symbol

    const queryTemplates = {
      comprehensive: `${baseSymbol} financial performance earnings revenue growth analysis recent`,
      news: `${baseSymbol} latest news earnings announcement financial results`,
      earnings: `${baseSymbol} quarterly earnings results conference call transcript guidance`,
      filings: `${baseSymbol} SEC filing 10-K 10-Q annual report investor relations`,
      analysis: `${baseSymbol} analyst rating recommendation price target investment research`
    }

    return queryTemplates[searchType as keyof typeof queryTemplates] || queryTemplates.comprehensive
  }

  /**
   * Apply advanced filtering to processed content
   */
  private applyAdvancedFiltering(content: ContentResult[], symbol: string): ContentResult[] {
    return content
      .filter(item => {
        // Additional quality checks
        if (item.wordCount < 100) return false // Too short
        if (item.relevanceScore < 0.5) return false // Not relevant enough
        if (item.sentiment < -0.8) return false // Too negative (might be spam/attacks)
        
        // Check for symbol mention in title or first 500 chars
        const searchText = (item.title + ' ' + item.extractedText.substring(0, 500)).toLowerCase()
        if (!searchText.includes(symbol.toLowerCase())) return false
        
        return true
      })
      .sort((a, b) => {
        // Advanced scoring combining multiple factors
        const scoreA = this.calculateAdvancedScore(a, symbol)
        const scoreB = this.calculateAdvancedScore(b, symbol)
        return scoreB - scoreA
      })
  }

  /**
   * Calculate advanced content score
   */
  private calculateAdvancedScore(content: ContentResult, symbol: string): number {
    let score = content.overallScore

    // Boost for recent content
    if (content.publishedDate) {
      const daysOld = (Date.now() - content.publishedDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysOld <= 7) score += 0.2
      else if (daysOld <= 30) score += 0.1
    }

    // Boost for financial content types
    const typeBoosts = {
      earnings: 0.3,
      analysis: 0.2,
      filing: 0.25,
      news: 0.1,
      other: 0
    }
    score += typeBoosts[content.contentType] || 0

    // Boost for multiple symbol mentions
    const symbolRegex = new RegExp(`\\b${symbol.toLowerCase()}\\b`, 'gi')
    const mentions = (content.extractedText.match(symbolRegex) || []).length
    score += Math.min(mentions * 0.05, 0.15)

    // Boost for key financial topics
    const keyTopicBoost = content.keyTopics.length * 0.02
    score += Math.min(keyTopicBoost, 0.1)

    // Penalty for very negative sentiment (spam filter)
    if (content.sentiment < -0.5) {
      score -= 0.1
    }

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Batch process multiple symbols efficiently
   */
  async batchSearchSymbols(
    symbols: string[], 
    searchType: 'comprehensive' | 'news' | 'earnings' | 'filings' | 'analysis' = 'comprehensive',
    options: EnhancedSearchOptions = {}
  ): Promise<Map<string, EnhancedSearchResult>> {
    logger.info(`Starting batch search for ${symbols.length} symbols`)

    const results = new Map<string, EnhancedSearchResult>()
    
    // Process in batches of 5 to avoid overwhelming APIs
    const batchSize = 5
    const batches = []
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      batches.push(symbols.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (symbol) => {
        try {
          const result = await this.searchWithContentProcessing(symbol, undefined, {
            ...options,
            searchType,
            priority: 'MEDIUM'
          })
          return { symbol, result }
        } catch (error) {
          logger.error(`Failed to process symbol ${symbol}:`, {
            message: error instanceof Error ? error.message : String(error)
          })
          return { symbol, result: null }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      
      for (const { symbol, result } of batchResults) {
        if (result) {
          results.set(symbol, result)
        }
      }

      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    logger.info(`Batch search completed: ${results.size}/${symbols.length} successful`)
    return results
  }

  /**
   * Get service status and statistics
   */
  getServiceStatus() {
    return {
      searchOptimizer: this.searchOptimizer.getQueueStatus(),
      rateLimits: this.searchOptimizer.getRateLimitStatus(),
      contentProcessor: this.contentProcessor.getStats(),
      timestamp: new Date()
    }
  }

  /**
   * Clear all caches
   */
  async clearCaches() {
    this.contentProcessor.clearCache()
    // Note: CacheService clearing would need to be implemented
    logger.info('All caches cleared')
  }
} 