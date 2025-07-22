// Core Knowledge Base Types
export interface FinancialDocument {
  id: string
  title: string
  source: DocumentSource
  category: FinancialCategory
  subcategory: string
  level: CertificationLevel
  version: string
  url?: string
  metadata: DocumentMetadata
  createdAt: Date
  updatedAt: Date
}

export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  tokenCount: number
  embedding?: number[]
  metadata: ChunkMetadata
  concepts: FinancialConcept[]
}

export interface ChunkMetadata {
  pageNumber?: number
  sectionTitle?: string
  subsectionTitle?: string
  topics: string[]
  formulas?: string[]
  tables?: boolean
  figures?: boolean
}

export interface FinancialConcept {
  name: string
  definition: string
  category: ConceptCategory
  relatedConcepts: string[]
  formulas?: string[]
  applications: string[]
}

// Enums and Constants
export enum DocumentSource {
  CFA_INSTITUTE = 'CFA_INSTITUTE',
  CFP_BOARD = 'CFP_BOARD', 
  GARP_FRM = 'GARP_FRM',
  SCHWESER = 'SCHWESER',
  WILEY = 'WILEY',
  KAPLAN = 'KAPLAN'
}

export enum FinancialCategory {
  QUANTITATIVE_METHODS = 'QUANTITATIVE_METHODS',
  ECONOMICS = 'ECONOMICS',
  FINANCIAL_STATEMENT_ANALYSIS = 'FINANCIAL_STATEMENT_ANALYSIS',
  CORPORATE_FINANCE = 'CORPORATE_FINANCE',
  EQUITY_INVESTMENTS = 'EQUITY_INVESTMENTS',
  FIXED_INCOME = 'FIXED_INCOME',
  DERIVATIVES = 'DERIVATIVES',
  ALTERNATIVE_INVESTMENTS = 'ALTERNATIVE_INVESTMENTS',
  PORTFOLIO_MANAGEMENT = 'PORTFOLIO_MANAGEMENT',
  ETHICS = 'ETHICS',
  BEHAVIORAL_FINANCE = 'BEHAVIORAL_FINANCE',
  RISK_MANAGEMENT = 'RISK_MANAGEMENT'
}

export enum CertificationLevel {
  CFA_LEVEL_1 = 'CFA_LEVEL_1',
  CFA_LEVEL_2 = 'CFA_LEVEL_2', 
  CFA_LEVEL_3 = 'CFA_LEVEL_3',
  CFP = 'CFP',
  FRM_PART_1 = 'FRM_PART_1',
  FRM_PART_2 = 'FRM_PART_2'
}

export enum ConceptCategory {
  VALUATION = 'VALUATION',
  RATIO_ANALYSIS = 'RATIO_ANALYSIS',
  RISK_METRICS = 'RISK_METRICS',
  PORTFOLIO_THEORY = 'PORTFOLIO_THEORY',
  DERIVATIVES_PRICING = 'DERIVATIVES_PRICING',
  FIXED_INCOME_ANALYSIS = 'FIXED_INCOME_ANALYSIS',
  EQUITY_ANALYSIS = 'EQUITY_ANALYSIS',
  ECONOMICS = 'ECONOMICS',
  STATISTICS = 'STATISTICS'
}

export interface DocumentMetadata {
  author?: string
  publisher: string
  isbn?: string
  edition?: string
  publicationDate?: Date
  language: string
  pageCount?: number
  fileSize?: number
  checksumMD5?: string
}

// Knowledge Retrieval Types
export interface KnowledgeQuery {
  instrumentSymbol?: string
  instrumentType?: string
  analysisType: AnalysisType
  concepts?: string[]
  maxResults?: number
  minScore?: number
}

export enum AnalysisType {
  FUNDAMENTAL_ANALYSIS = 'FUNDAMENTAL_ANALYSIS',
  TECHNICAL_ANALYSIS = 'TECHNICAL_ANALYSIS', 
  QUANTITATIVE_ANALYSIS = 'QUANTITATIVE_ANALYSIS',
  RISK_ANALYSIS = 'RISK_ANALYSIS',
  PORTFOLIO_ANALYSIS = 'PORTFOLIO_ANALYSIS',
  VALUATION = 'VALUATION',
  ESG_ANALYSIS = 'ESG_ANALYSIS'
}

export interface KnowledgeResult {
  chunk: DocumentChunk
  score: number
  relevanceExplanation: string
  applicableFormulas?: string[]
  relatedConcepts: FinancialConcept[]
}

export interface EnhancedAnalysisContext {
  instrumentData: any
  marketData: any
  fundamentalData: any
  knowledgeResults: KnowledgeResult[]
  applicableFrameworks: ValuationFramework[]
}

export interface ValuationFramework {
  name: string
  description: string
  applicability: string[]
  keyMetrics: string[]
  formulas: Formula[]
  limitations: string[]
  source: DocumentSource
}

export interface Formula {
  name: string
  expression: string
  variables: Variable[]
  category: ConceptCategory
  usage: string
}

export interface Variable {
  symbol: string
  name: string
  description: string
  unit?: string
  typicalRange?: string
}

// RAG Service Types
export interface VectorSearchRequest {
  query: string
  filter?: Record<string, any>
  topK?: number
  includeMetadata?: boolean
}

export interface VectorSearchResponse {
  matches: VectorMatch[]
  queryId: string
  processingTimeMs: number
}

export interface VectorMatch {
  id: string
  score: number
  metadata: Record<string, any>
  content?: string
}

// Processing Pipeline Types
export interface DocumentProcessingJob {
  id: string
  documentId: string
  status: ProcessingStatus
  progress: number
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
  statistics: ProcessingStatistics
}

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface ProcessingStatistics {
  totalPages: number
  chunksCreated: number
  conceptsExtracted: number
  embeddingsGenerated: number
  processingTimeMs: number
}

// API Response Types
export interface KnowledgeBaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  vectorDatabase: {
    connected: boolean
    indexCount: number
    documentCount: number
  }
  embedding: {
    provider: string
    model: string
    available: boolean
  }
  lastSync: Date
}

export interface KnowledgeStats {
  totalDocuments: number
  totalChunks: number
  totalConcepts: number
  categoriesCount: Record<FinancialCategory, number>
  sourcesCount: Record<DocumentSource, number>
  levelsCount: Record<CertificationLevel, number>
} 