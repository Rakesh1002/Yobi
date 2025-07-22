import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import winston from 'winston'

// Load environment variables
dotenv.config()

// Import routes (to be created)
import routes from './routes'
import { errorHandler } from './middleware/error'

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

// Trust proxy for production deployment
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, process.env.VERCEL_URL].filter((url): url is string => Boolean(url))
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}))

// Compression and logging
app.use(compression())
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', limiter)

// Global request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  })
  next()
})

// Health check route (before other routes)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Trading Platform API Gateway',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Mount API routes
app.use('/api', routes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  })
})

// Global error handling
app.use(errorHandler)

// WebSocket handling for real-time features
const clients = new Set()

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substring(7)
  clients.add(ws)
  
  logger.info(`New WebSocket connection: ${clientId}`, {
    ip: req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
  })
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    timestamp: new Date().toISOString()
  }))
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString())
      logger.info(`WebSocket message from ${clientId}:`, data)
      
      // Handle different message types
      switch (data.type) {
        case 'subscribe':
          // Handle market data subscriptions
          ws.send(JSON.stringify({
            type: 'subscribed',
            symbol: data.symbol,
            timestamp: new Date().toISOString()
          }))
          break
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
          break
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type',
            timestamp: new Date().toISOString()
          }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`WebSocket message parsing error: ${errorMessage}`)
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }))
    }
  })
  
  ws.on('close', (code, reason) => {
    clients.delete(ws)
    logger.info(`WebSocket connection closed: ${clientId}`, {
      code,
      reason: reason.toString()
    })
  })
  
  ws.on('error', (error) => {
    logger.error(`WebSocket error for ${clientId}:`, error)
    clients.delete(ws)
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

// Start server
const PORT = process.env.PORT || 3002
server.listen(PORT, () => {
  logger.info(`🚀 Trading Platform API Gateway running on port ${PORT}`)
  logger.info(`📊 Health check: http://localhost:${PORT}/api/health`)
  logger.info(`🌐 WebSocket server enabled for real-time features`)
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
})

// Export server for testing
export default server 