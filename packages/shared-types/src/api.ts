// API request and response types

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  message: string
  details?: any
  timestamp: Date
}

export interface ApiMeta {
  page?: number
  limit?: number
  total?: number
  hasMore?: boolean
  timestamp?: Date
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface TimeRangeParams {
  startDate?: Date | string
  endDate?: Date | string
  interval?: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M'
}

export interface FilterParams {
  assetClass?: string[]
  exchange?: string[]
  sector?: string[]
  minPrice?: number
  maxPrice?: number
  minVolume?: number
  minMarketCap?: number
  signal?: string[]
}

// WebSocket message types
export interface WSMessage {
  type: WSMessageType
  channel?: string
  data: any
  timestamp: Date
}

export enum WSMessageType {
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  MARKET_DATA = 'MARKET_DATA',
  TICK_DATA = 'TICK_DATA',
  DEPTH_DATA = 'DEPTH_DATA',
  TRADE_UPDATE = 'TRADE_UPDATE',
  ORDER_UPDATE = 'ORDER_UPDATE',
  ALERT = 'ALERT',
  ERROR = 'ERROR',
  HEARTBEAT = 'HEARTBEAT',
}

export interface WSSubscription {
  channel: string
  symbols?: string[]
  types?: WSMessageType[]
}

// Request types
export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
}

export interface CreateOrderRequest {
  portfolioId: string
  instrumentId: string
  side: 'BUY' | 'SELL'
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LIMIT'
  quantity: number
  price?: number
  stopPrice?: number
  validity?: 'DAY' | 'IOC' | 'GTT' | 'GTC'
}

export interface CreatePortfolioRequest {
  name: string
  description?: string
  currency: string
  initialCash?: number
}

export interface CreateWatchlistRequest {
  name: string
  description?: string
  instrumentIds: string[]
}

export interface CreateAlertRequest {
  instrumentId: string
  type: 'PRICE' | 'VOLUME' | 'TECHNICAL' | 'FUNDAMENTAL' | 'NEWS'
  condition: string
  value: number
  message?: string
  expiresAt?: Date
} 