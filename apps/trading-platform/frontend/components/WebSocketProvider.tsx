'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'

interface MarketUpdate {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: string
}

interface NotificationMessage {
  id: string
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  title: string
  message: string
  timestamp: string
  autoHide?: boolean
}

interface WebSocketContextValue {
  isConnected: boolean
  reconnectCount: number
  marketUpdates: MarketUpdate[]
  notifications: NotificationMessage[]
  connectionStatus: string
  sendMessage: (message: any) => void
  subscribeToSymbol: (symbol: string) => void
  unsubscribeFromSymbol: (symbol: string) => void
  clearNotification: (id: string) => void
  clearAllNotifications: () => void
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function useWebSocketContext() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: ReactNode
}

export default function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [marketUpdates, setMarketUpdates] = useState<MarketUpdate[]>([])
  const [notifications, setNotifications] = useState<NotificationMessage[]>([])
  const [subscribedSymbols, setSubscribedSymbols] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  // WebSocket connection
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3003'
  
  const { isConnected, reconnectCount, sendMessage } = useWebSocket({
    url: wsUrl,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
    onOpen: () => {
      console.log('WebSocket connected to:', wsUrl)
      addNotification({
        id: Date.now().toString(),
        type: 'SUCCESS',
        title: 'Connected',
        message: 'Real-time data connection established',
        timestamp: new Date().toISOString(),
        autoHide: true
      })
      
      // Resubscribe to symbols after reconnection
      subscribedSymbols.forEach(symbol => {
        sendMessage({
          type: 'SUBSCRIBE',
          data: { symbol }
        })
      })
    },
    onClose: () => {
      addNotification({
        id: Date.now().toString(),
        type: 'WARNING',
        title: 'Disconnected',
        message: 'Real-time data connection lost. Attempting to reconnect...',
        timestamp: new Date().toISOString(),
        autoHide: true
      })
    },
    onError: () => {
      addNotification({
        id: Date.now().toString(),
        type: 'ERROR',
        title: 'Connection Error',
        message: 'Failed to connect to real-time data service',
        timestamp: new Date().toISOString(),
        autoHide: false
      })
    },
    onMessage: (message: WebSocketMessage) => {
      handleWebSocketMessage(message)
    }
  })

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'MARKET_UPDATE':
        handleMarketUpdate(message.data)
        break
      case 'PRICE_ALERT':
        handlePriceAlert(message.data)
        break
      case 'NEWS_ALERT':
        handleNewsAlert(message.data)
        break
      case 'SYSTEM_MESSAGE':
        handleSystemMessage(message.data)
        break
      default:
        console.log('Unknown message type:', message.type)
    }
  }

  const handleMarketUpdate = (update: MarketUpdate) => {
    setMarketUpdates(prev => {
      const existing = prev.find(item => item.symbol === update.symbol)
      if (existing) {
        return prev.map(item => 
          item.symbol === update.symbol ? update : item
        )
      } else {
        return [...prev.slice(-99), update] // Keep last 100 updates
      }
    })

    // Invalidate relevant queries to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['rankings'] })
    queryClient.invalidateQueries({ queryKey: ['instrument', update.symbol] })
  }

  const handlePriceAlert = (alert: any) => {
    addNotification({
      id: Date.now().toString(),
      type: alert.type || 'INFO',
      title: `Price Alert: ${alert.symbol}`,
      message: alert.message,
      timestamp: new Date().toISOString(),
      autoHide: false
    })
  }

  const handleNewsAlert = (alert: any) => {
    addNotification({
      id: Date.now().toString(),
      type: 'INFO',
      title: 'Market News',
      message: alert.headline,
      timestamp: new Date().toISOString(),
      autoHide: true
    })

    // Invalidate news queries
    queryClient.invalidateQueries({ queryKey: ['market-news'] })
  }

  const handleSystemMessage = (message: any) => {
    addNotification({
      id: Date.now().toString(),
      type: message.type || 'INFO',
      title: 'System Message',
      message: message.content,
      timestamp: new Date().toISOString(),
      autoHide: message.autoHide !== false
    })
  }

  const addNotification = (notification: NotificationMessage) => {
    setNotifications(prev => [notification, ...prev.slice(0, 9)]) // Keep last 10 notifications
    
    // Auto-hide notifications after 5 seconds
    if (notification.autoHide) {
      setTimeout(() => {
        clearNotification(notification.id)
      }, 5000)
    }
  }

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  const subscribeToSymbol = (symbol: string) => {
    if (!subscribedSymbols.has(symbol)) {
      setSubscribedSymbols(prev => new Set([...prev, symbol]))
      sendMessage({
        type: 'SUBSCRIBE',
        data: { symbol }
      })
    }
  }

  const unsubscribeFromSymbol = (symbol: string) => {
    if (subscribedSymbols.has(symbol)) {
      setSubscribedSymbols(prev => {
        const newSet = new Set(prev)
        newSet.delete(symbol)
        return newSet
      })
      sendMessage({
        type: 'UNSUBSCRIBE',
        data: { symbol }
      })
    }
  }

  const getConnectionStatus = () => {
    if (isConnected) return 'Connected'
    if (reconnectCount > 0) return `Reconnecting... (${reconnectCount})`
    return 'Connecting...'
  }

  const contextValue: WebSocketContextValue = {
    isConnected,
    reconnectCount,
    marketUpdates,
    notifications,
    connectionStatus: getConnectionStatus(),
    sendMessage,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    clearNotification,
    clearAllNotifications
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
} 