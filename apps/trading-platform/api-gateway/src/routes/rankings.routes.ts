import express, { Router, Request, Response } from 'express'
import { query } from 'express-validator'
import { asyncHandler } from '../middleware/error'
import { rankingsService } from '../services/rankings.service'
import { ApiError } from '../middleware/error'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'rankings-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

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

// GET /api/rankings - Get instrument rankings
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
  query('exchange').optional().isIn(['ALL', 'NSE', 'NASDAQ', 'NYSE']).withMessage('Invalid exchange'),
  query('assetClass').optional().isIn(['ALL', 'STOCK', 'ETF', 'MUTUAL_FUND']).withMessage('Invalid asset class'),
  query('signal').optional().isIn(['ALL', 'STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']).withMessage('Invalid signal'),
  validateRequest
], asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching instrument rankings', { 
    query: req.query,
    timestamp: new Date().toISOString()
  })

  try {
    // Extract and validate query parameters
    const sector = typeof req.query.sector === 'string' ? req.query.sector : undefined
    const assetClass = typeof req.query.assetClass === 'string' ? req.query.assetClass : undefined
    const exchange = typeof req.query.exchange === 'string' ? req.query.exchange : undefined
    const signal = typeof req.query.signal === 'string' ? req.query.signal : undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined

    const filters = {
      ...(sector && { sector }),
      ...(assetClass && { assetClass }),
      ...(exchange && exchange !== 'ALL' && { exchange }),
      ...(signal && signal !== 'ALL' && { signal }),
      ...(limit && { limit })
    }

    try {
      const rankingsData = await rankingsService.getRankings(filters)
      
      // Data is already limited in the service, but ensure we have the right structure
      const rankings = rankingsData.data

      res.json({
        success: true,
        data: rankings,
        meta: {
          ...rankingsData.meta,
          returned: rankings.length
        }
      })
    } catch (serviceError) {
      logger.error('Rankings service error:', serviceError)
      throw new ApiError('Failed to fetch rankings from service', 500)
    }
  } catch (error) {
    logger.error('Rankings request failed:', error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError('Unable to fetch rankings', 500)
  }
}))

// GET /api/rankings/stats - Get ranking statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching ranking statistics')
  
  try {
    const stats = await rankingsService.getStats()
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Failed to fetch ranking stats:', error)
    throw new ApiError('Unable to fetch ranking statistics', 500)
  }
}))

// GET /api/rankings/:symbol - Get specific instrument ranking
router.get('/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    throw new ApiError('Symbol parameter is required', 400)
  }

  try {
    const ranking = await rankingsService.getInstrumentRanking(symbol.toUpperCase())
    
    if (!ranking) {
      throw new ApiError(`No ranking found for symbol: ${symbol}`, 404)
    }
    
    res.json({
      success: true,
      data: ranking
    })
  } catch (error) {
    logger.error(`Failed to fetch ranking for ${symbol}:`, error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(`Unable to fetch ranking for ${symbol}`, 500)
  }
}))

// POST /api/rankings/refresh - Refresh rankings cache (admin only)
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Add admin authentication middleware
  try {
    await rankingsService.clearCache()
    
    res.json({
      success: true,
      message: 'Rankings cache cleared successfully'
    })
  } catch (error) {
    logger.error('Failed to clear rankings cache:', error)
    throw new ApiError('Unable to refresh rankings', 500)
  }
}))

// GET /api/rankings/cache/stats - Get cache statistics
router.get('/cache/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await rankingsService.getCacheStats()
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Failed to get cache stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics'
    })
  }
}))

// POST /api/rankings/cache/refresh - Manually refresh cache
router.post('/cache/refresh', asyncHandler(async (req: Request, res: Response) => {
  try {
    await rankingsService.refreshRankingsCache()
    res.json({
      success: true,
      message: 'Rankings cache refreshed successfully'
    })
  } catch (error) {
    logger.error('Failed to refresh cache:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache'
    })
  }
}))

// POST /api/rankings/cache/invalidate - Invalidate cache
router.post('/cache/invalidate', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { filters } = req.body
    
    if (filters) {
      await rankingsService.invalidateRankingsCache(filters)
      res.json({
        success: true,
        message: 'Specific cache entries invalidated'
      })
    } else {
      await rankingsService.invalidateAllRankingsCache()
      res.json({
        success: true,
        message: 'All rankings cache invalidated'
      })
    }
  } catch (error) {
    logger.error('Failed to invalidate cache:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache'
    })
  }
}))

export default router 