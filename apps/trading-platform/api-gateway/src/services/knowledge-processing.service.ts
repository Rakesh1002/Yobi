// Import these directly since the knowledge-base package doesn't export them properly
// We'll create simplified versions for now

import { OpenAI } from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'
import winston from 'winston'
import crypto from 'crypto'

export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  tokenCount: number
  embedding?: number[]
  concepts: Array<{
    name: string
    category: string
  }>
  metadata: {
    sectionTitle?: string
    topics?: string[]
    formulas?: string[]
  }
}

export interface ProcessingResult {
  chunks: DocumentChunk[]
  totalChunks: number
  embeddingsGenerated: number
  vectorsStored: number
  concepts: string[]
}

export class KnowledgeProcessingService {
  private openai: OpenAI
  private pinecone: Pinecone
  private logger: winston.Logger
  private indexName: string = 'yobi-knowledge'

  constructor(logger: winston.Logger) {
    this.logger = logger
    
    // Initialize OpenAI for embeddings
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    })
    
    // Initialize Pinecone client
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    })
  }

  /**
   * Check if knowledge processing is available
   */
  isAvailable(): boolean {
    return !!(process.env.PINECONE_API_KEY && process.env.OPENAI_API_KEY)
  }

  /**
   * Create embedding for a single text chunk
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Truncate to model limits
        encoding_format: 'float'
      })

      const embedding = response.data[0]?.embedding
      if (!embedding) {
        throw new Error('Failed to generate embedding: No embedding data returned')
      }

      this.logger.debug('Generated embedding', { 
        textLength: text.length,
        embeddingDimensions: embedding.length 
      })

      return embedding
    } catch (error) {
      this.logger.error('Failed to generate embedding', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        textPreview: text.substring(0, 100)
      })
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create embeddings for multiple text chunks
   */
  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    const batchSize = 100

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      try {
        const truncatedBatch = batch.map(text => text.substring(0, 8000))
        
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: truncatedBatch,
          encoding_format: 'float'
        })

        const batchEmbeddings = response.data.map(item => item.embedding)
        embeddings.push(...batchEmbeddings)

        this.logger.info(`Generated embeddings for batch ${Math.floor(i / batchSize) + 1}`, {
          batchSize: batch.length,
          totalProcessed: embeddings.length,
          remaining: texts.length - embeddings.length
        })

        // Rate limiting delay
        if (i + batchSize < texts.length) {
          await this.delay(1000)
        }

      } catch (error) {
        this.logger.error(`Failed to generate embeddings for batch ${Math.floor(i / batchSize) + 1}`, { error })
        
        // For failed batches, try individual processing
        for (const text of batch) {
          try {
            const embedding = await this.createEmbedding(text)
            embeddings.push(embedding)
            await this.delay(200)
          } catch (individualError) {
            this.logger.warn('Failed to generate individual embedding, using zero vector', { individualError })
            embeddings.push(new Array(1536).fill(0)) // text-embedding-3-small has 1536 dimensions
          }
        }
      }
    }

    return embeddings
  }

  /**
   * Process uploaded document for knowledge base
   */
  async processDocument(
    documentId: string,
    text: string,
    title: string,
    source: string = 'USER_UPLOAD'
  ): Promise<ProcessingResult> {
    try {
      this.logger.info(`Processing document for knowledge base: ${documentId}`)

      // 1. Chunk the document
      const chunks = this.chunkDocument(documentId, text, title)
      
      // 2. Extract concepts from chunks
      const chunksWithConcepts = this.enrichChunksWithConcepts(chunks)
      
      // 3. Generate embeddings
      const chunksWithEmbeddings = await this.generateEmbeddings(chunksWithConcepts)
      
      // 4. Store in vector database
      const vectorsStored = await this.storeInVectorDatabase(chunksWithEmbeddings)
      
      // 5. Extract unique concepts
      const concepts = this.extractUniqueConcepts(chunksWithConcepts)

      this.logger.info(`Document processing completed for ${documentId}`, {
        totalChunks: chunks.length,
        embeddingsGenerated: chunksWithEmbeddings.filter(c => c.embedding).length,
        vectorsStored,
        conceptsExtracted: concepts.length
      })

      return {
        chunks: chunksWithEmbeddings,
        totalChunks: chunks.length,
        embeddingsGenerated: chunksWithEmbeddings.filter(c => c.embedding).length,
        vectorsStored,
        concepts
      }

    } catch (error) {
      this.logger.error(`Document processing failed for ${documentId}:`, error)
      throw new Error(`Knowledge processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Search knowledge base using vector similarity
   */
  async searchKnowledge(
    query: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{
    id: string
    content: string
    score: number
    metadata: any
  }>> {
    try {
      if (!this.isAvailable()) {
        return []
      }

      // Generate query embedding
      const queryEmbedding = await this.createEmbedding(query)
      
      // Search vector database
      const index = this.pinecone.index(this.indexName)
      const searchResults = await index.query({
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: true,
        filter: {} // Add filters as needed
      })

      // Filter by threshold and format results
      const results = (searchResults.matches || [])
        .filter(match => (match.score || 0) >= threshold)
        .map(match => ({
          id: match.id || '',
          content: match.metadata?.content as string || '',
          score: match.score || 0,
          metadata: match.metadata || {}
        }))

      this.logger.info(`Knowledge search completed`, {
        query: query.substring(0, 100),
        resultsFound: results.length,
        threshold
      })

      return results

    } catch (error) {
      this.logger.error('Knowledge search failed:', error)
      return []
    }
  }

  /**
   * Chunk document into manageable pieces
   */
  private chunkDocument(documentId: string, text: string, title: string): DocumentChunk[] {
    const chunkSize = 1000
    const chunkOverlap = 200
    const chunks: DocumentChunk[] = []

    // Split text into sentences for better chunking
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    let currentChunk = ''
    let chunkIndex = 0

    for (const sentence of sentences) {
      const proposedChunk = currentChunk + (currentChunk ? '. ' : '') + sentence.trim()
      
      if (proposedChunk.length > chunkSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          content: currentChunk.trim(),
          chunkIndex,
          tokenCount: this.estimateTokenCount(currentChunk),
          concepts: [],
          metadata: {
            sectionTitle: title,
            topics: []
          }
        })
        
        // Start new chunk with overlap
        const words = currentChunk.split(' ')
        const overlapWords = words.slice(-Math.floor(chunkOverlap / 5)) // Rough overlap
        currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? '. ' : '') + sentence.trim()
        chunkIndex++
      } else {
        currentChunk = proposedChunk
      }
    }

    // Add final chunk if any content remains
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        content: currentChunk.trim(),
        chunkIndex,
        tokenCount: this.estimateTokenCount(currentChunk),
        concepts: [],
        metadata: {
          sectionTitle: title,
          topics: []
        }
      })
    }

    return chunks
  }

  /**
   * Extract financial concepts from chunks
   */
  private enrichChunksWithConcepts(chunks: DocumentChunk[]): DocumentChunk[] {
    return chunks.map(chunk => {
      const concepts = this.extractFinancialConcepts(chunk.content)
      return {
        ...chunk,
        concepts
      }
    })
  }

  /**
   * Generate embeddings for all chunks
   */
  private async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const chunksWithEmbeddings: DocumentChunk[] = []
    
    // Process in batches to respect rate limits
    const batchSize = 20
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      try {
        const texts = batch.map(chunk => chunk.content)
        const embeddings = await this.createEmbeddings(texts)
        
        batch.forEach((chunk, index) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: embeddings[index]
          })
        })

        this.logger.info(`Generated embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`)
        
        // Rate limiting delay
        if (i + batchSize < chunks.length) {
          await this.delay(1000)
        }

      } catch (error) {
        this.logger.warn(`Failed to generate embeddings for batch ${Math.floor(i / batchSize) + 1}:`, error)
        
        // Add chunks without embeddings
        batch.forEach(chunk => {
          chunksWithEmbeddings.push(chunk)
        })
      }
    }
    
    return chunksWithEmbeddings
  }

  /**
   * Store chunks in Pinecone vector database
   */
  private async storeInVectorDatabase(chunks: DocumentChunk[]): Promise<number> {
    try {
      const index = this.pinecone.index(this.indexName)
      
      // Prepare vectors for storage
      const vectors = chunks
        .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
        .map(chunk => ({
          id: chunk.id,
          values: chunk.embedding!,
          metadata: {
            documentId: chunk.documentId,
            content: chunk.content.substring(0, 1000), // Truncate for metadata size limits
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
            sectionTitle: chunk.metadata.sectionTitle || '',
            concepts: chunk.concepts.map(c => c.name),
            categories: chunk.concepts.map(c => c.category),
            topics: chunk.metadata.topics || []
          }
        }))

      if (vectors.length === 0) {
        this.logger.warn('No vectors to store - no embeddings generated')
        return 0
      }

      // Batch upsert vectors
      const batchSize = 100
      let totalStored = 0
      
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)
        await index.upsert(batch)
        totalStored += batch.length
        
        this.logger.info(`Stored vector batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`, {
          batchSize: batch.length,
          totalStored
        })
      }

      return totalStored

    } catch (error) {
      this.logger.error('Failed to store vectors in Pinecone:', error)
      return 0
    }
  }

  /**
   * Extract financial concepts using regex patterns
   */
  private extractFinancialConcepts(text: string): Array<{ name: string; category: string }> {
    const concepts: Array<{ name: string; category: string }> = []
    const lowercaseText = text.toLowerCase()
    
    // Financial concept patterns
    const conceptPatterns = [
      // Valuation
      { pattern: /\b(dcf|discounted cash flow)\b/g, concept: 'DCF Analysis', category: 'Valuation' },
      { pattern: /\b(valuation|value|valued)\b/g, concept: 'Valuation', category: 'Valuation' },
      { pattern: /\b(p\/e|price.?to.?earnings)\b/g, concept: 'P/E Ratio', category: 'Ratios' },
      { pattern: /\b(dividend|dividends)\b/g, concept: 'Dividend Analysis', category: 'Income' },
      
      // Financial statements
      { pattern: /\b(revenue|sales|income)\b/g, concept: 'Revenue Analysis', category: 'Financial Statements' },
      { pattern: /\b(balance.?sheet)\b/g, concept: 'Balance Sheet', category: 'Financial Statements' },
      { pattern: /\b(cash.?flow)\b/g, concept: 'Cash Flow', category: 'Financial Statements' },
      { pattern: /\b(profit|profitability)\b/g, concept: 'Profitability', category: 'Performance' },
      
      // Risk
      { pattern: /\b(risk|risks|risky)\b/g, concept: 'Risk Analysis', category: 'Risk Management' },
      { pattern: /\b(beta|volatility)\b/g, concept: 'Market Risk', category: 'Risk Management' },
      { pattern: /\b(debt|leverage)\b/g, concept: 'Credit Risk', category: 'Risk Management' },
      
      // Investment
      { pattern: /\b(investment|investing|investor)\b/g, concept: 'Investment Strategy', category: 'Investment' },
      { pattern: /\b(portfolio|diversification)\b/g, concept: 'Portfolio Management', category: 'Investment' },
      { pattern: /\b(return|returns|ror)\b/g, concept: 'Return Analysis', category: 'Performance' }
    ]
    
    conceptPatterns.forEach(({ pattern, concept, category }) => {
      if (pattern.test(lowercaseText)) {
        concepts.push({ name: concept, category })
      }
    })
    
    // Remove duplicates
    const uniqueConcepts = concepts.filter((concept, index, self) => 
      index === self.findIndex(c => c.name === concept.name)
    )
    
    return uniqueConcepts.slice(0, 10) // Limit to top 10
  }

  /**
   * Extract unique concept names from chunks
   */
  private extractUniqueConcepts(chunks: DocumentChunk[]): string[] {
    const allConcepts = chunks.flatMap(chunk => chunk.concepts.map(c => c.name))
    return [...new Set(allConcepts)]
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4)
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Health check for knowledge processing services
   */
  async healthCheck(): Promise<{
    available: boolean
    pinecone: boolean
    openai: boolean
    indexExists: boolean
  }> {
    const health = {
      available: this.isAvailable(),
      pinecone: false,
      openai: false,
      indexExists: false
    }

    if (health.available) {
      try {
        // Test OpenAI
        await this.createEmbedding('test')
        health.openai = true
      } catch (error) {
        this.logger.debug('OpenAI health check failed')
      }

      try {
        // Test Pinecone
        const index = this.pinecone.index(this.indexName)
        await index.describeIndexStats()
        health.pinecone = true
        health.indexExists = true
      } catch (error) {
        this.logger.debug('Pinecone health check failed')
      }
    }

    return health
  }
} 