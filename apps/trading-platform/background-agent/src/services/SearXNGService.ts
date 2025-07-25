import axios from 'axios'
import { createLogger } from '../utils/logger'
import { CacheService } from './CacheService.js'

const logger = createLogger('searxng-service')

// Enhanced configuration for maximum financial data coverage
export interface SearXNGConfig {
  baseUrl: string
  defaultCategories: string[]
  defaultEngines: string[]
  financialEngines: string[]
  timeout: number
  userAgent: string
  maxRetries: number
  retryDelay: number
  fallbackStrategies: boolean
}

export interface SearXNGSearchParams {
  q: string
  category?: string
  engines?: string | string[]
  time_range?: 'day' | 'week' | 'month' | 'year' | 'all'
  safesearch?: 0 | 1 | 2
  format?: 'html' | 'json' | 'csv' | 'rss'
  safe_search?: number
  lang?: string
  pageno?: number
}

export interface SearXNGResult {
  url: string
  title: string
  content: string
  engine: string
  category: string
  score: number
  positions: number[]
  engines: string[]
  publishedDate?: string
  thumbnail?: string
  img_src?: string
}

export interface SearXNGResponse {
  query: string
  number_of_results: number
  results: SearXNGResult[]
  answers: any[]
  corrections: any[]
  infoboxes: any[]
  suggestions: string[]
  unresponsive_engines: any[]
}

export interface FinancialSearchOptions {
  symbol: string
  companyName?: string
  searchType: 'news' | 'filings' | 'analysis' | 'earnings' | 'comprehensive' | 'reports' | 'sentiment'
  timeRange?: 'day' | 'week' | 'month' | 'year'
  maxResults?: number
  includeRelatedCompanies?: boolean
  priorityEngines?: string[]
  enableFallback?: boolean
  aggressiveSearch?: boolean
}

export class SearXNGService {
  private config: SearXNGConfig
  private cacheService: CacheService
  private client: axios.AxiosInstance
  private lastRequestTime: number = 0
  private failedEngines: Set<string> = new Set()
  private engineRetryCount: Map<string, number> = new Map()

  constructor(config?: Partial<SearXNGConfig>) {
    this.config = {
      baseUrl: process.env.SEARXNG_URL || 'http://localhost:8080',
      defaultCategories: ['general', 'news'],
      defaultEngines: ['startpage', 'brave', 'duckduckgo'],
      financialEngines: ['google', 'bing', 'yahoo', 'google_news', 'bing_news', 'reddit'],
      timeout: 30000,
      userAgent: 'Yobi-Financial-Platform/1.0',
      maxRetries: 5,
      retryDelay: 2000,
      fallbackStrategies: true,
      ...config
    }

    this.cacheService = new CacheService()
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })

    logger.info(`SearXNG Service initialized with base URL: ${this.config.baseUrl}`)
  }

  /**
   * Enhanced financial data search with multiple strategies and fallbacks
   */
  async searchFinancialData(options: FinancialSearchOptions): Promise<SearXNGResult[]> {
    const {
      symbol,
      companyName,
      searchType,
      timeRange = 'month',
      maxResults = 50,
      includeRelatedCompanies = false,
      priorityEngines,
      enableFallback = true,
      aggressiveSearch = false
    } = options

    logger.info(`Enhanced financial search for ${symbol} (${searchType})`)

    const searchStrategies = this.buildSearchStrategies(symbol, companyName, searchType, aggressiveSearch)
    let allResults: SearXNGResult[] = []

    // Strategy 1: Primary search with priority engines
    try {
      const primaryResults = await this.executeSearchStrategy({
        strategies: searchStrategies.primary,
        engines: priorityEngines || this.config.financialEngines,
        timeRange,
        maxResults: Math.floor(maxResults * 0.6)
      })
      allResults.push(...primaryResults)
      logger.info(`Primary strategy found ${primaryResults.length} results`)
    } catch (error: any) {
      logger.warn(`Primary search strategy failed:`, { message: (error as Error).message })
    }

    // Strategy 2: Fallback search with alternative engines (if enabled and needed)
    if (enableFallback && allResults.length < maxResults * 0.3) {
      try {
        const fallbackResults = await this.executeSearchStrategy({
          strategies: searchStrategies.fallback,
          engines: this.config.defaultEngines,
          timeRange,
          maxResults: Math.floor(maxResults * 0.4)
        })
        allResults.push(...fallbackResults)
        logger.info(`Fallback strategy found ${fallbackResults.length} additional results`)
      } catch (error: any) {
        logger.warn(`Fallback search strategy failed:`, { message: (error as Error).message })
      }
    }

    // Strategy 3: Aggressive search with comprehensive engines (if enabled and still needed)
    if (aggressiveSearch && allResults.length < maxResults * 0.5) {
      try {
        const aggressiveResults = await this.executeSearchStrategy({
          strategies: searchStrategies.aggressive,
          engines: ['google', 'bing', 'yahoo', 'yandex', 'google_scholar', 'semantic_scholar'],
          timeRange: 'year', // Broader time range for comprehensive search
          maxResults: maxResults - allResults.length
        })
        allResults.push(...aggressiveResults)
        logger.info(`Aggressive strategy found ${aggressiveResults.length} additional results`)
      } catch (error: any) {
        logger.warn(`Aggressive search strategy failed:`, { message: (error as Error).message })
      }
    }

    // Deduplicate and sort results
    const uniqueResults = this.deduplicateResults(allResults)
    const sortedResults = this.sortResultsByRelevance(uniqueResults, symbol, searchType)

    logger.info(`Enhanced search completed: ${sortedResults.length} unique results for ${symbol}`)
    return sortedResults.slice(0, maxResults)
  }

  /**
   * Build multiple search strategies for comprehensive coverage
   */
  private buildSearchStrategies(
    symbol: string, 
    companyName?: string, 
    searchType?: string,
    aggressive: boolean = false
  ): { primary: string[], fallback: string[], aggressive: string[] } {
    const baseSymbol = companyName ? `"${companyName}" ${symbol}` : symbol
    
    const strategies: { primary: string[], fallback: string[], aggressive: string[] } = {
      primary: [],
      fallback: [],
      aggressive: []
    }

    // Primary strategies - high precision
    switch (searchType) {
      case 'news':
        strategies.primary = [
          `${baseSymbol} stock news latest earnings announcement`,
          `"${symbol}" financial news today market update`,
          `${baseSymbol} quarterly results revenue guidance`
        ]
        break
      case 'filings':
        strategies.primary = [
          `${baseSymbol} SEC filing 10-K 10-Q 8-K investor relations`,
          `"${symbol}" annual report quarterly filing`,
          `${baseSymbol} regulatory disclosure financial statement`
        ]
        break
      case 'analysis':
        strategies.primary = [
          `${baseSymbol} stock analysis price target rating`,
          `"${symbol}" analyst research report recommendation`,
          `${baseSymbol} investment research equity analysis`
        ]
        break
      case 'earnings':
        strategies.primary = [
          `${baseSymbol} earnings call transcript conference`,
          `"${symbol}" quarterly earnings results revenue`,
          `${baseSymbol} EPS guidance outlook forecast`
        ]
        break
      case 'reports':
        strategies.primary = [
          `${baseSymbol} financial report annual quarterly`,
          `"${symbol}" investor presentation deck slides`,
          `${baseSymbol} market research industry report`
        ]
        break
      case 'sentiment':
        strategies.primary = [
          `${baseSymbol} stock discussion forum community`,
          `"${symbol}" reddit wallstreetbets trading discussion`,
          `${baseSymbol} social media sentiment analysis`
        ]
        break
      default: // comprehensive
        strategies.primary = [
          `${baseSymbol} stock financial data comprehensive`,
          `"${symbol}" company information business overview`,
          `${baseSymbol} investment profile market analysis`
        ]
    }

    // Fallback strategies - broader coverage
    strategies.fallback = [
      `${symbol} financial information`,
      `"${symbol}" stock market data`,
      `${baseSymbol} company profile`,
      `${symbol} investment research`
    ]

    // Aggressive strategies - maximum coverage
    if (aggressive) {
      strategies.aggressive = [
        `${symbol}`, // Simple symbol search
        `"${symbol}" -crypto -forex`, // Exclude crypto/forex
        `${companyName || symbol} financial`,
        `${symbol} stock exchange trading`,
        `${baseSymbol} market cap valuation`,
        `${symbol} business model revenue streams`,
        `${baseSymbol} competitive analysis industry`
      ]
    }

    return strategies
  }

  /**
   * Execute a search strategy with resilient error handling
   */
  private async executeSearchStrategy(options: {
    strategies: string[]
    engines: string[]
    timeRange: string
    maxResults: number
  }): Promise<SearXNGResult[]> {
    const { strategies, engines, timeRange, maxResults } = options
    const allResults: SearXNGResult[] = []
    const resultsPerStrategy = Math.ceil(maxResults / strategies.length)

    for (const query of strategies) {
      try {
        const searchParams: SearXNGSearchParams = {
          q: query,
          engines: this.getWorkingEngines(engines),
          time_range: timeRange as any,
          format: 'json',
          safe_search: 0,
          pageno: 1
        }

        const results = await this.performSearchWithRetry(searchParams, this.config.maxRetries)
        const relevantResults = results.results
          .filter(r => this.isFinanciallyRelevant(r, query))
          .slice(0, resultsPerStrategy)

        allResults.push(...relevantResults)
        
        if (allResults.length >= maxResults) break

        // Add delay between strategy executions
        await this.sleep(1000)

      } catch (error: any) {
        logger.warn(`Strategy "${query}" failed:`, { message: (error as Error).message })
        continue
      }
    }

    return allResults
  }

  /**
   * Get list of working engines, excluding failed ones
   */
  private getWorkingEngines(requestedEngines: string[]): string[] {
    const workingEngines = requestedEngines.filter(engine => {
      const retryCount = this.engineRetryCount.get(engine) || 0
      return !this.failedEngines.has(engine) && retryCount < 3
    })

    // If all engines are failed, reset and try again
    if (workingEngines.length === 0) {
      logger.warn('All engines failed, resetting failure tracking')
      this.failedEngines.clear()
      this.engineRetryCount.clear()
      return requestedEngines.slice(0, 3) // Use first 3 engines
    }

    return workingEngines
  }

  /**
   * Enhanced search method with comprehensive error handling
   */
  async search(params: SearXNGSearchParams): Promise<SearXNGResponse> {
    // Validate and sanitize parameters
    const sanitizedParams = this.sanitizeSearchParams(params)
    
    // Enhanced rate limiting with adaptive delays
    const now = Date.now()
    const baseDelay = 2000 // Base 2 seconds
    const adaptiveDelay = this.failedEngines.size * 1000 // Add 1s per failed engine
    const totalDelay = baseDelay + adaptiveDelay
    
    if (this.lastRequestTime > 0) {
      const timeSinceLastRequest = now - this.lastRequestTime
      if (timeSinceLastRequest < totalDelay) {
        await this.sleep(totalDelay - timeSinceLastRequest)
      }
    }
    
    this.lastRequestTime = Date.now()
    
    try {
      const response = await this.client.get('/search', { 
        params: sanitizedParams,
        timeout: this.config.timeout,
        validateStatus: (status) => status < 500 // Accept 4xx errors as recoverable
      })
      
      if (response.status !== 200) {
        throw new Error(`SearXNG returned status ${response.status}`)
      }

      // Reset failure tracking on successful request
      this.resetEngineFailures(params.engines)
      
      return response.data
    } catch (error: any) {
      // Track engine failures for adaptive behavior
      this.trackEngineFailures(params.engines, error)
      
      logger.error('SearXNG search failed:', {
        message: (error as Error).message,
        params: typeof params.q === 'string' ? params.q.substring(0, 50) : 'invalid query',
        failedEngineCount: this.failedEngines.size
      })
      throw error
    }
  }

  /**
   * Sanitize and validate search parameters
   */
  private sanitizeSearchParams(params: SearXNGSearchParams): SearXNGSearchParams {
    // Ensure query is a string
    if (typeof params.q !== 'string' || !params.q.trim()) {
      throw new Error('Search query must be a non-empty string')
    }

    const sanitized: SearXNGSearchParams = {
      q: params.q.trim(),
      format: 'json', // Always use JSON format
      safe_search: params.safe_search || params.safesearch || 0,
      lang: params.lang || 'en',
      pageno: params.pageno || 1
    }

    // Handle engines parameter
    if (params.engines) {
      if (Array.isArray(params.engines)) {
        sanitized.engines = params.engines.join(',')
      } else if (typeof params.engines === 'string') {
        sanitized.engines = params.engines
      }
    }

    // Handle category
    if (params.category && typeof params.category === 'string') {
      sanitized.category = params.category
    }

    // Handle time range
    if (params.time_range && ['day', 'week', 'month', 'year', 'all'].includes(params.time_range)) {
      sanitized.time_range = params.time_range
    }

    return sanitized
  }

  /**
   * Track failed engines for adaptive behavior
   */
  private trackEngineFailures(engines: string | string[] | undefined, error: any): void {
    if (!engines) return

    const engineList = Array.isArray(engines) ? engines : [engines]
    
    engineList.forEach(engine => {
      const currentCount = this.engineRetryCount.get(engine) || 0
      this.engineRetryCount.set(engine, currentCount + 1)
      
      if (currentCount >= 2) {
        this.failedEngines.add(engine)
        logger.warn(`Engine ${engine} marked as failed after multiple failures`)
      }
    })
  }

  /**
   * Reset engine failure tracking on success
   */
  private resetEngineFailures(engines: string | string[] | undefined): void {
    if (!engines) return

    const engineList = Array.isArray(engines) ? engines : [engines]
    engineList.forEach(engine => {
      this.failedEngines.delete(engine)
      this.engineRetryCount.delete(engine)
    })
  }

  /**
   * Check if result is financially relevant
   */
  private isFinanciallyRelevant(result: SearXNGResult, query: string): boolean {
    const financialKeywords = [
      'stock', 'financial', 'earnings', 'revenue', 'profit', 'market', 'trading',
      'investment', 'analyst', 'SEC', 'filing', 'report', 'quarterly', 'annual',
      'price', 'target', 'rating', 'recommendation', 'valuation', 'dividend'
    ]

    const content = `${result.title} ${result.content}`.toLowerCase()
    const hasFinancialKeywords = financialKeywords.some(keyword => 
      content.includes(keyword)
    )

    // Additional relevance checks
    const isFromFinancialDomain = this.isFinancialDomain(result.url)
    const isRecent = this.isRecentContent(result.publishedDate)

    return hasFinancialKeywords || isFromFinancialDomain || isRecent
  }

  /**
   * Check if URL is from a known financial domain
   */
  private isFinancialDomain(url: string): boolean {
    const financialDomains = [
      'finance.yahoo.com', 'bloomberg.com', 'reuters.com', 'wsj.com',
      'marketwatch.com', 'investing.com', 'seekingalpha.com', 'fool.com',
      'sec.gov', 'edgar.sec.gov', 'investor.', 'ir.', 'financials.',
      'benzinga.com', 'zacks.com', 'morningstar.com', 'finviz.com'
    ]

    return financialDomains.some(domain => url.includes(domain))
  }

  /**
   * Check if content is recent (within 1 year)
   */
  private isRecentContent(publishedDate?: string): boolean {
    if (!publishedDate) return true // Assume recent if no date

    try {
      const contentDate = new Date(publishedDate)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      
      return contentDate >= oneYearAgo
    } catch (error) {
      return true // Assume recent if date parsing fails
    }
  }

  /**
   * Deduplicate results by URL and title similarity
   */
  private deduplicateResults(results: SearXNGResult[]): SearXNGResult[] {
    const seen = new Set<string>()
    const unique: SearXNGResult[] = []

    for (const result of results) {
      const key = `${result.url}|${result.title.substring(0, 50)}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(result)
      }
    }

    return unique
  }

  /**
   * Sort results by relevance score and recency
   */
  private sortResultsByRelevance(
    results: SearXNGResult[], 
    symbol: string, 
    searchType?: string
  ): SearXNGResult[] {
    return results.sort((a, b) => {
      // Primary sort by score
      const scoreDiff = (b.score || 0) - (a.score || 0)
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff

      // Secondary sort by financial domain preference
      const aFinancial = this.isFinancialDomain(a.url) ? 1 : 0
      const bFinancial = this.isFinancialDomain(b.url) ? 1 : 0
      const financialDiff = bFinancial - aFinancial
      if (financialDiff !== 0) return financialDiff

      // Tertiary sort by recency
      const aDate = new Date(a.publishedDate || '1970-01-01')
      const bDate = new Date(b.publishedDate || '1970-01-01')
      return bDate.getTime() - aDate.getTime()
    })
  }

  /**
   * Enhanced retry logic with exponential backoff and jitter
   */
  private async performSearchWithRetry(
    params: SearXNGSearchParams, 
    maxRetries: number
  ): Promise<SearXNGResponse> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.search(params)
      } catch (error: any) {
        lastError = error as Error
        logger.warn(`Search attempt ${attempt}/${maxRetries} failed:`, { 
          message: (error as Error).message,
          engines: params.engines,
          query: params.q?.substring(0, 50)
        })
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          const jitter = Math.random() * 1000
          const delay = baseDelay + jitter
          
          logger.info(`Retrying in ${Math.round(delay)}ms...`)
          await this.sleep(delay)
        }
      }
    }
    
    throw lastError!
  }

  /**
   * Batch search multiple symbols with intelligent parallelization
   */
  async batchSearchFinancial(symbols: string[], options: Omit<FinancialSearchOptions, 'symbol'>): Promise<Map<string, SearXNGResult[]>> {
    logger.info(`Starting batch financial search for ${symbols.length} symbols`)
    
    const results = new Map<string, SearXNGResult[]>()
    const batchSize = 3 // Limit concurrent searches
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async symbol => {
        try {
          const symbolResults = await this.searchFinancialData({
            symbol,
            ...options
          })
          results.set(symbol, symbolResults)
          logger.info(`Batch search completed for ${symbol}: ${symbolResults.length} results`)
        } catch (error: any) {
          logger.error(`Batch search failed for ${symbol}:`, { message: (error as Error).message })
          results.set(symbol, [])
        }
      })
      
      await Promise.all(batchPromises)
      
      // Add delay between batches
      if (i + batchSize < symbols.length) {
        await this.sleep(2000)
      }
    }
    
    logger.info(`Batch search completed for all ${symbols.length} symbols`)
    return results
  }

  /**
   * Health check with comprehensive engine status
   */
  async healthCheck(): Promise<{
    status: boolean
    workingEngines: number
    failedEngines: number
    totalEngines: number
    responseTime: number
  }> {
    const startTime = Date.now()
    
    try {
      const response = await this.client.get('/stats', { timeout: 5000 })
      const responseTime = Date.now() - startTime
      
      const totalEngines = this.config.defaultEngines.length + this.config.financialEngines.length
      const workingEngines = totalEngines - this.failedEngines.size
      
      return {
        status: response.status === 200,
        workingEngines,
        failedEngines: this.failedEngines.size,
        totalEngines,
        responseTime
      }
    } catch (error: any) {
      logger.error('SearXNG health check failed:', { message: (error as Error).message })
      
      return {
        status: false,
        workingEngines: 0,
        failedEngines: this.failedEngines.size,
        totalEngines: this.config.defaultEngines.length + this.config.financialEngines.length,
        responseTime: Date.now() - startTime
      }
    }
  }

  /**
   * Get comprehensive service statistics
   */
  getStats(): {
    failedEngines: string[]
    engineRetryCount: Record<string, number>
    lastRequestTime: number
    requestsSinceStart: number
  } {
    return {
      failedEngines: Array.from(this.failedEngines),
      engineRetryCount: Object.fromEntries(this.engineRetryCount),
      lastRequestTime: this.lastRequestTime,
      requestsSinceStart: this.engineRetryCount.size
    }
  }

  /**
   * Build optimized query for financial content
   */
  private buildFinancialQuery(
    symbol: string, 
    companyName?: string,
    searchType?: string,
    includeRelated: boolean = false
  ): string {
    const baseSymbol = companyName ? `"${companyName}" ${symbol}` : symbol
    
    const queryTemplates = {
      news: `${baseSymbol} stock news earnings announcement latest`,
      filings: `${baseSymbol} SEC filing 10-K 10-Q earnings report investor relations`,
      earnings: `${baseSymbol} quarterly earnings results conference call transcript guidance`,
      analysis: `${baseSymbol} analyst rating price target investment research recommendation`,
      comprehensive: `${baseSymbol} financial performance earnings revenue stock analysis`
    }

    let query = queryTemplates[searchType as keyof typeof queryTemplates] || queryTemplates.comprehensive

    // Add related company search terms
    if (includeRelated && companyName) {
      query += ` OR "${companyName.split(' ')[0]}" financial`
    }

    // Add financial relevance terms
    query += ' site:sec.gov OR site:investor.* OR site:finance.yahoo.com OR site:bloomberg.com OR site:reuters.com'

    return query
  }

  /**
   * Get appropriate category for search type
   */
  private getCategoryForSearchType(searchType: string): string {
    const categoryMap = {
      news: 'news',
      filings: 'files',
      earnings: 'news',
      analysis: 'general',
      comprehensive: 'general'
    }
    
    return categoryMap[searchType as keyof typeof categoryMap] || 'general'
  }

  /**
   * Get optimized engines for search type
   */
  private getEnginesForSearchType(searchType: string): string[] {
    const engineMap = {
      news: ['google', 'bing', 'yahoo', 'duckduckgo'],
      filings: ['google', 'bing', 'startpage'],
      earnings: ['google', 'bing', 'yahoo'],
      analysis: ['google', 'bing', 'duckduckgo', 'startpage'],
      comprehensive: ['google', 'bing', 'yahoo', 'duckduckgo']
    }
    
    return engineMap[searchType as keyof typeof engineMap] || this.config.defaultEngines
  }

  /**
   * Filter results for financial relevance
   */
  private filterFinancialResults(
    response: SearXNGResponse, 
    symbol: string, 
    searchType: string
  ): SearXNGResult[] {
    return response.results
      .filter(result => {
        // Basic relevance filtering
        const content = (result.title + ' ' + result.content).toLowerCase()
        const symbolLower = symbol.toLowerCase()
        
        // Must contain the symbol
        if (!content.includes(symbolLower)) return false
        
        // Financial content indicators
        const financialKeywords = [
          'stock', 'shares', 'earnings', 'revenue', 'profit', 'financial',
          'analyst', 'rating', 'price', 'market', 'trading', 'investment'
        ]
        
        const hasFinancialKeywords = financialKeywords.some(keyword => 
          content.includes(keyword)
        )
        
        return hasFinancialKeywords
      })
      .map(result => ({
        ...result,
        score: this.calculateFinancialRelevanceScore(result, symbol, searchType)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Limit to top 50 results
  }

  /**
   * Filter results for market trend relevance
   */
  private filterTrendResults(response: SearXNGResponse, themes: string[]): SearXNGResult[] {
    return response.results
      .filter(result => {
        const content = (result.title + ' ' + result.content).toLowerCase()
        
        // Must mention at least one theme
        return themes.some(theme => 
          content.includes(theme.toLowerCase())
        )
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
  }

  /**
   * Calculate financial relevance score
   */
  private calculateFinancialRelevanceScore(
    result: SearXNGResult, 
    symbol: string, 
    searchType: string
  ): number {
    let score = result.score || 0
    const content = (result.title + ' ' + result.content).toLowerCase()
    const symbolLower = symbol.toLowerCase()

    // Symbol mentions boost
    const symbolMentions = (content.match(new RegExp(symbolLower, 'g')) || []).length
    score += symbolMentions * 10

    // Title relevance boost
    if (result.title.toLowerCase().includes(symbolLower)) {
      score += 20
    }

    // Financial domain boost
    const financialDomains = [
      'sec.gov', 'investor', 'finance.yahoo.com', 'bloomberg.com', 
      'reuters.com', 'marketwatch.com', 'fool.com', 'seekingalpha.com'
    ]
    
    if (financialDomains.some(domain => result.url.includes(domain))) {
      score += 30
    }

    // Search type specific boosts
    const typeKeywords = {
      earnings: ['earnings', 'quarterly', 'results', 'guidance'],
      filings: ['filing', '10-k', '10-q', 'sec', 'annual report'],
      analysis: ['analyst', 'rating', 'recommendation', 'price target'],
      news: ['announced', 'breaking', 'news', 'update']
    }

    const keywords = typeKeywords[searchType as keyof typeof typeKeywords] || []
    const keywordMatches = keywords.filter(keyword => content.includes(keyword)).length
    score += keywordMatches * 5

    return score
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 