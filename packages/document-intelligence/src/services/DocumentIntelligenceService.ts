import { Anthropic } from '@anthropic-ai/sdk'
import puppeteer from 'puppeteer'
import axios from 'axios'
import * as cheerio from 'cheerio'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import { createWorker } from 'tesseract.js'
import { Logger } from 'winston'
import Queue from 'bull'
import { Pinecone } from '@pinecone-database/pinecone'

interface CompanyDocument {
  id: string
  symbol: string
  companyName: string
  documentType: DocumentType
  title: string
  url: string
  filingDate?: Date
  period?: string // Q1 2024, FY 2023, etc.
  content: string
  extractedData: FinancialData
  metadata: DocumentMetadata
  processedAt: Date
}

interface FinancialData {
  revenue?: number[]
  netIncome?: number[]
  totalAssets?: number
  totalLiabilities?: number
  shareholderEquity?: number
  cashFlow?: number
  ratios?: FinancialRatios
  keyMetrics?: KeyMetrics
  businessSegments?: BusinessSegment[]
  riskFactors?: string[]
  forwardGuidance?: string[]
}

interface FinancialRatios {
  peRatio?: number
  pbRatio?: number
  roe?: number
  roa?: number
  debtToEquity?: number
  currentRatio?: number
  quickRatio?: number
  grossMargin?: number
  operatingMargin?: number
  netMargin?: number
}

interface KeyMetrics {
  revenueGrowth?: number
  earningsGrowth?: number
  freeCashFlow?: number
  bookValuePerShare?: number
  tangibleBookValue?: number
  workingCapital?: number
}

interface BusinessSegment {
  name: string
  revenue: number
  operatingIncome: number
  percentOfTotal: number
}

interface DocumentMetadata {
  source: 'SEC' | 'COMPANY_WEBSITE' | 'INVESTOR_RELATIONS' | 'EARNINGS_CALL' | 'MANUAL'
  fileSize: number
  pageCount?: number
  language: string
  extractionMethod: 'PDF' | 'HTML' | 'OCR' | 'API'
  confidence: number
}

enum DocumentType {
  ANNUAL_REPORT = '10-K',
  QUARTERLY_REPORT = '10-Q',
  PROXY_STATEMENT = 'DEF 14A',
  CURRENT_REPORT = '8-K',
  EARNINGS_RELEASE = 'EARNINGS',
  INVESTOR_PRESENTATION = 'PRESENTATION',
  MANAGEMENT_DISCUSSION = 'MD&A',
  FINANCIAL_STATEMENTS = 'FINANCIALS'
}

export class DocumentIntelligenceService {
  private anthropic: Anthropic
  private pinecone: Pinecone
  private logger: Logger
  private processingQueue: Queue.Queue
  private browser?: any

  constructor(logger: Logger) {
    this.logger = logger
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    })
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    })
    
    // Initialize Bull queue for document processing
    this.processingQueue = new Queue('document processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    })

    this.setupQueueProcessors()
  }

  /**
   * Main entry point for document processing
   */
  async processCompanyDocuments(symbol: string): Promise<CompanyDocument[]> {
    try {
      this.logger.info(`Starting document processing for ${symbol}`)

      // 1. Discover available documents
      const documentUrls = await this.discoverDocuments(symbol)
      
      // 2. Queue documents for processing
      const jobs = await Promise.all(
        documentUrls.map(doc => 
          this.processingQueue.add('process-document', {
            symbol,
            documentUrl: doc.url,
            documentType: doc.type,
            metadata: doc.metadata
          })
        )
      )

      this.logger.info(`Queued ${jobs.length} documents for processing`, { symbol })
      return []

    } catch (error) {
      this.logger.error(`Document processing failed for ${symbol}`, { error })
      throw error
    }
  }

  /**
   * Discover available documents for a company
   */
  private async discoverDocuments(symbol: string): Promise<Array<{
    url: string
    type: DocumentType
    metadata: any
  }>> {
    const documents: Array<{ url: string; type: DocumentType; metadata: any }> = []

    try {
      // 1. SEC EDGAR Database
      const secDocuments = await this.discoverSECDocuments(symbol)
      documents.push(...secDocuments)

      // 2. Company Investor Relations
      const irDocuments = await this.discoverIRDocuments(symbol)
      documents.push(...irDocuments)

      // 3. Earnings Call Transcripts
      const earningsDocuments = await this.discoverEarningsDocuments(symbol)
      documents.push(...earningsDocuments)

      this.logger.info(`Discovered ${documents.length} documents for ${symbol}`)
      return documents

    } catch (error) {
      this.logger.error(`Document discovery failed for ${symbol}`, { error })
      return []
    }
  }

  /**
   * Discover SEC filings
   */
  private async discoverSECDocuments(symbol: string): Promise<Array<{
    url: string
    type: DocumentType
    metadata: any
  }>> {
    try {
      // SEC EDGAR API
      const response = await axios.get(
        `https://data.sec.gov/submissions/CIK${await this.getCIK(symbol)}.json`,
        {
          headers: {
            'User-Agent': 'Yobi Trading Platform (support@yobi.com)'
          }
        }
      )

      const filings = response.data.filings?.recent
      const documents: Array<{ url: string; type: DocumentType; metadata: any }> = []

      if (filings) {
        for (let i = 0; i < Math.min(10, filings.form.length); i++) {
          const form = filings.form[i]
          const filingDate = filings.filingDate[i]
          const accessionNumber = filings.accessionNumber[i]

          let documentType: DocumentType
          switch (form) {
            case '10-K': documentType = DocumentType.ANNUAL_REPORT; break
            case '10-Q': documentType = DocumentType.QUARTERLY_REPORT; break
            case '8-K': documentType = DocumentType.CURRENT_REPORT; break
            case 'DEF 14A': documentType = DocumentType.PROXY_STATEMENT; break
            default: continue
          }

          documents.push({
            url: `https://www.sec.gov/Archives/edgar/data/${response.data.cik}/${accessionNumber.replace(/-/g, '')}/${accessionNumber}.txt`,
            type: documentType,
            metadata: {
              source: 'SEC',
              filingDate,
              form,
              accessionNumber
            }
          })
        }
      }

      return documents

    } catch (error) {
      this.logger.warn(`SEC document discovery failed for ${symbol}`, { error })
      return []
    }
  }

  /**
   * Discover company investor relations documents
   */
  private async discoverIRDocuments(symbol: string): Promise<Array<{
    url: string
    type: DocumentType
    metadata: any
  }>> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({ headless: true })
      }

      const page = await this.browser.newPage()
      
      // Common IR URL patterns
      const irUrls = [
        `https://investors.${symbol.toLowerCase()}.com`,
        `https://investor.${symbol.toLowerCase()}.com`,
        `https://ir.${symbol.toLowerCase()}.com`,
        `https://www.${symbol.toLowerCase()}.com/investors`,
        `https://www.${symbol.toLowerCase()}.com/investor-relations`
      ]

      const documents: Array<{ url: string; type: DocumentType; metadata: any }> = []

      for (const url of irUrls) {
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
          
          // Extract document links
          const documentLinks = await page.evaluate(() => {
            const links: Array<{ href: string; text: string }> = []
            document.querySelectorAll('a[href*=".pdf"], a[href*="earnings"], a[href*="annual"], a[href*="quarterly"]').forEach(link => {
              const href = (link as HTMLAnchorElement).href
              const text = link.textContent?.trim() || ''
              if (href && text) {
                links.push({ href, text })
              }
            })
            return links
          })

          documentLinks.forEach((link: { href: string; text: string }) => {
            let documentType = DocumentType.FINANCIAL_STATEMENTS
            
            if (link.text.toLowerCase().includes('annual')) {
              documentType = DocumentType.ANNUAL_REPORT
            } else if (link.text.toLowerCase().includes('quarterly') || link.text.toLowerCase().includes('q1') || link.text.toLowerCase().includes('q2')) {
              documentType = DocumentType.QUARTERLY_REPORT
            } else if (link.text.toLowerCase().includes('earnings')) {
              documentType = DocumentType.EARNINGS_RELEASE
            } else if (link.text.toLowerCase().includes('presentation')) {
              documentType = DocumentType.INVESTOR_PRESENTATION
            }

            documents.push({
              url: link.href,
              type: documentType,
              metadata: {
                source: 'COMPANY_WEBSITE',
                title: link.text,
                discoveredAt: new Date()
              }
            })
          })

          break // Successfully found IR page

        } catch (error) {
          continue // Try next URL
        }
      }

      return documents

    } catch (error) {
      this.logger.warn(`IR document discovery failed for ${symbol}`, { error })
      return []
    }
  }

  /**
   * Discover earnings call transcripts
   */
  private async discoverEarningsDocuments(symbol: string): Promise<Array<{
    url: string
    type: DocumentType
    metadata: any
  }>> {
    // Implementation for earnings call transcript discovery
    // Could integrate with services like AlphaSense, FactSet, or scrape earnings.com
    return []
  }

  /**
   * Process individual document
   */
  private async processDocument(
    symbol: string,
    documentUrl: string,
    documentType: DocumentType,
    metadata: any
  ): Promise<CompanyDocument> {
    try {
      this.logger.info(`Processing document: ${documentUrl}`)

      // 1. Download document
      const content = await this.downloadDocument(documentUrl)
      
      // 2. Extract text
      const extractedText = await this.extractText(content, documentUrl)
      
      // 3. Extract financial data using AI
      const financialData = await this.extractFinancialData(extractedText, documentType)
      
      // 4. Create document record
      const document: CompanyDocument = {
        id: `${symbol}_${documentType}_${Date.now()}`,
        symbol,
        companyName: await this.getCompanyName(symbol),
        documentType,
        title: metadata.title || `${documentType} - ${symbol}`,
        url: documentUrl,
        filingDate: metadata.filingDate ? new Date(metadata.filingDate) : undefined,
        content: extractedText,
        extractedData: financialData,
        metadata: {
          source: metadata.source,
          fileSize: content.length,
          language: 'en',
          extractionMethod: this.getExtractionMethod(documentUrl),
          confidence: financialData ? 0.85 : 0.5
        },
        processedAt: new Date()
      }

      // 5. Store in vector database for search
      await this.storeInVectorDB(document)

      this.logger.info(`Successfully processed document: ${documentUrl}`)
      return document

    } catch (error) {
      this.logger.error(`Document processing failed: ${documentUrl}`, { error })
      throw error
    }
  }

  /**
   * Extract financial data using Claude AI
   */
  private async extractFinancialData(content: string, documentType: DocumentType): Promise<FinancialData> {
    try {
      const prompt = this.buildExtractionPrompt(content, documentType)
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const analysisText = (response.content[0] as any)?.text || ''
      return this.parseFinancialData(analysisText)

    } catch (error) {
      this.logger.error('Financial data extraction failed', { error })
      return {}
    }
  }

  /**
   * Build extraction prompt for Claude
   */
  private buildExtractionPrompt(content: string, documentType: DocumentType): string {
    // Truncate content if too long
    const truncatedContent = content.length > 15000 ? content.substring(0, 15000) + '...' : content

    return `
Extract key financial data from this ${documentType} document. Analyze the text and extract:

1. Financial Statements Data:
   - Revenue (current and previous periods)
   - Net Income
   - Total Assets, Liabilities, Equity
   - Cash Flow information

2. Financial Ratios:
   - P/E, P/B, ROE, ROA
   - Debt-to-Equity, Current Ratio
   - Profit margins

3. Key Metrics:
   - Revenue/Earnings growth rates
   - Free cash flow
   - Book value per share

4. Business Information:
   - Revenue by business segment
   - Risk factors mentioned
   - Forward guidance

5. Management Commentary:
   - Key strategic initiatives
   - Market outlook
   - Operational highlights

Document Content:
${truncatedContent}

Format the response as JSON:
{
  "revenue": [current_period, previous_period],
  "netIncome": [current, previous],
  "totalAssets": number,
  "totalLiabilities": number,
  "shareholderEquity": number,
  "ratios": {
    "peRatio": number,
    "pbRatio": number,
    "roe": number,
    "roa": number,
    "debtToEquity": number,
    "currentRatio": number,
    "grossMargin": number,
    "operatingMargin": number,
    "netMargin": number
  },
  "keyMetrics": {
    "revenueGrowth": number,
    "earningsGrowth": number,
    "freeCashFlow": number
  },
  "businessSegments": [
    {"name": "segment", "revenue": number, "percentOfTotal": number}
  ],
  "riskFactors": ["risk1", "risk2"],
  "forwardGuidance": ["guidance1", "guidance2"]
}

Focus on numerical data and be conservative with estimates. If information is not clearly stated, omit it rather than guess.
`
  }

  /**
   * Parse financial data from Claude response
   */
  private parseFinancialData(analysisText: string): FinancialData {
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return {}
    } catch (error) {
      this.logger.warn('Failed to parse financial data JSON', { error })
      return {}
    }
  }

  // Helper methods
  private async downloadDocument(url: string): Promise<Buffer> {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Yobi Trading Platform (support@yobi.com)'
      }
    })
    return Buffer.from(response.data)
  }

  private async extractText(content: Buffer, url: string): Promise<string> {
    if (url.toLowerCase().includes('.pdf')) {
      const data = await pdf(content)
      return data.text
    } else if (url.toLowerCase().includes('.doc')) {
      const result = await mammoth.extractRawText({ buffer: content })
      return result.value
    } else {
      // Assume HTML
      const $ = cheerio.load(content.toString())
      return $.text()
    }
  }

  private getExtractionMethod(url: string): 'PDF' | 'HTML' | 'OCR' | 'API' {
    if (url.toLowerCase().includes('.pdf')) return 'PDF'
    if (url.toLowerCase().includes('api.')) return 'API'
    return 'HTML'
  }

  private async getCIK(symbol: string): Promise<string> {
    // Implementation to get CIK from symbol
    // Could use SEC company tickers JSON
    return '0000000000' // Placeholder
  }

  private async getCompanyName(symbol: string): Promise<string> {
    // Implementation to get company name
    return symbol // Placeholder
  }

  private async storeInVectorDB(document: CompanyDocument): Promise<void> {
    // Implementation to store document in Pinecone
    // Similar to knowledge base storage
  }

  private setupQueueProcessors(): void {
    this.processingQueue.process('process-document', async (job) => {
      const { symbol, documentUrl, documentType, metadata } = job.data
      return this.processDocument(symbol, documentUrl, documentType, metadata)
    })
  }

  /**
   * Get processed documents for a symbol
   */
  async getProcessedDocuments(symbol: string): Promise<CompanyDocument[]> {
    // Implementation to retrieve stored documents
    return []
  }

  /**
   * Search documents by content
   */
  async searchDocuments(query: string, symbol?: string): Promise<CompanyDocument[]> {
    // Implementation for semantic search in documents
    return []
  }
} 