import cron from 'node-cron'
import { DataCollectionService } from './DataCollectionService'
import { createLogger } from '../utils/logger'

const logger = createLogger('market-data-scheduler')

export class MarketDataScheduler {
  private dataCollectionService: DataCollectionService
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map()

  constructor(dataCollectionService: DataCollectionService) {
    this.dataCollectionService = dataCollectionService
  }

  start(): void {
    logger.info('Starting market data scheduler')

    // Real-time quotes during market hours (every 1 minute)
    const quotesTask = cron.schedule('*/1 * * * *', async () => {
      if (this.isMarketHours()) {
        logger.info('Scheduled quotes collection starting')
        try {
          await this.dataCollectionService.collectQuotes()
          logger.info('Scheduled quotes collection completed')
        } catch (error) {
          logger.error('Scheduled quotes collection failed:', error)
        }
      }
    }, {
      scheduled: false
    })

    // Historical data update (daily at 6 PM ET when markets close)
    const historicalTask = cron.schedule('0 18 * * 1-5', async () => {
      logger.info('Scheduled historical data collection starting')
      try {
        await this.dataCollectionService.collectHistoricalData()
        logger.info('Scheduled historical data collection completed')
      } catch (error) {
        logger.error('Scheduled historical data collection failed:', error)
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    })

    // Fundamental data update (weekly on Sunday at midnight)
    const fundamentalTask = cron.schedule('0 0 * * 0', async () => {
      logger.info('Scheduled fundamental data collection starting')
      try {
        await this.dataCollectionService.collectFundamentalData()
        logger.info('Scheduled fundamental data collection completed')
      } catch (error) {
        logger.error('Scheduled fundamental data collection failed:', error)
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    })

    // Health check (every 10 minutes)
    const healthTask = cron.schedule('*/10 * * * *', async () => {
      try {
        const status = await this.dataCollectionService.getProviderStatus()
        logger.info('Provider status check:', status)
      } catch (error) {
        logger.error('Health check failed:', error)
      }
    }, {
      scheduled: false
    })

    // Start all tasks
    quotesTask.start()
    historicalTask.start()
    fundamentalTask.start()
    healthTask.start()

    // Store references for later cleanup
    this.scheduledTasks.set('quotes', quotesTask)
    this.scheduledTasks.set('historical', historicalTask)
    this.scheduledTasks.set('fundamental', fundamentalTask)
    this.scheduledTasks.set('health', healthTask)

    logger.info('All scheduled tasks started')
  }

  stop(): void {
    logger.info('Stopping market data scheduler')
    
    this.scheduledTasks.forEach((task, name) => {
      task.stop()
      logger.info(`Stopped task: ${name}`)
    })
    
    this.scheduledTasks.clear()
    logger.info('All scheduled tasks stopped')
  }

  // Immediate collection triggers
  async triggerQuotesCollection(): Promise<void> {
    logger.info('Manual quotes collection triggered')
    try {
      await this.dataCollectionService.collectQuotes()
      logger.info('Manual quotes collection completed')
    } catch (error) {
      logger.error('Manual quotes collection failed:', error)
      throw error
    }
  }

  async triggerHistoricalCollection(): Promise<void> {
    logger.info('Manual historical data collection triggered')
    try {
      await this.dataCollectionService.collectHistoricalData()
      logger.info('Manual historical data collection completed')
    } catch (error) {
      logger.error('Manual historical data collection failed:', error)
      throw error
    }
  }

  async triggerFundamentalCollection(): Promise<void> {
    logger.info('Manual fundamental data collection triggered')
    try {
      await this.dataCollectionService.collectFundamentalData()
      logger.info('Manual fundamental data collection completed')
    } catch (error) {
      logger.error('Manual fundamental data collection failed:', error)
      throw error
    }
  }

  private isMarketHours(): boolean {
    const now = new Date()
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    
    const day = easternTime.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = easternTime.getHours()
    const minute = easternTime.getMinutes()
    const timeInMinutes = hour * 60 + minute

    // Market is closed on weekends
    if (day === 0 || day === 6) {
      return false
    }

    // US Market hours: 9:30 AM - 4:00 PM ET
    const marketOpen = 9 * 60 + 30  // 9:30 AM in minutes
    const marketClose = 16 * 60     // 4:00 PM in minutes

    return timeInMinutes >= marketOpen && timeInMinutes <= marketClose
  }

  private isMarketDay(): boolean {
    const now = new Date()
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    const day = easternTime.getDay()

    // Monday = 1, Friday = 5
    return day >= 1 && day <= 5
  }

  getScheduleStatus(): any {
    const status: any = {
      isRunning: this.scheduledTasks.size > 0,
      tasks: {},
      marketInfo: {
        isMarketHours: this.isMarketHours(),
        isMarketDay: this.isMarketDay(),
        currentTime: new Date().toISOString(),
        easternTime: new Date().toLocaleString("en-US", {timeZone: "America/New_York"})
      }
    }

    this.scheduledTasks.forEach((task, name) => {
      status.tasks[name] = {
        running: task !== null && task !== undefined
      }
    })

    return status
  }

  // Override schedules for testing/development
  setTestMode(enabled: boolean): void {
    if (enabled) {
      logger.info('Enabling test mode - more frequent collection')
      this.stop()
      
      // More frequent collection for testing (every 30 seconds)
      const testTask = cron.schedule('*/30 * * * * *', async () => {
        logger.info('Test mode quotes collection starting')
        try {
          // Collect only a few symbols for testing
          await this.dataCollectionService.collectQuotes(['AAPL', 'GOOGL', 'MSFT', 'TSLA'])
          logger.info('Test mode quotes collection completed')
        } catch (error) {
          logger.error('Test mode quotes collection failed:', error)
        }
      }, {
        scheduled: false
      })

      testTask.start()
      this.scheduledTasks.set('test', testTask)
      
      logger.info('Test mode enabled')
    } else {
      logger.info('Disabling test mode')
      this.stop()
      this.start()
    }
  }
} 