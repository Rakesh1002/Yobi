import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import cron from 'node-cron'
import { DataCollectionService } from './services/DataCollectionService'
import { MarketDataScheduler } from './services/MarketDataScheduler'
import { instrumentDiscoveryService } from './services/InstrumentDiscoveryService'
import { createLogger } from './utils/logger'
import { prisma } from '@yobi/database'

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
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    service: 'data-collector',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      'POST /collect/quotes': 'Collect market quotes for specific symbols',
      'POST /collect/active': 'Smart collection - only collect from currently open markets',
      'POST /collect/nasdaq': 'Collect NASDAQ (US market) symbols',
      'POST /collect/nse': 'Collect NSE (Indian market) symbols', 
      'POST /collect/all-exchanges': 'Collect from both US and Indian exchanges',
      'POST /collect/fundamentals': 'Collect fundamental data',
      'POST /analyze/technical': 'Calculate technical indicators',
      'POST /analyze/technical/:symbol': 'Calculate technical indicators for specific symbol',
      'POST /collect/complete': 'Complete data collection workflow (quotes + technical + fundamentals)',
      'GET /scheduler/status': 'Get scheduler status and multi-timezone market hours info',
      'POST /scheduler/test': 'Test scheduler manually'
    }
  })
})

// Scheduler status endpoint
app.get('/scheduler/status', (req: Request, res: Response) => {
  try {
    const status = scheduler.getScheduleStatus()
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to get scheduler status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    })
  }
})

// Test scheduler logic endpoint
app.post('/scheduler/test', async (req: Request, res: Response) => {
  try {
    logger.info('Manual scheduler test triggered')
    await scheduler.triggerQuotesCollection()
    res.json({
      success: true,
      message: 'Test scheduler triggered successfully'
    })
  } catch (error) {
    logger.error('Test scheduler failed:', error)
    res.status(500).json({
      success: false,
      error: 'Test scheduler failed'
    })
  }
})

// Exchange-specific collection endpoints
app.post('/collect/nasdaq', async (req: Request, res: Response) => {
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

app.post('/collect/nse', async (req: Request, res: Response) => {
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

app.post('/collect/all-exchanges', async (req: Request, res: Response) => {
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
app.post('/collect/quotes', async (req: Request, res: Response) => {
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

// Smart collection - only collect from currently active markets
app.post('/collect/active', async (req: Request, res: Response) => {
  try {
    logger.info('Active market collection requested')
    
    await dataCollectionService.collectActiveMarketQuotes()
    
    res.json({
      success: true,
      message: 'Active market collection completed'
    })
  } catch (error) {
    logger.error('Active market collection failed:', error)
    res.status(500).json({
      success: false,
      error: 'Active market collection failed'
    })
  }
})

app.post('/collect/historical', async (req: Request, res: Response) => {
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

// Calculate technical indicators
app.post('/analyze/technical', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body
    const symbolList = symbols || ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
    
    logger.info(`Technical analysis requested for ${symbolList.length} symbols`)
    
    await dataCollectionService.calculateTechnicalIndicators(symbolList)
    
    res.json({
      success: true,
      message: `Technical indicators calculated for ${symbolList.length} symbols`,
      symbols: symbolList,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Technical analysis failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Technical analysis failed',
      timestamp: new Date().toISOString()
    })
  }
})

// Calculate technical indicators for specific symbol
app.post('/analyze/technical/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol parameter is required'
      })
    }
    
    logger.info(`Technical analysis requested for ${symbol}`)
    
    await dataCollectionService.calculateIndicatorsForSymbol(symbol.toUpperCase())
    
    res.json({
      success: true,
      message: `Technical indicators calculated for ${symbol}`,
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error(`Technical analysis failed for ${req.params.symbol}:`, error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Technical analysis failed',
      timestamp: new Date().toISOString()
    })
  }
})

// Complete data collection workflow
app.post('/collect/complete', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body
    const symbolList = symbols || ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
    
    logger.info(`Complete data collection requested for ${symbolList.length} symbols`)
    
    await dataCollectionService.collectCompleteDataset(symbolList)
    
    res.json({
      success: true,
      message: `Complete data collection finished for ${symbolList.length} symbols`,
      symbols: symbolList,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Complete data collection failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Complete data collection failed',
      timestamp: new Date().toISOString()
    })
  }
})

// Dynamic instrument discovery - add new instrument when user searches
app.post('/discover/instrument', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol is required'
      })
    }
    
    logger.info(`Discovering instrument: ${symbol}`)
    
    await dataCollectionService.discoverAndTrackInstrument(symbol.toUpperCase())
    
    res.json({
      success: true,
      message: `Instrument ${symbol} discovered and added to tracking`,
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('Instrument discovery failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Instrument discovery failed'
    })
  }
})

// Maintain top 1000 instruments by volume and user interest
app.post('/discover/maintain-top', async (req: Request, res: Response) => {
  try {
    logger.info('Maintaining top instruments list')
    
    await dataCollectionService.maintainTopInstruments()
    
    res.json({
      success: true,
      message: 'Top instruments list maintained successfully',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('Top instruments maintenance failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Top instruments maintenance failed'
    })
  }
})

// Get current tracked instruments
app.get('/discover/tracked', async (req: Request, res: Response) => {
  try {
    const trackedInstruments = await instrumentDiscoveryService.getTrackedInstruments()
    
    res.json({
      success: true,
      data: {
        instruments: trackedInstruments,
        count: trackedInstruments.length,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    logger.error('Failed to get tracked instruments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get tracked instruments'
    })
  }
})

// Collect quotes for top volume instruments
app.post('/collect/top-volume', async (req: Request, res: Response) => {
  try {
    logger.info('Collecting quotes for top volume instruments')
    
    await dataCollectionService.collectTopVolumeQuotes()
    
    res.json({
      success: true,
      message: 'Top volume quotes collection completed',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('Top volume collection failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Top volume collection failed'
    })
  }
})

// Schedule automated data collection
scheduler.start()

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down...`)
  
  // Disconnect from Prisma
  try {
    await prisma.$disconnect()
    logger.info('Prisma client disconnected')
  } catch (e) {
    logger.error('Error disconnecting Prisma client', e)
  }

  // Stop the scheduler
  try {
    scheduler.stop()
    logger.info('Market data scheduler stopped')
  } catch (e) {
    logger.error('Error stopping scheduler', e)
  }

  // Add any other cleanup logic here

  process.exit(0)
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// Start server
const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  logger.info(`🚀 Data Collector Service running on port ${PORT}`)
  logger.info(`📊 Health check: http://localhost:${PORT}/health`)
  logger.info(`⏰ Scheduled data collection started`)
})

export default app 