import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import winston from 'winston'
import dotenv from 'dotenv'
import multer from 'multer'

import { DocumentProcessor } from './services/DocumentProcessor'
import { EmbeddingService } from './services/EmbeddingService'
import { ConceptExtractor } from './services/ConceptExtractor'
import { RAGService } from './services/RAGService'
import { 
  DocumentSource, 
  CertificationLevel, 
  KnowledgeQuery,
  AnalysisType 
} from './types'

// Load environment variables
dotenv.config()

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'knowledge-base-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'knowledge-base.log' })
  ]
})

// Initialize services
const embeddingService = new EmbeddingService(logger)
const conceptExtractor = new ConceptExtractor(logger)
const documentProcessor = new DocumentProcessor(logger, embeddingService, conceptExtractor)
const ragService = new RAGService(logger, embeddingService)

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'))
    }
  }
})

// Initialize Express app
const app = express()
const PORT = process.env.KNOWLEDGE_BASE_PORT || 3005

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await ragService.healthCheck()
    res.json({
      status: 'OK',
      service: 'Financial Knowledge Base',
      timestamp: new Date().toISOString(),
      ...health
    })
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Document upload and processing endpoint
app.post('/documents/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { title, source, level, url } = req.body

    if (!title || !source || !level) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, source, level' 
      })
    }

    logger.info('Processing document upload', { 
      title, 
      source, 
      level, 
      fileSize: req.file.size 
    })

    const job = await documentProcessor.processDocument(req.file.buffer, {
      title,
      source: source as DocumentSource,
      level: level as CertificationLevel,
      url
    })

    res.json({
      success: true,
      job,
      message: 'Document processing completed successfully'
    })

  } catch (error) {
    logger.error('Document upload failed', { error })
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Document processing failed'
    })
  }
})

// Knowledge search endpoint
app.post('/knowledge/search', async (req, res) => {
  try {
    const query: KnowledgeQuery = req.body

    if (!query.analysisType) {
      return res.status(400).json({
        error: 'analysisType is required'
      })
    }

    logger.info('Knowledge search request', { query })

    const results = await ragService.searchKnowledge(query)

    res.json({
      success: true,
      query,
      results,
      resultCount: results.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Knowledge search failed', { error })
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Knowledge search failed'
    })
  }
})

// Enhanced analysis endpoint
app.post('/analysis/enhanced', async (req, res) => {
  try {
    const { instrumentData, marketData, fundamentalData } = req.body

    if (!instrumentData?.symbol) {
      return res.status(400).json({
        error: 'instrumentData with symbol is required'
      })
    }

    logger.info('Enhanced analysis request', { 
      symbol: instrumentData.symbol,
      exchange: instrumentData.exchange 
    })

    // Search for relevant knowledge
    const knowledgeQuery: KnowledgeQuery = {
      instrumentSymbol: instrumentData.symbol,
      instrumentType: instrumentData.assetClass || 'STOCK',
      analysisType: AnalysisType.FUNDAMENTAL_ANALYSIS,
      maxResults: 5
    }

    const knowledgeResults = await ragService.searchKnowledge(knowledgeQuery)

    // Get applicable valuation frameworks
    const frameworks = await ragService.getValuationFrameworks(
      instrumentData.assetClass || 'STOCK',
      instrumentData.sector,
      instrumentData.exchange
    )

    // Generate enhanced analysis
    const enhancedAnalysis = await ragService.generateEnhancedAnalysis({
      instrumentData,
      marketData,
      fundamentalData,
      knowledgeResults,
      applicableFrameworks: frameworks
    })

    res.json({
      success: true,
      symbol: instrumentData.symbol,
      analysis: enhancedAnalysis,
      knowledgeUsed: knowledgeResults.length,
      frameworksApplied: frameworks.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Enhanced analysis failed', { error })
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Enhanced analysis failed'
    })
  }
})

// Get valuation frameworks endpoint
app.get('/frameworks/:instrumentType', async (req, res) => {
  try {
    const { instrumentType } = req.params
    const { sector, exchange } = req.query

    const frameworks = await ragService.getValuationFrameworks(
      instrumentType,
      sector as string,
      exchange as string
    )

    res.json({
      success: true,
      instrumentType,
      frameworks,
      count: frameworks.length
    })

  } catch (error) {
    logger.error('Get frameworks failed', { error })
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get frameworks'
    })
  }
})

// List available analysis types
app.get('/analysis/types', (req, res) => {
  res.json({
    success: true,
    analysisTypes: Object.values(AnalysisType),
    description: 'Available analysis types for knowledge search'
  })
})

// List available document sources
app.get('/documents/sources', (req, res) => {
  res.json({
    success: true,
    sources: Object.values(DocumentSource),
    levels: Object.values(CertificationLevel),
    description: 'Available document sources and certification levels'
  })
})

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error, path: req.path })
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  })
})

// Start server
app.listen(PORT, () => {
  logger.info(`🧠 Financial Knowledge Base API running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      'POST /documents/upload',
      'POST /knowledge/search',
      'POST /analysis/enhanced',
      'GET /frameworks/:instrumentType',
      'GET /health'
    ]
  })
})

export { 
  documentProcessor, 
  embeddingService, 
  conceptExtractor, 
  ragService 
} 