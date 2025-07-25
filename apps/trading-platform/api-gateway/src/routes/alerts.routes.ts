import express, { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error'
import { AlertService } from '../services/alert.service'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'alerts-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

const router: express.Router = Router()
const alertService = new AlertService()

// Create a new alert
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId, symbol, type, condition, message } = req.body

  if (!userId || !symbol || !type || !condition || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userId, symbol, type, condition, message'
    })
  }

  if (!['PRICE', 'TECHNICAL', 'NEWS', 'VOLUME'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid alert type. Must be PRICE, TECHNICAL, NEWS, or VOLUME'
    })
  }

  try {
    const alert = await alertService.createAlert({
      userId,
      symbol: symbol.toUpperCase(),
      type,
      condition,
      message
    })

    logger.info(`Created alert for user ${userId}: ${message}`)

    res.json({
      success: true,
      data: alert
    })
  } catch (error) {
    logger.error('Failed to create alert:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create alert'
    })
  }
}))

// Get user's alerts
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    })
  }

  try {
    const alerts = await alertService.getUserAlerts(userId)

    res.json({
      success: true,
      data: alerts
    })
  } catch (error) {
    logger.error(`Failed to get alerts for user ${userId}:`, error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alerts'
    })
  }
}))

// Get recent alert triggers for a symbol
router.get('/triggers/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol is required'
    })
  }

  try {
    const triggers = await alertService.getRecentTriggers(symbol.toUpperCase())

    res.json({
      success: true,
      data: triggers
    })
  } catch (error) {
    logger.error(`Failed to get recent triggers for ${symbol}:`, error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recent triggers'
    })
  }
}))

// Deactivate an alert
router.delete('/:alertId', asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params
  const { userId } = req.body

  if (!alertId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Alert ID and User ID are required'
    })
  }

  try {
    const success = await alertService.deactivateAlert(alertId, userId)

    if (success) {
      res.json({
        success: true,
        message: 'Alert deactivated successfully'
      })
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or unauthorized'
      })
    }
  } catch (error) {
    logger.error(`Failed to deactivate alert ${alertId}:`, error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate alert'
    })
  }
}))

// Test alert system with mock data
router.post('/test/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params
  const { price, volume, indicators } = req.body

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol is required'
    })
  }

  try {
    const triggers = await alertService.processMarketDataUpdate({
      symbol: symbol.toUpperCase(),
      price: price || 100,
      volume: volume || 1000000,
      indicators: indicators || { rsi: 65, macd: 1.2, sma20: 98, sma50: 95 }
    })

    res.json({
      success: true,
      message: `Processed ${triggers.length} alert triggers for ${symbol}`,
      data: triggers
    })
  } catch (error) {
    logger.error(`Failed to test alerts for ${symbol}:`, error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test alerts'
    })
  }
}))

// Bulk create common alerts for a user
router.post('/bulk/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params
  const { symbol, priceAbove, priceBelow } = req.body

  if (!userId || !symbol) {
    return res.status(400).json({
      success: false,
      error: 'User ID and symbol are required'
    })
  }

  try {
    const createdAlerts = []

    // Create price above alert
    if (priceAbove) {
      const alert = await alertService.createAlert({
        userId,
        symbol: symbol.toUpperCase(),
        type: 'PRICE',
        condition: {
          operator: 'above',
          value: priceAbove
        },
        message: `${symbol} price above $${priceAbove}`
      })
      createdAlerts.push(alert)
    }

    // Create price below alert
    if (priceBelow) {
      const alert = await alertService.createAlert({
        userId,
        symbol: symbol.toUpperCase(),
        type: 'PRICE',
        condition: {
          operator: 'below',
          value: priceBelow
        },
        message: `${symbol} price below $${priceBelow}`
      })
      createdAlerts.push(alert)
    }

    // Create common technical alerts
    const technicalAlerts = [
      {
        type: 'TECHNICAL' as const,
        condition: { operator: 'above' as const, value: 70, indicator: 'rsi' },
        message: `${symbol} RSI above 70 (overbought)`
      },
      {
        type: 'TECHNICAL' as const,
        condition: { operator: 'below' as const, value: 30, indicator: 'rsi' },
        message: `${symbol} RSI below 30 (oversold)`
      }
    ]

    for (const alertData of technicalAlerts) {
      const alert = await alertService.createAlert({
        userId,
        symbol: symbol.toUpperCase(),
        ...alertData
      })
      createdAlerts.push(alert)
    }

    res.json({
      success: true,
      message: `Created ${createdAlerts.length} alerts for ${symbol}`,
      data: createdAlerts
    })
  } catch (error) {
    logger.error(`Failed to create bulk alerts for user ${userId}:`, error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bulk alerts'
    })
  }
}))

export default router 