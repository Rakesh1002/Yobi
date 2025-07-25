'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface MarketData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: string
  currency?: string
  exchange?: string
}

interface CachedPrice {
  symbol: string
  price: number
  changePercent: number
  timestamp: string
  currency?: string
}

interface ServerStats {
  connectedClients: number
  subscribedSymbols: number
  timestamp: string
}

interface WebSocketContextType {
  socket: Socket | null
  isConnected: boolean
  marketData: Map<string, MarketData>
  serverStats: ServerStats | null
  subscribe: (symbols: string[], type?: string) => void
  unsubscribe: (symbols: string[], type?: string) => void
  getLatestPrice: (symbol: string) => MarketData | null
  getCachedPrice: (symbol: string) => CachedPrice | null
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

// Price cache utilities
const CACHE_KEY = 'market_prices_cache'
const CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes

const getCachedPrices = (): Map<string, CachedPrice> => {
  if (typeof window === 'undefined') return new Map()
  
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return new Map()
    
    const data = JSON.parse(cached)
    const now = Date.now()
    
    // Filter out expired entries
    const validEntries = Object.entries(data).filter(([_, price]: [string, any]) => {
      return now - new Date(price.timestamp).getTime() < CACHE_EXPIRY
    })
    
    return new Map(validEntries as [string, CachedPrice][])
  } catch (error) {
    console.warn('Failed to load cached prices:', error)
    return new Map()
  }
}

const setCachedPrices = (priceMap: Map<string, CachedPrice>) => {
  if (typeof window === 'undefined') return
  
  try {
    const data = Object.fromEntries(priceMap)
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to cache prices:', error)
  }
}

interface WebSocketProviderProps {
  children: React.ReactNode
  autoConnect?: boolean
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  autoConnect = true 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map())
  const [cachedPrices, setCachedPricesState] = useState<Map<string, CachedPrice>>(new Map())
  const [serverStats, setServerStats] = useState<ServerStats | null>(null)
  const subscriptionsRef = useRef<Set<string>>(new Set())

  // Load cached prices on mount
  useEffect(() => {
    const cached = getCachedPrices()
    setCachedPricesState(cached)
    console.log(`📦 Loaded ${cached.size} cached prices`)
  }, [])

  const subscribe = useCallback((symbols: string[], type: string = 'quotes') => {
    if (!socket || !isConnected) return
    
    // Only subscribe to symbols we're not already subscribed to
    const newSymbols = symbols.filter(symbol => !subscriptionsRef.current.has(symbol))
    
    if (newSymbols.length > 0) {
      socket.emit('subscribe', { symbols: newSymbols, type })
      newSymbols.forEach(symbol => subscriptionsRef.current.add(symbol))
      console.log(`🔔 Subscribed to ${newSymbols.length} new symbols:`, newSymbols)
    }
  }, [socket, isConnected])

  const unsubscribe = useCallback((symbols: string[], type: string = 'quotes') => {
    if (!socket || !isConnected) return
    
    // Only unsubscribe from symbols we're actually subscribed to
    const activeSymbols = symbols.filter(symbol => subscriptionsRef.current.has(symbol))
    
    if (activeSymbols.length > 0) {
      socket.emit('unsubscribe', { symbols: activeSymbols, type })
      activeSymbols.forEach(symbol => subscriptionsRef.current.delete(symbol))
      console.log(`🔕 Unsubscribed from ${activeSymbols.length} symbols:`, activeSymbols)
    }
  }, [socket, isConnected])

  const getLatestPrice = useCallback((symbol: string): MarketData | null => {
    return marketData.get(symbol.toUpperCase()) || null
  }, [marketData])

  const getCachedPrice = useCallback((symbol: string): CachedPrice | null => {
    return cachedPrices.get(symbol.toUpperCase()) || null
  }, [cachedPrices])

  useEffect(() => {
    if (!autoConnect) return

    console.log('🚀 Initializing WebSocket connection...')

    // Create socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002', {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      forceNew: true
    })

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected:', newSocket.id)
      setIsConnected(true)
      
      // Re-subscribe to any symbols we were tracking
      const activeSymbols = Array.from(subscriptionsRef.current)
      if (activeSymbols.length > 0) {
        newSocket.emit('subscribe', { symbols: activeSymbols, type: 'quotes' })
        console.log(`🔄 Re-subscribed to ${activeSymbols.length} symbols after reconnection`)
      }
    })

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason)
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('🚫 WebSocket connection error:', error)
      setIsConnected(false)
    })

    // Server status
    newSocket.on('connection_status', (data) => {
      console.log('📊 Connection status:', data)
    })

    // Market data updates
    newSocket.on('market_data', (data: {
      symbol: string
      type: string
      data: MarketData
    }) => {
      const { symbol, data: priceData } = data
      const symbolUpper = symbol.toUpperCase()
      
      setMarketData(prev => {
        const newMap = new Map(prev)
        newMap.set(symbolUpper, {
          ...priceData,
          symbol: symbolUpper
        })
        return newMap
      })

      // Update cache
      setCachedPricesState(prev => {
        const newMap = new Map(prev)
        newMap.set(symbolUpper, {
          symbol: symbolUpper,
          price: priceData.price,
          changePercent: priceData.changePercent,
          timestamp: new Date().toISOString(),
          currency: priceData.currency
        })
        
        // Persist to localStorage
        setCachedPrices(newMap)
        return newMap
      })

      // Log significant price changes
      const prevData = marketData.get(symbolUpper)
      if (prevData && Math.abs(priceData.changePercent) > 2) {
        console.log(`📈 Significant change for ${symbol}: ${priceData.changePercent.toFixed(2)}%`)
      }
    })

    // Server statistics
    newSocket.on('server_stats', (stats: ServerStats) => {
      setServerStats(stats)
    })

    // Pong response for ping/pong health checks
    newSocket.on('pong', (data) => {
      console.log('🏓 Pong received:', data.timestamp)
    })

    // Error handling
    newSocket.on('error', (error) => {
      console.error('🚨 WebSocket error:', error)
    })

    setSocket(newSocket)

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection')
      subscriptionsRef.current.clear()
      newSocket.close()
    }
  }, [autoConnect])

  // Ping server every 30 seconds to keep connection alive
  useEffect(() => {
    if (!socket || !isConnected) return

    const pingInterval = setInterval(() => {
      socket.emit('ping')
    }, 30000)

    return () => clearInterval(pingInterval)
  }, [socket, isConnected])

  const contextValue: WebSocketContextType = {
    socket,
    isConnected,
    marketData,
    serverStats,
    subscribe,
    unsubscribe,
    getLatestPrice,
    getCachedPrice
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

// Real-time price component for displaying live updates
export const RealTimePriceDisplay: React.FC<{
  symbol: string
  className?: string
  fallbackPrice?: number
  fallbackCurrency?: string
}> = ({ symbol, className = '', fallbackPrice, fallbackCurrency = 'USD' }) => {
  const { getLatestPrice, getCachedPrice, subscribe, isConnected } = useWebSocket()
  const [priceData, setPriceData] = useState<MarketData | null>(null)
  const [cachedData, setCachedData] = useState<CachedPrice | null>(null)
  const hasSubscribed = useRef(false)

  useEffect(() => {
    // Subscribe to this symbol only once
    if (!hasSubscribed.current) {
    subscribe([symbol])
      hasSubscribed.current = true
    }
  }, [symbol, subscribe])

  useEffect(() => {
    // Update price data when market data changes
    const liveData = getLatestPrice(symbol)
    const cached = getCachedPrice(symbol)
    
    setPriceData(liveData)
    setCachedData(cached)
  }, [symbol, getLatestPrice, getCachedPrice])

  // Determine what data to display - prioritize live, then cached, then fallback
  const displayData = priceData || cachedData
  const isLive = !!priceData && isConnected
  const isCached = !priceData && !!cachedData
  const isStale = cachedData && !priceData && 
    (Date.now() - new Date(cachedData.timestamp).getTime()) > 300000 // More than 5 minutes old

  // Only show fallback if we have no real data and no cached data
  if (!displayData && fallbackPrice) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          {fallbackCurrency === 'INR' ? '₹' : '$'}{fallbackPrice.toFixed(2)}
        </span>
        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
          Static
        </span>
      </div>
    )
  }

  // Show loading state only if we have no data at all
  if (!displayData) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-gray-500 animate-pulse">Loading...</span>
        <span className={`text-xs ${isConnected ? 'text-yellow-500' : 'text-red-500'}`}>
          {isConnected ? '◐' : '●'}
        </span>
      </div>
    )
  }

  const isPositive = (displayData?.changePercent || 0) >= 0
  const changeColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-semibold ${isStale ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
        {displayData?.currency === 'INR' ? '₹' : '$'}{displayData?.price.toFixed(2)}
      </span>
      <span className={`text-sm ${changeColor} ${isStale ? 'opacity-70' : ''}`}>
        {isPositive ? '+' : ''}{(displayData?.changePercent || 0).toFixed(2)}%
      </span>
      
      {/* Status indicator with tooltip-like behavior */}
      <div className="flex items-center gap-1">
        <span className={`text-xs ${
          isLive ? 'text-green-500' : 
          isCached && !isStale ? 'text-blue-500' : 
          isStale ? 'text-orange-500' : 'text-red-500'
        }`}>
          {isLive ? '●' : isCached && !isStale ? '◐' : isStale ? '◑' : '●'}
        </span>
        
        {/* Only show status text for non-live data */}
        {!isLive && (
          <span className={`text-xs px-1.5 py-0.5 rounded text-white ${
            isCached && !isStale ? 'bg-blue-500' :
            isStale ? 'bg-orange-500' : 'bg-red-500'
          }`}>
            {isCached && !isStale ? 'Cached' : isStale ? 'Stale' : 'Offline'}
          </span>
      )}
      </div>
    </div>
  )
}

// Connection status indicator
export const WebSocketStatus: React.FC = () => {
  const { isConnected, serverStats } = useWebSocket()

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
        {isConnected ? 'Live' : 'Disconnected'}
      </span>
      {serverStats && (
        <span className="text-gray-500">
          ({serverStats.connectedClients} clients)
        </span>
      )}
    </div>
  )
} 