import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '@yobi/database'
import { ApiError } from '../middleware/error'
import { generateTokens, verifyRefreshToken } from '../middleware/auth'
import { redis } from '@yobi/database'

interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  username?: string
}

interface LoginRequest {
  email: string
  password: string
}

export const register = async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, username } = req.body as RegisterRequest

  // Validate input
  if (!email || !password || !firstName || !lastName) {
    throw new ApiError('All fields are required', 400)
  }

  if (password.length < 8) {
    throw new ApiError('Password must be at least 8 characters long', 400)
  }

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: email.toLowerCase() },
        ...(username ? [{ username }] : [])
      ]
    }
  })

  if (existingUser) {
    throw new ApiError('User with this email or username already exists', 409)
  }

  // Hash password
  const saltRounds = 12
  const hashedPassword = await bcrypt.hash(password, saltRounds)

  // Generate username if not provided
  const finalUsername = username || `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username: finalUsername,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'TRADER', // Default role
      isActive: true,
      emailVerified: false, // TODO: Implement email verification
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    }
  })

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role)

  // Store refresh token in Redis (optional, for token revocation)
  await redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken)

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 3600 // 1 hour
      }
    }
  })
}

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginRequest

  // Validate input
  if (!email || !password) {
    throw new ApiError('Email and password are required', 400)
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      password: true,
      isActive: true,
      emailVerified: true,
    }
  })

  if (!user) {
    throw new ApiError('Invalid credentials', 401)
  }

  if (!user.isActive) {
    throw new ApiError('Account has been deactivated', 401)
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password)
  
  if (!isPasswordValid) {
    throw new ApiError('Invalid credentials', 401)
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role)

  // Store refresh token in Redis
  await redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken)

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  })

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: userWithoutPassword,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 3600 // 1 hour
      }
    }
  })
}

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    throw new ApiError('Refresh token required', 400)
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken)

    // Check if token exists in Redis (optional validation)
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`)
    if (!storedToken || storedToken !== refreshToken) {
      throw new ApiError('Invalid refresh token', 401)
    }

    // Get user to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      }
    })

    if (!user || !user.isActive) {
      throw new ApiError('User not found or inactive', 401)
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id,
      user.email,
      user.role
    )

    // Store new refresh token
    await redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, newRefreshToken)

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      }
    })
  } catch (error) {
    throw new ApiError('Invalid refresh token', 401)
  }
}

export const logout = async (req: Request, res: Response) => {
  const userId = req.user?.id

  if (userId) {
    // Remove refresh token from Redis
    await redis.del(`refresh_token:${userId}`)
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  })
}

export const me = async (req: Request, res: Response) => {
  const userId = req.user?.id

  if (!userId) {
    throw new ApiError('User not authenticated', 401)
  }

  // Get user with preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
      preferences: {
        select: {
          theme: true,
          currency: true,
          timezone: true,
          language: true,
          notifications: true,
        }
      }
    }
  })

  if (!user) {
    throw new ApiError('User not found', 404)
  }

  res.json({
    success: true,
    data: user
  })
} 