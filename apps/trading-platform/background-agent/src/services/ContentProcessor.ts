import axios from 'axios'
import * as cheerio from 'cheerio'
import { createLogger } from '../utils/logger'
import { CacheService } from './CacheService'

const logger = createLogger('content-processor')

export interface ContentResult {
  url: string
  title: string
  content: string
  extractedText: string
  publishedDate?: Date
  relevanceScore: number
  timelinessScore: number
  overallScore: number
  contentType: 'news' | 'filing' | 'analysis' | 'earnings' | 'other'
  keyTopics: string[]
  entities: string[]
  sentiment: number
  isRelevant: boolean
  isTimely: boolean
  isDuplicate: boolean
  wordCount: number
  metadata: any
}

export interface ProcessingOptions {
  maxContentLength?: number
  timelinessThresholdDays?: number
  relevanceThreshold?: number
  enableDeduplication?: boolean
  extractEntities?: boolean
  analyzeSentiment?: boolean
}

export class ContentProcessor {
  private cacheService: CacheService
  private processedUrls: Set<string> = new Set()
  private contentHashes: Map<string, string> = new Map() // hash -> url mapping for deduplication

  constructor() {
    this.cacheService = new CacheService()
  }

  /**
   * Process a batch of URLs from search results
   */
  async processUrls(
    urls: string[], 
    symbol: string, 
    options: ProcessingOptions = {}
  ): Promise<ContentResult[]> {
    const {
      maxContentLength = 104857600, // Increased to 100MB for large financial documents
      timelinessThresholdDays = 90,
      relevanceThreshold = 0.6,
      enableDeduplication = true,
      extractEntities = true,
      analyzeSentiment = true
    } = options

    logger.info(`Processing ${urls.length} URLs for ${symbol}`)

    const results: ContentResult[] = []
    const semaphore = this.createSemaphore(3) // Limit concurrent requests

    const processingPromises = urls.map(async (url) => {
      return semaphore(async () => {
        try {
          // Check if already processed
          if (this.processedUrls.has(url)) {
            logger.debug(`URL already processed: ${url}`)
            return null
          }

          // Check cache
          const cacheKey = `content:${this.hashUrl(url)}`
          const cached = await this.cacheService.getJSON(cacheKey)
          if (cached) {
            logger.debug(`Cache hit for URL: ${url}`)
            return cached as ContentResult
          }

          // Fetch and process content
          const content = await this.fetchContent(url)
          if (!content) {
            return null
          }

          // Parse and extract information
          const parsed = await this.parseContent(content, url, symbol)
          
          // Score relevance and timeliness
          const relevanceScore = this.calculateRelevanceScore(parsed, symbol)
          const timelinessScore = this.calculateTimelinessScore(parsed, timelinessThresholdDays)
          const overallScore = (relevanceScore * 0.7) + (timelinessScore * 0.3)

          // Check for duplicates
          const isDuplicate = enableDeduplication ? this.checkForDuplicate(parsed.extractedText, url) : false

          const result: ContentResult = {
            url,
            title: parsed.title,
            content: '', // ⚡ OPTIMIZATION: Don't cache full HTML content
            extractedText: parsed.extractedText.substring(0, 2000), // ⚡ LIMIT: Only first 2000 chars
            publishedDate: parsed.publishedDate,
            relevanceScore,
            timelinessScore,
            overallScore,
            contentType: this.classifyContent(parsed.title, parsed.extractedText),
            keyTopics: extractEntities ? this.extractKeyTopics(parsed.extractedText, symbol) : [],
            entities: extractEntities ? this.extractEntities(parsed.extractedText) : [],
            sentiment: analyzeSentiment ? this.analyzeSentiment(parsed.extractedText) : 0,
            isRelevant: relevanceScore >= relevanceThreshold,
            isTimely: timelinessScore >= 0.5,
            isDuplicate,
            wordCount: parsed.extractedText.split(/\s+/).length,
            metadata: {
              processingTime: Date.now(),
              contentLength: content.length,
              domain: new URL(url).hostname
            }
          }

          // ⚡ OPTIMIZATION: Shorter cache TTL and size check
          const resultSize = JSON.stringify(result).length
          if (resultSize < 100000) { // Only cache if < 100KB
            await this.cacheService.set(cacheKey, result, 3600) // ⚡ REDUCED: 1 hour instead of 24
          } else {
            logger.debug(`Skipping cache for large result: ${resultSize} bytes`)
          }

          // Mark as processed
          this.processedUrls.add(url)

          logger.debug(`Processed URL: ${url} (relevance: ${relevanceScore.toFixed(2)}, timeliness: ${timelinessScore.toFixed(2)})`)
          
          return result

        } catch (error: any) {
          logger.error(`Failed to process URL ${url}:`, {
            message: (error as Error).message,
            url: url.substring(0, 100)
          })
          return null
        }
      })
    })

    const processedResults = await Promise.all(processingPromises)
    
    // Filter out null results and apply quality thresholds
    const validResults = processedResults
      .filter((result): result is ContentResult => result !== null)
      .filter(result => result.isRelevant && result.isTimely && !result.isDuplicate)
      .sort((a, b) => b.overallScore - a.overallScore) // Sort by score descending

    logger.info(`Processed ${urls.length} URLs, ${validResults.length} high-quality results for ${symbol}`)

    return validResults
  }

  /**
   * Fetch content from URL with proper error handling
   */
  private async fetchContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxContentLength: 104857600, // 100MB limit - for large financial documents, PDFs, reports
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Financial-Data-Bot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      })

      if (response.status !== 200) {
        logger.warn(`HTTP ${response.status} for URL: ${url}`)
        return null
      }

      return response.data
    } catch (error: any) {
      logger.error(`Failed to fetch URL ${url}:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status
      })
      return null
    }
  }

  /**
   * Parse HTML content and extract meaningful text
   */
  private async parseContent(html: string, url: string, symbol: string) {
    const $ = cheerio.load(html)

    // Remove script and style elements
    $('script, style, nav, footer, aside, .sidebar, .advertisement').remove()

    // Extract title
    const title = $('title').text().trim() || 
                 $('h1').first().text().trim() || 
                 'No Title'

    // Extract main content
    let extractedText = ''
    
    // Try to find main content areas
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.content',
      '.article-content',
      '.post-content',
      '#content',
      'main'
    ]

    for (const selector of contentSelectors) {
      const content = $(selector).text()
      if (content && content.length > extractedText.length) {
        extractedText = content
      }
    }

    // Fallback: get all text from body
    if (!extractedText || extractedText.length < 200) {
      extractedText = $('body').text()
    }

    // Clean up text
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n+/g, '\n') // Normalize newlines
      .trim()

    // Extract published date
    const publishedDate = this.extractPublishedDate($, url)

    return {
      title: title.substring(0, 200), // Limit title length
      content: html,
      extractedText: extractedText.substring(0, 20000), // Limit text length
      publishedDate
    }
  }

  /**
   * Extract published date from various HTML elements
   */
  private extractPublishedDate($: cheerio.CheerioAPI, url: string): Date | undefined {
    // Common date selectors
    const dateSelectors = [
      '[property="article:published_time"]',
      '[name="publishdate"]',
      '.published-date',
      '.publish-date',
      '.date',
      'time[datetime]',
      '.timestamp'
    ]

    for (const selector of dateSelectors) {
      const element = $(selector).first()
      if (element.length) {
        const dateStr = element.attr('datetime') || 
                       element.attr('content') || 
                       element.text()
        
        if (dateStr) {
          const date = new Date(dateStr)
          if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
            return date
          }
        }
      }
    }

    // Try to extract from URL patterns
    const urlDateMatch = url.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
    if (urlDateMatch) {
      const [, year, month, day] = urlDateMatch
      return new Date(parseInt(year || '1970'), parseInt(month || '1') - 1, parseInt(day || '1'))
    }

    return undefined
  }

  /**
   * Calculate relevance score based on content analysis
   */
  private calculateRelevanceScore(parsed: any, symbol: string): number {
    const text = (parsed.title + ' ' + parsed.extractedText).toLowerCase()
    let score = 0

    // Symbol mentions (high weight)
    const symbolRegex = new RegExp(`\\b${symbol.toLowerCase()}\\b`, 'gi')
    const symbolMentions = (text.match(symbolRegex) || []).length
    score += Math.min(symbolMentions * 0.2, 0.4)

    // Financial keywords
    const financialKeywords = [
      'earnings', 'revenue', 'profit', 'loss', 'quarterly', 'annual',
      'financial', 'stock', 'shares', 'dividend', 'eps', 'guidance',
      'outlook', 'results', 'performance', 'analyst', 'rating',
      'target price', 'buy', 'sell', 'hold', 'upgrade', 'downgrade'
    ]

    const keywordMatches = financialKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    ).length

    score += Math.min(keywordMatches * 0.05, 0.3)

    // Negative factors
    if (text.includes('unrelated') || text.includes('off-topic')) {
      score -= 0.2
    }

    // Content quality indicators
    if (parsed.extractedText.length > 500) score += 0.1
    if (parsed.extractedText.length > 1500) score += 0.1

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Calculate timeliness score based on published date
   */
  private calculateTimelinessScore(parsed: any, thresholdDays: number): number {
    if (!parsed.publishedDate) {
      return 0.5 // Neutral score for unknown dates
    }

    const now = new Date()
    const ageInDays = (now.getTime() - parsed.publishedDate.getTime()) / (1000 * 60 * 60 * 24)

    if (ageInDays < 0) return 0 // Future dates are suspicious
    if (ageInDays <= 1) return 1.0 // Last day
    if (ageInDays <= 7) return 0.9 // Last week
    if (ageInDays <= 30) return 0.7 // Last month
    if (ageInDays <= thresholdDays) return 0.5 // Within threshold
    
    return Math.max(0, 0.5 - ((ageInDays - thresholdDays) / thresholdDays))
  }

  /**
   * Classify content type based on title and content
   */
  private classifyContent(title: string, text: string): ContentResult['contentType'] {
    const combined = (title + ' ' + text).toLowerCase()

    if (combined.includes('earnings') || combined.includes('quarterly results')) {
      return 'earnings'
    }
    if (combined.includes('sec filing') || combined.includes('10-k') || combined.includes('10-q')) {
      return 'filing'
    }
    if (combined.includes('analyst') || combined.includes('rating') || combined.includes('price target')) {
      return 'analysis'
    }
    if (combined.includes('news') || combined.includes('breaking') || combined.includes('announced')) {
      return 'news'
    }
    
    return 'other'
  }

  /**
   * Extract key topics from text
   */
  private extractKeyTopics(text: string, symbol: string): string[] {
    const topics: string[] = []
    const lowerText = text.toLowerCase()

    // Financial topics
    const topicPatterns = [
      /earnings?\s+(?:report|results?|call)/gi,
      /quarterly?\s+(?:report|results?)/gi,
      /revenue\s+(?:growth|increase|decrease)/gi,
      /profit\s+(?:margin|growth)/gi,
      /guidance\s+(?:raised|lowered|maintained)/gi,
      /analyst\s+(?:rating|recommendation)/gi,
      /price\s+target/gi,
      /dividend\s+(?:increase|cut|declared)/gi
    ]

    for (const pattern of topicPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        topics.push(...matches.map(m => m.trim()))
      }
    }

    return [...new Set(topics)].slice(0, 10) // Unique topics, max 10
  }

  /**
   * Extract entities (companies, people, etc.)
   */
  private extractEntities(text: string): string[] {
    const entities: string[] = []

    // Simple entity extraction (can be enhanced with NLP libraries)
    const entityPatterns = [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Person names
      /\b[A-Z]{2,5}\b/g, // Stock symbols
      /\$\d+(?:\.\d+)?(?:\s*(?:billion|million|thousand|B|M|K))?\b/gi // Dollar amounts
    ]

    for (const pattern of entityPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        entities.push(...matches)
      }
    }

    return [...new Set(entities)].slice(0, 20) // Unique entities, max 20
  }

  /**
   * Analyze sentiment of text (simple implementation)
   */
  private analyzeSentiment(text: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'positive', 'up', 'growth', 'increase', 'strong', 'beat', 'outperform']
    const negativeWords = ['bad', 'poor', 'negative', 'down', 'decline', 'decrease', 'weak', 'miss', 'underperform', 'loss']

    const words = text.toLowerCase().split(/\s+/)
    let score = 0

    for (const word of words) {
      if (positiveWords.includes(word)) score += 1
      if (negativeWords.includes(word)) score -= 1
    }

    return Math.max(-1, Math.min(1, score / Math.max(words.length / 100, 1)))
  }

  /**
   * Check for duplicate content using content hashing
   */
  private checkForDuplicate(text: string, url: string): boolean {
    // Simple content hash (first 1000 chars)
    const contentHash = this.hashContent(text.substring(0, 1000))
    
    if (this.contentHashes.has(contentHash)) {
      const existingUrl = this.contentHashes.get(contentHash)!
      logger.debug(`Duplicate content detected: ${url} (similar to ${existingUrl})`)
      return true
    }

    this.contentHashes.set(contentHash, url)
    return false
  }

  /**
   * Create a semaphore for controlling concurrency
   */
  private createSemaphore(maxConcurrency: number) {
    let running = 0
    const queue: Array<() => void> = []

    return async <T>(fn: () => Promise<T>): Promise<T> => {
      return new Promise((resolve, reject) => {
        const task = async () => {
          running++
          try {
            const result = await fn()
            resolve(result)
          } catch (error) {
            reject(error)
          } finally {
            running--
            if (queue.length > 0) {
              const next = queue.shift()!
              next()
            }
          }
        }

        if (running < maxConcurrency) {
          task()
        } else {
          queue.push(task)
        }
      })
    }
  }

  /**
   * Simple URL hashing
   */
  private hashUrl(url: string): string {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  /**
   * Simple content hashing
   */
  private hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      processedUrls: this.processedUrls.size,
      uniqueContentHashes: this.contentHashes.size,
      duplicateDetectionEnabled: this.contentHashes.size > 0
    }
  }

  /**
   * Clear processing cache
   */
  clearCache() {
    this.processedUrls.clear()
    this.contentHashes.clear()
    logger.info('Content processor cache cleared')
  }
} 