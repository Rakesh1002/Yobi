import axios, { AxiosResponse } from 'axios'
import { createLogger } from '../utils/logger'

const logger = createLogger('web-search')

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: 'tavily' | 'exa' | 'serp'
  published?: Date
  relevanceScore: number
  domain?: string
}

export interface SearchOptions {
  maxResults?: number
  dateRange?: 'day' | 'week' | 'month' | 'year' | 'all'
  includeAnswer?: boolean
  searchType?: 'comprehensive' | 'news' | 'earnings' | 'filings' | 'analysis'
}

export class WebSearchService {
  private tavilyApiKey?: string
  private exaApiKey?: string
  private serpApiKey?: string
  private enabledProviders: string[] = []

  constructor() {
    this.tavilyApiKey = process.env.TAVILY_API_KEY
    this.exaApiKey = process.env.EXA_API_KEY
    this.serpApiKey = process.env.SERP_API_KEY

    // Check which providers are available
    if (this.tavilyApiKey) {
      this.enabledProviders.push('tavily')
      logger.info('Tavily API initialized')
    } else {
      logger.warn('TAVILY_API_KEY not provided - Tavily search disabled')
    }

    if (this.exaApiKey) {
      this.enabledProviders.push('exa')
      logger.info('Exa API initialized')
    } else {
      logger.warn('EXA_API_KEY not provided - Exa search disabled')
    }

    if (this.serpApiKey) {
      this.enabledProviders.push('serp')
      logger.info('SERP API initialized')
    } else {
      logger.warn('SERP_API_KEY not provided - SERP search disabled')
    }

    if (this.enabledProviders.length === 0) {
      logger.warn('No web search API keys configured - search functionality will be limited')
      logger.warn('Configure at least one of: TAVILY_API_KEY, EXA_API_KEY, SERP_API_KEY')
    } else {
      logger.info(`Web search initialized with providers: ${this.enabledProviders.join(', ')}`)
    }
  }

  /**
   * Perform a comprehensive search across all available providers
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (this.enabledProviders.length === 0) {
      logger.warn('No search providers available - returning empty results')
      return []
    }

    const {
      maxResults = 20,
      dateRange = 'month',
      searchType = 'comprehensive'
    } = options

    logger.info(`Performing ${searchType} search: "${query}"`)

    const searchPromises: Promise<SearchResult[]>[] = []

    // Search with all available providers in parallel
    if (this.enabledProviders.includes('tavily')) {
      searchPromises.push(this.searchWithTavily(query, maxResults, dateRange))
    }

    if (this.enabledProviders.includes('exa')) {
      searchPromises.push(this.searchWithExa(query, maxResults, dateRange))
    }

    if (this.enabledProviders.includes('serp')) {
      searchPromises.push(this.searchWithSerp(query, maxResults, dateRange))
    }

    try {
      const results = await Promise.allSettled(searchPromises)
      
      // Combine successful results
      const allResults: SearchResult[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value)
        } else {
          logger.error(`Search provider ${this.enabledProviders[index]} failed:`, result.reason)
        }
      })

      // Deduplicate and rank results
      const deduplicatedResults = this.deduplicateAndRank(allResults)
      
      logger.info(`Search completed: ${deduplicatedResults.length} unique results from ${this.enabledProviders.length} providers`)
      return deduplicatedResults.slice(0, maxResults)
    } catch (error) {
      logger.error('Search failed:', error)
      return []
    }
  }

  /**
   * Search for company-specific information
   */
  async searchCompanyInfo(symbol: string, companyName?: string, searchType: string = 'comprehensive'): Promise<SearchResult[]> {
    if (this.enabledProviders.length === 0) {
      logger.warn(`No search providers available for ${symbol}`)
      return []
    }

    const queries = this.buildCompanyQueries(symbol, searchType, companyName)
    const allResults: SearchResult[] = []

    for (const query of queries) {
      try {
        const results = await this.search(query, {
          maxResults: 15,
          dateRange: searchType === 'news' ? 'week' : 'month',
          searchType: searchType as any
        })
        allResults.push(...results)
      } catch (error) {
        logger.error(`Failed to search for "${query}":`, error)
      }
    }

    return this.deduplicateAndRank(allResults).slice(0, 50)
  }

  /**
   * Search with Tavily API
   */
  private async searchWithTavily(query: string, maxResults: number, dateRange: string): Promise<SearchResult[]> {
    if (!this.tavilyApiKey) {
      return []
    }

    try {
      const response: AxiosResponse = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: this.tavilyApiKey,
          query,
          search_depth: 'advanced',
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: Math.min(maxResults, 20),
          include_domains: this.getRelevantDomains('financial')
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const results = response.data.results || []
      return results.map((result: any) => ({
        title: result.title || 'No title',
        url: result.url || '',
        snippet: result.content || result.snippet || 'No snippet available',
        source: 'tavily' as const,
        published: result.published_date ? new Date(result.published_date) : undefined,
        relevanceScore: result.score || 0.5,
        domain: new URL(result.url || 'https://example.com').hostname
      }))
    } catch (error) {
      logger.error('Tavily search failed:', error)
      return []
    }
  }

  /**
   * Search with Exa API
   */
  private async searchWithExa(query: string, maxResults: number, dateRange: string): Promise<SearchResult[]> {
    if (!this.exaApiKey) {
      return []
    }

    try {
      const dateFilter = this.getDateFilter(dateRange)
      
      const response: AxiosResponse = await axios.post(
        'https://api.exa.ai/search',
        {
          query,
          type: 'neural',
          useAutoprompt: true,
          numResults: Math.min(maxResults, 20),
          contents: {
            text: true,
            highlights: true,
            summary: false
          },
          startPublishedDate: dateFilter.start,
          endPublishedDate: dateFilter.end
        },
        {
          timeout: 15000,
          headers: {
            'Authorization': `Bearer ${this.exaApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const results = response.data.results || []
      return results.map((result: any) => ({
        title: result.title || 'No title',
        url: result.url || '',
        snippet: result.text?.slice(0, 300) || result.summary || 'No content available',
        source: 'exa' as const,
        published: result.publishedDate ? new Date(result.publishedDate) : undefined,
        relevanceScore: result.score || 0.5,
        domain: new URL(result.url || 'https://example.com').hostname
      }))
    } catch (error) {
      logger.error('Exa search failed:', error)
      return []
    }
  }

  /**
   * Search with SERP API
   */
  private async searchWithSerp(query: string, maxResults: number, dateRange: string): Promise<SearchResult[]> {
    if (!this.serpApiKey) {
      return []
    }

    try {
      const response: AxiosResponse = await axios.get('https://serpapi.com/search', {
        params: {
          api_key: this.serpApiKey,
          engine: 'google',
          q: query,
          num: Math.min(maxResults, 20),
          tbm: dateRange === 'day' ? 'nws' : undefined, // News search for recent queries
          tbs: this.getGoogleDateFilter(dateRange)
        },
        timeout: 15000
      })

      const organicResults = response.data.organic_results || []
      const newsResults = response.data.news_results || []
      
      const allResults = [...organicResults, ...newsResults]
      
      return allResults.map((result: any) => ({
        title: result.title || 'No title',
        url: result.link || '',
        snippet: result.snippet || result.description || 'No snippet available',
        source: 'serp' as const,
        published: result.date ? new Date(result.date) : undefined,
        relevanceScore: 0.7, // SERP doesn't provide relevance scores
        domain: new URL(result.link || 'https://example.com').hostname
      }))
    } catch (error) {
      logger.error('SERP search failed:', error)
      return []
    }
  }

  /**
   * Build company-specific search queries
   */
  private buildCompanyQueries(symbol: string, searchType: string, companyName?: string): string[] {
    const baseQueries = [
      `${symbol} stock`,
      companyName ? `${companyName} ${symbol}` : symbol
    ]

    switch (searchType) {
      case 'news':
        return [
          `${symbol} news latest`,
          `${symbol} stock news today`,
          companyName ? `${companyName} news` : `${symbol} company news`
        ]
      
      case 'earnings':
        return [
          `${symbol} earnings report`,
          `${symbol} quarterly results`,
          `${symbol} earnings call transcript`
        ]
      
      case 'filings':
        return [
          `${symbol} SEC filing`,
          `${symbol} 10-K 10-Q`,
          `${symbol} annual report`
        ]
      
      case 'analysis':
        return [
          `${symbol} analyst rating`,
          `${symbol} price target`,
          `${symbol} investment analysis`
        ]
      
      default: // comprehensive
        return [
          ...baseQueries,
          `${symbol} financial results`,
          `${symbol} business news`,
          `${symbol} market analysis`
        ]
    }
  }

  /**
   * Get relevant domains for search filtering
   */
  private getRelevantDomains(category: string): string[] {
    const domains = {
      financial: [
        'bloomberg.com',
        'reuters.com',
        'cnbc.com',
        'marketwatch.com',
        'yahoo.com',
        'sec.gov',
        'businesswire.com',
        'prnewswire.com',
        'fool.com',
        'seekingalpha.com'
      ]
    }

    return domains[category as keyof typeof domains] || []
  }

  /**
   * Get date filter for search APIs
   */
  private getDateFilter(dateRange: string): { start?: string; end?: string } {
    const now = new Date()
    const ranges = {
      day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    }

    const startDate = ranges[dateRange as keyof typeof ranges]
    return startDate ? {
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    } : {}
  }

  /**
   * Get Google-specific date filter
   */
  private getGoogleDateFilter(dateRange: string): string | undefined {
    const filters = {
      day: 'qdr:d',
      week: 'qdr:w',
      month: 'qdr:m',
      year: 'qdr:y'
    }

    return filters[dateRange as keyof typeof filters]
  }

  /**
   * Deduplicate and rank search results
   */
  private deduplicateAndRank(results: SearchResult[]): SearchResult[] {
    // Remove duplicates based on URL
    const seen = new Set<string>()
    const unique = results.filter(result => {
      if (seen.has(result.url)) {
        return false
      }
      seen.add(result.url)
      return true
    })

    // Sort by relevance score (descending) and recency
    return unique.sort((a, b) => {
      // Primary sort: relevance score
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore
      }
      
      // Secondary sort: recency (if published dates available)
      if (a.published && b.published) {
        return b.published.getTime() - a.published.getTime()
      }
      
      return 0
    })
  }

  /**
   * Health check for all search providers
   */
  async healthCheck(): Promise<{ tavily: boolean; exa: boolean; serp: boolean }> {
    const health = {
      tavily: false,
      exa: false,
      serp: false
    }

    // Test each provider if API key is available
    if (this.tavilyApiKey) {
      try {
        await this.searchWithTavily('test', 1, 'day')
        health.tavily = true
      } catch (error) {
        logger.debug('Tavily health check failed')
      }
    }

    if (this.exaApiKey) {
      try {
        await this.searchWithExa('test', 1, 'day')
        health.exa = true
      } catch (error) {
        logger.debug('Exa health check failed')
      }
    }

    if (this.serpApiKey) {
      try {
        await this.searchWithSerp('test', 1, 'day')
        health.serp = true
      } catch (error) {
        logger.debug('SERP health check failed')
      }
    }

    return health
  }

  /**
   * Get list of enabled providers
   */
  getEnabledProviders(): string[] {
    return [...this.enabledProviders]
  }

  /**
   * Check if any search providers are available
   */
  isSearchEnabled(): boolean {
    return this.enabledProviders.length > 0
  }
} 