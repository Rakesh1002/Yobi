import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ApiError } from './error'
import { prisma } from '@yobi/database'

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: string
        firstName: string
        lastName: string
      }
    }
  }
}

interface JwtPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('Access token required', 401)
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new ApiError('Access token required', 401)
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new ApiError('JWT secret not configured', 500)
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload
    
    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      }
    })

    if (!user) {
      throw new ApiError('User not found', 401)
    }

    if (!user.isActive) {
      throw new ApiError('Account deactivated', 401)
    }

    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    }

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError('Invalid token', 401))
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError('Token expired', 401))
    }

    next(error)
  }
}

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next() // Continue without user context
    }

    // Use the authenticate middleware logic but don't throw errors
    await authenticate(req, res, next)
  } catch (error) {
    // Ignore auth errors for optional auth
    next()
  }
}

// Role-based authorization
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError('Authentication required', 401)
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError('Insufficient permissions', 403)
    }

    next()
  }
}

// Generate JWT tokens
export const generateTokens = (userId: string, email: string, role: string) => {
  const jwtSecret = process.env.JWT_SECRET
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET
  
  if (!jwtSecret || !jwtRefreshSecret) {
    throw new ApiError('JWT secrets not configured', 500)
  }

  const payload = { userId, email, role }
  
  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  } as jwt.SignOptions)
  
  const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  } as jwt.SignOptions)

  return { accessToken, refreshToken }
}

// Verify refresh token
export const verifyRefreshToken = (token: string): JwtPayload => {
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET
  
  if (!jwtRefreshSecret) {
    throw new ApiError('JWT refresh secret not configured', 500)
  }

  return jwt.verify(token, jwtRefreshSecret) as JwtPayload
} 