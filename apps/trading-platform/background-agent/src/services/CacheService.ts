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
      let serializedValue: string
      
      if (typeof value === 'string') {
        serializedValue = value
      } else {
        try {
          // Ensure proper JSON serialization
          serializedValue = JSON.stringify(value, (key, val) => {
            // Handle circular references and functions
            if (typeof val === 'function') return '[Function]'
            if (val === undefined) return null
            return val
          })
        } catch (serializationError) {
          logger.warn(`Failed to serialize value for cache key ${key}:`, serializationError)
          return // Skip caching if we can't serialize
        }
      }

      // Validate that we can parse what we're about to store
      if (typeof value !== 'string') {
        try {
          JSON.parse(serializedValue)
        } catch (testParseError) {
          logger.warn(`Invalid JSON being stored for cache key ${key}, skipping cache`)
          return
        }
      }

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
      if (!value) return null
      
      // Ensure value is a string before calling string methods
      if (typeof value !== 'string') {
        logger.warn(`Cache value for key ${key} is not a string, clearing cache entry`)
        await this.del(key)
        return null
      }
      
      // Handle malformed JSON
      if (value === '[object Object]' || value.startsWith('[object ')) {
        logger.warn(`Malformed cache value for key ${key}, clearing cache entry`)
        await this.del(key) // Clear the bad cache entry
        return null
      }
      
      try {
        return JSON.parse(value)
      } catch (parseError) {
        logger.warn(`Invalid JSON in cache for key ${key}:`, parseError)
        await this.del(key) // Clear the bad cache entry
        return null
      }
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

  async clearCorruptedEntries(pattern: string = '*'): Promise<number> {
    if (this.cacheType === 'none') return 0
    
    let cleared = 0
    try {
      let keys: string[] = []
      
      switch (this.cacheType) {
        case 'upstash':
          // Upstash doesn't support SCAN, so we'll skip for now
          break
        case 'ioredis':
          keys = await this.ioRedis!.keys(pattern)
          break
      }

      for (const key of keys) {
        try {
          const value = await this.get(key)
          if (value && typeof value === 'string') {
            // Try to parse as JSON
            if (value.startsWith('{') || value.startsWith('[')) {
              JSON.parse(value)
            }
          }
        } catch (error) {
          // If we can't parse it, it's corrupted
          await this.del(key)
          cleared++
          logger.info(`Cleared corrupted cache entry: ${key}`)
        }
      }
    } catch (error) {
      logger.error('Failed to clear corrupted cache entries:', error)
    }
    
    return cleared
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