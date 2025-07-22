import express from 'express'
import dotenv from 'dotenv'
import cron from 'node-cron'
import { DataCollectionService } from './services/DataCollectionService'
import { MarketDataScheduler } from './services/MarketDataScheduler'
import { createLogger } from './utils/logger'

// Load environment variables
dotenv.config()

// Configure logger
const logger = createLogger('data-collector')

// Console transport is already configured in the shared logger

const app: express.Express = express()
const dataCollectionService = new DataCollectionService()
const scheduler = new MarketDataScheduler(dataCollectionService)

// Middleware
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Data Collector Service',
    version: '1.0.0'
  })
})

// Exchange-specific collection endpoints
app.post('/collect/nasdaq', async (req, res) => {
  try {
    logger.info('Starting NASDAQ quote collection')
    await dataCollectionService.collectNasdaqQuotes()
    res.json({ success: true, message: 'NASDAQ quote collection completed' })
  } catch (error) {
    logger.error('NASDAQ quote collection failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

app.post('/collect/nse', async (req, res) => {
  try {
    logger.info('Starting NSE quote collection')
    await dataCollectionService.collectNseQuotes()
    res.json({ success: true, message: 'NSE quote collection completed' })
  } catch (error) {
    logger.error('NSE quote collection failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

app.post('/collect/all-exchanges', async (req, res) => {
  try {
    logger.info('Starting collection for all exchanges')
    await dataCollectionService.collectAllExchangeQuotes()
    res.json({ success: true, message: 'All exchanges quote collection completed' })
  } catch (error) {
    logger.error('All exchanges quote collection failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Manual quote collection with symbols (existing endpoint)
app.post('/collect/quotes', async (req, res) => {
  try {
    const { symbols } = req.body
    logger.info(`Manual quote collection requested for symbols: ${symbols?.join(', ') || 'all'}`)
    
    await dataCollectionService.collectQuotes(symbols)
    
    res.json({
      success: true,
      message: 'Quote collection completed'
    })
  } catch (error) {
    logger.error('Manual quote collection failed:', error)
    res.status(500).json({
      success: false,
      error: 'Quote collection failed'
    })
  }
})

app.post('/collect/historical', async (req, res) => {
  try {
    const { symbols, period = '1y' } = req.body
    logger.info(`Manual historical data collection requested for symbols: ${symbols?.join(', ') || 'all'}`)
    
    await dataCollectionService.collectHistoricalData(symbols, period)
    
    res.json({
      success: true,
      message: 'Historical data collection completed'
    })
  } catch (error) {
    logger.error('Manual historical data collection failed:', error)
    res.status(500).json({
      success: false,
      error: 'Historical data collection failed'
    })
  }
})

// Schedule automated data collection
scheduler.start()

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  scheduler.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  scheduler.stop()
  process.exit(0)
})

// Start server
const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  logger.info(`🚀 Data Collector Service running on port ${PORT}`)
  logger.info(`📊 Health check: http://localhost:${PORT}/health`)
  logger.info(`⏰ Scheduled data collection started`)
})

export default app 