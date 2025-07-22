import express, { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error'
import { RankingsService } from '../services/rankings.service'
import { ClaudeService } from '../services/claude.service'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'instruments-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

const router: express.Router = Router()
const rankingsService = new RankingsService()
const claudeService = new ClaudeService(logger)

// Get specific instrument details with full analysis
router.get('/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter is required'
    })
  }

  logger.info(`Fetching details for instrument: ${symbol}`)

  try {
    // Get basic ranking data
    const ranking = await rankingsService.getInstrumentRanking(symbol.toUpperCase())
    
    // Generate AI-powered recommendation using Claude
    let recommendation = null
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        logger.info(`Generating AI recommendation for ${symbol}`)
        const analysis = await claudeService.generateInstrumentAnalysis(
          {
            symbol: ranking.symbol,
            name: ranking.name || ranking.symbol,
            exchange: ranking.exchange || 'Unknown',
            sector: ranking.sector || 'Unknown'
          },
          {
            close: ranking.price,
            changePercent: ranking.change24h,
            volume: ranking.volume
          },
          {
            technicalScore: ranking.technicalScore || 0,
            fundamentalScore: ranking.fundamentalScore || 0,
            momentumScore: ranking.momentumScore || 0
          }
        )
        
        recommendation = {
          action: ranking.signal.includes('BUY') ? 'BUY' : ranking.signal.includes('SELL') ? 'SELL' : 'HOLD',
          targetPrice: analysis.targetPrice,
          stopLoss: analysis.stopLoss,
          timeHorizon: 'MEDIUM_TERM',
          confidence: analysis.confidence,
          rationale: analysis.rationale,
          keyPoints: analysis.keyPoints,
          risks: analysis.risks
        }
        logger.info(`Successfully generated AI recommendation for ${symbol}`)
      } else {
        logger.warn('ANTHROPIC_API_KEY not found, using fallback recommendation')
        throw new Error('No API key')
      }
    } catch (error) {
      logger.warn(`Failed to generate AI recommendation for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Fallback recommendation
      recommendation = {
        action: ranking.signal.includes('BUY') ? 'BUY' : ranking.signal.includes('SELL') ? 'SELL' : 'HOLD',
        targetPrice: ranking.price * (ranking.signal.includes('BUY') ? 1.15 : 0.95),
        stopLoss: ranking.price * (ranking.signal.includes('BUY') ? 0.92 : 1.08),
        timeHorizon: 'MEDIUM_TERM',
        confidence: Math.min(95, Math.max(60, ranking.score + 20)),
        rationale: `Based on technical analysis (${ranking.technicalScore}/100) and fundamental evaluation (${ranking.fundamentalScore}/100), ${ranking.symbol} shows ${ranking.signal.toLowerCase()} characteristics with an expected return of ${ranking.expectedReturn}%.`,
        keyPoints: [
          `Technical score: ${ranking.technicalScore}/100`,
          `Fundamental score: ${ranking.fundamentalScore}/100`,
          `Market momentum: ${ranking.momentumScore}/100`,
          `Trading volume: ${ranking.volume.toLocaleString()}`
        ],
        risks: [
          'Market volatility may affect price movements',
          'Economic conditions could impact sector performance',
          'Company-specific events may influence stock price',
          'Currency fluctuations (for international markets)'
        ]
      }
    }

    // Format response for frontend
    const instrumentDetail = {
      symbol: ranking.symbol,
      name: ranking.name,
      exchange: getExchangeFromSymbol(ranking.symbol), // Helper function
      price: ranking.price,
      change24h: ranking.change24h,
      volume: ranking.volume,
      marketCap: ranking.marketCap,
      sector: ranking.sector,
      technicalScore: ranking.technicalScore || 0,
      fundamentalScore: ranking.fundamentalScore || 0,
      momentumScore: ranking.momentumScore || 0,
      totalScore: ranking.score,
      signal: ranking.signal,
      expectedReturn: ranking.expectedReturn,
      recommendation
    }

    logger.info(`Successfully generated details for ${symbol}`)
    
    res.json(instrumentDetail)

  } catch (error) {
    logger.error(`Failed to fetch instrument details for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    res.status(404).json({
      success: false,
      error: `Instrument ${symbol} not found or could not be analyzed`
    })
  }
}))

// Get instrument technical analysis
router.get('/:symbol/technical', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter is required'
    })
  }
  
  logger.info(`Fetching technical analysis for: ${symbol}`)

  try {
    const ranking = await rankingsService.getInstrumentRanking(symbol.toUpperCase())
    
    // TODO: Implement detailed technical indicators
    const technicalAnalysis = {
      symbol: ranking.symbol,
      rsi: ranking.technicalScore, // Placeholder
      macd: {
        signal: ranking.signal === 'BUY' ? 'bullish' : ranking.signal === 'SELL' ? 'bearish' : 'neutral',
        histogram: 0
      },
      movingAverages: {
        ma20: ranking.price * 0.98, // Simplified
        ma50: ranking.price * 0.95,
        ma200: ranking.price * 0.90
      },
      support: ranking.price * 0.95,
      resistance: ranking.price * 1.05,
      trend: ranking.signal === 'BUY' ? 'bullish' : ranking.signal === 'SELL' ? 'bearish' : 'sideways'
    }

    res.json({
      success: true,
      data: technicalAnalysis
    })

  } catch (error) {
    logger.error(`Failed to fetch technical analysis for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    res.status(404).json({
      success: false,
      error: `Technical analysis for ${symbol} not available`
    })
  }
}))

// Get instrument fundamental analysis
router.get('/:symbol/fundamentals', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter is required'
    })
  }
  
  logger.info(`Fetching fundamental analysis for: ${symbol}`)

  try {
    const ranking = await rankingsService.getInstrumentRanking(symbol.toUpperCase())
    
    // TODO: Fetch actual fundamental data from database
    const fundamentals = {
      symbol: ranking.symbol,
      peRatio: Math.random() * 30 + 10, // Placeholder
      pbRatio: Math.random() * 5 + 1,
      debtToEquity: Math.random() * 1.5,
      roe: Math.random() * 0.3,
      currentRatio: Math.random() * 3 + 1,
      revenueGrowth: Math.random() * 0.5 - 0.1,
      epsGrowth: Math.random() * 0.6 - 0.2,
      dividendYield: Math.random() * 0.05,
      marketCap: ranking.marketCap,
      fundamentalScore: ranking.fundamentalScore
    }

    res.json({
      success: true,
      data: fundamentals
    })

  } catch (error) {
    logger.error(`Failed to fetch fundamentals for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    res.status(404).json({
      success: false,
      error: `Fundamental data for ${symbol} not available`
    })
  }
}))

// Helper function to determine exchange from symbol
function getExchangeFromSymbol(symbol: string): string {
  // List of NSE symbols (should match the one in data collector)
  const nseSymbols = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 
    'KOTAKBANK', 'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'ASIANPAINT', 
    'AXISBANK', 'MARUTI', 'BAJFINANCE', 'HCLTECH', 'WIPRO', 'ULTRACEMCO',
    'TITAN', 'NESTLEIND', 'POWERGRID', 'NTPC', 'COALINDIA', 'DRREDDY',
    'SUNPHARMA', 'TECHM', 'ONGC', 'TATAMOTORS', 'BAJAJFINSV', 'INDUSINDBK',
    'JSWSTEEL', 'HINDALCO', 'GRASIM', 'BRITANNIA', 'CIPLA', 'HEROMOTOCO',
    'EICHERMOT', 'BPCL', 'SHREECEM', 'DIVISLAB', 'ADANIPORTS', 'TATACONSUM',
    'APOLLOHOSP', 'UPL', 'TATASTEEL', 'BAJAJ-AUTO', 'HDFCLIFE', 'SBILIFE',
    'ADANIENT', 'VEDL', 'GODREJCP', 'ADANIGREEN'
  ]
  
  return nseSymbols.includes(symbol.toUpperCase()) ? 'NSE' : 'NASDAQ'
}

export default router 