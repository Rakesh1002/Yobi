import dotenv from 'dotenv'

// Load environment variables FIRST, before any other imports
dotenv.config()

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import winston from 'winston'
import cron from 'node-cron'

// Import route handlers
import authRoutes from './routes/auth.routes'
import rankingsRoutes from './routes/rankings.routes'
import instrumentsRoutes from './routes/instruments.routes'
import currencyRoutes from './routes/currency.routes'
import analysisRoutes from './routes/analysis.routes'
import portfolioRoutes from './routes/portfolio.routes'
import knowledgeRoutes from './routes/knowledge.routes'
import documentsRoutes from './routes/documents.routes'
import marketRoutes from './routes/market.routes'
import agentRoutes from './routes/agent.routes'
import alertsRoutes from './routes/alerts.routes'

// Import middleware
import { asyncHandler } from './middleware/error'

// Import services
import { RankingsService, rankingsService } from './services/rankings.service'
import { AlertService } from './services/alert.service'


import { cache } from '@yobi/database/src/redis'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'combined.log' })
  ],
})

const app: express.Application = express()
const server = createServer(app)

// Initialize Socket.IO for real-time updates
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Initialize services

let alertService: AlertService

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', asyncHandler(async (req: Request, res: Response) => {
  let redisHealthy = false
  try {
    // Test Redis connection by trying to get a key
    await cache.get('health_check')
    redisHealthy = true
  } catch (error) {
    redisHealthy = false
  }
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      redis: redisHealthy ? 'connected' : 'disconnected',
      websocket: io.engine.clientsCount > 0 ? `${io.engine.clientsCount} clients` : 'no clients'
    }
  })
}))

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/rankings', rankingsRoutes)
app.use('/api/instruments', instrumentsRoutes)
app.use('/api/currency', currencyRoutes)
app.use('/api/analysis', analysisRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/documents', documentsRoutes)
app.use('/api/market', marketRoutes)
app.use('/api/agent', agentRoutes)
app.use('/api/alerts', alertsRoutes)

// Real-time WebSocket Implementation
class RealTimeDataStreamer {
  private io: SocketServer
  private subscribedSymbols: Set<string> = new Set()
  private intervalId: NodeJS.Timeout | null = null
  private alertService: AlertService
  private connectedUsers: Map<string, string> = new Map() // socketId -> userId
  
  constructor(socketServer: SocketServer) {
    this.io = socketServer
    this.alertService = new AlertService(socketServer)
    this.setupSocketHandlers()
    this.startDataStreaming()
  }
  
  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`)
      
      // Send initial data
      socket.emit('connection_status', {
        status: 'connected',
        timestamp: new Date().toISOString(),
        server: 'yobi-api-gateway',
        features: ['market_data', 'alerts', 'real_time_analysis']
      })

      // Handle user authentication for alerts
      socket.on('authenticate', (data: { userId: string }) => {
        if (data.userId) {
          this.connectedUsers.set(socket.id, data.userId)
          socket.join(`user:${data.userId}`)
          logger.info(`User ${data.userId} authenticated for alerts`)
          
          socket.emit('authenticated', {
            success: true,
            userId: data.userId,
            timestamp: new Date().toISOString()
          })
        }
      })
      
      // Handle symbol subscriptions
      socket.on('subscribe', (data: { symbols?: string[], type?: string }) => {
        const { symbols = [], type = 'quotes' } = data
        
        symbols.forEach(symbol => {
          this.subscribedSymbols.add(symbol.toUpperCase())
          socket.join(`${type}:${symbol.toUpperCase()}`)
        })
        
        logger.info(`Client ${socket.id} subscribed to ${symbols.length} symbols`)
        
        // Send immediate data for subscribed symbols
        this.sendImmediateData(socket, symbols, type)
      })
      
      // Handle unsubscribe
      socket.on('unsubscribe', (data: { symbols?: string[], type?: string }) => {
        const { symbols = [], type = 'quotes' } = data
        
        symbols.forEach(symbol => {
          this.subscribedSymbols.delete(symbol.toUpperCase())
          socket.leave(`${type}:${symbol.toUpperCase()}`)
        })
        
        logger.info(`Client ${socket.id} unsubscribed from ${symbols.length} symbols`)
      })

      // Handle alert creation via WebSocket
      socket.on('create_alert', async (data: {
        userId: string
        symbol: string
        type: 'PRICE' | 'TECHNICAL' | 'NEWS' | 'VOLUME'
        condition: any
        message: string
      }) => {
        try {
          const alert = await this.alertService.createAlert(data)
          socket.emit('alert_created', { success: true, alert })
          logger.info(`Alert created via WebSocket for user ${data.userId}`)
        } catch (error) {
          socket.emit('alert_error', { 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to create alert' 
          })
        }
      })

      // Handle getting user alerts
      socket.on('get_alerts', async (data: { userId: string }) => {
        try {
          const alerts = await this.alertService.getUserAlerts(data.userId)
          socket.emit('user_alerts', { success: true, alerts })
        } catch (error) {
          socket.emit('alert_error', { 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to get alerts' 
          })
        }
      })

      // Handle alert deactivation
      socket.on('deactivate_alert', async (data: { alertId: string, userId: string }) => {
        try {
          const success = await this.alertService.deactivateAlert(data.alertId, data.userId)
          socket.emit('alert_deactivated', { success, alertId: data.alertId })
        } catch (error) {
          socket.emit('alert_error', { 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to deactivate alert' 
          })
        }
      })
      
      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`)
        
        // Remove user from connected users
        const userId = this.connectedUsers.get(socket.id)
        if (userId) {
          this.connectedUsers.delete(socket.id)
          logger.info(`User ${userId} disconnected`)
        }
      })
      
      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() })
      })
    })
  }
  
  private async sendImmediateData(socket: Socket, symbols: string[], type: string) {
    try {
      for (const symbol of symbols) {
        const cachedData = await cache.getMarketData(symbol.toUpperCase())
        if (cachedData) {
          socket.emit('market_data', {
            symbol: symbol.toUpperCase(),
            type,
            data: cachedData,
            timestamp: new Date().toISOString()
          })
        }
      }
    } catch (error) {
      logger.error('Failed to send immediate data:', error)
    }
  }
  
  private startDataStreaming() {
    // Stream data every 5 seconds to connected clients
    this.intervalId = setInterval(async () => {
      await this.broadcastMarketData()
    }, 5000)
    
    logger.info('Real-time data streaming started (5-second intervals)')
  }
  
  private async broadcastMarketData() {
    if (this.subscribedSymbols.size === 0) return
    
    try {
      // Get latest data for all subscribed symbols
      const symbols = Array.from(this.subscribedSymbols)
      
      for (const symbol of symbols) {
        const marketData = await cache.getMarketData(symbol);

        if (marketData) {
          // Check alerts for this symbol
          try {
            const { rsi, macd, sma20, sma50 } = marketData.indicators || {};
            const triggers = await this.alertService.processMarketDataUpdate({
              symbol,
              price: marketData.price,
              volume: marketData.volume || 0,
              indicators: { rsi, macd, sma20, sma50 },
            });

            if (triggers.length > 0) {
              logger.info(
                `Processed ${triggers.length} alert triggers for ${symbol}`
              );
            }
          } catch (alertError) {
            logger.error(`Failed to check alerts for ${symbol}:`, alertError)
          }
          
          // Broadcast to all clients subscribed to this symbol
          this.io.to(`quotes:${symbol}`).emit('market_data', {
            symbol,
            type: 'quotes',
            data: {
              ...marketData,
              timestamp: new Date().toISOString()
            }
          })
        }
      }
      
      // Broadcast connection stats
      this.io.emit('server_stats', {
        connectedClients: this.io.engine.clientsCount,
        subscribedSymbols: this.subscribedSymbols.size,
        connectedUsers: this.connectedUsers.size,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      logger.error('Failed to broadcast market data:', error)
    }
  }
  
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

  // Initialize real-time data streamer
  const realTimeStreamer = new RealTimeDataStreamer(io)

// Schedule hourly cache refresh (at the start of every hour)
cron.schedule('0 * * * *', async () => {
  try {
    logger.info('🔄 Starting hourly rankings cache refresh...')
    await rankingsService.refreshRankingsCache()
    logger.info('✅ Hourly rankings cache refresh completed')
  } catch (error) {
    logger.error('❌ Failed to refresh rankings cache on schedule:', error)
  }
}, {
  scheduled: true,
  timezone: "UTC"
})

logger.info('⏰ Scheduled hourly rankings cache refresh enabled')

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('API Error:', error)
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message
    })
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  })
})

// Start server
const PORT = process.env.API_GATEWAY_PORT || process.env.PORT || 3002

server.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`)
  logger.info(`📡 WebSocket server enabled for real-time data`)
  logger.info(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || "http://localhost:3000"}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  realTimeStreamer.stop()
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  realTimeStreamer.stop()
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

export { app, server, io } 