import axios from 'axios'
import puppeteer, { type Browser } from 'puppeteer'
import * as cheerio from 'cheerio'
import PDFParse from 'pdf-parse'
import { createLogger } from '../utils/logger'
import { WebSearchService, SearchResult } from './WebSearchService'

const logger = createLogger('document-fetcher')

export interface DocumentInfo {
  id: string
  symbol: string
  title: string
  url: string
  documentType: 'SEC_FILING' | 'EARNINGS_TRANSCRIPT' | 'NEWS' | 'RESEARCH_REPORT' | 'COMPANY_DOCUMENT'
  filingType?: string // 10-K, 10-Q, 8-K, etc.
  publishedDate: Date
  content?: string
  metadata: {
    source: string
    author?: string
    pageCount?: number
    fileSize?: number
    language?: string
  }
  status: 'DISCOVERED' | 'FETCHING' | 'PROCESSED' | 'ERROR'
  fetchedAt?: Date
  processedAt?: Date
  error?: string
}

export interface FetchOptions {
  maxDocuments?: number
  dateRange?: 'week' | 'month' | 'quarter' | 'year'
  documentTypes?: string[]
  sources?: string[]
  includeContent?: boolean
}

export class DocumentFetcher {
  private webSearchService: WebSearchService
  private browser: Browser | null = null

  constructor() {
    this.webSearchService = new WebSearchService()
  }

  /**
   * Initialize browser for web scraping
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }
  }

  /**
   * Discover and fetch all documents for a company
   */
  async fetchAllCompanyDocuments(symbol: string, companyName: string, options: FetchOptions = {}): Promise<DocumentInfo[]> {
    logger.info(`Starting comprehensive document fetch for ${symbol}`)
    
    const allDocuments: DocumentInfo[] = []
    
    try {
      // Discover SEC filings
      const secFilings = await this.discoverSECFilings(symbol, options)
      allDocuments.push(...secFilings)

      // Discover earnings transcripts
      const earningsTranscripts = await this.discoverEarningsTranscripts(symbol, companyName, options)
      allDocuments.push(...earningsTranscripts)

      // Discover company documents (IR page, annual reports, etc.)
      const companyDocs = await this.discoverCompanyDocuments(symbol, companyName, options)
      allDocuments.push(...companyDocs)

      // Discover recent news and research
      const newsAndResearch = await this.discoverNewsAndResearch(symbol, companyName, options)
      allDocuments.push(...newsAndResearch)

      // Fetch content for priority documents
      if (options.includeContent) {
        await this.fetchDocumentContents(allDocuments.slice(0, options.maxDocuments || 50))
      }

      logger.info(`Discovered ${allDocuments.length} documents for ${symbol}`)
      return allDocuments
    } catch (error) {
      logger.error(`Document discovery failed for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Discover SEC filings using EDGAR API and web search
   */
  async discoverSECFilings(symbol: string, options: FetchOptions = {}): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = []
    
    try {
      // First try EDGAR API
      const edgarDocs = await this.fetchFromEDGAR(symbol, options)
      documents.push(...edgarDocs)

      // Supplement with web search
      const searchResults = await this.webSearchService.searchCompanyInfo(symbol, '', 'filings')
      for (const result of searchResults.slice(0, 10)) {
        if (result.url.includes('sec.gov') || result.url.includes('edgar')) {
          const docInfo = this.createDocumentInfo(
            symbol,
            result.title,
            result.url,
            'SEC_FILING',
            result.published?.toISOString(),
            'SEC EDGAR'
          )
          
          // Try to determine filing type from URL or title
          docInfo.filingType = this.extractFilingType(result.url, result.title)
          documents.push(docInfo)
        }
      }

      return this.deduplicateDocuments(documents)
    } catch (error) {
      logger.error(`SEC filing discovery failed for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Fetch documents from SEC EDGAR API
   */
  private async fetchFromEDGAR(symbol: string, options: FetchOptions): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = []
    
    try {
      // Get company CIK first
      const companyResponse = await axios.get(
        `https://www.sec.gov/files/company_tickers.json`,
        {
          headers: {
            'User-Agent': 'YobiTrading contact@yobitrading.com'
          }
        }
      )

      let cik = null
      const companies = companyResponse.data
      for (const key in companies) {
        if (companies[key].ticker === symbol.toUpperCase()) {
          cik = companies[key].cik_str.toString().padStart(10, '0')
          break
        }
      }

      if (!cik) {
        logger.warn(`CIK not found for symbol ${symbol}`)
        return documents
      }

      // Fetch recent filings
      const filingsResponse = await axios.get(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        {
          headers: {
            'User-Agent': 'YobiTrading contact@yobitrading.com'
          }
        }
      )

      const filings = filingsResponse.data.filings?.recent
      if (!filings) return documents

      const targetForms = options.documentTypes || ['10-K', '10-Q', '8-K', 'DEF 14A']
      const dateLimit = this.getDateLimit(options.dateRange)

      for (let i = 0; i < Math.min(filings.form.length, 50); i++) {
        const form = filings.form[i]
        const filingDate = new Date(filings.filingDate[i])
        
        if (targetForms.includes(form) && filingDate >= dateLimit) {
          const accessionNumber = filings.accessionNumber[i]
          const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber.replace(/-/g, '')}/${accessionNumber}.txt`
          
          const docInfo = this.createDocumentInfo(
            symbol,
            `${form} - ${filings.primaryDocument[i]}`,
            url,
            'SEC_FILING',
            filingDate.toISOString(),
            'SEC EDGAR'
          )
          docInfo.filingType = form
          documents.push(docInfo)
        }
      }

      return documents
    } catch (error) {
      logger.error('EDGAR API request failed:', error)
      return []
    }
  }

  /**
   * Discover earnings transcripts from various sources
   */
  async discoverEarningsTranscripts(symbol: string, companyName: string, options: FetchOptions = {}): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = []
    
    try {
      const searchResults = await this.webSearchService.searchCompanyInfo(symbol, companyName, 'earnings')
      
      for (const result of searchResults) {
        // Filter for earnings transcript sources
        if (this.isEarningsTranscriptSource(result.url)) {
          const docInfo = this.createDocumentInfo(
            symbol,
            result.title,
            result.url,
            'EARNINGS_TRANSCRIPT',
            result.published?.toISOString(),
            this.extractSourceDomain(result.url)
          )
          documents.push(docInfo)
        }
      }

      return documents.slice(0, options.maxDocuments || 20)
    } catch (error) {
      logger.error(`Earnings transcript discovery failed for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Discover company documents (IR pages, annual reports, etc.)
   */
  async discoverCompanyDocuments(symbol: string, companyName: string, options: FetchOptions = {}): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = []
    
    try {
      await this.initBrowser()
      
      // Search for investor relations pages
      const irQuery = `${companyName} investor relations annual report`
      const searchResults = await this.webSearchService.search(irQuery, {
        maxResults: 10,
        // Note: includeDomains not supported in current SearchOptions interface
      })

      for (const result of searchResults) {
        try {
          // Scrape the IR page for document links
          const irDocuments = await this.scrapeInvestorRelationsPage(result.url, symbol)
          documents.push(...irDocuments)
        } catch (error) {
          logger.warn(`Failed to scrape ${result.url}:`, error)
        }
      }

      return documents.slice(0, options.maxDocuments || 30)
    } catch (error) {
      logger.error(`Company document discovery failed for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Discover news and research reports
   */
  async discoverNewsAndResearch(symbol: string, companyName: string, options: FetchOptions = {}): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = []
    
    try {
      // Get recent news
      const newsResults = await this.webSearchService.searchCompanyInfo(symbol, companyName, 'news')
      
      for (const result of newsResults.slice(0, 20)) {
        const docInfo = this.createDocumentInfo(
          symbol,
          result.title,
          result.url,
          'NEWS',
          result.published?.toISOString(),
          this.extractSourceDomain(result.url)
        )
        documents.push(docInfo)
      }

      // Get research reports
      const researchResults = await this.webSearchService.searchCompanyInfo(symbol, companyName, 'analysis')
      
      for (const result of researchResults.slice(0, 10)) {
        if (this.isResearchReportSource(result.url)) {
          const docInfo = this.createDocumentInfo(
            symbol,
            result.title,
            result.url,
            'RESEARCH_REPORT',
            result.published?.toISOString(),
            this.extractSourceDomain(result.url)
          )
          documents.push(docInfo)
        }
      }

      return documents
    } catch (error) {
      logger.error(`News and research discovery failed for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Fetch content for discovered documents
   */
  async fetchDocumentContents(documents: DocumentInfo[]): Promise<void> {
    logger.info(`Fetching content for ${documents.length} documents`)
    
    for (const doc of documents) {
      try {
        doc.status = 'FETCHING'
        doc.fetchedAt = new Date()

        if (doc.url.endsWith('.pdf')) {
          doc.content = await this.fetchPDFContent(doc.url)
        } else {
          doc.content = await this.fetchWebContent(doc.url)
        }

        doc.status = 'PROCESSED'
        doc.processedAt = new Date()
        
        // Update metadata
        doc.metadata.fileSize = doc.content?.length || 0
        doc.metadata.pageCount = doc.content ? Math.ceil(doc.content.length / 3000) : 0

      } catch (error) {
        doc.status = 'ERROR'
        doc.error = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`Failed to fetch content for ${doc.url}:`, error)
      }
    }
  }

  /**
   * Fetch PDF content
   */
  private async fetchPDFContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YobiBot/1.0)'
        }
      })
      
      const pdfData = await PDFParse(response.data)
      return pdfData.text
    } catch (error) {
      logger.error(`PDF extraction failed for ${url}:`, error)
      throw error
    }
  }

  /**
   * Fetch web content using Puppeteer
   */
  private async fetchWebContent(url: string): Promise<string> {
    try {
      await this.initBrowser()
      const page = await this.browser!.newPage()
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
      
      // Extract main content (remove navigation, ads, etc.)
      const content = await page.evaluate(() => {
        // Remove unwanted elements
        const unwantedSelectors = [
          'nav', 'header', 'footer', '.ad', '.advertisement', 
          '.sidebar', '.menu', '.navigation', '.social-media'
        ]
        
        unwantedSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector)
          elements.forEach(el => el.remove())
        })

        // Get main content
        const contentSelectors = [
          'main', '.content', '.article', '.post', '#content',
          '.main-content', '.article-content', '.entry-content'
        ]

        for (const selector of contentSelectors) {
          const element = document.querySelector(selector)
          if (element) {
            return element.textContent?.trim() || ''
          }
        }

        // Fallback to body
        return document.body.textContent?.trim() || ''
      })

      await page.close()
      return content
    } catch (error) {
      logger.error(`Web content extraction failed for ${url}:`, error)
      throw error
    }
  }

  /**
   * Scrape investor relations page for document links
   */
  private async scrapeInvestorRelationsPage(url: string, symbol: string): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = []
    
    try {
      await this.initBrowser()
      const page = await this.browser!.newPage()
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Extract document links
      const links = await page.evaluate(() => {
        const linkElements = document.querySelectorAll('a[href]')
        const documentLinks: Array<{ href: string; text: string }> = []

        linkElements.forEach(link => {
          const href = link.getAttribute('href') || ''
          const text = link.textContent?.trim() || ''
          
          // Filter for document-like links
          if (href.match(/\.(pdf|doc|docx|xls|xlsx)$/i) || 
              text.match(/(annual report|10-K|10-Q|proxy|presentation|earnings)/i)) {
            documentLinks.push({ href, text })
          }
        })

        return documentLinks
      })

      for (const link of links) {
        const fullUrl = new URL(link.href, url).toString()
        const docInfo = this.createDocumentInfo(
          symbol,
          link.text,
          fullUrl,
          'COMPANY_DOCUMENT',
          undefined,
          this.extractSourceDomain(url)
        )
        documents.push(docInfo)
      }

      await page.close()
      return documents
    } catch (error) {
      logger.error(`IR page scraping failed for ${url}:`, error)
      return []
    }
  }

  /**
   * Helper methods
   */
  private createDocumentInfo(
    symbol: string,
    title: string,
    url: string,
    documentType: DocumentInfo['documentType'],
    publishedDate?: string,
    source?: string
  ): DocumentInfo {
    return {
      id: `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: symbol.toUpperCase(),
      title: title.trim(),
      url,
      documentType,
      publishedDate: publishedDate ? new Date(publishedDate) : new Date(),
      metadata: {
        source: source || this.extractSourceDomain(url)
      },
      status: 'DISCOVERED'
    }
  }

  private extractFilingType(url: string, title: string): string | undefined {
    const filingTypes = ['10-K', '10-Q', '8-K', 'DEF 14A', '13F', 'SC 13G', 'SC 13D']
    
    for (const type of filingTypes) {
      if (url.includes(type) || title.includes(type)) {
        return type
      }
    }
    
    return undefined
  }

  private extractSourceDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'unknown'
    }
  }

  private isEarningsTranscriptSource(url: string): boolean {
    const transcriptSources = [
      'seekingalpha.com',
      'fool.com',
      'investor.',
      'ir.',
      'earnings.call'
    ]
    return transcriptSources.some(source => url.includes(source))
  }

  private isResearchReportSource(url: string): boolean {
    const researchSources = [
      'morningstar.com',
      'zacks.com',
      'tipranks.com',
      'gurufocus.com',
      'valueresearchonline.com'
    ]
    return researchSources.some(source => url.includes(source))
  }

  private getDateLimit(dateRange?: string): Date {
    const now = new Date()
    switch (dateRange) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case 'quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // Default 1 year
    }
  }

  private deduplicateDocuments(documents: DocumentInfo[]): DocumentInfo[] {
    const seen = new Set<string>()
    return documents.filter(doc => {
      const key = `${doc.url}_${doc.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
} 