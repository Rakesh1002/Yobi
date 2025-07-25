import { createLogger } from '../utils/logger'
import { SearXNGService, SearXNGResult, FinancialSearchOptions } from './SearXNGService'
import { ContentProcessor, ContentResult, ProcessingOptions } from './ContentProcessor'
import { CacheService } from './CacheService'

const logger = createLogger('unified-search')

export interface UnifiedSearchOptions extends FinancialSearchOptions {
  enableContentProcessing?: boolean
  processingOptions?: ProcessingOptions
  enableIntelligentFiltering?: boolean
  enableMarketContext?: boolean
  maxQualityResults?: number
}

export interface SearchIntelligence {
  marketSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  keyTrends: string[]
  competitorMentions: string[]
  riskFactors: string[]
  opportunityIndicators: string[]
  newsFlow: 'HIGH' | 'MEDIUM' | 'LOW'
  dataFreshness: number // percentage of content from last 7 days
}

export interface UnifiedSearchResult {
  symbol: string
  searchResults: SearXNGResult[]
  processedContent: ContentResult[]
  intelligence: SearchIntelligence
  qualityMetrics: {
    totalSources: number
    uniqueDomains: number
    avgRelevanceScore: number
    avgTimelinessScore: number
    contentTypes: Record<string, number>
  }
  processingStats: {
    searchTime: number
    processingTime: number
    totalTime: number
    cacheHits: number
    duplicatesRemoved: number
    irrelevantFiltered: number
  }
  recommendations: string[]
}

export class UnifiedSearchService {
  private searxngService: SearXNGService
  private contentProcessor: ContentProcessor
  private cacheService: CacheService

  constructor() {
    this.searxngService = new SearXNGService()
    this.contentProcessor = new ContentProcessor()
    this.cacheService = new CacheService()
    
    logger.info('Unified Search Service initialized with SearXNG + Content Processing')
  }

  /**
   * Perform comprehensive financial intelligence search
   */
  async searchFinancialIntelligence(
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    const startTime = Date.now()
    const {
      symbol,
      companyName,
      searchType = 'comprehensive',
      enableContentProcessing = true,
      enableIntelligentFiltering = true,
      enableMarketContext = true,
      maxQualityResults = 15,
      processingOptions = {}
    } = options

    logger.info(`Starting unified financial intelligence search for ${symbol}`)

    try {
      // Step 1: Check comprehensive cache
      const cacheKey = `unified:${symbol}:${searchType}:${JSON.stringify(options)}`
      const cached = await this.cacheService.getJSON(cacheKey)
      
      if (cached) {
        logger.info(`Unified cache hit for ${symbol}`)
        return cached
      }

      // Step 2: Perform SearXNG search
      const searchStartTime = Date.now()
      const searchResults = await this.searxngService.searchFinancialData({
        symbol,
        companyName,
        searchType,
        timeRange: options.timeRange || 'month',
        maxResults: 60, // Get more results to filter for quality
        includeRelatedCompanies: options.includeRelatedCompanies,
        priorityEngines: options.priorityEngines
      })
      const searchTime = Date.now() - searchStartTime

      logger.info(`SearXNG found ${searchResults.length} results for ${symbol}`)

      // Step 3: Process content if enabled
      let processedContent: ContentResult[] = []
      let processingTime = 0
      
      if (enableContentProcessing && searchResults.length > 0) {
        const processingStartTime = Date.now()
        
        const urls = searchResults
          .map(result => result.url)
          .filter(url => this.isValidFinancialUrl(url))
          .slice(0, 40) // Limit URLs to process

        processedContent = await this.contentProcessor.processUrls(
          urls,
          symbol,
          {
            relevanceThreshold: 0.65,
            timelinessThresholdDays: 90,
            enableDeduplication: true,
            extractEntities: true,
            analyzeSentiment: true,
            ...processingOptions
          }
        )

        processingTime = Date.now() - processingStartTime
        logger.info(`Processed ${processedContent.length} high-quality content pieces`)
      }

      // Step 4: Apply intelligent filtering
      if (enableIntelligentFiltering) {
        processedContent = this.applyIntelligentFiltering(processedContent, symbol)
          .slice(0, maxQualityResults)
      }

      // Step 5: Generate intelligence insights
      const intelligence = enableMarketContext 
        ? await this.generateIntelligence(searchResults, processedContent, symbol)
        : this.getDefaultIntelligence()

      // Step 6: Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(searchResults, processedContent)

      // Step 7: Generate recommendations
      const recommendations = this.generateRecommendations(
        intelligence,
        qualityMetrics,
        processedContent
      )

      // Step 8: Compile final result
      const totalTime = Date.now() - startTime
      const result: UnifiedSearchResult = {
        symbol,
        searchResults,
        processedContent,
        intelligence,
        qualityMetrics,
        processingStats: {
          searchTime,
          processingTime,
          totalTime,
          cacheHits: 0, // TODO: Implement cache hit tracking
          duplicatesRemoved: processedContent.filter(c => c.isDuplicate).length,
          irrelevantFiltered: searchResults.length - processedContent.length
        },
        recommendations
      }

      // Step 9: Cache the result (if not too large)
      const resultSize = JSON.stringify(result).length
      if (resultSize < 300000) { // Only cache if < 300KB
        await this.cacheService.set(cacheKey, result, 900) // ⚡ REDUCED: 15 min cache
      } else {
        logger.debug(`Skipping cache for large unified result: ${resultSize} bytes`)
      }

      logger.info(`Unified search completed for ${symbol}: ${processedContent.length} quality results in ${totalTime}ms`)
      return result

    } catch (error) {
      logger.error(`Unified search failed for ${symbol}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        searchType
      })

      // Return minimal result on error
      return {
        symbol,
        searchResults: [],
        processedContent: [],
        intelligence: this.getDefaultIntelligence(),
        qualityMetrics: this.getDefaultQualityMetrics(),
        processingStats: {
          searchTime: 0,
          processingTime: 0,
          totalTime: Date.now() - startTime,
          cacheHits: 0,
          duplicatesRemoved: 0,
          irrelevantFiltered: 0
        },
        recommendations: ['Search failed - please try again later']
      }
    }
  }

  /**
   * Batch process multiple symbols with market context
   */
  async batchSearchWithIntelligence(
    symbols: string[],
    searchType: UnifiedSearchOptions['searchType'] = 'comprehensive',
    options: Partial<UnifiedSearchOptions> = {}
  ): Promise<Map<string, UnifiedSearchResult>> {
    logger.info(`Starting batch intelligence search for ${symbols.length} symbols`)

    const results = new Map<string, UnifiedSearchResult>()
    const batchSize = 3 // Conservative batch size for quality

    // Process in batches
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          const result = await this.searchFinancialIntelligence({
            symbol,
            searchType,
            maxQualityResults: 10, // Reduce for batch processing
            ...options
          })
          return { symbol, result }
        } catch (error) {
          logger.error(`Batch intelligence search failed for ${symbol}:`, {
            message: error instanceof Error ? error.message : 'Unknown error'
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

      // Delay between batches to be respectful
      if (i + batchSize < symbols.length) {
        await this.sleep(3000)
      }
    }

    // Generate cross-symbol market insights
    if (results.size > 1) {
      this.enrichWithMarketContext(results)
    }

    logger.info(`Batch intelligence search completed: ${results.size}/${symbols.length} successful`)
    return results
  }

  /**
   * Search for market themes and trends
   */
  async searchMarketThemes(
    themes: string[],
    timeRange: string = 'week'
  ): Promise<{
    themeResults: Map<string, ContentResult[]>
    crossThemeInsights: SearchIntelligence
    emergingTrends: string[]
  }> {
    logger.info(`Searching market themes: ${themes.join(', ')}`)

    const themeResults = new Map<string, ContentResult[]>()

    // Search each theme
    for (const theme of themes) {
      try {
        const searchResponse = await this.searxngService.search({ q: `${theme} market trends ${timeRange}` })
                  const results = Array.isArray(searchResponse) ? searchResponse : (searchResponse as any).results || []
        
        if (results.length > 0) {
          const urls = results.map((r: any) => r.url).slice(0, 20)
          const processed = await this.contentProcessor.processUrls(
            urls,
            theme,
            {
              relevanceThreshold: 0.6,
              timelinessThresholdDays: 30,
              enableDeduplication: true
            }
          )
          
          themeResults.set(theme, processed.slice(0, 10))
        }
      } catch (error) {
        logger.error(`Theme search failed for ${theme}:`, { message: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // Generate cross-theme insights
    const allContent = Array.from(themeResults.values()).flat()
    const crossThemeInsights = await this.generateThemeIntelligence(allContent, themes)
    const emergingTrends = this.extractEmergingTrends(allContent)

    return {
      themeResults,
      crossThemeInsights,
      emergingTrends
    }
  }

  /**
   * Apply intelligent filtering based on multiple factors
   */
  private applyIntelligentFiltering(content: ContentResult[], symbol: string): ContentResult[] {
    return content
      .filter(item => {
        // Quality thresholds
        if (item.wordCount < 150) return false
        if (item.relevanceScore < 0.6) return false
        if (item.overallScore < 0.5) return false

        // Domain quality check
        const domain = new URL(item.url).hostname
        if (this.isLowQualityDomain(domain)) return false

        // Content freshness (boost recent content)
        if (item.publishedDate) {
          const daysOld = (Date.now() - item.publishedDate.getTime()) / (1000 * 60 * 60 * 24)
          if (daysOld > 180) return false // Exclude very old content
        }

        return true
      })
      .sort((a, b) => {
        // Advanced scoring combining multiple factors
        const scoreA = this.calculateUnifiedScore(a, symbol)
        const scoreB = this.calculateUnifiedScore(b, symbol)
        return scoreB - scoreA
      })
  }

  /**
   * Generate intelligence insights from search results
   */
  private async generateIntelligence(
    searchResults: SearXNGResult[],
    processedContent: ContentResult[],
    symbol: string
  ): Promise<SearchIntelligence> {
    // Sentiment analysis
    const sentiments = processedContent.map(c => c.sentiment)
    const avgSentiment = sentiments.length > 0 
      ? sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length 
      : 0

    const marketSentiment = avgSentiment > 0.1 ? 'POSITIVE' 
      : avgSentiment < -0.1 ? 'NEGATIVE' 
      : 'NEUTRAL'

    // Extract key trends
    const allTopics = processedContent.flatMap(c => c.keyTopics)
    const keyTrends = this.getTopFrequentItems(allTopics, 5)

    // Competitor mentions
    const allEntities = processedContent.flatMap(c => c.entities)
    const competitorMentions = allEntities
      .filter(entity => entity.length > 2 && entity !== symbol)
      .filter(entity => /^[A-Z]{2,5}$/.test(entity)) // Stock symbol pattern
      .slice(0, 5)

    // Risk factors and opportunities
    const { riskFactors, opportunityIndicators } = this.extractRiskOpportunities(processedContent)

    // News flow assessment
    const recentContent = processedContent.filter(c => {
      if (!c.publishedDate) return false
      const daysOld = (Date.now() - c.publishedDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysOld <= 7
    })

    const newsFlow = recentContent.length > 10 ? 'HIGH'
      : recentContent.length > 5 ? 'MEDIUM'
      : 'LOW'

    // Data freshness
    const dataFreshness = processedContent.length > 0
      ? (recentContent.length / processedContent.length) * 100
      : 0

    return {
      marketSentiment,
      keyTrends,
      competitorMentions,
      riskFactors,
      opportunityIndicators,
      newsFlow,
      dataFreshness
    }
  }

  /**
   * Calculate comprehensive quality metrics
   */
  private calculateQualityMetrics(
    searchResults: SearXNGResult[],
    processedContent: ContentResult[]
  ) {
    const uniqueDomains = new Set(
      processedContent.map(c => new URL(c.url).hostname)
    ).size

    const avgRelevanceScore = processedContent.length > 0
      ? processedContent.reduce((sum, c) => sum + c.relevanceScore, 0) / processedContent.length
      : 0

    const avgTimelinessScore = processedContent.length > 0
      ? processedContent.reduce((sum, c) => sum + c.timelinessScore, 0) / processedContent.length
      : 0

    const contentTypes = processedContent.reduce((acc, c) => {
      acc[c.contentType] = (acc[c.contentType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalSources: searchResults.length,
      uniqueDomains,
      avgRelevanceScore,
      avgTimelinessScore,
      contentTypes
    }
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    intelligence: SearchIntelligence,
    qualityMetrics: any,
    processedContent: ContentResult[]
  ): string[] {
    const recommendations: string[] = []

    // Sentiment-based recommendations
    if (intelligence.marketSentiment === 'POSITIVE') {
      recommendations.push('Strong positive sentiment detected - monitor for continuation')
    } else if (intelligence.marketSentiment === 'NEGATIVE') {
      recommendations.push('Negative sentiment identified - assess risk factors carefully')
    }

    // News flow recommendations
    if (intelligence.newsFlow === 'HIGH') {
      recommendations.push('High news activity - increased volatility expected')
    } else if (intelligence.newsFlow === 'LOW') {
      recommendations.push('Low news flow - monitor for catalyst events')
    }

    // Data quality recommendations
    if (qualityMetrics.avgRelevanceScore > 0.8) {
      recommendations.push('High-quality data sources identified - analysis confidence high')
    } else if (qualityMetrics.avgRelevanceScore < 0.6) {
      recommendations.push('Limited relevant data found - consider broader search criteria')
    }

    // Freshness recommendations
    if (intelligence.dataFreshness > 70) {
      recommendations.push('Recent information available - current analysis possible')
    } else if (intelligence.dataFreshness < 30) {
      recommendations.push('Limited recent data - analysis may be outdated')
    }

    return recommendations.slice(0, 5) // Limit to top 5
  }

  /**
   * Helper methods
   */
  private calculateUnifiedScore(content: ContentResult, symbol: string): number {
    let score = content.overallScore

    // Boost for recent content
    if (content.publishedDate) {
      const daysOld = (Date.now() - content.publishedDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysOld <= 3) score += 0.2
      else if (daysOld <= 7) score += 0.1
    }

    // Boost for financial domains
    const domain = new URL(content.url).hostname
    if (this.isHighQualityFinancialDomain(domain)) {
      score += 0.15
    }

    // Boost for content type
    const typeBoosts = {
      earnings: 0.25,
      analysis: 0.2,
      filing: 0.2,
      news: 0.1,
      other: 0
    }
    score += typeBoosts[content.contentType] || 0

    return Math.min(1, score)
  }

  private isValidFinancialUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url)
      const domain = parsedUrl.hostname.toLowerCase()
      
      // Exclude social media and low-quality domains
      const excludeDomains = [
        'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com',
        'pinterest.com', 'reddit.com', 'youtube.com'
      ]
      
      return !excludeDomains.some(excluded => domain.includes(excluded))
    } catch {
      return false
    }
  }

  private isHighQualityFinancialDomain(domain: string): boolean {
    const highQualityDomains = [
      'sec.gov', 'bloomberg.com', 'reuters.com', 'wsj.com',
      'marketwatch.com', 'finance.yahoo.com', 'fool.com',
      'seekingalpha.com', 'morningstar.com', 'finviz.com'
    ]
    
    return highQualityDomains.some(hq => domain.includes(hq))
  }

  private isLowQualityDomain(domain: string): boolean {
    const lowQualityPatterns = [
      'ads', 'spam', 'clickbait', 'affiliate', 'promo'
    ]
    
    return lowQualityPatterns.some(pattern => domain.includes(pattern))
  }

  private getTopFrequentItems(items: string[], limit: number): string[] {
    const frequency = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item)
  }

  private extractRiskOpportunities(content: ContentResult[]) {
    // Simple keyword-based extraction (can be enhanced with NLP)
    const riskKeywords = ['risk', 'concern', 'warning', 'decline', 'loss', 'negative']
    const opportunityKeywords = ['opportunity', 'growth', 'positive', 'increase', 'strong', 'beat']

    const allText = content.map(c => c.extractedText.toLowerCase()).join(' ')
    
    const riskFactors = riskKeywords.filter(keyword => allText.includes(keyword))
    const opportunityIndicators = opportunityKeywords.filter(keyword => allText.includes(keyword))

    return { riskFactors, opportunityIndicators }
  }

  private generateThemeIntelligence(content: ContentResult[], themes: string[]): SearchIntelligence {
    // Simplified theme intelligence generation
    return this.getDefaultIntelligence()
  }

  private extractEmergingTrends(content: ContentResult[]): string[] {
    // Extract emerging trends from content
    const allTopics = content.flatMap(c => c.keyTopics)
    return this.getTopFrequentItems(allTopics, 10)
  }

  private enrichWithMarketContext(results: Map<string, UnifiedSearchResult>) {
    // Add cross-symbol market context insights
    // This is a placeholder for more sophisticated market analysis
    logger.info('Enriching results with market context')
  }

  private getDefaultIntelligence(): SearchIntelligence {
    return {
      marketSentiment: 'NEUTRAL',
      keyTrends: [],
      competitorMentions: [],
      riskFactors: [],
      opportunityIndicators: [],
      newsFlow: 'LOW',
      dataFreshness: 0
    }
  }

  private getDefaultQualityMetrics() {
    return {
      totalSources: 0,
      uniqueDomains: 0,
      avgRelevanceScore: 0,
      avgTimelinessScore: 0,
      contentTypes: {}
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    const searxngHealth = await this.searxngService.healthCheck()
    const contentProcessorStats = this.contentProcessor.getStats()

    return {
      searxng: searxngHealth,
      contentProcessor: contentProcessorStats,
      unified: true,
      timestamp: new Date()
    }
  }
} 