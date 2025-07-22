import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createLogger } from './utils/logger'
import { BackgroundAgent } from './services/BackgroundAgent'
import { WebSearchService } from './services/WebSearchService'
import { DocumentFetcher } from './services/DocumentFetcher'
import { InsightsEngine } from './services/InsightsEngine'
import { AgentScheduler } from './services/AgentScheduler'

// Load environment variables
dotenv.config()

const logger = createLogger('background-agent')
const app = express()
const PORT = process.env.BACKGROUND_AGENT_PORT || 3008

// Middleware
app.use(cors())
app.use(express.json())

// Initialize services
const webSearchService = new WebSearchService()
const documentFetcher = new DocumentFetcher()
const insightsEngine = new InsightsEngine()

// Configure agent with auto-start settings
const agentConfig = {
  autoStart: true,
  autoProcessExistingInstruments: process.env.AUTO_PROCESS_INSTRUMENTS !== 'false',
  concurrency: parseInt(process.env.AGENT_CONCURRENCY || '3'),
  batchSize: parseInt(process.env.AGENT_BATCH_SIZE || '10'),
  retryAttempts: parseInt(process.env.AGENT_RETRY_ATTEMPTS || '3'),
  processingDelay: parseInt(process.env.AGENT_PROCESSING_DELAY || '5000')
}

const backgroundAgent = new BackgroundAgent(
  webSearchService,
  documentFetcher,
  insightsEngine,
  agentConfig
)

// Configure scheduler
const schedulerConfig = {
  marketScan: {
    enabled: process.env.ENABLE_MARKET_SCAN !== 'false',
    schedule: process.env.MARKET_SCAN_SCHEDULE || '0 9 * * 1-5',
    batchSize: parseInt(process.env.MARKET_SCAN_BATCH_SIZE || '30')
  },
  companyAnalysis: {
    enabled: process.env.ENABLE_COMPANY_ANALYSIS !== 'false',
    schedule: process.env.COMPANY_ANALYSIS_SCHEDULE || '*/30 * * * *',
    priority: (process.env.COMPANY_ANALYSIS_PRIORITY || 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW'
  },
  documentDiscovery: {
    enabled: process.env.ENABLE_DOCUMENT_DISCOVERY !== 'false',
    schedule: process.env.DOCUMENT_DISCOVERY_SCHEDULE || '0 */3 * * *',
    maxDocuments: parseInt(process.env.DOCUMENT_DISCOVERY_MAX_DOCS || '20')
  },
  insightGeneration: {
    enabled: process.env.ENABLE_INSIGHT_GENERATION !== 'false',
    schedule: process.env.INSIGHT_GENERATION_SCHEDULE || '0 10,14,18 * * 1-5',
    symbols: process.env.INSIGHT_SYMBOLS ? process.env.INSIGHT_SYMBOLS.split(',') : []
  },
  earningsUpdates: {
    enabled: process.env.ENABLE_EARNINGS_UPDATES !== 'false',
    schedule: process.env.EARNINGS_UPDATES_SCHEDULE || '0 7 * * *'
  },
  newsMonitoring: {
    enabled: process.env.ENABLE_NEWS_MONITORING !== 'false',
    schedule: process.env.NEWS_MONITORING_SCHEDULE || '*/20 * * * *'
  }
}

const agentScheduler = new AgentScheduler(backgroundAgent, schedulerConfig)

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'background-agent',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    config: {
      autoStart: agentConfig.autoStart,
      autoProcessInstruments: agentConfig.autoProcessExistingInstruments,
      concurrency: agentConfig.concurrency,
      batchSize: agentConfig.batchSize
    }
  })
})

// Agent control endpoints
app.post('/agent/start', async (req, res) => {
  try {
    await backgroundAgent.start()
    res.json({ message: 'Background agent started successfully' })
  } catch (error) {
    logger.error('Failed to start background agent:', error)
    res.status(500).json({ error: 'Failed to start background agent' })
  }
})

app.post('/agent/stop', async (req, res) => {
  try {
    await backgroundAgent.stop()
    res.json({ message: 'Background agent stopped successfully' })
  } catch (error) {
    logger.error('Failed to stop background agent:', error)
    res.status(500).json({ error: 'Failed to stop background agent' })
  }
})

app.get('/agent/status', async (req, res) => {
  try {
    const status = await backgroundAgent.getStatus()
    res.json(status)
  } catch (error) {
    logger.error('Failed to get agent status:', error)
    res.status(500).json({ error: 'Failed to get agent status' })
  }
})

// Manual trigger endpoints
app.post('/search/company/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const { searchType = 'comprehensive' } = req.body
    
    const results = await backgroundAgent.searchCompanyInformation(symbol, searchType)
    res.json(results)
  } catch (error) {
    logger.error(`Failed to search for ${req.params.symbol}:`, error)
    res.status(500).json({ error: 'Search failed' })
  }
})

app.post('/fetch/documents/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const { documentTypes } = req.body
    
    const results = await backgroundAgent.fetchCompanyDocuments(symbol, documentTypes)
    res.json(results)
  } catch (error) {
    logger.error(`Failed to fetch documents for ${req.params.symbol}:`, error)
    res.status(500).json({ error: 'Document fetch failed' })
  }
})

app.post('/insights/generate/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const insights = await backgroundAgent.generateInsights(symbol)
    res.json(insights)
  } catch (error) {
    logger.error(`Failed to generate insights for ${req.params.symbol}:`, error)
    res.status(500).json({ error: 'Insights generation failed' })
  }
})

// Scheduler control
app.post('/scheduler/start', async (req, res) => {
  try {
    agentScheduler.start()
    res.json({ message: 'Agent scheduler started' })
  } catch (error) {
    logger.error('Failed to start scheduler:', error)
    res.status(500).json({ error: 'Failed to start scheduler' })
  }
})

app.post('/scheduler/stop', async (req, res) => {
  try {
    agentScheduler.stop()
    res.json({ message: 'Agent scheduler stopped' })
  } catch (error) {
    logger.error('Failed to stop scheduler:', error)
    res.status(500).json({ error: 'Failed to stop scheduler' })
  }
})

app.get('/scheduler/status', async (req, res) => {
  try {
    const status = agentScheduler.getStatus()
    res.json(status)
  } catch (error) {
    logger.error('Failed to get scheduler status:', error)
    res.status(500).json({ error: 'Failed to get scheduler status' })
  }
})

// Add task endpoint for external services
app.post('/task/add', async (req, res) => {
  try {
    const { type, symbol, companyName, priority = 'MEDIUM', options } = req.body

    if (!type) {
      return res.status(400).json({ error: 'Task type is required' })
    }

    const validTypes = ['COMPANY_ANALYSIS', 'DOCUMENT_DISCOVERY', 'INSIGHT_GENERATION', 'MARKET_SCAN', 'INITIAL_PROCESSING']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid task type',
        validTypes
      })
    }

    const taskId = await backgroundAgent.addTask({
      type,
      symbol,
      companyName,
      priority,
      options
    })

    res.json({ 
      message: 'Task added successfully',
      taskId
    })
  } catch (error) {
    logger.error('Failed to add task:', error)
    res.status(500).json({ error: 'Failed to add task' })
  }
})

// Start server and auto-initialize agent
const server = app.listen(PORT, async () => {
  logger.info(`Background Agent Service running on port ${PORT}`)
  logger.info(`Configuration: ${JSON.stringify(agentConfig, null, 2)}`)
  
  try {
    // Auto-start the agent if configured
    if (agentConfig.autoStart) {
      logger.info('Auto-starting background agent...')
      await backgroundAgent.start()
      logger.info('Background agent auto-started successfully')
    }
    
    // Auto-start the scheduler
    logger.info('Auto-starting agent scheduler...')
    agentScheduler.start()
    logger.info('Agent scheduler auto-started successfully')
    
    // Log startup success
    logger.info('🚀 Background Agent Service fully initialized and ready!')
    logger.info(`📊 Auto-processing: ${agentConfig.autoProcessExistingInstruments ? 'ENABLED' : 'DISABLED'}`)
    logger.info(`⏰ Scheduler: ${Object.values(schedulerConfig).filter(s => s.enabled).length} tasks enabled`)
    
  } catch (error) {
    logger.error('Failed to auto-start services:', error)
    logger.warn('Services are available but may need manual start via API')
  }
})

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`)
  
  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed')
    })
    
    // Stop background services
    agentScheduler.stop()
    await backgroundAgent.stop()
    await agentScheduler.cleanup()
    
    logger.info('All services stopped successfully')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  gracefulShutdown('UNHANDLED_REJECTION')
}) 