// Analysis and recommendation types

import { AssetClass } from './market'

export enum AnalysisType {
  TECHNICAL = 'TECHNICAL',
  FUNDAMENTAL = 'FUNDAMENTAL',
  SENTIMENT = 'SENTIMENT',
  QUANTITATIVE = 'QUANTITATIVE',
  AI_POWERED = 'AI_POWERED',
}

export enum SignalStrength {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  NEUTRAL = 'NEUTRAL',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL',
}

export enum TimeHorizon {
  INTRADAY = 'INTRADAY',
  SHORT_TERM = 'SHORT_TERM', // 1-7 days
  MEDIUM_TERM = 'MEDIUM_TERM', // 1-4 weeks
  LONG_TERM = 'LONG_TERM', // > 1 month
}

export interface InstrumentRanking {
  rank: number
  instrumentId: string
  symbol: string
  name: string
  assetClass: AssetClass
  score: number // 0-100
  signal: SignalStrength
  timeHorizon: TimeHorizon
  expectedReturn: number
  riskScore: number
  confidence: number // 0-100
  lastUpdated: Date
  metrics: RankingMetrics
  recommendation: Recommendation
}

export interface RankingMetrics {
  technicalScore: number
  fundamentalScore: number
  sentimentScore: number
  momentumScore: number
  volatilityScore: number
  liquidityScore: number
  relativeStrengthIndex: number
  priceToEarnings?: number
  priceToBook?: number
  debtToEquity?: number
  returnOnEquity?: number
  earningsGrowth?: number
}

export interface Recommendation {
  id: string
  instrumentId: string
  type: AnalysisType
  action: 'BUY' | 'SELL' | 'HOLD'
  signal: SignalStrength
  entryPrice: number
  targetPrice: number
  stopLoss: number
  expectedReturn: number
  riskRewardRatio: number
  timeHorizon: TimeHorizon
  confidence: number
  rationale: string
  keyPoints: string[]
  risks: string[]
  createdAt: Date
  validUntil: Date
}

export interface FundamentalData {
  instrumentId: string
  marketCap: number
  enterpriseValue: number
  peRatio: number
  pegRatio: number
  psRatio: number
  pbRatio: number
  evToRevenue: number
  evToEbitda: number
  beta: number
  eps: number
  epsGrowth: number
  revenue: number
  revenueGrowth: number
  grossProfit: number
  grossMargin: number
  operatingMargin: number
  netMargin: number
  roe: number
  roa: number
  debtToEquity: number
  currentRatio: number
  quickRatio: number
  dividendYield: number
  payoutRatio: number
  lastUpdated: Date
}

export interface TechnicalAnalysis {
  instrumentId: string
  timestamp: Date
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  support: number[]
  resistance: number[]
  pivotPoints: {
    r3: number
    r2: number
    r1: number
    pivot: number
    s1: number
    s2: number
    s3: number
  }
  patterns: Pattern[]
  signals: Signal[]
}

export interface Pattern {
  type: string // 'HEAD_AND_SHOULDERS', 'TRIANGLE', 'FLAG', etc.
  confidence: number
  startDate: Date
  endDate?: Date
  targetPrice?: number
}

export interface Signal {
  type: string // 'GOLDEN_CROSS', 'RSI_OVERSOLD', etc.
  strength: SignalStrength
  timestamp: Date
  description: string
}

export interface Alert {
  id: string
  userId: string
  instrumentId: string
  type: 'PRICE' | 'VOLUME' | 'TECHNICAL' | 'FUNDAMENTAL' | 'NEWS'
  condition: string
  value: number
  isActive: boolean
  triggered: boolean
  triggeredAt?: Date
  message: string
  createdAt: Date
  expiresAt?: Date
} 