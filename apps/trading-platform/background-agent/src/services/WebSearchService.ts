import axios, { AxiosResponse } from 'axios'
import { createLogger } from '../utils/logger'

const logger = createLogger('web-search')

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: 'searxng'
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
  private searxngBaseUrl: string

  constructor() {
    this.searxngBaseUrl = process.env.SEARXNG_BASE_URL || 'http://localhost:8080'
    logger.info('WebSearchService initialized - using SearXNG for web search')
  }

  /**
   * Perform a comprehensive search using SearXNG
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      maxResults = 20,
      dateRange = 'month',
      searchType = 'comprehensive'
    } = options

    logger.info(`Performing ${searchType} search: "${query}"`)

    try {
      return await this.searchWithSearXNG(query, maxResults, dateRange)
    } catch (error) {
      logger.error('SearXNG search failed:', error)
      return []
    }
  }

  /**
   * Search with SearXNG
   */
  private async searchWithSearXNG(query: string, maxResults: number, dateRange: string): Promise<SearchResult[]> {
    try {
      const response: AxiosResponse = await axios.get(`${this.searxngBaseUrl}/search`, {
        params: {
          q: query,
          format: 'json',
          categories: 'general,news',
          time_range: this.mapDateRange(dateRange),
          safesearch: 0,
          pageno: 1
        },
        timeout: 10000
      })

      if (!response.data?.results) {
        return []
      }

      const results: SearchResult[] = response.data.results
        .slice(0, maxResults)
        .map((result: any) => ({
          title: result.title || 'No title',
          url: result.url || '',
          snippet: result.content || result.description || 'No description available',
          source: 'searxng' as const,
          published: result.publishedDate ? new Date(result.publishedDate) : undefined,
          relevanceScore: result.score || 0.5,
          domain: this.extractDomain(result.url)
        }))

      logger.info(`SearXNG returned ${results.length} results for query: ${query}`)
      return results

    } catch (error) {
      logger.error('SearXNG search failed:', {
        message: error?.message || 'Unknown error',
        code: error?.code,
        status: error?.response?.status
      })
      return []
    }
  }

  /**
   * Map date range to SearXNG format
   */
  private mapDateRange(dateRange: string): string {
    const mapping: Record<string, string> = {
      'day': 'day',
      'week': 'week', 
      'month': 'month',
      'year': 'year',
      'all': ''
    }
    return mapping[dateRange] || 'month'
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'unknown'
    }
  }

  /**
   * Remove duplicate results based on URL
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = result.url.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * Sort results by relevance score
   */
  private sortByRelevance(results: SearchResult[], query: string): SearchResult[] {
    return results.sort((a, b) => {
      // Boost results with query terms in title
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()
      const queryLower = query.toLowerCase()
      
      const aTitleMatch = aTitle.includes(queryLower) ? 0.2 : 0
      const bTitleMatch = bTitle.includes(queryLower) ? 0.2 : 0
      
      const aScore = a.relevanceScore + aTitleMatch
      const bScore = b.relevanceScore + bTitleMatch
      
      return bScore - aScore
    })
  }

  /**
   * Combine deduplication and ranking
   */
  private deduplicateAndRank(results: SearchResult[], query?: string): SearchResult[] {
    const deduplicated = this.deduplicateResults(results)
    return query ? this.sortByRelevance(deduplicated, query) : deduplicated
  }

  /**
   * Specialized search for company earnings
   */
  async searchEarnings(company: string, symbol: string): Promise<SearchResult[]> {
    const queries = [
      `${company} ${symbol} earnings Q3 2024`,
      `${company} ${symbol} quarterly results`,
      `${company} earnings call transcript`
    ]

    const allResults: SearchResult[] = []
    
    for (const query of queries) {
      try {
        const results = await this.searchWithSearXNG(query, 10, 'month')
        allResults.push(...results)
      } catch (error) {
        logger.warn(`Earnings search failed for query: ${query}`, error)
      }
    }

    return this.deduplicateAndRank(allResults).slice(0, 20)
  }

  /**
   * Specialized search for company filings
   */
  async searchFilings(company: string, symbol: string): Promise<SearchResult[]> {
    const queries = [
      `${company} ${symbol} SEC filing 10-K`,
      `${company} ${symbol} SEC filing 10-Q`, 
      `${company} ${symbol} annual report`,
      `${company} proxy statement`
    ]

    const allResults: SearchResult[] = []
    
    for (const query of queries) {
      try {
        const results = await this.searchWithSearXNG(query, 8, 'year')
        allResults.push(...results)
      } catch (error) {
        logger.warn(`Filings search failed for query: ${query}`, error)
      }
    }

    return this.deduplicateAndRank(allResults).slice(0, 15)
  }

  /**
   * Specialized search for recent company news
   */
  async searchNews(company: string, symbol: string): Promise<SearchResult[]> {
    const queries = [
      `${company} ${symbol} news`,
      `${company} stock news`,
      `${company} latest developments`
    ]

    const allResults: SearchResult[] = []
    
    for (const query of queries) {
      try {
        const results = await this.searchWithSearXNG(query, 15, 'week')
        allResults.push(...results)
      } catch (error) {
        logger.warn(`News search failed for query: ${query}`, error)
      }
    }

    return this.deduplicateAndRank(allResults).slice(0, 25)
  }

  /**
   * Multi-query comprehensive search
   */
  async comprehensiveSearch(company: string, symbol: string): Promise<SearchResult[]> {
    const searchPromises = [
      this.searchNews(company, symbol),
      this.searchEarnings(company, symbol),
      this.searchFilings(company, symbol)
    ]

    try {
      const results = await Promise.allSettled(searchPromises)
      const allResults: SearchResult[] = []
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value)
        }
      })

      return this.deduplicateAndRank(allResults).slice(0, 50)
    } catch (error) {
      logger.error('Comprehensive search failed:', error)
      return []
    }
  }

  /**
   * Health check for SearXNG service
   */
  async healthCheck(): Promise<{ searxng: boolean }> {
    try {
      await this.searchWithSearXNG('test', 1, 'day')
      return { searxng: true }
    } catch {
      return { searxng: false }
    }
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      provider: 'SearXNG',
      baseUrl: this.searxngBaseUrl,
      status: 'active'
    }
  }
} 