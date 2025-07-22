import express, { Router, Request, Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import { currencyService } from '../services/currency.service'
import { asyncHandler } from '../middleware/error'
import winston from 'winston'

const router: express.Router = Router()
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.label({ label: 'currency-routes' })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

// Get current exchange rates
router.get('/rates', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching current exchange rates')
  
  const rates = await currencyService.getExchangeRates()
  
  res.json({
    success: true,
    data: rates,
    timestamp: new Date().toISOString()
  })
}))

// Get supported currencies
router.get('/supported', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching supported currencies')
  
  const currencies = currencyService.getSupportedCurrencies()
  
  res.json({
    success: true,
    data: currencies,
    timestamp: new Date().toISOString()
  })
}))

// Convert single amount
router.post('/convert', [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('from').isString().isLength({ min: 3, max: 3 }).withMessage('From currency must be 3-letter code'),
  body('to').isString().isLength({ min: 3, max: 3 }).withMessage('To currency must be 3-letter code'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }

  const { amount, from, to } = req.body
  
  logger.info(`Converting ${amount} ${from} to ${to}`)
  
  try {
    const conversion = await currencyService.convertCurrency(
      parseFloat(amount), 
      from.toUpperCase(), 
      to.toUpperCase()
    )
    
    res.json({
      success: true,
      data: conversion,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Currency conversion failed:', error)
    res.status(500).json({
      success: false,
      error: 'Currency conversion failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}))

// Convert multiple amounts (bulk conversion)
router.post('/convert-bulk', [
  body('prices').isArray().withMessage('Prices must be an array'),
  body('prices.*.amount').isNumeric().withMessage('Each price amount must be a number'),
  body('prices.*.currency').isString().withMessage('Each price currency must be a string'),
  body('targetCurrency').isString().isLength({ min: 3, max: 3 }).withMessage('Target currency must be 3-letter code'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }

  const { prices, targetCurrency } = req.body
  
  logger.info(`Bulk converting ${prices.length} prices to ${targetCurrency}`)
  
  try {
    const conversions = await currencyService.convertPrices(
      prices.map((p: any) => ({
        amount: parseFloat(p.amount),
        currency: p.currency.toUpperCase()
      })),
      targetCurrency.toUpperCase()
    )
    
    res.json({
      success: true,
      data: conversions,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Bulk currency conversion failed:', error)
    res.status(500).json({
      success: false,
      error: 'Bulk currency conversion failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}))

// Format currency display
router.post('/format', [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }

  const { amount, currency } = req.body
  
  const formatted = currencyService.formatCurrency(
    parseFloat(amount), 
    currency.toUpperCase()
  )
  
  const symbol = currencyService.getCurrencySymbol(currency.toUpperCase())
  
  res.json({
    success: true,
    data: {
      formatted,
      symbol,
      amount: parseFloat(amount),
      currency: currency.toUpperCase()
    },
    timestamp: new Date().toISOString()
  })
}))

export default router 