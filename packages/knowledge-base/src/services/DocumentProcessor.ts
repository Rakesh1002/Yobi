import pdf from 'pdf-parse'
import { createHash } from 'crypto'
import { 
  FinancialDocument, 
  DocumentChunk, 
  DocumentSource, 
  FinancialCategory,
  CertificationLevel,
  ProcessingStatus,
  DocumentProcessingJob,
  FinancialConcept,
  ConceptCategory
} from '../types'
import { Logger } from 'winston'
import { EmbeddingService } from './EmbeddingService'
import { ConceptExtractor } from './ConceptExtractor'

export class DocumentProcessor {
  private logger: Logger
  private embeddingService: EmbeddingService
  private conceptExtractor: ConceptExtractor

  constructor(
    logger: Logger,
    embeddingService: EmbeddingService,
    conceptExtractor: ConceptExtractor
  ) {
    this.logger = logger
    this.embeddingService = embeddingService
    this.conceptExtractor = conceptExtractor
  }

  /**
   * Process a financial document (PDF) and extract structured knowledge
   */
  async processDocument(
    buffer: Buffer,
    metadata: {
      title: string
      source: DocumentSource
      level: CertificationLevel
      url?: string
    }
  ): Promise<DocumentProcessingJob> {
    const jobId = this.generateJobId()
    const startTime = Date.now()

    try {
      this.logger.info(`Starting document processing job ${jobId}`, { metadata })

      // Extract text from PDF
      const pdfData = await this.extractPDFContent(buffer)
      
      // Create document record
      const document = await this.createDocumentRecord(pdfData, metadata, buffer)
      
      // Chunk the document into manageable pieces
      const chunks = await this.chunkDocument(document, pdfData.text)
      
      // Extract financial concepts from chunks
      const enrichedChunks = await this.enrichChunksWithConcepts(chunks)
      
      // Generate embeddings for vector search
      const chunksWithEmbeddings = await this.generateEmbeddings(enrichedChunks)
      
      const processingTime = Date.now() - startTime
      
      const job: DocumentProcessingJob = {
        id: jobId,
        documentId: document.id,
        status: ProcessingStatus.COMPLETED,
        progress: 100,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        statistics: {
          totalPages: pdfData.numpages,
          chunksCreated: chunks.length,
          conceptsExtracted: enrichedChunks.reduce((acc, chunk) => acc + chunk.concepts.length, 0),
          embeddingsGenerated: chunksWithEmbeddings.length,
          processingTimeMs: processingTime
        }
      }

      this.logger.info(`Document processing completed successfully`, { jobId, stats: job.statistics })
      return job

    } catch (error) {
      this.logger.error(`Document processing failed`, { jobId, error })
      
      return {
        id: jobId,
        documentId: '',
        status: ProcessingStatus.FAILED,
        progress: 0,
        startedAt: new Date(startTime),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        statistics: {
          totalPages: 0,
          chunksCreated: 0,
          conceptsExtracted: 0,
          embeddingsGenerated: 0,
          processingTimeMs: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Extract content and metadata from PDF
   */
  private async extractPDFContent(buffer: Buffer): Promise<any> {
    try {
      const options = {
        // Customize PDF parsing options
        max: 0 // Parse all pages
      }
      
      return await pdf(buffer, options)
    } catch (error) {
      this.logger.error('PDF extraction failed', { error })
      throw new Error(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create structured document record
   */
  private async createDocumentRecord(
    pdfData: any, 
    metadata: any, 
    buffer: Buffer
  ): Promise<FinancialDocument> {
    const documentId = this.generateDocumentId(metadata.title, metadata.source)
    const checksum = createHash('md5').update(buffer).digest('hex')
    
    // Determine category based on title and content analysis
    const category = this.determineCategory(metadata.title, pdfData.text)
    
    const document: FinancialDocument = {
      id: documentId,
      title: metadata.title,
      source: metadata.source,
      category,
      subcategory: this.determineSubcategory(metadata.title),
      level: metadata.level,
      version: this.extractVersion(metadata.title),
      url: metadata.url,
      metadata: {
        publisher: this.getPublisher(metadata.source),
        language: 'en',
        pageCount: pdfData.numpages,
        fileSize: buffer.length,
        checksumMD5: checksum
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return document
  }

  /**
   * Split document into semantic chunks
   */
  private async chunkDocument(
    document: FinancialDocument, 
    text: string
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    
    // Smart chunking strategy for financial documents
    const sections = this.splitIntoSections(text)
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      
      // Further split large sections into smaller chunks
      const subChunks = this.splitLongSection(section || '', 1000) // ~1000 tokens per chunk
      
      for (let j = 0; j < subChunks.length; j++) {
        const chunkContent = subChunks[j] || ''
        
        const chunk: DocumentChunk = {
          id: `${document.id}_chunk_${i}_${j}`,
          documentId: document.id,
          content: chunkContent,
          chunkIndex: chunks.length,
          tokenCount: this.estimateTokenCount(chunkContent),
          metadata: {
            sectionTitle: this.extractSectionTitle(section || ''),
            topics: this.extractTopics(chunkContent),
            formulas: this.extractFormulas(chunkContent),
            tables: this.containsTables(chunkContent),
            figures: this.containsFigures(chunkContent)
          },
          concepts: [] // Will be populated later
        }
        
        chunks.push(chunk)
      }
    }
    
    return chunks
  }

  /**
   * Enrich chunks with financial concepts
   */
  private async enrichChunksWithConcepts(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const enrichedChunks: DocumentChunk[] = []
    
    for (const chunk of chunks) {
      try {
        const concepts = await this.conceptExtractor.extractConcepts(
          chunk.content, 
          chunk.metadata.topics || []
        )
        
        enrichedChunks.push({
          ...chunk,
          concepts
        })
      } catch (error) {
        this.logger.warn(`Failed to extract concepts for chunk ${chunk.id}`, { error })
        enrichedChunks.push(chunk) // Keep chunk without concepts
      }
    }
    
    return enrichedChunks
  }

  /**
   * Generate embeddings for semantic search
   */
  private async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const chunksWithEmbeddings: DocumentChunk[] = []
    
    for (const chunk of chunks) {
      try {
        const embedding = await this.embeddingService.createEmbedding(chunk.content)
        
        chunksWithEmbeddings.push({
          ...chunk,
          embedding
        })
      } catch (error) {
        this.logger.warn(`Failed to generate embedding for chunk ${chunk.id}`, { error })
        chunksWithEmbeddings.push(chunk) // Keep chunk without embedding
      }
    }
    
    return chunksWithEmbeddings
  }

  // Helper methods
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateDocumentId(title: string, source: DocumentSource): string {
    const hash = createHash('sha256').update(`${title}_${source}`).digest('hex').substr(0, 16)
    return `doc_${hash}`
  }

  private determineCategory(title: string, content: string): FinancialCategory {
    const titleLower = title.toLowerCase()
    const contentSample = content.substring(0, 5000).toLowerCase()
    
    // Pattern matching for categories
    if (titleLower.includes('quantitative') || titleLower.includes('statistics')) {
      return FinancialCategory.QUANTITATIVE_METHODS
    }
    if (titleLower.includes('economics') || contentSample.includes('macroeconomic')) {
      return FinancialCategory.ECONOMICS
    }
    if (titleLower.includes('financial statement') || titleLower.includes('accounting')) {
      return FinancialCategory.FINANCIAL_STATEMENT_ANALYSIS
    }
    if (titleLower.includes('corporate finance') || titleLower.includes('capital structure')) {
      return FinancialCategory.CORPORATE_FINANCE
    }
    if (titleLower.includes('equity') || titleLower.includes('stock')) {
      return FinancialCategory.EQUITY_INVESTMENTS
    }
    if (titleLower.includes('fixed income') || titleLower.includes('bond')) {
      return FinancialCategory.FIXED_INCOME
    }
    if (titleLower.includes('derivatives') || titleLower.includes('options')) {
      return FinancialCategory.DERIVATIVES
    }
    if (titleLower.includes('alternative') || titleLower.includes('hedge fund')) {
      return FinancialCategory.ALTERNATIVE_INVESTMENTS
    }
    if (titleLower.includes('portfolio') || titleLower.includes('asset allocation')) {
      return FinancialCategory.PORTFOLIO_MANAGEMENT
    }
    if (titleLower.includes('ethics') || titleLower.includes('standards')) {
      return FinancialCategory.ETHICS
    }
    
    // Default fallback
    return FinancialCategory.PORTFOLIO_MANAGEMENT
  }

  private determineSubcategory(title: string): string {
    // Extract more specific subcategory from title
    const titleLower = title.toLowerCase()
    
    if (titleLower.includes('valuation')) return 'Valuation Methods'
    if (titleLower.includes('analysis')) return 'Financial Analysis'
    if (titleLower.includes('risk')) return 'Risk Management'
    if (titleLower.includes('theory')) return 'Financial Theory'
    
    return 'General'
  }

  private extractVersion(title: string): string {
    // Extract year or version from title
    const yearMatch = title.match(/20\d{2}/)
    if (yearMatch) return yearMatch[0]
    
    const versionMatch = title.match(/v?\d+\.\d+/)
    if (versionMatch) return versionMatch[0]
    
    return '1.0'
  }

  private getPublisher(source: DocumentSource): string {
    switch (source) {
      case DocumentSource.CFA_INSTITUTE: return 'CFA Institute'
      case DocumentSource.CFP_BOARD: return 'CFP Board'
      case DocumentSource.GARP_FRM: return 'Global Association of Risk Professionals'
      case DocumentSource.SCHWESER: return 'Kaplan Schweser'
      case DocumentSource.WILEY: return 'Wiley'
      case DocumentSource.KAPLAN: return 'Kaplan'
      default: return 'Unknown'
    }
  }

  private splitIntoSections(text: string): string[] {
    // Split by common section headers in financial texts
    const sectionRegex = /(?=^\s*(?:CHAPTER|SECTION|PART|READING|STUDY SESSION)\s+\d+)/gmi
    return text.split(sectionRegex).filter(section => section.trim().length > 100)
  }

  private splitLongSection(section: string, maxTokens: number): string[] {
    const chunks: string[] = []
    const sentences = section.split(/[.!?]+/)
    
    let currentChunk = ''
    let currentTokens = 0
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokenCount(sentence)
      
      if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence
        currentTokens = sentenceTokens
      } else {
        currentChunk += sentence + '. '
        currentTokens += sentenceTokens
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  private extractSectionTitle(section: string): string {
    const lines = section.split('\n')
    for (const line of lines.slice(0, 5)) {
      if (line.trim().length > 10 && line.trim().length < 100) {
        return line.trim()
      }
    }
    return 'Untitled Section'
  }

  private extractTopics(content: string): string[] {
    // Extract key financial topics using patterns
    const topics: Set<string> = new Set()
    
    const patterns = [
      /\b(DCF|discounted cash flow)\b/gi,
      /\b(WACC|weighted average cost of capital)\b/gi,
      /\b(P\/E|price.to.earnings)\b/gi,
      /\b(beta|correlation|covariance)\b/gi,
      /\b(duration|convexity)\b/gi,
      /\b(VaR|value at risk)\b/gi,
      /\b(CAPM|capital asset pricing model)\b/gi,
      /\b(IRR|internal rate of return)\b/gi,
      /\b(NPV|net present value)\b/gi
    ]
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        matches.forEach(match => topics.add(match.toLowerCase()))
      }
    })
    
    return Array.from(topics)
  }

  private extractFormulas(content: string): string[] {
    // Extract mathematical formulas
    const formulas: string[] = []
    
    // Look for common formula patterns
    const formulaPatterns = [
      /[A-Z]\s*=\s*[^.]{10,50}/g, // Simple formula pattern
      /\$[^$]+\$/g, // LaTeX style formulas
      /\([^)]*[+\-*/][^)]*\)/g // Parenthetical expressions
    ]
    
    formulaPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        formulas.push(...matches)
      }
    })
    
    return formulas
  }

  private containsTables(content: string): boolean {
    // Detect table structures
    const tableIndicators = [
      /\|[^|]+\|[^|]+\|/g, // Markdown-style tables
      /^\s*\w+\s+\w+\s+\w+\s*$/gm, // Column-like data
      /(table|exhibit|figure)\s+\d+/gi
    ]
    
    return tableIndicators.some(pattern => pattern.test(content))
  }

  private containsFigures(content: string): boolean {
    // Detect figure references
    return /(figure|chart|graph|diagram)\s+\d+/gi.test(content)
  }
} 