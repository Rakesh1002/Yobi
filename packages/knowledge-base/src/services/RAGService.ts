import { Pinecone } from '@pinecone-database/pinecone'
import { Anthropic } from '@anthropic-ai/sdk'
import { Logger } from 'winston'
import { 
  KnowledgeQuery, 
  KnowledgeResult, 
  EnhancedAnalysisContext,
  VectorSearchRequest,
  VectorSearchResponse,
  AnalysisType,
  ValuationFramework,
  DocumentChunk,
  ConceptCategory,
  DocumentSource
} from '../types'
import { EmbeddingService } from './EmbeddingService'

export class RAGService {
  private pinecone: Pinecone
  private anthropic: Anthropic
  private embeddingService: EmbeddingService
  private logger: Logger
  private indexName: string = 'financial-knowledge'

  constructor(
    logger: Logger,
    embeddingService: EmbeddingService,
    pineconeApiKey?: string,
    anthropicApiKey?: string
  ) {
    this.logger = logger
    this.embeddingService = embeddingService

    // Initialize Pinecone for vector storage
    this.pinecone = new Pinecone({
      apiKey: pineconeApiKey || process.env.PINECONE_API_KEY || ''
    })

    // Initialize Anthropic for enhanced analysis
    this.anthropic = new Anthropic({
      apiKey: anthropicApiKey || process.env.ANTHROPIC_API_KEY || ''
    })
  }

  /**
   * Store document chunks in vector database
   */
  async storeDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
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
            content: chunk.content.substring(0, 1000), // Truncate for metadata
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
            sectionTitle: chunk.metadata.sectionTitle || '',
            topics: chunk.metadata.topics,
            formulas: chunk.metadata.formulas || [],
            concepts: chunk.concepts.map(c => c.name),
            categories: chunk.concepts.map(c => c.category)
          }
        }))

      // Batch upsert vectors
      const batchSize = 100
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)
        await index.upsert(batch)
        
        this.logger.info(`Stored batch ${Math.floor(i / batchSize) + 1}`, {
          batchSize: batch.length,
          totalProcessed: Math.min(i + batchSize, vectors.length),
          remaining: Math.max(0, vectors.length - (i + batchSize))
        })
      }

      this.logger.info('Successfully stored document chunks', {
        totalChunks: chunks.length,
        storedVectors: vectors.length
      })

    } catch (error) {
      this.logger.error('Failed to store document chunks', { error })
      throw new Error(`Vector storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Search for relevant knowledge based on query
   */
  async searchKnowledge(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    try {
      // Create search query embedding
      const searchText = this.buildSearchQuery(query)
      const queryEmbedding = await this.embeddingService.createEmbedding(searchText)

      // Build search filters
      const filter = this.buildSearchFilter(query)

      // Perform vector search
      const searchRequest: VectorSearchRequest = {
        query: searchText,
        filter,
        topK: query.maxResults || 10,
        includeMetadata: true
      }

      const searchResults = await this.performVectorSearch(queryEmbedding, searchRequest)

      // Convert to knowledge results
      const knowledgeResults = await this.convertToKnowledgeResults(searchResults, query)

      this.logger.info('Knowledge search completed', {
        query: query.analysisType,
        resultsFound: knowledgeResults.length,
        searchText: searchText.substring(0, 100)
      })

      return knowledgeResults

    } catch (error) {
      this.logger.error('Knowledge search failed', { error, query })
      return []
    }
  }

  /**
   * Generate enhanced analysis using retrieved knowledge + Claude
   */
  async generateEnhancedAnalysis(context: EnhancedAnalysisContext): Promise<any> {
    try {
      const prompt = this.buildEnhancedAnalysisPrompt(context)
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const analysisText = (response.content[0] as any)?.text || ''
      const analysisResult = this.parseEnhancedAnalysis(analysisText)

      this.logger.info('Enhanced analysis generated', {
        instrumentSymbol: context.instrumentData?.symbol,
        knowledgeChunks: context.knowledgeResults.length,
        analysisLength: analysisText.length
      })

      return analysisResult

    } catch (error) {
      this.logger.error('Enhanced analysis generation failed', { error })
      throw new Error(`Analysis generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get relevant valuation frameworks for an instrument
   */
  async getValuationFrameworks(
    instrumentType: string,
    sector?: string,
    exchangeRegion?: string
  ): Promise<ValuationFramework[]> {
    try {
      const query: KnowledgeQuery = {
        instrumentType,
        analysisType: AnalysisType.VALUATION,
        concepts: ['valuation', 'dcf', 'multiples', 'comparables'],
        maxResults: 5
      }

      const knowledgeResults = await this.searchKnowledge(query)
      
      // Extract frameworks from knowledge
      const frameworks = this.extractValuationFrameworks(knowledgeResults, instrumentType, sector)

      return frameworks

    } catch (error) {
      this.logger.error('Failed to get valuation frameworks', { error, instrumentType })
      return []
    }
  }

  /**
   * Perform vector similarity search
   */
  private async performVectorSearch(
    queryEmbedding: number[],
    request: VectorSearchRequest
  ): Promise<VectorSearchResponse> {
    try {
      const index = this.pinecone.index(this.indexName)
      
      const response = await index.query({
        vector: queryEmbedding,
        topK: request.topK || 10,
        includeMetadata: request.includeMetadata || true,
        filter: request.filter
      })

      return {
        matches: response.matches?.map(match => ({
          id: match.id || '',
          score: match.score || 0,
          metadata: match.metadata || {},
          content: match.metadata?.content as string
        })) || [],
        queryId: `query_${Date.now()}`,
        processingTimeMs: 0 // Pinecone doesn't provide this
      }

    } catch (error) {
      this.logger.error('Vector search failed', { error })
      throw error
    }
  }

  /**
   * Build search query text from structured query
   */
  private buildSearchQuery(query: KnowledgeQuery): string {
    const parts: string[] = []

    if (query.instrumentSymbol) {
      parts.push(`analysis of ${query.instrumentSymbol}`)
    }

    if (query.instrumentType) {
      parts.push(`${query.instrumentType} analysis`)
    }

    parts.push(query.analysisType.toLowerCase().replace(/_/g, ' '))

    if (query.concepts && query.concepts.length > 0) {
      parts.push(query.concepts.join(' '))
    }

    return parts.join(' ')
  }

  /**
   * Build search filters for vector database
   */
  private buildSearchFilter(query: KnowledgeQuery): Record<string, any> {
    const filter: Record<string, any> = {}

    if (query.analysisType) {
      // Map analysis types to categories
      const categoryMappings: Record<AnalysisType, string[]> = {
        [AnalysisType.FUNDAMENTAL_ANALYSIS]: ['VALUATION', 'RATIO_ANALYSIS', 'EQUITY_ANALYSIS'],
        [AnalysisType.TECHNICAL_ANALYSIS]: ['STATISTICS', 'RISK_METRICS'],
        [AnalysisType.QUANTITATIVE_ANALYSIS]: ['STATISTICS', 'PORTFOLIO_THEORY'],
        [AnalysisType.RISK_ANALYSIS]: ['RISK_METRICS', 'PORTFOLIO_THEORY'],
        [AnalysisType.PORTFOLIO_ANALYSIS]: ['PORTFOLIO_THEORY', 'RISK_METRICS'],
        [AnalysisType.VALUATION]: ['VALUATION', 'EQUITY_ANALYSIS'],
        [AnalysisType.ESG_ANALYSIS]: ['EQUITY_ANALYSIS']
      }

      const relevantCategories = categoryMappings[query.analysisType]
      if (relevantCategories) {
        filter.categories = { $in: relevantCategories }
      }
    }

    return filter
  }

  /**
   * Convert vector search results to knowledge results
   */
  private async convertToKnowledgeResults(
    searchResults: VectorSearchResponse,
    query: KnowledgeQuery
  ): Promise<KnowledgeResult[]> {
    const knowledgeResults: KnowledgeResult[] = []

    for (const match of searchResults.matches) {
      if (match.score < (query.minScore || 0.7)) {
        continue // Skip low-relevance results
      }

      const chunk: DocumentChunk = {
        id: match.id,
        documentId: match.metadata.documentId as string,
        content: match.content || '',
        chunkIndex: match.metadata.chunkIndex as number,
        tokenCount: match.metadata.tokenCount as number,
        metadata: {
          sectionTitle: match.metadata.sectionTitle as string,
          topics: match.metadata.topics as string[],
          formulas: match.metadata.formulas as string[]
        },
        concepts: (match.metadata.concepts as string[])?.map(name => ({
          name,
          definition: '',
          category: match.metadata.categories?.[0] || 'VALUATION',
          relatedConcepts: [],
          applications: []
        })) || []
      }

      knowledgeResults.push({
        chunk,
        score: match.score,
        relevanceExplanation: this.generateRelevanceExplanation(match, query),
        applicableFormulas: match.metadata.formulas as string[],
        relatedConcepts: chunk.concepts
      })
    }

    return knowledgeResults
  }

  /**
   * Build enhanced analysis prompt with knowledge context
   */
  private buildEnhancedAnalysisPrompt(context: EnhancedAnalysisContext): string {
    const { instrumentData, marketData, fundamentalData, knowledgeResults, applicableFrameworks } = context

    const knowledgeContext = knowledgeResults
      .map(result => `**${result.chunk.metadata.sectionTitle}** (Relevance: ${Math.round(result.score * 100)}%)\n${result.chunk.content.substring(0, 500)}...`)
      .join('\n\n')

    const frameworkContext = applicableFrameworks
      .map(fw => `**${fw.name}**: ${fw.description}\nKey Metrics: ${fw.keyMetrics.join(', ')}\nFormulas: ${fw.formulas.map(f => f.expression).join(', ')}`)
      .join('\n\n')

    return `
You are a CFA charter holder and expert financial analyst. Analyze the following instrument using professional financial analysis frameworks and the provided knowledge base context.

## Instrument Data
Symbol: ${instrumentData?.symbol}
Name: ${instrumentData?.name}
Exchange: ${instrumentData?.exchange}
Sector: ${instrumentData?.sector}
Current Price: ${marketData?.close}
Market Cap: ${fundamentalData?.marketCap}

## Market Data
Price: ${marketData?.close}
Change: ${marketData?.changePercent}%
Volume: ${marketData?.volume}
52W High: ${marketData?.high52w}
52W Low: ${marketData?.low52w}

## Fundamental Data
P/E Ratio: ${fundamentalData?.peRatio}
PEG Ratio: ${fundamentalData?.pegRatio}
P/B Ratio: ${fundamentalData?.pbRatio}
ROE: ${fundamentalData?.roe}%
ROA: ${fundamentalData?.roa}%
Debt/Equity: ${fundamentalData?.debtToEquity}

## Professional Knowledge Context
${knowledgeContext}

## Applicable Valuation Frameworks
${frameworkContext}

## Analysis Requirements
Please provide a comprehensive professional analysis including:

1. **Executive Summary** (2-3 sentences)
2. **Valuation Analysis** using appropriate CFA frameworks
3. **Financial Ratio Analysis** with industry context
4. **Risk Assessment** including systematic and unsystematic risks
5. **Investment Recommendation** with price targets
6. **Key Risks and Opportunities**
7. **Technical Analysis Insights**

Use the knowledge base context to ensure your analysis follows CFA Institute standards and best practices. Reference specific valuation methods, ratios, and frameworks from the knowledge base where applicable.

Provide specific numbers, calculations, and professional reasoning based on the CFA curriculum principles provided in the knowledge context.

Format your response as structured JSON:
{
  "executiveSummary": "...",
  "valuation": {
    "currentValue": number,
    "targetPrice": number,
    "upside": number,
    "method": "DCF/Multiples/DDM",
    "assumptions": ["..."]
  },
  "ratios": {
    "profitability": {...},
    "liquidity": {...},
    "leverage": {...},
    "efficiency": {...}
  },
  "risks": {
    "systematic": ["..."],
    "unsystematic": ["..."],
    "keyRiskFactors": ["..."]
  },
  "recommendation": {
    "action": "STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL",
    "targetPrice": number,
    "timeHorizon": "SHORT_TERM/MEDIUM_TERM/LONG_TERM",
    "confidence": number
  },
  "technicalAnalysis": {
    "trend": "BULLISH/BEARISH/NEUTRAL",
    "support": number,
    "resistance": number,
    "indicators": {...}
  },
  "cfaFrameworks": ["frameworks used"],
  "keyInsights": ["..."]
}
`
  }

  /**
   * Parse enhanced analysis response
   */
  private parseEnhancedAnalysis(analysisText: string): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed
      }

      // Fallback: create structured response from text
      return {
        executiveSummary: analysisText.substring(0, 200) + '...',
        recommendation: {
          action: 'HOLD',
          confidence: 75
        },
        rawAnalysis: analysisText
      }

    } catch (error) {
      this.logger.warn('Failed to parse enhanced analysis JSON', { error })
      return {
        executiveSummary: 'Professional analysis based on CFA frameworks',
        rawAnalysis: analysisText
      }
    }
  }

  /**
   * Generate relevance explanation for search results
   */
  private generateRelevanceExplanation(match: any, query: KnowledgeQuery): string {
    const score = Math.round(match.score * 100)
    const topics = match.metadata.topics as string[] || []
    const concepts = match.metadata.concepts as string[] || []

    let explanation = `${score}% relevance to ${query.analysisType.toLowerCase()}`

    if (topics.length > 0) {
      explanation += ` - Contains topics: ${topics.slice(0, 3).join(', ')}`
    }

    if (concepts.length > 0) {
      explanation += ` - Covers concepts: ${concepts.slice(0, 3).join(', ')}`
    }

    return explanation
  }

  /**
   * Extract valuation frameworks from knowledge results
   */
  private extractValuationFrameworks(
    knowledgeResults: KnowledgeResult[],
    instrumentType: string,
    sector?: string
  ): ValuationFramework[] {
    const frameworks: ValuationFramework[] = []

    // Standard frameworks based on instrument type
    if (instrumentType === 'STOCK') {
      frameworks.push({
        name: 'Discounted Cash Flow (DCF)',
        description: 'Values company based on projected future cash flows discounted to present value',
        applicability: ['All equities', 'Growth companies', 'Mature companies'],
        keyMetrics: ['Free Cash Flow', 'WACC', 'Terminal Value', 'Growth Rate'],
        formulas: [
                     {
             name: 'DCF Formula',
             expression: 'PV = Σ(FCF_t / (1 + WACC)^t) + Terminal Value',
             variables: [
               { symbol: 'FCF_t', name: 'Free Cash Flow in year t', description: 'Operating cash flow minus capital expenditures' },
               { symbol: 'WACC', name: 'Weighted Average Cost of Capital', description: 'Discount rate reflecting cost of equity and debt' },
               { symbol: 't', name: 'Time period', description: 'Year in projection period' }
             ],
             category: ConceptCategory.VALUATION,
             usage: 'Primary valuation method for cash-generating businesses'
           }
        ],
                 limitations: ['Sensitive to assumptions', 'Difficult for early-stage companies', 'Terminal value dependency'],
         source: DocumentSource.CFA_INSTITUTE
      })

      frameworks.push({
        name: 'Price-to-Earnings Multiple',
        description: 'Relative valuation using P/E ratios compared to peers',
        applicability: ['Profitable companies', 'Mature industries', 'Peer comparison'],
        keyMetrics: ['P/E Ratio', 'EPS Growth', 'Industry Average P/E'],
        formulas: [
                     {
             name: 'P/E Ratio',
             expression: 'P/E = Price per Share / Earnings per Share',
             variables: [
               { symbol: 'P', name: 'Price per Share', description: 'Current market price of stock' },
               { symbol: 'EPS', name: 'Earnings per Share', description: 'Net income divided by shares outstanding' }
             ],
             category: ConceptCategory.VALUATION,
             usage: 'Quick valuation comparison with peer companies'
           }
        ],
                 limitations: ['Requires positive earnings', 'Cyclical earnings distortion', 'Different accounting methods'],
         source: DocumentSource.CFA_INSTITUTE
      })
    }

    return frameworks
  }

  /**
   * Health check for RAG service
   */
  async healthCheck(): Promise<any> {
    try {
      const pineconeStatus = await this.checkPineconeConnection()
      const embeddingStatus = this.embeddingService.getModelInfo()

      return {
        status: 'healthy',
        vectorDatabase: pineconeStatus,
        embedding: {
          ...embeddingStatus,
          available: true
        },
        lastSync: new Date()
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      }
    }
  }

  /**
   * Check Pinecone connection
   */
  private async checkPineconeConnection(): Promise<any> {
    try {
      const index = this.pinecone.index(this.indexName)
      const stats = await index.describeIndexStats()

      return {
        connected: true,
        indexCount: 1,
        documentCount: stats.totalRecordCount || 0
      }

    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
} 