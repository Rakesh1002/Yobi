import { Redis } from '@upstash/redis'
import IORedis from 'ioredis'
import { createLogger } from '../utils/logger'

const logger = createLogger('cache-service')

export class CacheService {
  private upstashRedis?: Redis
  private ioRedis?: IORedis
  private cacheType: 'upstash' | 'ioredis' | 'none' = 'none'

  constructor() {
    this.initializeCache()
  }

  private initializeCache(): void {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
    const redisUrl = process.env.REDIS_URL

    if (upstashUrl && upstashToken) {
      // Use Upstash Redis REST API
      this.upstashRedis = new Redis({
        url: upstashUrl,
        token: upstashToken
      })
      this.cacheType = 'upstash'
      logger.info('Initialized Upstash Redis REST cache')
    } else if (redisUrl) {
      // Use standard Redis
      this.ioRedis = new IORedis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        lazyConnect: true
      })
      this.cacheType = 'ioredis'
      logger.info('Initialized standard Redis cache')
    } else {
      logger.warn('No cache configuration found - running without cache')
      this.cacheType = 'none'
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value)

      switch (this.cacheType) {
        case 'upstash':
          if (ttlSeconds) {
            await this.upstashRedis!.setex(key, ttlSeconds, serializedValue)
          } else {
            await this.upstashRedis!.set(key, serializedValue)
          }
          break
        case 'ioredis':
          if (ttlSeconds) {
            await this.ioRedis!.setex(key, ttlSeconds, serializedValue)
          } else {
            await this.ioRedis!.set(key, serializedValue)
          }
          break
        case 'none':
          // No-op when cache is disabled
          break
      }
    } catch (error) {
      logger.error(`Cache set failed for key ${key}:`, error)
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      switch (this.cacheType) {
        case 'upstash':
          return await this.upstashRedis!.get(key)
        case 'ioredis':
          return await this.ioRedis!.get(key)
        case 'none':
          return null
        default:
          return null
      }
    } catch (error) {
      logger.error(`Cache get failed for key ${key}:`, error)
      return null
    }
  }

  async getJSON(key: string): Promise<any> {
    try {
      const value = await this.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logger.error(`Cache getJSON failed for key ${key}:`, error)
      return null
    }
  }

  async del(key: string): Promise<void> {
    try {
      switch (this.cacheType) {
        case 'upstash':
          await this.upstashRedis!.del(key)
          break
        case 'ioredis':
          await this.ioRedis!.del(key)
          break
        case 'none':
          // No-op when cache is disabled
          break
      }
    } catch (error) {
      logger.error(`Cache delete failed for key ${key}:`, error)
    }
  }

  async ping(): Promise<boolean> {
    try {
      switch (this.cacheType) {
        case 'upstash':
          await this.upstashRedis!.ping()
          return true
        case 'ioredis':
          await this.ioRedis!.ping()
          return true
        case 'none':
          return false
        default:
          return false
      }
    } catch (error) {
      logger.error('Cache ping failed:', error)
      return false
    }
  }

  isEnabled(): boolean {
    return this.cacheType !== 'none'
  }

  getCacheType(): string {
    return this.cacheType
  }

  async disconnect(): Promise<void> {
    try {
      if (this.ioRedis) {
        await this.ioRedis.disconnect()
      }
      // Upstash Redis REST doesn't need explicit disconnection
    } catch (error) {
      logger.error('Cache disconnect failed:', error)
    }
  }
} 