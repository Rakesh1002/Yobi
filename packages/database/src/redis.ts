import { Redis } from "@upstash/redis";

// Upstash Redis client for caching and real-time data
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Helper functions for common operations
export const cache = {
  // Get cached data
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      // Upstash Redis automatically deserializes JSON, so data is already the correct type
      return data as T | null;
    } catch (error) {
      console.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  },

  // Set cached data with TTL
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      // Upstash Redis handles JSON serialization automatically
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, error);
    }
  },

  // Delete cached data
  async delete(key: string): Promise<void> {
    await redis.del(key);
  },

  // Invalidate cache by pattern
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  // Market data specific caching
  async setMarketData(
    symbol: string,
    data: any,
    ttl: number = 60
  ): Promise<void> {
    try {
      // Upstash Redis handles JSON serialization automatically
      await redis.setex(`market:${symbol}`, ttl, data);
    } catch (error) {
      console.error(`Failed to store market data for ${symbol}:`, error);
    }
  },

  async getMarketData(symbol: string): Promise<any | null> {
    try {
      const data = await redis.get(`market:${symbol}`);
      if (!data) return {};

      // Upstash Redis automatically deserializes JSON, so data is already an object
      if (typeof data === "object" && data !== null) {
        return data;
      }

      // If it's still a string (fallback for other Redis implementations)
      if (typeof data === "string") {
        // Additional validation for "[object Object]" issue
        if (data === "[object Object]" || data.startsWith("[object")) {
          console.warn(`Invalid serialized data for market:${symbol}:`, data);
          // Clean up the invalid cache entry
          await redis.del(`market:${symbol}`);
          return null;
        }

        return JSON.parse(data);
      }

      // Unexpected data type
      console.warn(
        `Unexpected data type for market:${symbol}, got:`,
        typeof data,
        data
      );
      return null;
    } catch (error) {
      console.error(
        `Failed to retrieve/parse market data for ${symbol}:`,
        error
      );
      // Clean up the potentially corrupted cache entry
      try {
        await redis.del(`market:${symbol}`);
      } catch (deleteError) {
        console.error(
          `Failed to delete corrupted cache entry for ${symbol}:`,
          deleteError
        );
      }
      return null;
    }
  },

  // Rate limiting
  async checkRateLimit(
    userId: string,
    limit: number = 100,
    window: number = 60
  ): Promise<boolean> {
    const key = `rate:${userId}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, window);
    }

    return current <= limit;
  },

  // Session management
  async setSession(
    sessionId: string,
    data: any,
    ttl: number = 86400
  ): Promise<void> {
    try {
      // Upstash Redis handles JSON serialization automatically
      if (ttl) {
        await redis.setex(`session:${sessionId}`, ttl, data);
      } else {
        await redis.set(`session:${sessionId}`, data);
      }
    } catch (error) {
      console.error(`Failed to set session ${sessionId}:`, error);
    }
  },

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const data = await redis.get(`session:${sessionId}`);
      // Upstash Redis automatically deserializes JSON, so data is already an object
      return data;
    } catch (error) {
      console.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  },
};
