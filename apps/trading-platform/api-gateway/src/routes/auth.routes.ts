import express, { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { asyncHandler } from '../middleware/error'
import { authenticate } from '../middleware/auth'
import { register, login, refresh, logout, me } from '../controllers/auth.controller'

const router: express.Router = Router()

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }
  next()
}

// POST /api/auth/register - Register new user
router.post('/register', 
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('firstName')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name is required and must be between 1-50 characters'),
    body('lastName')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name is required and must be between 1-50 characters'),
    body('username')
      .optional()
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  ],
  validateRequest,
  asyncHandler(register)
)

// POST /api/auth/login - User login
router.post('/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  validateRequest,
  asyncHandler(login)
)

// POST /api/auth/refresh - Refresh tokens
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
  ],
  validateRequest,
  asyncHandler(refresh)
)

// POST /api/auth/logout - User logout
router.post('/logout', 
  authenticate, 
  asyncHandler(logout)
)

// GET /api/auth/me - Get current user
router.get('/me', 
  authenticate, 
  asyncHandler(me)
)

export default router 