// Simple prisma client for frontend use
// This avoids build-time database connection issues

let prisma: any = null

if (typeof window === 'undefined') {
  // Server-side: only initialize if DATABASE_URL is available
  if (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL) {
    try {
      const { prisma: dbPrisma } = require('@yobi/database')
      prisma = dbPrisma
    } catch (error) {
      console.warn('Database connection not available during build')
      prisma = null
    }
  }
}

export { prisma } 