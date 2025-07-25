// Simple prisma client for frontend use
// This avoids build-time database connection issues

let prisma: any = null

if (typeof window === 'undefined') {
  // Server-side: only initialize if DATABASE_URL is available and not during build
  if ((process.env.DATABASE_URL || process.env.NEON_DATABASE_URL) && process.env.NODE_ENV !== 'development') {
    try {
      // Dynamic import to avoid bundling database dependencies during build
      const { PrismaClient } = require('@prisma/client')
      prisma = new PrismaClient()
    } catch (error) {
      console.warn('Database connection not available during build')
      prisma = null
    }
  }
}

export { prisma } 