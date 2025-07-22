import { Request, Response, NextFunction } from 'express'
import winston from 'winston'

// Configure logger for error middleware
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway-errors' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export class ApiError extends Error implements AppError {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    
    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const {
    statusCode = 500,
    message = 'Internal Server Error',
    stack
  } = err

  // Log error details
  logger.error('API Error:', {
    message,
    statusCode,
    stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  })

  // Don't expose stack trace in production
  const errorResponse: any = {
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  }

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = stack
  }

  res.status(statusCode).json(errorResponse)
}

// Async error handler wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Not found handler
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(`Route ${req.originalUrl} not found`, 404)
  next(error)
}

// Validation error handler
export const handleValidationError = (error: any) => {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((val: any) => val.message)
    return new ApiError(`Validation Error: ${errors.join(', ')}`, 400)
  }
  return error
} 