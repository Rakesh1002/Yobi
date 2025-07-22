import * as cron from 'node-cron'
import { createLogger } from '../utils/logger'
import { BackgroundAgent } from './BackgroundAgent'
import { DatabaseService } from './DatabaseService'

const logger = createLogger('agent-scheduler')

export interface ScheduleConfig {
  marketScan: {
    enabled: boolean
    schedule: string // Cron expression
    batchSize: number
  }
  companyAnalysis: {
    enabled: boolean
    schedule: string
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }
  documentDiscovery: {
    enabled: boolean
    schedule: string
    maxDocuments: number
  }
  insightGeneration: {
    enabled: boolean
    schedule: string
    symbols: string[]
  }
  earningsUpdates: {
    enabled: boolean
    schedule: string
  }
  newsMonitoring: {
    enabled: boolean
    schedule: string
  }
}

export class AgentScheduler {
  private backgroundAgent: BackgroundAgent
  private databaseService: DatabaseService
  private config: ScheduleConfig
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map()
  private isRunning = false

  constructor(backgroundAgent: BackgroundAgent, config?: Partial<ScheduleConfig>) {
    this.backgroundAgent = backgroundAgent
    this.databaseService = new DatabaseService()
    this.config = {
      marketScan: {
        enabled: true,
        schedule: '0 9 * * 1-5', // 9 AM on weekdays
        batchSize: 30
      },
      companyAnalysis: {
        enabled: true,
        schedule: '*/30 * * * *', // Every 30 minutes
        priority: 'MEDIUM'
      },
      documentDiscovery: {
        enabled: true,
        schedule: '0 */3 * * *', // Every 3 hours
        maxDocuments: 20
      },
      insightGeneration: {
        enabled: true,
        schedule: '0 10,14,18 * * 1-5', // 10 AM, 2 PM, 6 PM on weekdays
        symbols: []
      },
      earningsUpdates: {
        enabled: true,
        schedule: '0 7 * * *' // 7 AM daily
      },
      newsMonitoring: {
        enabled: true,
        schedule: '*/20 * * * *' // Every 20 minutes
      },
      ...config
    }
  }

  /**
   * Start all scheduled tasks
   */
  start(): void {
    if (this.isRunning) {
      logger.info('Agent scheduler is already running')
      return
    }

    logger.info('Starting agent scheduler...')

    try {
      this.setupScheduledTasks()
      this.isRunning = true
      logger.info('Agent scheduler started successfully')
    } catch (error) {
      logger.error('Failed to start agent scheduler:', error)
      throw error
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    if (!this.isRunning) {
      logger.info('Agent scheduler is not running')
      return
    }

    logger.info('Stopping agent scheduler...')

    // Stop all scheduled tasks
    this.scheduledTasks.forEach((task, name) => {
      task.stop()
      logger.debug(`Stopped scheduled task: ${name}`)
    })

    this.scheduledTasks.clear()
    this.isRunning = false
    logger.info('Agent scheduler stopped successfully')
  }

  /**
   * Add or update a scheduled task
   */
  addSchedule(name: string, schedule: string, taskFn: () => Promise<void>): void {
    // Stop existing task if it exists
    if (this.scheduledTasks.has(name)) {
      this.scheduledTasks.get(name)!.stop()
    }

    // Create new scheduled task
    const task = cron.schedule(schedule, async () => {
      logger.info(`Executing scheduled task: ${name}`)
      try {
        await taskFn()
        logger.info(`Completed scheduled task: ${name}`)
      } catch (error) {
        logger.error(`Scheduled task failed: ${name}`, error)
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York' // Market timezone
    })

    this.scheduledTasks.set(name, task)

    if (this.isRunning) {
      task.start()
    }

    logger.info(`Added scheduled task: ${name} with schedule: ${schedule}`)
  }

  /**
   * Remove a scheduled task
   */
  removeSchedule(name: string): void {
    const task = this.scheduledTasks.get(name)
    if (task) {
      task.stop()
      this.scheduledTasks.delete(name)
      logger.info(`Removed scheduled task: ${name}`)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ScheduleConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (this.isRunning) {
      // Restart to apply new configuration
      this.stop()
      this.start()
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean
    activeTasks: string[]
    nextExecutions: Record<string, Date | null>
  } {
    const activeTasks: string[] = []
    const nextExecutions: Record<string, Date | null> = {}

    this.scheduledTasks.forEach((task, name) => {
      // Note: node-cron ScheduledTask doesn't expose running status
      // We'll track this separately if needed
      activeTasks.push(name) // Assume all scheduled tasks are active
      // Note: node-cron doesn't expose next execution time directly
      nextExecutions[name] = null
    })

    return {
      isRunning: this.isRunning,
      activeTasks,
      nextExecutions
    }
  }

  /**
   * Setup all scheduled tasks based on configuration
   */
  private setupScheduledTasks(): void {
    // Market scan - comprehensive analysis of active symbols
    if (this.config.marketScan.enabled) {
      this.addSchedule('marketScan', this.config.marketScan.schedule, async () => {
        await this.executeMarketScan()
      })
    }

    // Company analysis - regular updates for tracked companies
    if (this.config.companyAnalysis.enabled) {
      this.addSchedule('companyAnalysis', this.config.companyAnalysis.schedule, async () => {
        await this.executeCompanyAnalysis()
      })
    }

    // Document discovery - find new filings and documents
    if (this.config.documentDiscovery.enabled) {
      this.addSchedule('documentDiscovery', this.config.documentDiscovery.schedule, async () => {
        await this.executeDocumentDiscovery()
      })
    }

    // Insight generation - generate fresh insights
    if (this.config.insightGeneration.enabled) {
      this.addSchedule('insightGeneration', this.config.insightGeneration.schedule, async () => {
        await this.executeInsightGeneration()
      })
    }

    // Earnings updates - check for new earnings reports
    if (this.config.earningsUpdates.enabled) {
      this.addSchedule('earningsUpdates', this.config.earningsUpdates.schedule, async () => {
        await this.executeEarningsUpdates()
      })
    }

    // News monitoring - continuous news and research monitoring
    if (this.config.newsMonitoring.enabled) {
      this.addSchedule('newsMonitoring', this.config.newsMonitoring.schedule, async () => {
        await this.executeNewsMonitoring()
      })
    }

    // Special schedules for different market conditions
    this.setupMarketConditionSchedules()
  }

  /**
   * Execute market scan
   */
  private async executeMarketScan(): Promise<void> {
    logger.info('Executing market scan...')

    try {
      const instruments = await this.databaseService.getPriorityInstruments(this.config.marketScan.batchSize)
      
      await this.backgroundAgent.addTask({
        type: 'MARKET_SCAN',
        priority: 'LOW',
        options: {
          instruments,
          batchSize: this.config.marketScan.batchSize
        }
      })
    } catch (error) {
      logger.error('Market scan execution failed:', error)
    }
  }

  /**
   * Execute company analysis for priority symbols
   */
  private async executeCompanyAnalysis(): Promise<void> {
    logger.info('Executing company analysis...')

    try {
      // Get priority symbols from database
      const priorityInstruments = await this.databaseService.getPriorityInstruments(15)

      for (const instrument of priorityInstruments) {
        await this.backgroundAgent.addTask({
          type: 'COMPANY_ANALYSIS',
          symbol: instrument.symbol,
          companyName: instrument.name,
          priority: this.config.companyAnalysis.priority,
          options: {
            exchange: instrument.exchange,
            generateInsights: false // Skip insights in regular analysis to save API calls
          }
        })
      }
    } catch (error) {
      logger.error('Company analysis execution failed:', error)
    }
  }

  /**
   * Execute document discovery
   */
  private async executeDocumentDiscovery(): Promise<void> {
    logger.info('Executing document discovery...')

    try {
      const instrumentsNeedingUpdate = await this.databaseService.getInstrumentsNeedingDocumentUpdate()

      for (const instrument of instrumentsNeedingUpdate.slice(0, 10)) {
        await this.backgroundAgent.addTask({
          type: 'DOCUMENT_DISCOVERY',
          symbol: instrument.symbol,
          companyName: instrument.name,
          priority: 'MEDIUM',
          options: {
            maxDocuments: this.config.documentDiscovery.maxDocuments,
            exchange: instrument.exchange
          }
        })
      }
    } catch (error) {
      logger.error('Document discovery execution failed:', error)
    }
  }

  /**
   * Execute insight generation
   */
  private async executeInsightGeneration(): Promise<void> {
    logger.info('Executing insight generation...')

    try {
      const symbols = this.config.insightGeneration.symbols.length > 0 
        ? this.config.insightGeneration.symbols 
        : await this.getInsightTrackingSymbols()

      for (const symbol of symbols.slice(0, 8)) { // Limit to 8 to avoid overwhelming AI API
        await this.backgroundAgent.addTask({
          type: 'INSIGHT_GENERATION',
          symbol,
          priority: 'HIGH'
        })
      }
    } catch (error) {
      logger.error('Insight generation execution failed:', error)
    }
  }

  /**
   * Execute earnings updates
   */
  private async executeEarningsUpdates(): Promise<void> {
    logger.info('Executing earnings updates...')

    try {
      // Check for companies with earnings today
      const earningsSymbols = await this.databaseService.getEarningsCalendarSymbols()

      for (const symbol of earningsSymbols) {
        await this.backgroundAgent.addTask({
          type: 'DOCUMENT_DISCOVERY',
          symbol,
          priority: 'HIGH',
          options: {
            documentTypes: ['EARNINGS_TRANSCRIPT'],
            maxDocuments: 5
          }
        })
      }
    } catch (error) {
      logger.error('Earnings updates execution failed:', error)
    }
  }

  /**
   * Execute news monitoring
   */
  private async executeNewsMonitoring(): Promise<void> {
    logger.info('Executing news monitoring...')

    try {
      // Monitor news for trending symbols
      const trendingSymbols = await this.getTrendingSymbols()

      for (const symbol of trendingSymbols.slice(0, 8)) {
        const searchResults = await this.backgroundAgent.searchCompanyInformation(symbol, 'news')
        
        // If significant news found, trigger full analysis
        if (searchResults.length > 3) {
          await this.backgroundAgent.addTask({
            type: 'COMPANY_ANALYSIS',
            symbol,
            priority: 'HIGH',
            options: {
              generateInsights: true // Generate insights for trending news
            }
          })
        }
      }
    } catch (error) {
      logger.error('News monitoring execution failed:', error)
    }
  }

  /**
   * Setup special schedules based on market conditions
   */
  private setupMarketConditionSchedules(): void {
    // Pre-market analysis (6:30 AM ET)
    this.addSchedule('preMarketAnalysis', '30 6 * * 1-5', async () => {
      logger.info('Executing pre-market analysis...')
      
      try {
        const preMarketInstruments = await this.databaseService.getPriorityInstruments(15)
        for (const instrument of preMarketInstruments) {
          await this.backgroundAgent.addTask({
            type: 'INSIGHT_GENERATION',
            symbol: instrument.symbol,
            priority: 'HIGH'
          })
        }
      } catch (error) {
        logger.error('Pre-market analysis failed:', error)
      }
    })

    // Post-market analysis (4:30 PM ET)
    this.addSchedule('postMarketAnalysis', '30 16 * * 1-5', async () => {
      logger.info('Executing post-market analysis...')
      
      try {
        const postMarketInstruments = await this.databaseService.getPriorityInstruments(12)
        for (const instrument of postMarketInstruments) {
          await this.backgroundAgent.addTask({
            type: 'COMPANY_ANALYSIS',
            symbol: instrument.symbol,
            priority: 'HIGH',
            options: {
              generateInsights: true
            }
          })
        }
      } catch (error) {
        logger.error('Post-market analysis failed:', error)
      }
    })

    // Weekend deep analysis (Saturday 10 AM)
    this.addSchedule('weekendAnalysis', '0 10 * * 6', async () => {
      logger.info('Executing weekend deep analysis...')
      
      try {
        const allInstruments = await this.databaseService.getActiveInstruments()
        
        await this.backgroundAgent.addTask({
          type: 'MARKET_SCAN',
          priority: 'LOW',
          options: {
            instruments: allInstruments,
            batchSize: 50 // Larger batch for weekend
          }
        })
      } catch (error) {
        logger.error('Weekend analysis failed:', error)
      }
    })
  }

  /**
   * Helper methods to get symbols from database
   */
  private async getInsightTrackingSymbols(): Promise<string[]> {
    try {
      // Get instruments that need insights updates
      const instruments = await this.databaseService.getPriorityInstruments(20)
      return instruments.map(i => i.symbol)
    } catch (error) {
      logger.error('Failed to get insight tracking symbols:', error)
      // Fallback symbols
      return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']
    }
  }

  private async getTrendingSymbols(): Promise<string[]> {
    try {
      // Get instruments with recent market activity
      const instruments = await this.databaseService.getPriorityInstruments(15)
      return instruments.map(i => i.symbol)
    } catch (error) {
      logger.error('Failed to get trending symbols:', error)
      // Fallback trending symbols
      return ['AAPL', 'TSLA', 'NVDA', 'META', 'AMZN']
    }
  }

  /**
   * Cleanup database connection
   */
  async cleanup(): Promise<void> {
    await this.databaseService.disconnect()
  }
} 