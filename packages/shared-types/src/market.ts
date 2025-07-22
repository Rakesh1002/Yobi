// Market data types for trading instruments

export enum AssetClass {
  STOCK = 'STOCK',
  ETF = 'ETF',
  MUTUAL_FUND = 'MUTUAL_FUND',
  BOND = 'BOND',
  COMMODITY = 'COMMODITY',
  CRYPTO = 'CRYPTO',
  FOREX = 'FOREX',
  FIXED_DEPOSIT = 'FIXED_DEPOSIT'
}

export enum Exchange {
  NSE = 'NSE',
  BSE = 'BSE',
  NASDAQ = 'NASDAQ',
  NYSE = 'NYSE',
  CRYPTO = 'CRYPTO',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_LOSS = 'STOP_LOSS',
  STOP_LIMIT = 'STOP_LIMIT',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PLACED = 'PLACED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export interface Instrument {
  id: string
  symbol: string
  name: string
  assetClass: AssetClass
  exchange: Exchange
  sector?: string
  industry?: string
  isin?: string
  currency: string
  lotSize: number
  tickSize: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MarketData {
  instrumentId: string
  symbol: string
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  previousClose: number
  volume: number
  value: number
  trades: number
  bid: number
  ask: number
  bidSize: number
  askSize: number
  lastPrice: number
  lastSize: number
  change: number
  changePercent: number
  dayHigh: number
  dayLow: number
  weekHigh52: number
  weekLow52: number
  vwap: number
  openInterest?: number
}

export interface OHLCV {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
  trades?: number
}

export interface TickData {
  instrumentId: string
  timestamp: Date
  price: number
  volume: number
  side: OrderSide
}

export interface DepthData {
  instrumentId: string
  timestamp: Date
  bids: Array<{ price: number; size: number; orders: number }>
  asks: Array<{ price: number; size: number; orders: number }>
}

export interface TechnicalIndicator {
  name: string
  value: number
  signal?: 'BUY' | 'SELL' | 'NEUTRAL'
  timestamp: Date
}

export interface MarketIndicators {
  instrumentId: string
  timestamp: Date
  rsi: number
  rsi14: number
  macd: {
    macd: number
    signal: number
    histogram: number
  }
  bollingerBands: {
    upper: number
    middle: number
    lower: number
  }
  movingAverages: {
    sma20: number
    sma50: number
    sma200: number
    ema12: number
    ema26: number
  }
  atr: number
  adx: number
  obv: number
  volumeProfile: {
    poc: number // Point of Control
    vah: number // Value Area High
    val: number // Value Area Low
  }
} 