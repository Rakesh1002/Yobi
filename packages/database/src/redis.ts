import { Redis } from '@upstash/redis'

// Upstash Redis client for caching and real-time data
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Helper functions for common operations
export const cache = {
  // Get cached data
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key)
    return data as T | null
  },

  // Set cached data with TTL
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, JSON.stringify(value))
    } else {
      await redis.set(key, JSON.stringify(value))
    }
  },

  // Delete cached data
  async delete(key: string): Promise<void> {
    await redis.del(key)
  },

  // Invalidate cache by pattern
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },

  // Market data specific caching
  async setMarketData(symbol: string, data: any, ttl: number = 60): Promise<void> {
    await redis.setex(`market:${symbol}`, ttl, JSON.stringify(data))
  },

  async getMarketData(symbol: string): Promise<any | null> {
    const data = await redis.get(`market:${symbol}`)
    return data ? JSON.parse(data as string) : null
  },

  // Rate limiting
  async checkRateLimit(userId: string, limit: number = 100, window: number = 60): Promise<boolean> {
    const key = `rate:${userId}`
    const current = await redis.incr(key)
    
    if (current === 1) {
      await redis.expire(key, window)
    }
    
    return current <= limit
  },

  // Session management
  async setSession(sessionId: string, data: any, ttl: number = 86400): Promise<void> {
    await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data))
  },

  async getSession(sessionId: string): Promise<any | null> {
    const data = await redis.get(`session:${sessionId}`)
    return data ? JSON.parse(data as string) : null
  },

  async deleteSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`)
  }
} 