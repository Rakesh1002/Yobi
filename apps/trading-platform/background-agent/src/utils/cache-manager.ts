import { CacheService } from '../services/CacheService'
import { createLogger } from './logger'

const logger = createLogger('cache-manager')

export class CacheManager {
  private cacheService: CacheService

  constructor() {
    this.cacheService = new CacheService()
  }

  /**
   * Clear all cache (for Upstash Redis)
   * Note: This doesn't work with Upstash REST API, needs manual clearing
   */
  async clearAllCache(): Promise<void> {
    try {
      if (this.cacheService.getCacheType() === 'upstash') {
        logger.warn('Upstash Redis requires manual cache clearing via dashboard')
        logger.info('Go to: https://console.upstash.com/ → Your Redis → Data Browser → FLUSHALL')
        return
      }

      // For standard Redis, we could use FLUSHALL
      logger.info('For standard Redis, manual FLUSHALL command needed')
    } catch (error) {
      logger.error('Failed to clear cache:', error)
    }
  }

  /**
   * Test cache with size monitoring
   */
  async testCacheSize(): Promise<void> {
    try {
      const testData = {
        small: 'small test data',
        medium: 'x'.repeat(1000),
        large: 'x'.repeat(10000)
      }

      for (const [size, data] of Object.entries(testData)) {
        const testKey = `test:${size}:${Date.now()}`
        const dataSize = JSON.stringify(data).length
        
        try {
          await this.cacheService.set(testKey, data, 60) // 1 minute TTL
          logger.info(`✅ Cached ${size} data (${dataSize} bytes)`)
        } catch (error) {
          logger.error(`❌ Failed to cache ${size} data (${dataSize} bytes):`, error)
        }
      }
    } catch (error) {
      logger.error('Cache size test failed:', error)
    }
  }

  /**
   * Monitor cache health
   */
  async monitorCacheHealth(): Promise<{
    isHealthy: boolean
    cacheType: string
    canWrite: boolean
    errorMessage?: string
  }> {
    try {
      const isHealthy = await this.cacheService.ping()
      const cacheType = this.cacheService.getCacheType()
      
      // Test write capability
      let canWrite = false
      try {
        await this.cacheService.set('health:test', 'test', 5)
        canWrite = true
      } catch (error) {
        logger.debug('Cache write test failed:', error)
      }

      return {
        isHealthy,
        cacheType,
        canWrite,
        errorMessage: !canWrite ? 'Cache writes failing - likely quota exceeded' : undefined
      }
    } catch (error) {
      return {
        isHealthy: false,
        cacheType: 'unknown',
        canWrite: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Calculate estimated cache usage reduction from optimizations
   */
  calculateOptimizationBenefit(): {
    beforeOptimization: string
    afterOptimization: string
    reduction: string
    benefits: string[]
  } {
    return {
      beforeOptimization: '~5MB per URL (full content + 24h TTL)',
      afterOptimization: '~50KB per URL (essential data + 1h TTL)',
      reduction: '~99% size reduction per entry',
      benefits: [
        '24h → 1h TTL: 96% faster cache turnover',
        'Full content → Essential only: 99% size reduction',
        'Size limits: Prevents large entries',
        'Multiple layers optimized: All services improved'
      ]
    }
  }
}

// CLI utility functions
export async function clearCache(): Promise<void> {
  const manager = new CacheManager()
  await manager.clearAllCache()
}

export async function testCache(): Promise<void> {
  const manager = new CacheManager()
  await manager.testCacheSize()
}

export async function checkCacheHealth(): Promise<void> {
  const manager = new CacheManager()
  const health = await manager.monitorCacheHealth()
  
  console.log('📊 Cache Health Report:')
  console.log(`  Type: ${health.cacheType}`)
  console.log(`  Healthy: ${health.isHealthy ? '✅' : '❌'}`)
  console.log(`  Can Write: ${health.canWrite ? '✅' : '❌'}`)
  
  if (health.errorMessage) {
    console.log(`  ⚠️  Issue: ${health.errorMessage}`)
  }

  if (!health.canWrite) {
    console.log('\n💡 Solutions:')
    console.log('  1. Clear cache via Upstash dashboard')
    console.log('  2. Upgrade Upstash plan for more storage')
    console.log('  3. Use local Redis for development')
  }
}

// Run cache health check if this file is executed directly
if (require.main === module) {
  checkCacheHealth()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Cache health check failed:', error)
      process.exit(1)
    })
} 