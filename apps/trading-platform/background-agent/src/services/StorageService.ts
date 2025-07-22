import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import { createLogger } from '../utils/logger'
import { DatabaseService } from './DatabaseService'
import { SearchResult } from './WebSearchService'
import { DocumentInfo } from './DocumentFetcher'
import { InsightData } from './InsightsEngine'

const logger = createLogger('storage-service')

export interface StoredDocument {
  id: string
  instrumentId: string
  title: string
  url: string
  documentType: string
  s3Key?: string
  s3Bucket?: string
  contentHash?: string
  extractedText?: string
  summary?: string
  metadata: any
  status: string
}

export interface StoredSearchResult {
  id: string
  instrumentId: string
  query: string
  title: string
  url: string
  snippet?: string
  provider: string
  relevanceScore: number
  publishedDate?: Date
  metadata: any
}

export interface StoredInsight {
  id: string
  instrumentId: string
  analysisType: string
  recommendation: string
  confidence: number
  summary: string
  keyInsights: string[]
  risks: string[]
  opportunities: string[]
  rationale: string
  sourcesUsed: any
  dataQuality: number
  validUntil?: Date
}

// Helper functions to convert null to undefined for interface compatibility
function convertToStoredSearchResult(dbResult: any): StoredSearchResult {
  return {
    ...dbResult,
    snippet: dbResult.snippet || undefined,
    publishedDate: dbResult.publishedDate || undefined
  }
}

function convertToStoredDocument(dbResult: any): StoredDocument {
  return {
    ...dbResult,
    s3Key: dbResult.s3Key || undefined,
    s3Bucket: dbResult.s3Bucket || undefined,
    contentHash: dbResult.contentHash || undefined,
    extractedText: dbResult.extractedText || undefined,
    summary: dbResult.summary || undefined
  }
}

function convertToStoredInsight(dbResult: any): StoredInsight {
  return {
    ...dbResult,
    validUntil: dbResult.validUntil || undefined
  }
}

export class StorageService {
  private s3Client: S3Client | null = null
  private databaseService: DatabaseService
  private bucketName: string

  constructor() {
    this.databaseService = new DatabaseService()
    this.bucketName = process.env.AWS_S3_BUCKET || 'trading-platform-documents'
    
    // Initialize S3 client if credentials are available
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      })
      logger.info('S3 client initialized successfully')
    } else {
      logger.warn('S3 credentials not found - document storage will be limited to database only')
    }
  }

  /**
   * Store search results in database
   */
  async storeSearchResults(
    instrumentId: string, 
    searchResults: SearchResult[], 
    query: string
  ): Promise<StoredSearchResult[]> {
    try {
      const storedResults: StoredSearchResult[] = []

      for (const result of searchResults) {
        try {
          // Check if this URL already exists for this instrument and provider
          const existingResult = await this.databaseService.findSearchResult(
            instrumentId, 
            result.url, 
            result.source || 'unknown'
          )

          if (existingResult) {
            logger.debug(`Search result already exists: ${result.url}`)
            storedResults.push(convertToStoredSearchResult(existingResult))
            continue
          }

          // Store new search result
          const stored = await this.databaseService.createSearchResult({
            instrumentId,
            query,
            title: result.title,
            url: result.url,
            snippet: result.snippet,
            provider: result.source || 'unknown',
            relevanceScore: result.relevanceScore || 0,
            publishedDate: result.published ? new Date(result.published) : null,
            contentType: 'web',
            domain: this.extractDomain(result.url),
            metadata: {
              originalQuery: query,
              source: result.source,
              domain: result.domain
            }
          })

          storedResults.push(convertToStoredSearchResult(stored))
          logger.debug(`Stored search result: ${result.title}`)

        } catch (error) {
          logger.error(`Failed to store search result ${result.url}:`, error)
        }
      }

      logger.info(`Stored ${storedResults.length} search results for instrument ${instrumentId}`)
      return storedResults

    } catch (error) {
      logger.error(`Failed to store search results for ${instrumentId}:`, error)
      return []
    }
  }

  /**
   * Store documents with S3 integration
   */
  async storeDocuments(
    instrumentId: string, 
    documents: DocumentInfo[]
  ): Promise<StoredDocument[]> {
    try {
      const storedDocuments: StoredDocument[] = []

      for (const doc of documents) {
        try {
          // Generate content hash for deduplication
          const contentHash = doc.content 
            ? this.generateContentHash(doc.content)
            : this.generateContentHash(doc.url + doc.title)

          // Check if document already exists
          const existingDoc = await this.databaseService.findDocumentByHash(
            instrumentId, 
            contentHash
          )

          if (existingDoc) {
            logger.debug(`Document already exists: ${doc.title}`)
            storedDocuments.push(convertToStoredDocument(existingDoc))
            continue
          }

          let s3Key: string | undefined
          let s3Bucket: string | undefined
          let fileSize: number | undefined

          // Upload document content to S3 if available
          if (doc.content && this.s3Client) {
            try {
              s3Key = this.generateS3Key(instrumentId, doc.documentType, doc.title)
              s3Bucket = this.bucketName
              
              const uploadCommand = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
                Body: Buffer.from(doc.content, 'utf-8'),
                ContentType: 'text/plain',
                Metadata: {
                  instrumentId,
                  documentType: doc.documentType,
                  title: doc.title,
                  url: doc.url,
                  contentHash,
                  uploadedAt: new Date().toISOString()
                }
              })

              await this.s3Client.send(uploadCommand)
              fileSize = Buffer.from(doc.content, 'utf-8').byteLength
              logger.debug(`Uploaded document to S3: ${s3Key}`)

            } catch (s3Error) {
              logger.error(`Failed to upload document to S3: ${doc.title}`, s3Error)
              // Continue without S3 storage
            }
          }

          // Store document metadata in database
          const stored = await this.databaseService.createDocument({
            instrumentId,
            title: doc.title,
            url: doc.url,
            documentType: this.mapDocumentType(doc.documentType),
            filingType: doc.filingType,
            publishedDate: doc.publishedDate ? new Date(doc.publishedDate) : null,
            status: doc.status === 'PROCESSED' ? 'PROCESSED' : 'DISCOVERED',
            s3Key,
            s3Bucket,
            contentHash,
            fileSize: fileSize ? BigInt(fileSize) : null,
            extractedText: doc.content,
            summary: null, // Can be generated later with AI
            keyPoints: [],
            sourceProvider: doc.metadata?.source || 'unknown',
            sourceUrl: doc.url,
            metadata: {
              ...doc.metadata,
              fetchedAt: doc.fetchedAt?.toISOString(),
              processedAt: doc.processedAt?.toISOString()
            }
          })

          storedDocuments.push(convertToStoredDocument(stored))
          logger.debug(`Stored document: ${doc.title}`)

        } catch (error) {
          logger.error(`Failed to store document ${doc.title}:`, error)
        }
      }

      logger.info(`Stored ${storedDocuments.length} documents for instrument ${instrumentId}`)
      return storedDocuments

    } catch (error) {
      logger.error(`Failed to store documents for ${instrumentId}:`, error)
      return []
    }
  }

  /**
   * Store AI insights
   */
  async storeInsights(
    instrumentId: string, 
    insights: InsightData
  ): Promise<StoredInsight | null> {
    try {
      // Deactivate previous insights for this instrument
      await this.databaseService.deactivateInsights(instrumentId, 'AI_POWERED')

      // Extract risks and opportunities from insights
      const risks = insights.insights.filter(i => i.type === 'RISK').map(i => i.description)
      const opportunities = insights.insights.filter(i => i.type === 'OPPORTUNITY').map(i => i.description)
      const keyInsights = insights.insights.map(i => i.description)

      // Convert DataQuality to number (use completeness as primary metric)
      const dataQualityScore = typeof insights.dataQuality === 'object' 
        ? insights.dataQuality.completeness || 0
        : Number(insights.dataQuality) || 0

      const stored = await this.databaseService.createInsight({
        instrumentId,
        analysisType: 'AI_POWERED',
        recommendation: 'HOLD', // Default recommendation
        confidence: insights.confidence || 0,
        targetPrice: undefined,
        stopLoss: undefined,
        timeHorizon: 'MEDIUM_TERM',
        summary: insights.executiveSummary || '',
        keyInsights,
        risks,
        opportunities,
        rationale: insights.executiveSummary || 'AI-powered analysis completed',
        sourcesUsed: insights.sources || {},
        dataQuality: dataQualityScore,
        dataFreshness: new Date(),
        validUntil: undefined,
        modelVersion: 'claude-3.5',
        tokenCount: undefined
      })

      logger.info(`Stored AI insights for instrument ${instrumentId}`)
      return convertToStoredInsight(stored)

    } catch (error) {
      logger.error(`Failed to store insights for ${instrumentId}:`, error)
      return null
    }
  }

  /**
   * Retrieve document content from S3
   */
  async getDocumentContent(s3Key: string): Promise<string | null> {
    if (!this.s3Client || !s3Key) {
      return null
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      })

      const response = await this.s3Client.send(command)
      if (response.Body) {
        const content = await response.Body.transformToString()
        return content
      }

      return null

    } catch (error) {
      logger.error(`Failed to retrieve document from S3: ${s3Key}`, error)
      return null
    }
  }

  /**
   * Generate presigned URL for document access
   */
  async getDocumentUrl(s3Key: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.s3Client || !s3Key) {
      return null
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      })

      const url = await getSignedUrl(this.s3Client, command, { expiresIn })
      return url

    } catch (error) {
      logger.error(`Failed to generate presigned URL for: ${s3Key}`, error)
      return null
    }
  }

  /**
   * Get stored search results for an instrument
   */
  async getSearchResults(
    instrumentId: string, 
    limit: number = 100
  ): Promise<StoredSearchResult[]> {
    try {
      const results = await this.databaseService.getSearchResults(instrumentId, limit)
      return results.map(convertToStoredSearchResult)
    } catch (error) {
      logger.error(`Failed to get search results for ${instrumentId}:`, error)
      return []
    }
  }

  /**
   * Get stored documents for an instrument
   */
  async getDocuments(
    instrumentId: string, 
    documentType?: string,
    limit: number = 50
  ): Promise<StoredDocument[]> {
    try {
      const results = await this.databaseService.getDocuments(instrumentId, documentType, limit)
      return results.map(convertToStoredDocument)
    } catch (error) {
      logger.error(`Failed to get documents for ${instrumentId}:`, error)
      return []
    }
  }

  /**
   * Get latest AI insights for an instrument
   */
  async getLatestInsights(instrumentId: string): Promise<StoredInsight | null> {
    try {
      const result = await this.databaseService.getLatestInsights(instrumentId)
      return result ? convertToStoredInsight(result) : null
    } catch (error) {
      logger.error(`Failed to get insights for ${instrumentId}:`, error)
      return null
    }
  }

  /**
   * Health check for storage services
   */
  async healthCheck(): Promise<{ database: boolean; s3: boolean }> {
    const health = {
      database: false,
      s3: false
    }

    // Test database connection
    try {
      await this.databaseService.getActiveInstruments()
      health.database = true
    } catch (error) {
      logger.debug('Database health check failed')
    }

    // Test S3 connection
    if (this.s3Client) {
      try {
        // Simple test - list objects with small limit
        await this.s3Client.send(new GetObjectCommand({ 
          Bucket: this.bucketName, 
          Key: 'health-check-non-existent' 
        }))
        health.s3 = true
      } catch (error) {
        // Expected to fail, but if it's a permission error, S3 is accessible
        if (error instanceof Error && error.name !== 'NoSuchKey') {
          health.s3 = true // S3 is accessible, just no such key
        }
      }
    }

    return health
  }

  /**
   * Helper methods
   */
  private generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  private generateS3Key(instrumentId: string, documentType: string, title: string): string {
    const timestamp = Date.now()
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 100)
    return `documents/${instrumentId}/${documentType}/${timestamp}-${sanitizedTitle}.txt`
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'unknown'
    }
  }

  private mapDocumentType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'SEC_FILING': 'SEC_FILING',
      'EARNINGS_TRANSCRIPT': 'EARNINGS_TRANSCRIPT',
      'NEWS': 'NEWS_ARTICLE',
      'RESEARCH_REPORT': 'RESEARCH_REPORT',
      'COMPANY_DOCUMENT': 'ANNUAL_REPORT'
    }
    return typeMap[type] || 'RESEARCH_REPORT'
  }

  async disconnect(): Promise<void> {
    try {
      await this.databaseService.disconnect()
      logger.info('Storage service disconnected')
    } catch (error) {
      logger.error('Error disconnecting storage service:', error)
    }
  }
} 