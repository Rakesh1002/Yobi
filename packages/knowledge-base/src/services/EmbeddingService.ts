import { OpenAI } from 'openai'
import { Logger } from 'winston'

export class EmbeddingService {
  private openai: OpenAI
  private logger: Logger
  private model: string = 'text-embedding-3-small' // Latest OpenAI embedding model
  private maxTokens: number = 8191 // Model token limit

  constructor(logger: Logger, apiKey?: string) {
    this.logger = logger
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    })
  }

  /**
   * Create embedding for a single text chunk
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text if it exceeds token limit
      const truncatedText = this.truncateText(text, this.maxTokens)
      
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: truncatedText,
        encoding_format: 'float'
      })

      const embedding = response.data[0]?.embedding
      
      if (!embedding) {
        throw new Error('Failed to generate embedding: No embedding data returned')
      }
      
      this.logger.debug('Generated embedding', { 
        textLength: text.length,
        truncatedLength: truncatedText.length,
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
   * Create embeddings for multiple text chunks (batch processing)
   */
  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    
    // Process in batches to respect rate limits
    const batchSize = 100
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      try {
        const truncatedBatch = batch.map(text => this.truncateText(text, this.maxTokens))
        
        const response = await this.openai.embeddings.create({
          model: this.model,
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

        // Add delay to respect rate limits
        if (i + batchSize < texts.length) {
          await this.delay(1000) // 1 second delay between batches
        }

      } catch (error) {
        this.logger.error(`Failed to generate embeddings for batch ${Math.floor(i / batchSize) + 1}`, { error })
        
        // For failed batches, try individual processing
        for (const text of batch) {
          try {
            const embedding = await this.createEmbedding(text)
            embeddings.push(embedding)
            await this.delay(200) // Smaller delay for individual requests
          } catch (individualError) {
            this.logger.warn('Failed to generate individual embedding, using zero vector', { individualError })
            // Use zero vector as fallback
            embeddings.push(new Array(1536).fill(0)) // text-embedding-3-small has 1536 dimensions
          }
        }
      }
    }

    return embeddings
  }

  /**
   * Calculate similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i]! * embedding2[i]!
      norm1 += embedding1[i]! * embedding1[i]!
      norm2 += embedding2[i]! * embedding2[i]!
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  /**
   * Find most similar embeddings from a collection
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: Array<{ id: string; embedding: number[]; metadata?: any }>,
    topK: number = 10
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    
    const similarities = candidateEmbeddings.map(candidate => ({
      id: candidate.id,
      similarity: this.calculateCosineSimilarity(queryEmbedding, candidate.embedding),
      metadata: candidate.metadata
    }))

    // Sort by similarity descending and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  /**
   * Get embedding model information
   */
  getModelInfo(): { model: string; dimensions: number; maxTokens: number } {
    const dimensions = this.model === 'text-embedding-3-small' ? 1536 : 
                     this.model === 'text-embedding-3-large' ? 3072 : 1536

    return {
      model: this.model,
      dimensions,
      maxTokens: this.maxTokens
    }
  }

  /**
   * Switch to a different embedding model
   */
  setModel(model: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'): void {
    this.model = model
    
    // Update token limits based on model
    switch (model) {
      case 'text-embedding-3-small':
      case 'text-embedding-3-large':
        this.maxTokens = 8191
        break
      case 'text-embedding-ada-002':
        this.maxTokens = 8191
        break
    }

    this.logger.info('Switched embedding model', { model, maxTokens: this.maxTokens })
  }

  /**
   * Truncate text to fit within token limits
   */
  private truncateText(text: string, maxTokens: number): string {
    // Rough estimation: 4 characters per token
    const maxChars = maxTokens * 4
    
    if (text.length <= maxChars) {
      return text
    }

    // Truncate at sentence boundary if possible
    const truncated = text.substring(0, maxChars)
    const lastSentence = truncated.lastIndexOf('.')
    
    if (lastSentence > maxChars * 0.8) {
      return truncated.substring(0, lastSentence + 1)
    }

    return truncated
  }

  /**
   * Add delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 