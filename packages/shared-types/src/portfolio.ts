// Portfolio and trading types

import { AssetClass, OrderSide, OrderStatus, OrderType } from './market'

export interface Portfolio {
  id: string
  userId: string
  name: string
  description?: string
  currency: string
  isDefault: boolean
  isActive: boolean
  totalValue: number
  availableCash: number
  investedAmount: number
  realizedPnL: number
  unrealizedPnL: number
  dayPnL: number
  dayPnLPercent: number
  totalPnL: number
  totalPnLPercent: number
  createdAt: Date
  updatedAt: Date
}

export interface Position {
  id: string
  portfolioId: string
  instrumentId: string
  symbol: string
  assetClass: AssetClass
  quantity: number
  averagePrice: number
  currentPrice: number
  marketValue: number
  investedAmount: number
  realizedPnL: number
  unrealizedPnL: number
  dayPnL: number
  pnlPercent: number
  allocation: number // percentage of portfolio
  firstBuyDate: Date
  lastTransactionDate: Date
  createdAt: Date
  updatedAt: Date
}

export interface Order {
  id: string
  userId: string
  portfolioId: string
  instrumentId: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  executedQuantity: number
  executedPrice: number
  status: OrderStatus
  validity: 'DAY' | 'IOC' | 'GTT' | 'GTC'
  timeInForce: 'DAY' | 'IOC' | 'FOK' | 'GTC'
  message?: string
  fees: number
  tax: number
  placedAt: Date
  executedAt?: Date
  cancelledAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Trade {
  id: string
  orderId: string
  userId: string
  portfolioId: string
  instrumentId: string
  symbol: string
  side: OrderSide
  quantity: number
  price: number
  amount: number
  fees: number
  tax: number
  netAmount: number
  executedAt: Date
  settlementDate: Date
  createdAt: Date
}

export interface Transaction {
  id: string
  portfolioId: string
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'INTEREST' | 'FEE' | 'TAX'
  amount: number
  currency: string
  description: string
  referenceId?: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  processedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Watchlist {
  id: string
  userId: string
  name: string
  description?: string
  isDefault: boolean
  instrumentIds: string[]
  createdAt: Date
  updatedAt: Date
}

export interface PerformanceMetrics {
  portfolioId: string
  period: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL'
  returns: number
  returnsPercent: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  calculatedAt: Date
} 