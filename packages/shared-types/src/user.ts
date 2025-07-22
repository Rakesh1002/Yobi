// User and authentication types

export enum UserRole {
  ADMIN = 'ADMIN',
  TRADER = 'TRADER',
  INVESTOR = 'INVESTOR',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER',
}

export enum SubscriptionTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export interface User {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  phoneNumber?: string
  role: UserRole
  subscriptionTier: SubscriptionTier
  isEmailVerified: boolean
  isPhoneVerified: boolean
  isActive: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
  preferences: UserPreferences
}

export interface UserPreferences {
  userId: string
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  currency: string
  notifications: NotificationPreferences
  defaultExchange: string
  favoriteAssetClasses: string[]
  riskProfile: RiskProfile
}

export interface NotificationPreferences {
  email: {
    trades: boolean
    alerts: boolean
    reports: boolean
    marketing: boolean
  }
  push: {
    trades: boolean
    alerts: boolean
    priceAlerts: boolean
  }
  sms: {
    trades: boolean
    criticalAlerts: boolean
  }
}

export interface RiskProfile {
  type: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  maxPositionSize: number
  maxPortfolioRisk: number
  stopLossPercentage: number
  preferredHoldingPeriod: 'INTRADAY' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface Session {
  id: string
  userId: string
  deviceInfo: {
    userAgent: string
    ip: string
    platform: string
  }
  createdAt: Date
  expiresAt: Date
  isActive: boolean
} 