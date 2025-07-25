import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from root .env file
const rootEnvPath = resolve(__dirname, '../../../../../.env')
config({ path: rootEnvPath })

// Also load from local .env file if it exists
config()

export const environment = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
  
  // Redis/Cache
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  REDIS_URL: process.env.REDIS_URL,
  
  // AI Services
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Search APIs (Legacy - now using SearXNG)

  
  // SearXNG
  SEARXNG_BASE_URL: process.env.SEARXNG_BASE_URL || 'http://localhost:8080',
  
  // S3 Storage
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  
  // Node Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
}

// Validate critical environment variables
export function validateEnvironment() {
  const required = ['DATABASE_URL']
  const missing = required.filter(key => !environment[key as keyof typeof environment])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  // Warn about optional but recommended variables
  const recommended = [
    'ANTHROPIC_API_KEY',
    'UPSTASH_REDIS_REST_URL',
    'AWS_ACCESS_KEY_ID'
  ]
  
  const missingRecommended = recommended.filter(key => !environment[key as keyof typeof environment])
  
  if (missingRecommended.length > 0) {
    console.warn(`⚠️  Recommended environment variables not set: ${missingRecommended.join(', ')}`)
    console.warn('   Some features may be disabled or work with reduced functionality')
  }
  
  return true
}

// Initialize environment on import
try {
  validateEnvironment()
  console.log('✅ Environment configuration loaded successfully')
} catch (error) {
  console.error('❌ Environment validation failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exit(1)
} 