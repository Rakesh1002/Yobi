import express, { Router, Request, Response } from 'express'
import { query } from 'express-validator'
import { asyncHandler } from '../middleware/error'
import { rankingsService } from '../services/rankings.service'
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

// GET /api/rankings - Get instrument rankings
router.get('/', 
  [
    query('sector')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Sector filter must be 1-50 characters'),
    query('assetClass')
      .optional()
      .isIn(['STOCK', 'ETF', 'MUTUAL_FUND', 'CRYPTOCURRENCY', 'CURRENCY'])
      .withMessage('Asset class must be valid type'),
    query('exchange')
      .optional()
      .isIn(['NSE', 'NASDAQ', 'NYSE', 'ALL'])
      .withMessage('Exchange must be NSE, NASDAQ, NYSE, or ALL'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200')
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { sector, assetClass, exchange, limit } = req.query
    
    const filters = {
      ...(sector && { sector }),
      ...(assetClass && { assetClass }),
      ...(exchange && exchange !== 'ALL' && { exchange }),
      ...(limit && { limit: Number(limit) })
    }

    try {
      const rankingsData = await rankingsService.getRankings(filters)
      
      // Apply limit if specified
      let rankings = rankingsData.rankings
      if (limit) {
        rankings = rankings.slice(0, Number(limit))
      }

      res.json({
        success: true,
        data: rankings,
        metadata: {
          ...rankingsData.metadata,
          returned: rankings.length
        }
      })
    } catch (error) {
      throw new ApiError('Unable to fetch rankings', 500)
    }
  })
)

// Debug endpoint to test the query
router.get('/debug', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { prisma } = require('@yobi/database')
    
    // Test the exact query used in getActiveInstruments
    const whereClause = {
      isActive: true,
      marketData: {
        some: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }
    }
    
    const instruments = await prisma.instrument.findMany({
      where: whereClause,
      include: {
        marketData: {
          orderBy: { timestamp: 'desc' },
          take: 1
        },
        fundamentals: true
      },
      take: 5
    })
    
    res.json({
      success: true,
      debug: {
        queryTime: new Date().toISOString(),
        whereClause,
        instrumentCount: instruments.length,
        instruments: instruments.map((i: any) => ({
          symbol: i.symbol,
          name: i.name,
          isActive: i.isActive,
          marketDataCount: i.marketData.length,
          latestPrice: i.marketData[0]?.close,
          latestTimestamp: i.marketData[0]?.timestamp
        }))
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}))

// GET /api/rankings/:symbol - Get specific instrument ranking
router.get('/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  
  if (!symbol) {
    throw new ApiError('Symbol parameter is required', 400)
  }

  try {
    const ranking = await rankingsService.getInstrumentRanking(symbol)
    
    res.json({
      success: true,
      data: ranking
    })
  } catch (error) {
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
    throw new ApiError('Unable to refresh rankings', 500)
  }
}))

export default router 