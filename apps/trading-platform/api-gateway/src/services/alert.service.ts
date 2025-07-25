import { PrismaClient } from '@prisma/client'
import { cache } from '@yobi/database/src/redis'
import winston from 'winston'
import { Server as SocketServer } from 'socket.io'

const prisma = new PrismaClient()

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'alert-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
})

export interface Alert {
  id: string
  userId: string
  symbol: string
  type: 'PRICE' | 'TECHNICAL' | 'NEWS' | 'VOLUME'
  condition: {
    operator: 'above' | 'below' | 'crosses_above' | 'crosses_below' | 'equals'
    value: number
    indicator?: string // For technical alerts
  }
  message: string
  isActive: boolean
  triggeredAt?: Date
  createdAt: Date
}

export interface AlertTrigger {
  alertId: string
  symbol: string
  currentValue: number
  targetValue: number
  type: 'PRICE' | 'TECHNICAL' | 'NEWS' | 'VOLUME'
  message: string
  triggeredAt: Date
}

export class AlertService {
  private io: SocketServer | null = null

  constructor(socketServer?: SocketServer) {
    this.io = socketServer || null
  }

  /**
   * Create a new alert
   */
  async createAlert(alertData: {
    userId: string
    symbol: string
    type: 'PRICE' | 'TECHNICAL' | 'NEWS' | 'VOLUME'
    condition: {
      operator: 'above' | 'below' | 'crosses_above' | 'crosses_below' | 'equals'
      value: number
      indicator?: string
    }
    message: string
  }): Promise<Alert> {
    try {
      const alert = await prisma.alert.create({
        data: {
          userId: alertData.userId,
          instrumentId: alertData.symbol, // Will be resolved by Prisma
          type: alertData.type,
          condition: JSON.stringify(alertData.condition),
          value: alertData.condition.value,
          message: alertData.message,
          isActive: true,
          triggered: false
        }
      })

      logger.info(`Created alert for ${alertData.symbol}: ${alertData.message}`)
      
      return {
        id: alert.id,
        userId: alert.userId,
        symbol: alertData.symbol,
        type: alertData.type,
        condition: alertData.condition,
        message: alert.message,
        isActive: alert.isActive,
        triggeredAt: alert.triggeredAt || undefined,
        createdAt: alert.createdAt
      }
    } catch (error) {
      logger.error('Failed to create alert:', error)
      throw error
    }
  }

  /**
   * Get alerts for a user
   */
  async getUserAlerts(userId: string): Promise<Alert[]> {
    try {
      const alerts = await prisma.alert.findMany({
        where: {
          userId,
          isActive: true
        },
        include: {
          instrument: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return alerts.map(alert => ({
        id: alert.id,
        userId: alert.userId,
        symbol: alert.instrument.symbol,
        type: alert.type as 'PRICE' | 'TECHNICAL' | 'NEWS' | 'VOLUME',
        condition: JSON.parse(alert.condition) as any,
        message: alert.message,
        isActive: alert.isActive,
        triggeredAt: alert.triggeredAt || undefined,
        createdAt: alert.createdAt
      }))
    } catch (error) {
      logger.error(`Failed to get alerts for user ${userId}:`, error)
      return []
    }
  }

  /**
   * Check price alerts for a symbol
   */
  async checkPriceAlerts(symbol: string, currentPrice: number): Promise<AlertTrigger[]> {
    try {
      const alerts = await prisma.alert.findMany({
        where: {
          instrument: {
            symbol: symbol.toUpperCase()
          },
          type: 'PRICE',
          isActive: true,
          triggered: false
        },
        include: {
          instrument: true,
          user: true
        }
      })

      const triggeredAlerts: AlertTrigger[] = []

      for (const alert of alerts) {
        const condition = JSON.parse(alert.condition) as any
        let shouldTrigger = false

        switch (condition.operator) {
          case 'above':
            shouldTrigger = currentPrice > condition.value
            break
          case 'below':
            shouldTrigger = currentPrice < condition.value
            break
          case 'equals':
            shouldTrigger = Math.abs(currentPrice - condition.value) < (condition.value * 0.005) // 0.5% tolerance
            break
        }

        if (shouldTrigger) {
          // Mark alert as triggered
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              triggered: true,
              triggeredAt: new Date()
            }
          })

          const trigger: AlertTrigger = {
            alertId: alert.id,
            symbol: symbol.toUpperCase(),
            currentValue: currentPrice,
            targetValue: condition.value,
            type: 'PRICE',
            message: `${symbol} price ${condition.operator} ${condition.value}: Current ${currentPrice}`,
            triggeredAt: new Date()
          }

          triggeredAlerts.push(trigger)

          // Send real-time notification
          await this.sendNotification(alert.userId, trigger)
        }
      }

      if (triggeredAlerts.length > 0) {
        logger.info(`Triggered ${triggeredAlerts.length} price alerts for ${symbol}`)
      }

      return triggeredAlerts
    } catch (error) {
      logger.error(`Failed to check price alerts for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Check technical indicator alerts
   */
  async checkTechnicalAlerts(symbol: string, indicators: {
    rsi?: number
    macd?: number
    sma20?: number
    sma50?: number
    volume?: number
  }): Promise<AlertTrigger[]> {
    try {
      const alerts = await prisma.alert.findMany({
        where: {
          instrument: {
            symbol: symbol.toUpperCase()
          },
          type: 'TECHNICAL',
          isActive: true,
          triggered: false
        },
        include: {
          instrument: true,
          user: true
        }
      })

      const triggeredAlerts: AlertTrigger[] = []

      for (const alert of alerts) {
        const condition = JSON.parse(alert.condition) as any
        const indicatorValue = indicators[condition.indicator as keyof typeof indicators]
        
        if (indicatorValue === undefined) continue

        let shouldTrigger = false

        switch (condition.operator) {
          case 'above':
            shouldTrigger = indicatorValue > condition.value
            break
          case 'below':
            shouldTrigger = indicatorValue < condition.value
            break
        }

        if (shouldTrigger) {
          // Mark alert as triggered
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              triggered: true,
              triggeredAt: new Date()
            }
          })

          const trigger: AlertTrigger = {
            alertId: alert.id,
            symbol: symbol.toUpperCase(),
            currentValue: indicatorValue,
            targetValue: condition.value,
            type: 'TECHNICAL',
            message: `${symbol} ${condition.indicator} ${condition.operator} ${condition.value}: Current ${indicatorValue.toFixed(2)}`,
            triggeredAt: new Date()
          }

          triggeredAlerts.push(trigger)

          // Send real-time notification
          await this.sendNotification(alert.userId, trigger)
        }
      }

      if (triggeredAlerts.length > 0) {
        logger.info(`Triggered ${triggeredAlerts.length} technical alerts for ${symbol}`)
      }

      return triggeredAlerts
    } catch (error) {
      logger.error(`Failed to check technical alerts for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Check volume alerts
   */
  async checkVolumeAlerts(symbol: string, currentVolume: number): Promise<AlertTrigger[]> {
    try {
      const alerts = await prisma.alert.findMany({
        where: {
          instrument: {
            symbol: symbol.toUpperCase()
          },
          type: 'VOLUME',
          isActive: true,
          triggered: false
        },
        include: {
          instrument: true,
          user: true
        }
      })

      const triggeredAlerts: AlertTrigger[] = []

      for (const alert of alerts) {
        const condition = JSON.parse(alert.condition) as any
        let shouldTrigger = false

        switch (condition.operator) {
          case 'above':
            shouldTrigger = currentVolume > condition.value
            break
          case 'below':
            shouldTrigger = currentVolume < condition.value
            break
        }

        if (shouldTrigger) {
          // Mark alert as triggered
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              triggered: true,
              triggeredAt: new Date()
            }
          })

          const trigger: AlertTrigger = {
            alertId: alert.id,
            symbol: symbol.toUpperCase(),
            currentValue: currentVolume,
            targetValue: condition.value,
            type: 'VOLUME',
            message: `${symbol} volume ${condition.operator} ${condition.value}: Current ${currentVolume.toLocaleString()}`,
            triggeredAt: new Date()
          }

          triggeredAlerts.push(trigger)

          // Send real-time notification
          await this.sendNotification(alert.userId, trigger)
        }
      }

      if (triggeredAlerts.length > 0) {
        logger.info(`Triggered ${triggeredAlerts.length} volume alerts for ${symbol}`)
      }

      return triggeredAlerts
    } catch (error) {
      logger.error(`Failed to check volume alerts for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Process market data update and check all relevant alerts
   */
  async processMarketDataUpdate(marketData: {
    symbol: string
    price: number
    volume: number
    indicators?: {
      rsi?: number
      macd?: number
      sma20?: number
      sma50?: number
    }
  }): Promise<AlertTrigger[]> {
    const allTriggers: AlertTrigger[] = []

    try {
      // Check price alerts
      const priceAlerts = await this.checkPriceAlerts(marketData.symbol, marketData.price)
      allTriggers.push(...priceAlerts)

      // Check volume alerts
      const volumeAlerts = await this.checkVolumeAlerts(marketData.symbol, marketData.volume)
      allTriggers.push(...volumeAlerts)

      // Check technical alerts if indicators are provided
      if (marketData.indicators) {
        const technicalAlerts = await this.checkTechnicalAlerts(marketData.symbol, {
          ...marketData.indicators,
          volume: marketData.volume
        })
        allTriggers.push(...technicalAlerts)
      }

      // Cache recent triggers for monitoring
      if (allTriggers.length > 0) {
        await cache.set(`alerts:recent:${marketData.symbol}`, JSON.stringify(allTriggers), 300)
      }

    } catch (error) {
      logger.error(`Failed to process market data alerts for ${marketData.symbol}:`, error)
    }

    return allTriggers
  }

  /**
   * Send notification to user
   */
  private async sendNotification(userId: string, trigger: AlertTrigger): Promise<void> {
    try {
      // Send WebSocket notification if available
      if (this.io) {
        this.io.to(`user:${userId}`).emit('alert', {
          id: trigger.alertId,
          symbol: trigger.symbol,
          type: trigger.type,
          message: trigger.message,
          triggeredAt: trigger.triggeredAt,
          currentValue: trigger.currentValue,
          targetValue: trigger.targetValue
        })
      }

      // Log notification
      logger.info(`Sent notification to user ${userId}: ${trigger.message}`)

    } catch (error) {
      logger.error(`Failed to send notification to user ${userId}:`, error)
    }
  }

  /**
   * Get recent alert triggers for a symbol
   */
  async getRecentTriggers(symbol: string): Promise<AlertTrigger[]> {
    try {
      const cached = await cache.get(`alerts:recent:${symbol}`)
      return cached ? JSON.parse(cached as string) : []
    } catch (error) {
      logger.error(`Failed to get recent triggers for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Deactivate an alert
   */
  async deactivateAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      await prisma.alert.updateMany({
        where: {
          id: alertId,
          userId: userId
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      })

      logger.info(`Deactivated alert ${alertId} for user ${userId}`)
      return true
    } catch (error) {
      logger.error(`Failed to deactivate alert ${alertId}:`, error)
      return false
    }
  }
} 