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

    // US Market quotes during market hours (every 1 minute)
    const usQuotesTask = cron.schedule('*/1 * * * *', async () => {
      const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.DATA_COLLECTOR_DEV_MODE === 'true'
      const isUSMarketOpen = this.isUSMarketHours()
      const shouldCollect = isDevelopmentMode || isUSMarketOpen
      
      logger.debug(`US Market collection check: isDev=${isDevelopmentMode}, marketOpen=${isUSMarketOpen}, shouldCollect=${shouldCollect}`)
      
      if (shouldCollect) {
        const mode = isDevelopmentMode && !isUSMarketOpen ? '(DEV MODE)' : ''
        logger.info(`Scheduled US market quotes collection starting ${mode}`)
        try {
          await this.dataCollectionService.collectNasdaqQuotes()
          logger.info(`Scheduled US market quotes collection completed ${mode}`)
        } catch (error) {
          logger.error('Scheduled US market quotes collection failed:', error)
        }
      }
    }, {
      scheduled: false
    })

    // Indian Market quotes during market hours (every 1 minute)
    const inQuotesTask = cron.schedule('*/1 * * * *', async () => {
      const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.DATA_COLLECTOR_DEV_MODE === 'true'
      const isIndianMarketOpen = this.isIndianMarketHours()
      const shouldCollect = isDevelopmentMode || isIndianMarketOpen
      
      logger.debug(`Indian Market collection check: isDev=${isDevelopmentMode}, marketOpen=${isIndianMarketOpen}, shouldCollect=${shouldCollect}`)
      
      if (shouldCollect) {
        const mode = isDevelopmentMode && !isIndianMarketOpen ? '(DEV MODE)' : ''
        logger.info(`Scheduled Indian market quotes collection starting ${mode}`)
        try {
          await this.dataCollectionService.collectNseQuotes()
          logger.info(`Scheduled Indian market quotes collection completed ${mode}`)
        } catch (error) {
          logger.error('Scheduled Indian market quotes collection failed:', error)
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

    // Dynamic instrument discovery maintenance (every 2 hours)
    const discoveryTask = cron.schedule('0 */2 * * *', async () => {
      logger.info('Scheduled instrument discovery maintenance starting')
      try {
        await this.dataCollectionService.maintainTopInstruments()
        logger.info('Scheduled instrument discovery maintenance completed')
      } catch (error) {
        logger.error('Scheduled instrument discovery maintenance failed:', error)
      }
    }, {
      scheduled: false
    })

    // Collect top volume quotes (every 30 minutes during market hours)
    const topVolumeTask = cron.schedule('*/30 * * * *', async () => {
      const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.DATA_COLLECTOR_DEV_MODE === 'true'
      const isAnyMarketOpen = this.isUSMarketHours() || this.isIndianMarketHours()
      const shouldCollect = isDevelopmentMode || isAnyMarketOpen
      
      if (shouldCollect) {
        const mode = isDevelopmentMode && !isAnyMarketOpen ? '(DEV MODE)' : ''
        logger.info(`Scheduled top volume collection starting ${mode}`)
        try {
          await this.dataCollectionService.collectTopVolumeQuotes()
          logger.info(`Scheduled top volume collection completed ${mode}`)
        } catch (error) {
          logger.error('Scheduled top volume collection failed:', error)
        }
      }
    }, {
      scheduled: false
    })

    // Start all tasks
    usQuotesTask.start()
    inQuotesTask.start()
    historicalTask.start()
    fundamentalTask.start()
    healthTask.start()
    discoveryTask.start()
    topVolumeTask.start()

    // Store references for later cleanup
    this.scheduledTasks.set('usQuotes', usQuotesTask)
    this.scheduledTasks.set('inQuotes', inQuotesTask)
    this.scheduledTasks.set('historical', historicalTask)
    this.scheduledTasks.set('fundamental', fundamentalTask)
    this.scheduledTasks.set('health', healthTask)
    this.scheduledTasks.set('discovery', discoveryTask)
    this.scheduledTasks.set('topVolume', topVolumeTask)

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
    // Check both US and Indian markets
    return this.isUSMarketHours() || this.isIndianMarketHours()
  }

  private isUSMarketHours(): boolean {
    const now = new Date()
    
    // Use Eastern Time for US markets (NYSE, NASDAQ)
    const easternTimeString = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    // Extract day of week from the string (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    const weekdayMatch = easternTimeString.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)
    const isWeekend = weekdayMatch && (weekdayMatch[1] === 'Sat' || weekdayMatch[1] === 'Sun')
    
    // Extract hour and minute using regex
    const timeMatch = easternTimeString.match(/(\d{2}):(\d{2})/)
    if (!timeMatch || !timeMatch[1] || !timeMatch[2]) {
      logger.debug('Could not parse Eastern time')
      return false
    }
    
    const hour = parseInt(timeMatch[1], 10)
    const minute = parseInt(timeMatch[2], 10)
    const timeInMinutes = hour * 60 + minute

    logger.debug(`US Market check: UTC=${now.toISOString()}, ET=${easternTimeString}, hour=${hour}, minute=${minute}, weekend=${isWeekend}`)

    // Market is closed on weekends
    if (isWeekend) {
      return false
    }

    // US Market hours: 9:30 AM - 4:00 PM ET
    const marketOpen = 9 * 60 + 30  // 9:30 AM in minutes
    const marketClose = 16 * 60     // 4:00 PM in minutes

    const isOpen = timeInMinutes >= marketOpen && timeInMinutes <= marketClose
    logger.debug(`US Market hours: ${isOpen} (${timeInMinutes} vs ${marketOpen}-${marketClose})`)
    
    return isOpen
  }

  private isIndianMarketHours(): boolean {
    const now = new Date()
    
    // Use Indian Standard Time for NSE
    const istTimeString = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    // Extract day of week from the string (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    const weekdayMatch = istTimeString.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)
    const isWeekend = weekdayMatch && (weekdayMatch[1] === 'Sat' || weekdayMatch[1] === 'Sun')
    
    // Extract hour and minute using regex
    const timeMatch = istTimeString.match(/(\d{2}):(\d{2})/)
    if (!timeMatch || !timeMatch[1] || !timeMatch[2]) {
      logger.debug('Could not parse Indian time')
      return false
    }
    
    const hour = parseInt(timeMatch[1], 10)
    const minute = parseInt(timeMatch[2], 10)
    const timeInMinutes = hour * 60 + minute

    logger.debug(`Indian Market check: UTC=${now.toISOString()}, IST=${istTimeString}, hour=${hour}, minute=${minute}, weekend=${isWeekend}`)

    // Market is closed on weekends
    if (isWeekend) {
      return false
    }

    // Indian Market hours: 9:00 AM - 4:00 PM IST
    const marketOpen = 9 * 60       // 9:00 AM in minutes
    const marketClose = 16 * 60     // 4:00 PM in minutes

    const isOpen = timeInMinutes >= marketOpen && timeInMinutes <= marketClose
    logger.debug(`Indian Market hours: ${isOpen} (${timeInMinutes} vs ${marketOpen}-${marketClose})`)
    
    return isOpen
  }

  private isMarketDay(): boolean {
    return this.isUSMarketDay() || this.isIndianMarketDay()
  }

  private isUSMarketDay(): boolean {
    const now = new Date()
    const easternTimeString = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short'
    })
    
    // Check if it's a weekday (Mon-Fri)
    const weekdayMatch = easternTimeString.match(/^(Mon|Tue|Wed|Thu|Fri)/)
    return !!weekdayMatch
  }

  private isIndianMarketDay(): boolean {
    const now = new Date()
    const istTimeString = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short'
    })
    
    // Check if it's a weekday (Mon-Fri)
    const weekdayMatch = istTimeString.match(/^(Mon|Tue|Wed|Thu|Fri)/)
    return !!weekdayMatch
  }

  getScheduleStatus(): any {
    const now = new Date()
    const status: any = {
      isRunning: this.scheduledTasks.size > 0,
      tasks: {},
      marketInfo: {
        combined: {
          isMarketHours: this.isMarketHours(),
          isMarketDay: this.isMarketDay()
        },
        us: {
          isMarketHours: this.isUSMarketHours(),
          isMarketDay: this.isUSMarketDay(),
          currentTime: now.toLocaleString("en-US", {timeZone: "America/New_York"}),
          timeZone: "America/New_York (ET)",
          tradingHours: "9:30 AM - 4:00 PM ET"
        },
        indian: {
          isMarketHours: this.isIndianMarketHours(),
          isMarketDay: this.isIndianMarketDay(),
          currentTime: now.toLocaleString("en-IN", {timeZone: "Asia/Kolkata"}),
          timeZone: "Asia/Kolkata (IST)",
          tradingHours: "9:00 AM - 4:00 PM IST"
        },
        utc: {
          currentTime: now.toISOString()
        }
      },
      development: {
        devMode: process.env.NODE_ENV === 'development' || process.env.DATA_COLLECTOR_DEV_MODE === 'true',
        nodeEnv: process.env.NODE_ENV,
        devModeEnv: process.env.DATA_COLLECTOR_DEV_MODE
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