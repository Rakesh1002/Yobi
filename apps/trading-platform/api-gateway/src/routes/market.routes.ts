import express, { Router, Request, Response } from 'express'
import { query } from 'express-validator'
import { asyncHandler } from '../middleware/error'
import { marketDataService } from '../services/market.service'
import { ApiError } from '../middleware/error'

const router: express.Router = Router()

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const { validationResult } = require('express-validator')
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }
  next()
}

// GET /api/market/quote/:symbol - Get current quote
router.get('/quote/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    throw new ApiError('Symbol parameter is required', 400)
  }

  try {
    const quote = await marketDataService.getQuote(symbol)
    
    res.json({
      success: true,
      data: quote
    })
  } catch (error) {
    throw new ApiError(`Unable to fetch quote for ${symbol}`, 500)
  }
}))

// GET /api/market/historical/:symbol - Get historical data
router.get('/historical/:symbol', 
  [
    query('period')
      .optional()
      .isIn(['1d', '5d', '1m', '3m', '6m', '1y', '2y', '5y'])
      .withMessage('Period must be one of: 1d, 5d, 1m, 3m, 6m, 1y, 2y, 5y'),
    query('interval')
      .optional()
      .isIn(['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo'])
      .withMessage('Interval must be valid time interval')
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params
    const { period = '1y', interval = '1d' } = req.query
    
    if (!symbol) {
      throw new ApiError('Symbol parameter is required', 400)
    }

    try {
      const historicalData = await marketDataService.getHistoricalData(
        symbol, 
        period as string, 
        interval as string
      )
      
      res.json({
        success: true,
        data: historicalData
      })
    } catch (error) {
      throw new ApiError(`Unable to fetch historical data for ${symbol}`, 500)
    }
  })
)

// GET /api/market/search - Search instruments
router.get('/search',
  [
    query('q')
      .notEmpty()
      .isLength({ min: 1, max: 50 })
      .withMessage('Query parameter "q" is required and must be 1-50 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { q: query, limit = 10 } = req.query
    
    try {
      const results = await marketDataService.searchInstruments(
        query as string, 
        Number(limit)
      )
      
      res.json({
        success: true,
        data: results,
        metadata: {
          query,
          total: results.length,
          limit: Number(limit)
        }
      })
    } catch (error) {
      throw new ApiError('Unable to search instruments', 500)
    }
  })
)

export default router 