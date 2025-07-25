import Queue from 'bull'
import Redis from 'ioredis'
import { createLogger } from '../utils/logger'
import { WebSearchService, SearchResult } from './WebSearchService'
import { UnifiedSearchService, UnifiedSearchResult } from './UnifiedSearchService'
import { EnhancedWebSearchService, EnhancedSearchResult } from './EnhancedWebSearchService'
import { SearXNGService } from './SearXNGService'
import { DocumentFetcher, DocumentInfo, FetchOptions } from './DocumentFetcher'
import { InsightsEngine, InsightData } from './InsightsEngine'
import { DatabaseService, InstrumentInfo } from './DatabaseService'
import { CacheService } from './CacheService'
import { StorageService } from './StorageService'
import { ContentProcessor, ContentResult } from './ContentProcessor'

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
  // Enhanced search configuration
  enableAdvancedSearch?: boolean
  enableContentProcessing?: boolean
  enableIntelligentFiltering?: boolean
  maxQualityResults?: number
  searchTimeRange?: 'day' | 'week' | 'month' | 'year'
}

export interface AgentTask {
  id: string
  type: 'COMPANY_ANALYSIS' | 'DOCUMENT_DISCOVERY' | 'INSIGHT_GENERATION' | 'MARKET_SCAN' | 'INITIAL_PROCESSING' | 'KNOWLEDGE_BASE_GENERATION'
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
    unifiedSearch: boolean
    searxng: boolean
    documentFetcher: boolean
    insightsEngine: boolean
    redis: boolean
    database: boolean
    cache: boolean
  }
}

// Enhanced knowledge base generation result
export interface KnowledgeBaseResult {
  symbol: string
  companyName: string
  searchIntelligence: UnifiedSearchResult
  enhancedSearch: EnhancedSearchResult
  documents: DocumentInfo[]
  insights: InsightData
  qualityMetrics: {
    totalSources: number
    uniqueDomains: number
    avgRelevanceScore: number
    contentProcessed: number
    knowledgeChunks: number
  }
  processingStats: {
    searchTime: number
    documentTime: number
    insightTime: number
    totalTime: number
  }
  recommendations: string[]
}

export class BackgroundAgent {
  private webSearchService: WebSearchService
  private unifiedSearchService: UnifiedSearchService
  private enhancedSearchService: EnhancedWebSearchService
  private searxngService: SearXNGService
  private documentFetcher: DocumentFetcher
  private insightsEngine: InsightsEngine
  private databaseService: DatabaseService
  private cacheService: CacheService
  private storageService: StorageService
  private contentProcessor: ContentProcessor
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
    this.unifiedSearchService = new UnifiedSearchService()
    this.enhancedSearchService = new EnhancedWebSearchService()
    this.searxngService = new SearXNGService()
    this.documentFetcher = documentFetcher
    this.insightsEngine = insightsEngine
    this.databaseService = new DatabaseService()
    this.cacheService = new CacheService()
    this.storageService = new StorageService()
    this.contentProcessor = new ContentProcessor()
    this.config = {
      concurrency: 3,
      batchSize: 10,
      retryAttempts: 3,
      processingDelay: 5000,
      autoStart: true,
      autoProcessExistingInstruments: true,
      // Enhanced search defaults
      enableAdvancedSearch: true,
      enableContentProcessing: true,
      enableIntelligentFiltering: true,
      maxQualityResults: 15,
      searchTimeRange: 'month',
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
          tls: {},
          connectTimeout: 3000,
          commandTimeout: 3000,
          maxRetriesPerRequest: 2,
          lazyConnect: true,
          keepAlive: 30000,
          family: 4
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

      // Add error handling for queue
      this.taskQueue.on('error', (error) => {
        logger.error('Task queue error:', error)
      })

      this.taskQueue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} stalled and will be retried`)
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
   * Add a task to the processing queue with timeout handling
   */
  async addTask(task: Omit<AgentTask, 'id' | 'createdAt'>): Promise<string> {
    if (!this.taskQueue) {
      throw new Error('Task queue not initialized')
    }

    const fullTask: AgentTask = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      ...task
    }

    const priority = this.getPriorityValue(task.priority)
    
    // Add timeout to prevent hanging - reduced timeout for faster failure
    const taskPromise = this.taskQueue.add(task.type, fullTask, {
      priority,
      delay: task.scheduledFor ? task.scheduledFor.getTime() - Date.now() : 0,
      timeout: 30000  // 30 second timeout for individual jobs
    })

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Task queue operation timed out after 3 seconds')), 3000)
    )

    try {
      await Promise.race([taskPromise, timeoutPromise])
      logger.info(`Added task ${fullTask.id} to queue with priority ${task.priority}`)
      return fullTask.id
    } catch (error) {
      // If it's a timeout error, we can still continue as the task might be added
      if (error instanceof Error && error.message.includes('timed out')) {
        logger.warn(`Task queue add operation timed out for task ${fullTask.id}, but task may still be queued`)
        return fullTask.id
      }
      
      logger.error(`Failed to add task to queue:`, error)
      throw error
    }
  }

  /**
   * Process a company comprehensively (legacy method - use generateComprehensiveKnowledgeBase for new implementations)
   */
  async searchCompanyInformation(symbol: string, searchType: string = 'comprehensive'): Promise<SearchResult[]> {
    logger.info(`Starting company search for ${symbol} (${searchType})`)
    
    try {
      // Use advanced search if enabled
      if (this.config.enableAdvancedSearch) {
        const intelligenceResult = await this.searchCompanyIntelligence(symbol, searchType)
        return intelligenceResult.searchResults.map(result => ({
          title: result.title,
          url: result.url,
          snippet: result.content,
          source: 'searxng' as const,
          published: result.publishedDate ? new Date(result.publishedDate) : undefined,
          relevanceScore: result.score / 100, // Normalize score to 0-1 range
          domain: new URL(result.url).hostname
        }))
      }

      // Fallback to basic search
      const companyName = await this.getCompanyName(symbol)
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
   * Generate comprehensive knowledge base for a company using all advanced services
   */
  async generateComprehensiveKnowledgeBase(symbol: string, options: {
    includeDocuments?: boolean
    generateInsights?: boolean
    searchType?: string
    forceRefresh?: boolean
  } = {}): Promise<KnowledgeBaseResult> {
    const startTime = Date.now()
    const {
      includeDocuments = true,
      generateInsights = true,
      searchType = 'comprehensive',
      forceRefresh = false
    } = options

    logger.info(`🧠 Generating comprehensive knowledge base for ${symbol}`)

    try {
      // Get company name
      const companyName = await this.getCompanyName(symbol)
      
      // Check comprehensive cache first
      const cacheKey = `knowledge_base:${symbol}:${searchType}:${JSON.stringify(options)}`
      if (!forceRefresh) {
        const cached = await this.cacheService.getJSON(cacheKey)
        if (cached) {
          logger.info(`Knowledge base cache hit for ${symbol}`)
          return cached
        }
      }

      // Step 1: Advanced Intelligence Search
      const searchStartTime = Date.now()
      const searchIntelligence = await this.searchCompanyIntelligence(symbol, searchType)
      const searchTime = Date.now() - searchStartTime

      // Step 2: Enhanced Content Processing Search
      const enhancedSearch = await this.processAdvancedSearch(symbol, companyName, searchType)

      // Step 3: Document Discovery (if enabled)
      let documents: DocumentInfo[] = []
      const documentStartTime = Date.now()
      if (includeDocuments) {
        documents = await this.fetchCompanyDocuments(symbol, ['SEC_FILING', 'EARNINGS_TRANSCRIPT', 'RESEARCH_REPORT'])
      }
      const documentTime = Date.now() - documentStartTime

      // Step 4: AI Insights Generation (if enabled)
      let insights: InsightData | null = null
      const insightStartTime = Date.now()
      if (generateInsights) {
        try {
          insights = await this.generateAdvancedInsights(symbol, {
            searchIntelligence,
            enhancedSearch,
            documents
          })
        } catch (error) {
          logger.warn(`Insights generation failed for ${symbol}, continuing without insights:`, error)
        }
      }
      const insightTime = Date.now() - insightStartTime

      // Step 5: Calculate quality metrics
      const qualityMetrics = this.calculateKnowledgeQualityMetrics(
        searchIntelligence,
        enhancedSearch,
        documents
      )

      // Step 6: Generate recommendations
      const recommendations = this.generateKnowledgeRecommendations(
        symbol,
        searchIntelligence,
        enhancedSearch,
        documents,
        insights
      )

      const result: KnowledgeBaseResult = {
        symbol,
        companyName,
        searchIntelligence,
        enhancedSearch,
        documents,
        insights: insights!,
        qualityMetrics,
        processingStats: {
          searchTime,
          documentTime,
          insightTime,
          totalTime: Date.now() - startTime
        },
        recommendations
      }

      // Step 7: Store comprehensive knowledge base
      await this.storeKnowledgeBase(symbol, result)
      
      // Step 8: Trigger rankings cache refresh with new analysis
      const instrumentId = await this.getInstrumentId(symbol)
      if (instrumentId) {
        await this.notifyRankingsCacheRefresh(instrumentId)
      }

      // ⚡ OPTIMIZATION: Cache result with size check and shorter TTL
      const resultSize = JSON.stringify(result).length
      if (resultSize < 1000000) { // Only cache if < 1MB
        await this.cacheService.set(cacheKey, result, 3600) // ⚡ REDUCED: 1 hour instead of 2
      } else {
        logger.debug(`Skipping cache for large knowledge base: ${resultSize} bytes`)
      }

      logger.info(`✅ Knowledge base generated for ${symbol} in ${result.processingStats.totalTime}ms`)
      return result

    } catch (error) {
      logger.error(`Failed to generate knowledge base for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Search for comprehensive company intelligence using unified services
   */
  async searchCompanyIntelligence(symbol: string, searchType: string = 'comprehensive'): Promise<UnifiedSearchResult> {
    logger.info(`🔍 Starting intelligence search for ${symbol} (${searchType})`)
    
    try {
      // Validate inputs
      if (!symbol || typeof symbol !== 'string') {
        throw new Error('Invalid symbol provided for intelligence search')
      }
      
      const companyName = await this.getCompanyName(symbol)
      
      const result = await this.unifiedSearchService.searchFinancialIntelligence({
        symbol,
        companyName,
        searchType: searchType as any,
        enableContentProcessing: this.config.enableContentProcessing,
        enableIntelligentFiltering: this.config.enableIntelligentFiltering,
        enableMarketContext: true,
        maxQualityResults: this.config.maxQualityResults,
        timeRange: this.config.searchTimeRange,
        processingOptions: {
          relevanceThreshold: 0.7,
          timelinessThresholdDays: 60,
          enableDeduplication: true,
          extractEntities: true,
          analyzeSentiment: true
        }
      })

      if (!result || !result.searchResults) {
        logger.warn(`Intelligence search returned empty result for ${symbol}`)
        return {
          symbol,
          searchResults: [],
          processedContent: [],
          intelligence: {
            marketSentiment: 'NEUTRAL',
            keyTrends: [],
            competitorMentions: [],
            riskFactors: [],
            opportunityIndicators: [],
            newsFlow: 'LOW',
            dataFreshness: 0
          },
          qualityMetrics: {
            totalSources: 0,
            uniqueDomains: 0,
            avgRelevanceScore: 0,
            avgTimelinessScore: 0,
            contentTypes: {}
          },
          processingStats: {
            searchTime: 0,
            processingTime: 0,
            totalTime: 0,
            cacheHits: 0,
            duplicatesRemoved: 0,
            irrelevantFiltered: 0
          },
          recommendations: []
        } as UnifiedSearchResult
      }

      logger.info(`Intelligence search completed for ${symbol}: ${result.searchResults.length} results, ${result.processedContent.length} quality content`)
      return result

    } catch (error) {
      logger.error(`Intelligence search failed for ${symbol}:`, error)
      
      // Return empty result instead of throwing to prevent cascade failures
      return {
        symbol,
        searchResults: [],
        processedContent: [],
        intelligence: {
          marketSentiment: 'NEUTRAL',
          keyTrends: [],
          competitorMentions: [],
          riskFactors: [],
          opportunityIndicators: [],
          newsFlow: 'LOW',
          dataFreshness: 0
        },
        qualityMetrics: {
          totalSources: 0,
          uniqueDomains: 0,
          avgRelevanceScore: 0,
          avgTimelinessScore: 0,
          contentTypes: {}
        },
        processingStats: {
          searchTime: 0,
          processingTime: 0,
          totalTime: 0,
          cacheHits: 0,
          duplicatesRemoved: 0,
          irrelevantFiltered: 0
        },
        recommendations: []
      } as UnifiedSearchResult
    }
  }

  /**
   * Process advanced search using EnhancedWebSearchService
   */
  async processAdvancedSearch(symbol: string, companyName: string, searchType: string): Promise<EnhancedSearchResult> {
    logger.info(`⚡ Processing advanced search for ${symbol}`)
    
    try {
      const result = await this.enhancedSearchService.searchWithContentProcessing(
        symbol,
        companyName,
        {
          searchType: searchType as any,
          priority: 'HIGH',
          maxResults: 25,
          enableContentProcessing: this.config.enableContentProcessing,
          maxProcessedResults: this.config.maxQualityResults,
          processingOptions: {
            relevanceThreshold: 0.65,
            timelinessThresholdDays: 45,
            enableDeduplication: true,
            extractEntities: true,
            analyzeSentiment: true
          }
        }
      )

      logger.info(`Advanced search completed for ${symbol}: ${result.processedContent.length} processed content`)
      return result

    } catch (error) {
      logger.error(`Advanced search failed for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Generate enhanced insights using comprehensive data
   */
  async generateAdvancedInsights(symbol: string, data: {
    searchIntelligence: UnifiedSearchResult
    enhancedSearch: EnhancedSearchResult
    documents: DocumentInfo[]
  }): Promise<InsightData> {
    logger.info(`🧠 Generating advanced insights for ${symbol}`)
    
    try {
      // Combine all search results and content
      const allSearchResults = [
        ...data.searchIntelligence.searchResults.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          source: 'searxng' as const,
          relevanceScore: r.score / 100
        })),
        ...data.enhancedSearch.searchResults
      ]

      // Generate insights with enhanced context
      const insights = await this.insightsEngine.generateInsights(
        symbol,
        data.documents,
        allSearchResults,
        {
          intelligence: data.searchIntelligence.intelligence,
          qualityMetrics: data.searchIntelligence.qualityMetrics,
          processedContent: [
            ...data.searchIntelligence.processedContent,
            ...data.enhancedSearch.processedContent
          ]
        }
      )

      return insights

    } catch (error) {
      logger.error(`Advanced insights generation failed for ${symbol}:`, error)
      throw error
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
      
      // Trigger rankings cache refresh with new analysis
      await this.notifyRankingsCacheRefresh(instrumentId)
      
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

    this.taskQueue.process('KNOWLEDGE_BASE_GENERATION', this.config.concurrency!, async (job) => {
      return this.processKnowledgeBaseGeneration(job.data)
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
      // Use comprehensive knowledge base if advanced search is enabled
      if (this.config.enableAdvancedSearch && task.options?.useComprehensive !== false) {
        const knowledgeBase = await this.generateComprehensiveKnowledgeBase(symbol, {
          includeDocuments: true,
          generateInsights: task.options?.generateInsights !== false,
          searchType: 'comprehensive'
        })

        return {
          symbol,
          companyName,
          searchResults: knowledgeBase.qualityMetrics.totalSources,
          documents: knowledgeBase.qualityMetrics.knowledgeChunks,
          insights: knowledgeBase.insights ? knowledgeBase.insights.insights.length : 0,
          confidence: knowledgeBase.insights?.confidence || 0,
          qualityScore: knowledgeBase.qualityMetrics.avgRelevanceScore,
          processingTime: knowledgeBase.processingStats.totalTime,
          recommendations: knowledgeBase.recommendations.length,
          isComprehensive: true
        }
      }

      // Fallback to legacy processing
      const searchResults = await this.searchCompanyInformation(symbol, 'comprehensive')
      const documents = await this.fetchCompanyDocuments(symbol)
      
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
        confidence: insights?.confidence || 0,
        isComprehensive: false
      }
    } catch (error) {
      logger.error(`Company analysis failed for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Process knowledge base generation task
   */
  private async processKnowledgeBaseGeneration(task: AgentTask): Promise<any> {
    const { symbol, companyName } = task
    if (!symbol) throw new Error('Symbol is required for knowledge base generation')

    logger.info(`Processing knowledge base generation for ${symbol}`)

    try {
      const options = {
        includeDocuments: task.options?.includeDocuments !== false,
        generateInsights: task.options?.generateInsights !== false,
        searchType: task.options?.searchType || 'comprehensive',
        forceRefresh: task.options?.forceRefresh || false
      }

      const knowledgeBase = await this.generateComprehensiveKnowledgeBase(symbol, options)

      return {
        symbol,
        companyName,
        totalSources: knowledgeBase.qualityMetrics.totalSources,
        uniqueDomains: knowledgeBase.qualityMetrics.uniqueDomains,
        contentProcessed: knowledgeBase.qualityMetrics.contentProcessed,
        documentsDiscovered: knowledgeBase.qualityMetrics.knowledgeChunks,
        insightsGenerated: knowledgeBase.insights ? knowledgeBase.insights.insights.length : 0,
        qualityScore: knowledgeBase.qualityMetrics.avgRelevanceScore,
        confidence: knowledgeBase.insights?.confidence || 0,
        processingStats: knowledgeBase.processingStats,
        recommendations: knowledgeBase.recommendations,
        intelligence: {
          marketSentiment: knowledgeBase.searchIntelligence.intelligence.marketSentiment,
          newsFlow: knowledgeBase.searchIntelligence.intelligence.newsFlow,
          dataFreshness: knowledgeBase.searchIntelligence.intelligence.dataFreshness,
          keyTrends: knowledgeBase.searchIntelligence.intelligence.keyTrends.slice(0, 5)
        }
      }
    } catch (error) {
      logger.error(`Knowledge base generation failed for ${symbol}:`, error)
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
   * Health check with individual timeouts to prevent hanging
   */
  private async healthCheck(): Promise<AgentStatus['healthStatus']> {
    const health = {
      webSearch: false,
      unifiedSearch: false,
      searxng: false,
      documentFetcher: false,
      insightsEngine: false,
      redis: false,
      database: false,
      cache: false
    }

    // Helper function to add timeout to health checks
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
      return Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
      ])
    }

    // Perform all health checks in parallel with timeouts
    const healthChecks = await Promise.allSettled([
      withTimeout(this.webSearchService.healthCheck(), 2000).then(result => {
        if (result) health.webSearch = Object.values(result).some(Boolean)
      }),
      withTimeout(this.unifiedSearchService.getHealthStatus(), 2000).then(result => {
        if (result) health.unifiedSearch = result.unified
      }),
      withTimeout(this.searxngService.healthCheck(), 2000).then(result => {
        if (result) health.searxng = result.status
      }),
      withTimeout(this.cacheService.ping(), 1000).then(result => {
        health.cache = result === true
      }),
      withTimeout(this.storageService.healthCheck(), 2000).then(result => {
        if (result) health.database = result.database
      })
    ])

    // Log any failures for debugging
    healthChecks.forEach((result, index) => {
      if (result.status === 'rejected') {
        const services = ['webSearch', 'unifiedSearch', 'searxng', 'cache', 'storage']
        logger.debug(`${services[index]} health check failed:`, result.reason)
      }
    })

    // Document fetcher and insights engine are internal, assume healthy if instantiated
    health.documentFetcher = true
    health.insightsEngine = true
    health.redis = health.cache // Use cache status for Redis

    return health
  }

  /**
   * Calculate quality metrics for knowledge base
   */
  private calculateKnowledgeQualityMetrics(
    searchIntelligence: UnifiedSearchResult,
    enhancedSearch: EnhancedSearchResult,
    documents: DocumentInfo[]
  ) {
    const allContent = [
      ...searchIntelligence.processedContent,
      ...enhancedSearch.processedContent
    ]

    const uniqueDomains = new Set([
      ...searchIntelligence.searchResults.map(r => new URL(r.url).hostname),
      ...enhancedSearch.searchResults.map(r => new URL(r.url).hostname)
    ])

    const totalRelevanceScore = allContent.reduce((sum, content) => 
      sum + content.relevanceScore, 0
    )

    return {
      totalSources: searchIntelligence.searchResults.length + enhancedSearch.searchResults.length,
      uniqueDomains: uniqueDomains.size,
      avgRelevanceScore: allContent.length > 0 ? totalRelevanceScore / allContent.length : 0,
      contentProcessed: allContent.length,
      knowledgeChunks: documents.length
    }
  }

  /**
   * Generate recommendations based on knowledge base
   */
  private generateKnowledgeRecommendations(
    symbol: string,
    searchIntelligence: UnifiedSearchResult,
    enhancedSearch: EnhancedSearchResult,
    documents: DocumentInfo[],
    insights: InsightData | null
  ): string[] {
    const recommendations: string[] = []

    // Data quality recommendations
    if (searchIntelligence.qualityMetrics.avgRelevanceScore < 0.7) {
      recommendations.push(`Consider additional search terms for ${symbol} to improve relevance`)
    }

    if (documents.length < 5) {
      recommendations.push(`Add more recent SEC filings and earnings documents for ${symbol}`)
    }

    if (searchIntelligence.intelligence.dataFreshness < 50) {
      recommendations.push(`Search for more recent news and updates about ${symbol}`)
    }

    // Market intelligence recommendations
    if (searchIntelligence.intelligence.marketSentiment === 'NEGATIVE') {
      recommendations.push(`Monitor ${symbol} closely due to negative market sentiment`)
    }

    if (searchIntelligence.intelligence.newsFlow === 'HIGH') {
      recommendations.push(`${symbol} has high news activity - consider real-time monitoring`)
    }

    // Content recommendations
    const processedContent = [...searchIntelligence.processedContent, ...enhancedSearch.processedContent]
    const earningsContent = processedContent.filter(c => c.contentType === 'earnings')
    if (earningsContent.length === 0) {
      recommendations.push(`Add earnings transcripts and analysis for ${symbol}`)
    }

    // AI insights recommendations
    if (insights) {
      if (insights.confidence < 0.6) {
        recommendations.push(`Low confidence insights for ${symbol} - gather more reliable data`)
      }

      if (insights.dataQuality.completeness < 0.7) {
        recommendations.push(`Knowledge base for ${symbol} needs more comprehensive data coverage`)
      }
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push(`Knowledge base for ${symbol} is comprehensive and up-to-date`)
    }

    return recommendations.slice(0, 5) // Limit to top 5 recommendations
  }

  /**
   * Store comprehensive knowledge base results
   */
  private async storeKnowledgeBase(symbol: string, result: KnowledgeBaseResult): Promise<void> {
    try {
      const instrumentId = await this.getInstrumentId(symbol)
      if (!instrumentId) {
        logger.warn(`Cannot store knowledge base - instrument not found: ${symbol}`)
        return
      }

      // Store search intelligence results
      if (result.searchIntelligence.searchResults.length > 0) {
        const searchResults = result.searchIntelligence.searchResults.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          source: 'searxng' as const,
          relevanceScore: r.score / 100
        }))
        await this.storageService.storeSearchResults(instrumentId, searchResults, `${symbol} intelligence`)
      }

      // Store enhanced search results
      if (result.enhancedSearch.searchResults.length > 0) {
        await this.storageService.storeSearchResults(instrumentId, result.enhancedSearch.searchResults, `${symbol} enhanced`)
      }

      // Store documents
      if (result.documents.length > 0) {
        await this.storageService.storeDocuments(instrumentId, result.documents)
      }

      // Store insights
      if (result.insights) {
        await this.storageService.storeInsights(instrumentId, result.insights)
      }

      logger.info(`✅ Knowledge base stored for ${symbol}`)

    } catch (error) {
      logger.error(`Failed to store knowledge base for ${symbol}:`, error)
    }
  }

  /**
   * Batch generate knowledge bases for multiple symbols
   */
  async batchGenerateKnowledgeBases(symbols: string[], options: {
    includeDocuments?: boolean
    generateInsights?: boolean
    searchType?: string
    maxConcurrency?: number
  } = {}): Promise<Map<string, KnowledgeBaseResult>> {
    const {
      includeDocuments = true,
      generateInsights = false, // Default false for batch to avoid overwhelming AI API
      searchType = 'comprehensive',
      maxConcurrency = 3
    } = options

    logger.info(`🚀 Batch generating knowledge bases for ${symbols.length} symbols`)

    const results = new Map<string, KnowledgeBaseResult>()
    const semaphore = this.createSemaphore(maxConcurrency)

    const promises = symbols.map(symbol => 
      semaphore(async () => {
        try {
          const result = await this.generateComprehensiveKnowledgeBase(symbol, {
            includeDocuments,
            generateInsights,
            searchType
          })
          results.set(symbol, result)
          logger.info(`✅ Knowledge base completed for ${symbol}`)
        } catch (error) {
          logger.error(`❌ Knowledge base failed for ${symbol}:`, error)
        }
      })
    )

    await Promise.all(promises)

    logger.info(`🎉 Batch knowledge base generation completed: ${results.size}/${symbols.length} successful`)
    return results
  }

  /**
   * Create a semaphore for controlling concurrency
   */
  private createSemaphore(maxConcurrency: number) {
    let running = 0
    const queue: Array<() => void> = []

    return async <T>(fn: () => Promise<T>): Promise<T> => {
      return new Promise((resolve, reject) => {
        const task = async () => {
          running++
          try {
            const result = await fn()
            resolve(result)
          } catch (error) {
            reject(error)
          } finally {
            running--
            if (queue.length > 0) {
              const next = queue.shift()!
              next()
            }
          }
        }

        if (running < maxConcurrency) {
          task()
        } else {
          queue.push(task)
        }
      })
    }
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

  /**
   * Trigger rankings cache refresh when new analysis is ready
   */
  private async notifyRankingsCacheRefresh(instrumentId?: string): Promise<void> {
    try {
      const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3002'
      
      logger.info(`Triggering rankings cache refresh for ${instrumentId || 'all instruments'}...`)
      
      const response = await fetch(`${API_GATEWAY_URL}/api/rankings/cache/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'new_analysis',
          instrumentId
        })
      })
      
      if (response.ok) {
        logger.info('✅ Rankings cache refresh triggered successfully')
      } else {
        logger.warn(`⚠️ Rankings cache refresh request failed: ${response.statusText}`)
      }
    } catch (error) {
      logger.warn('❌ Failed to trigger rankings cache refresh:', error)
    }
  }
} 