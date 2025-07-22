import Queue from 'bull'
import Redis from 'ioredis'
import { createLogger } from '../utils/logger'
import { WebSearchService, SearchResult } from './WebSearchService'
import { DocumentFetcher, DocumentInfo, FetchOptions } from './DocumentFetcher'
import { InsightsEngine, InsightData } from './InsightsEngine'
import { DatabaseService, InstrumentInfo } from './DatabaseService'
import { CacheService } from './CacheService'
import { StorageService } from './StorageService'

const logger = createLogger('background-agent')

export interface AgentConfig {
  redis?: {
    host: string
    port: number
    password?: string
  }
  concurrency?: number
  batchSize?: number
  retryAttempts?: number
  processingDelay?: number
  autoStart?: boolean
  autoProcessExistingInstruments?: boolean
}

export interface AgentTask {
  id: string
  type: 'COMPANY_ANALYSIS' | 'DOCUMENT_DISCOVERY' | 'INSIGHT_GENERATION' | 'MARKET_SCAN' | 'INITIAL_PROCESSING'
  symbol?: string
  companyName?: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  options?: any
  createdAt: Date
  scheduledFor?: Date
}

export interface AgentStatus {
  isRunning: boolean
  tasksInQueue: number
  tasksProcessing: number
  tasksCompleted: number
  tasksFailed: number
  lastProcessedAt?: Date
  instrumentsProcessed: number
  totalInstruments: number
  healthStatus: {
    webSearch: boolean
    documentFetcher: boolean
    insightsEngine: boolean
    redis: boolean
    database: boolean
    cache: boolean
  }
}

export class BackgroundAgent {
  private webSearchService: WebSearchService
  private documentFetcher: DocumentFetcher
  private insightsEngine: InsightsEngine
  private databaseService: DatabaseService
  private cacheService: CacheService
  private storageService: StorageService
  private redis: Redis | null = null
  private taskQueue: Queue.Queue | null = null
  private isRunning = false
  private config: AgentConfig
  private stats = {
    tasksCompleted: 0,
    tasksFailed: 0,
    instrumentsProcessed: 0,
    totalInstruments: 0,
    lastProcessedAt: undefined as Date | undefined
  }

  constructor(
    webSearchService: WebSearchService,
    documentFetcher: DocumentFetcher,
    insightsEngine: InsightsEngine,
    config: AgentConfig = {}
  ) {
    this.webSearchService = webSearchService
    this.documentFetcher = documentFetcher
    this.insightsEngine = insightsEngine
    this.databaseService = new DatabaseService()
    this.cacheService = new CacheService()
    this.storageService = new StorageService()
    this.config = {
      concurrency: 3,
      batchSize: 10,
      retryAttempts: 3,
      processingDelay: 5000,
      autoStart: true,
      autoProcessExistingInstruments: true,
      ...config
    }

    // Initialize task queue (only for job processing, not caching)
    this.initializeTaskQueue()
  }

  private initializeTaskQueue(): void {
    try {
      const redisUrl = process.env.REDIS_URL
      const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL
      const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN

      let queueRedisConfig
      if (redisUrl) {
        queueRedisConfig = redisUrl
        logger.info('Using standard Redis for task queue')
      } else if (upstashRestUrl && upstashRestToken) {
        const url = new URL(upstashRestUrl)
        queueRedisConfig = {
          host: url.hostname,
          port: 6379,
          password: upstashRestToken,
          tls: {}
        }
        logger.info('Using Upstash Redis for task queue')
      } else {
        logger.warn('No Redis configuration found - task queue disabled')
        return
      }

      this.taskQueue = new Queue('background-agent-tasks', {
        redis: queueRedisConfig,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: this.config.retryAttempts,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      })

      this.setupQueueProcessors()
    } catch (error) {
      logger.error('Failed to initialize task queue:', error)
      logger.warn('Task queue disabled - agent will run without job processing')
    }
  }

  /**
   * Start the background agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Background agent is already running')
      return
    }

    try {
      logger.info('Starting background agent...')
      
      // Test cache connection
      const cacheHealthy = await this.cacheService.ping()
      if (cacheHealthy) {
        logger.info(`Cache connection successful (${this.cacheService.getCacheType()})`)
      } else {
        logger.warn('Cache connection failed - running without cache')
      }
      
      // Test database connection
      try {
        await this.databaseService.getActiveInstruments()
        logger.info('Database connection successful')
      } catch (error) {
        logger.error('Database connection failed:', error)
        logger.warn('Agent will use fallback instruments')
      }
      
      // Start processing queue
      this.isRunning = true
      
      // Auto-process existing instruments if enabled
      if (this.config.autoProcessExistingInstruments) {
        await this.startInitialProcessing()
      }
      
      logger.info('Background agent started successfully')
    } catch (error) {
      logger.error('Failed to start background agent:', error)
      throw error
    }
  }

  /**
   * Start initial processing for existing instruments
   */
  async startInitialProcessing(): Promise<void> {
    try {
      logger.info('Starting initial processing for existing instruments...')
      
      // Get all active instruments from database
      const instruments = await this.databaseService.getActiveInstruments()
      this.stats.totalInstruments = instruments.length
      
      logger.info(`Found ${instruments.length} active instruments in database`)
      
      if (instruments.length === 0) {
        logger.warn('No instruments found in database')
        return
      }

      // If task queue is available, add processing task
      if (this.taskQueue) {
        await this.addTask({
          type: 'INITIAL_PROCESSING',
          priority: 'HIGH',
          options: {
            instruments: instruments,
            batchSize: this.config.batchSize
          }
        })
        logger.info('Initial processing task added to queue')
      } else {
        // Process directly without queue
        logger.info('Processing instruments directly (no task queue)')
        await this.processInstrumentsDirect(instruments)
      }
    } catch (error) {
      logger.error('Failed to start initial processing:', error)
    }
  }

  /**
   * Process instruments directly when task queue is not available
   */
  private async processInstrumentsDirect(instruments: InstrumentInfo[]): Promise<void> {
    const batchSize = this.config.batchSize || 10
    
    for (let i = 0; i < instruments.length && i < 50; i += batchSize) { // Limit to first 50 instruments
      const batch = instruments.slice(i, i + batchSize)
      
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} instruments`)

      for (const instrument of batch) {
        try {
          // Process each instrument - search for information only (no AI insights to avoid rate limits)
          logger.info(`Processing ${instrument.symbol}...`)
          
          const searchResults = await this.searchCompanyInformation(instrument.symbol, 'comprehensive')
          logger.info(`Found ${searchResults.length} search results for ${instrument.symbol}`)
          
          // Small delay between instruments
          await new Promise(resolve => setTimeout(resolve, 2000))
          
        } catch (error) {
          logger.error(`Failed to process ${instrument.symbol}:`, error)
        }
      }

      // Longer delay between batches
      if (i + batchSize < instruments.length) {
        logger.info(`Batch completed. Waiting before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }
    
    logger.info('Direct processing completed')
  }

  /**
   * Stop the background agent
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.info('Background agent is not running')
      return
    }

    try {
      logger.info('Stopping background agent...')
      
      this.isRunning = false
      if (this.taskQueue) {
        await this.taskQueue.close()
      }
      await this.documentFetcher.cleanup()
      await this.databaseService.disconnect()
      await this.cacheService.disconnect()
      await this.storageService.disconnect()
      
      logger.info('Background agent stopped successfully')
    } catch (error) {
      logger.error('Error stopping background agent:', error)
      throw error
    }
  }

  /**
   * Add a task to the processing queue
   */
  async addTask(task: Omit<AgentTask, 'id' | 'createdAt'>): Promise<string> {
    if (!this.taskQueue) {
      throw new Error('Task queue not available')
    }

    const fullTask: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      ...task
    }

    const priority = this.getPriorityValue(task.priority)
    
    await this.taskQueue.add(task.type, fullTask, {
      priority,
      delay: task.scheduledFor ? task.scheduledFor.getTime() - Date.now() : 0
    })

    logger.info(`Added task ${fullTask.id} to queue with priority ${task.priority}`)
    return fullTask.id
  }

  /**
   * Process a company comprehensively
   */
  async searchCompanyInformation(symbol: string, searchType: string = 'comprehensive'): Promise<SearchResult[]> {
    logger.info(`Starting company search for ${symbol} (${searchType})`)
    
    try {
      // Get company name from database or cache
      const companyName = await this.getCompanyName(symbol)
      
      // Perform comprehensive search
      const searchResults = await this.webSearchService.searchCompanyInfo(
        symbol,
        companyName,
        searchType
      )

      // Store results permanently using storage service
      const instrumentId = await this.getInstrumentId(symbol)
      if (instrumentId) {
        await this.storageService.storeSearchResults(instrumentId, searchResults, `${symbol} ${searchType}`)
      }
      
      return searchResults
    } catch (error) {
      logger.error(`Company search failed for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Fetch company documents
   */
  async fetchCompanyDocuments(symbol: string, documentTypes?: string[]): Promise<DocumentInfo[]> {
    logger.info(`Fetching documents for ${symbol}`)
    
    try {
      const companyName = await this.getCompanyName(symbol)
      
      const options: FetchOptions = {
        maxDocuments: 50,
        dateRange: 'year',
        documentTypes,
        includeContent: true
      }

      const documents = await this.documentFetcher.fetchAllCompanyDocuments(
        symbol,
        companyName,
        options
      )

      // Store documents permanently using storage service
      const instrumentId = await this.getInstrumentId(symbol)
      if (instrumentId) {
        await this.storageService.storeDocuments(instrumentId, documents)
      }
      
      return documents
    } catch (error) {
      logger.error(`Document fetching failed for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Generate insights for a company
   */
  async generateInsights(symbol: string): Promise<InsightData> {
    logger.info(`Generating insights for ${symbol}`)
    
    try {
      const instrumentId = await this.getInstrumentId(symbol)
      if (!instrumentId) {
        throw new Error(`Instrument not found: ${symbol}`)
      }

      // Get stored documents and search results
      const documents = await this.storageService.getDocuments(instrumentId)
      const searchResults = await this.storageService.getSearchResults(instrumentId)
      const marketData = await this.getMarketData(symbol)

      // Convert stored data to expected format
      const documentInfos: DocumentInfo[] = documents.map(doc => ({
        id: doc.id,
        symbol: symbol,
        title: doc.title,
        url: doc.url,
        documentType: doc.documentType as any,
        publishedDate: new Date(),
        content: doc.extractedText,
        metadata: doc.metadata,
        status: doc.status as any
      }))

      // Generate insights
      const insights = await this.insightsEngine.generateInsights(
        symbol,
        documentInfos,
        searchResults,
        marketData
      )

      // Store insights permanently using storage service
      await this.storageService.storeInsights(instrumentId, insights)
      
      return insights
    } catch (error) {
      logger.error(`Insights generation failed for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get agent status
   */
  async getStatus(): Promise<AgentStatus> {
    let waiting = 0
    let active = 0
    
    if (this.taskQueue) {
      try {
        const waitingJobs = await this.taskQueue.getWaiting()
        const activeJobs = await this.taskQueue.getActive()
        waiting = waitingJobs.length
        active = activeJobs.length
      } catch (error) {
        logger.debug('Failed to get queue status:', error)
      }
    }

    const healthStatus = await this.healthCheck()

    return {
      isRunning: this.isRunning,
      tasksInQueue: waiting,
      tasksProcessing: active,
      tasksCompleted: this.stats.tasksCompleted,
      tasksFailed: this.stats.tasksFailed,
      lastProcessedAt: this.stats.lastProcessedAt,
      instrumentsProcessed: this.stats.instrumentsProcessed,
      totalInstruments: this.stats.totalInstruments,
      healthStatus
    }
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(): void {
    if (!this.taskQueue) return

    this.taskQueue.process('INITIAL_PROCESSING', 1, async (job) => {
      return this.processInitialBatch(job.data)
    })

    this.taskQueue.process('COMPANY_ANALYSIS', this.config.concurrency!, async (job) => {
      return this.processCompanyAnalysis(job.data)
    })

    this.taskQueue.process('DOCUMENT_DISCOVERY', this.config.concurrency!, async (job) => {
      return this.processDocumentDiscovery(job.data)
    })

    this.taskQueue.process('INSIGHT_GENERATION', this.config.concurrency!, async (job) => {
      return this.processInsightGeneration(job.data)
    })

    this.taskQueue.process('MARKET_SCAN', 1, async (job) => {
      return this.processMarketScan(job.data)
    })

    // Event handlers
    this.taskQueue.on('completed', (job) => {
      this.stats.tasksCompleted++
      this.stats.lastProcessedAt = new Date()
      logger.info(`Task ${job.id} completed successfully`)
    })

    this.taskQueue.on('failed', (job, err) => {
      this.stats.tasksFailed++
      logger.error(`Task ${job.id} failed:`, err)
    })
  }

  /**
   * Process initial batch of instruments
   */
  private async processInitialBatch(task: AgentTask): Promise<any> {
    const { instruments, batchSize } = task.options
    
    logger.info(`Processing initial batch of ${instruments.length} instruments`)

    let processedCount = 0
    const results = []

    // Process instruments in batches
    for (let i = 0; i < instruments.length; i += batchSize) {
      const batch = instruments.slice(i, i + batchSize)
      
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} instruments`)

      for (const instrument of batch) {
        try {
          // Add individual processing tasks for each instrument
          await this.addTask({
            type: 'COMPANY_ANALYSIS',
            symbol: instrument.symbol,
            companyName: instrument.name,
            priority: 'MEDIUM',
            options: {
              exchange: instrument.exchange,
              currency: instrument.currency
            }
          })

          processedCount++
          this.stats.instrumentsProcessed = processedCount
          results.push({ symbol: instrument.symbol, status: 'queued' })

        } catch (error) {
          logger.error(`Failed to queue processing for ${instrument.symbol}:`, error)
          results.push({ symbol: instrument.symbol, status: 'error', error: (error as Error).message })
        }

        // Add delay between instruments to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Longer delay between batches
      if (i + batchSize < instruments.length) {
        logger.info(`Batch completed. Waiting before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }

    logger.info(`Initial processing completed. Queued ${processedCount} instruments for analysis`)
    return {
      totalInstruments: instruments.length,
      processedCount,
      results
    }
  }

  /**
   * Process company analysis task
   */
  private async processCompanyAnalysis(task: AgentTask): Promise<any> {
    const { symbol, companyName } = task
    if (!symbol) throw new Error('Symbol is required for company analysis')

    logger.info(`Processing company analysis for ${symbol}`)

    try {
      // Step 1: Search for information
      const searchResults = await this.searchCompanyInformation(symbol, 'comprehensive')
      
      // Step 2: Fetch documents
      const documents = await this.fetchCompanyDocuments(symbol)
      
      // Step 3: Generate insights (optional, to avoid overwhelming AI API)
      let insights = null
      if (task.options?.generateInsights !== false) {
        try {
          insights = await this.generateInsights(symbol)
        } catch (error) {
          logger.warn(`Insights generation failed for ${symbol}, continuing without insights:`, error)
        }
      }

      return {
        symbol,
        companyName,
        searchResults: searchResults.length,
        documents: documents.length,
        insights: insights ? insights.insights.length : 0,
        confidence: insights?.confidence || 0
      }
    } catch (error) {
      logger.error(`Company analysis failed for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Process document discovery task
   */
  private async processDocumentDiscovery(task: AgentTask): Promise<any> {
    const { symbol } = task
    if (!symbol) throw new Error('Symbol is required for document discovery')

    logger.info(`Processing document discovery for ${symbol}`)
    
    const documents = await this.fetchCompanyDocuments(symbol, task.options?.documentTypes)
    
    return {
      symbol,
      documentsDiscovered: documents.length,
      documentsProcessed: documents.filter(d => d.status === 'PROCESSED').length
    }
  }

  /**
   * Process insight generation task
   */
  private async processInsightGeneration(task: AgentTask): Promise<any> {
    const { symbol } = task
    if (!symbol) throw new Error('Symbol is required for insight generation')

    logger.info(`Processing insight generation for ${symbol}`)
    
    const insights = await this.generateInsights(symbol)
    
    return {
      symbol,
      insightsGenerated: insights.insights.length,
      confidence: insights.confidence,
      dataQuality: insights.dataQuality
    }
  }

  /**
   * Process market scan task
   */
  private async processMarketScan(task: AgentTask): Promise<any> {
    logger.info('Processing market scan task')
    
    // Get list of symbols from database
    const instruments = await this.databaseService.getPriorityInstruments(this.config.batchSize || 10)
    const results = []

    for (const instrument of instruments) {
      try {
        await this.addTask({
          type: 'COMPANY_ANALYSIS',
          symbol: instrument.symbol,
          companyName: instrument.name,
          priority: 'LOW'
        })
        results.push(instrument.symbol)
      } catch (error) {
        logger.error(`Failed to add analysis task for ${instrument.symbol}:`, error)
      }
    }

    return {
      symbolsScanned: results.length,
      tasksCreated: results.length
    }
  }

  /**
   * Health check
   */
  private async healthCheck(): Promise<AgentStatus['healthStatus']> {
    const health = {
      webSearch: false,
      documentFetcher: false,
      insightsEngine: false,
      redis: false,
      database: false,
      cache: false
    }

    try {
      // Test web search
      const searchHealth = await this.webSearchService.healthCheck()
      health.webSearch = Object.values(searchHealth).some(Boolean)
    } catch (error) {
      logger.debug('Web search health check failed')
    }

    try {
      // Test Cache
      health.cache = await this.cacheService.ping()
    } catch (error) {
      logger.debug('Cache health check failed')
    }

    try {
      // Test Storage (Database + S3)
      const storageHealth = await this.storageService.healthCheck()
      health.database = storageHealth.database
      // Note: We use cache status for redis health, storage handles S3
    } catch (error) {
      logger.debug('Storage health check failed')
    }

    // Document fetcher and insights engine are internal, assume healthy if instantiated
    health.documentFetcher = true
    health.insightsEngine = true
    health.redis = health.cache // Use cache status for Redis

    return health
  }

  /**
   * Helper methods
   */
  private getPriorityValue(priority: AgentTask['priority']): number {
    const priorities = { HIGH: 1, MEDIUM: 5, LOW: 10 }
    return priorities[priority]
  }

  private async getCompanyName(symbol: string): Promise<string> {
    try {
      // Try to get from database first
      const instruments = await this.databaseService.getActiveInstruments()
      const instrument = instruments.find(i => i.symbol === symbol.toUpperCase())
      if (instrument?.name) {
        return instrument.name
      }
    } catch (error) {
      logger.debug(`Could not get company name from database for ${symbol}`)
    }

    // Try cache
    const cached = await this.cacheService.get(`company_name:${symbol}`)
    if (cached) return cached

    // Fallback to symbol if no name found
    return symbol
  }

  private async getMarketData(symbol: string): Promise<any> {
    try {
      // Get latest market data from database
      const lastUpdate = await this.databaseService.getLastMarketDataUpdate(symbol)
      if (lastUpdate) {
        return {
          symbol,
          lastUpdate,
          hasRecentData: lastUpdate > new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    } catch (error) {
      logger.debug(`Could not get market data for ${symbol}`)
    }
    return null
  }

  /**
   * Helper method to get instrument ID from symbol
   */
  private async getInstrumentId(symbol: string): Promise<string | null> {
    try {
      const instruments = await this.databaseService.getActiveInstruments()
      const instrument = instruments.find(i => i.symbol.toUpperCase() === symbol.toUpperCase())
      return instrument?.id || null
    } catch (error) {
      logger.error(`Failed to get instrument ID for ${symbol}:`, error)
      return null
    }
  }
} 