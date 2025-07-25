'use client'

import React, { useState, useEffect } from 'react'
import { useWebSocket } from './WebSocketProvider'
import { 
  Bell, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle,
  Wifi,
  WifiOff,
  Circle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Volume2,
  DollarSign
} from 'lucide-react'

interface Alert {
  id: string
  type: 'PRICE' | 'TECHNICAL' | 'NEWS' | 'VOLUME' | 'PORTFOLIO'
  symbol?: string
  title: string
  message: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  timestamp: string
  isRead: boolean
  triggeredAt?: string
  targetValue?: number
  currentValue?: number
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [showConnectionStatus, setShowConnectionStatus] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [userId] = useState('demo-user-001') // In production, get from auth context
  
  const { isConnected, serverStats, socket } = useWebSocket()

  // Initialize alerts from backend and setup WebSocket listeners
  useEffect(() => {
    if (!socket || !isConnected) return

    // Authenticate with the WebSocket server for alerts
    socket.emit('authenticate', { userId })

    // Listen for alert notifications
    socket.on('alert_triggered', (data: {
      alert: Alert
      trigger: {
        alertId: string
        symbol: string
        currentValue: number
        targetValue: number
        type: string
        message: string
        triggeredAt: string
      }
    }) => {
      console.log('🔔 Alert triggered:', data)
      
      // Add new alert to the list
      const newAlert: Alert = {
        id: data.alert.id,
        type: data.alert.type,
        symbol: data.trigger.symbol,
        title: `${data.trigger.symbol} Alert`,
        message: data.trigger.message,
        severity: 'WARNING',
        timestamp: data.trigger.triggeredAt,
        isRead: false,
        triggeredAt: data.trigger.triggeredAt,
        targetValue: data.trigger.targetValue,
        currentValue: data.trigger.currentValue
      }
      
      setAlerts(prev => [newAlert, ...prev])
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(`Yobi Alert: ${data.trigger.symbol}`, {
          body: data.trigger.message,
          icon: '/favicon.ico'
        })
      }
    })

    // Listen for authentication confirmation
    socket.on('authenticated', (data: { success: boolean; userId: string }) => {
      console.log('🔐 Authenticated for alerts:', data)
      if (data.success) {
        // Fetch existing alerts
        socket.emit('get_alerts', { userId })
      }
    })

    // Listen for user alerts response
    socket.on('user_alerts', (data: { success: boolean; alerts: any[] }) => {
      if (data.success && data.alerts) {
        const transformedAlerts: Alert[] = data.alerts.map(alert => ({
          id: alert.id,
          type: alert.type,
          symbol: alert.symbol,
          title: `${alert.symbol} ${alert.type} Alert`,
          message: alert.message,
          severity: alert.type === 'PRICE' ? 'INFO' : 'WARNING',
          timestamp: alert.createdAt,
          isRead: !alert.isActive, // Mark triggered alerts as "read"
          triggeredAt: alert.triggeredAt
        }))
        setAlerts(transformedAlerts)
      }
    })

    // Listen for alert errors
    socket.on('alert_error', (data: { success: boolean; error: string }) => {
      console.error('Alert error:', data.error)
    })

    return () => {
      socket.off('alert_triggered')
      socket.off('authenticated')
      socket.off('user_alerts')
      socket.off('alert_error')
    }
  }, [socket, isConnected, userId])

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const clearNotification = (id: string) => {
    setAlerts(prev => prev.filter(n => n.id !== id))
  }
  
  const markAsRead = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, isRead: true } : alert
    ))
  }
  
  const clearAllNotifications = () => {
    setAlerts([])
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PRICE':
        return <DollarSign className="h-5 w-5 text-blue-500" />
      case 'TECHNICAL':
        return <TrendingUp className="h-5 w-5 text-purple-500" />
      case 'VOLUME':
        return <Volume2 className="h-5 w-5 text-orange-500" />
      case 'PORTFOLIO':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'WARNING':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'ERROR':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'INFO':
      default:
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getNotificationBorderColor = (severity: string) => {
    switch (severity) {
      case 'SUCCESS':
        return 'border-l-green-500'
      case 'WARNING':
        return 'border-l-yellow-500'
      case 'ERROR':
        return 'border-l-red-500'
      case 'INFO':
      default:
        return 'border-l-blue-500'
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  // Count unread notifications
  const unreadAlerts = alerts.filter(alert => !alert.isRead)
  const totalNotifications = unreadAlerts.length + (showConnectionStatus && !isConnected ? 1 : 0)
  const hasUnreadNotifications = totalNotifications > 0

  return (
    <div className="relative">
      {/* Notification Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Toggle notifications"
      >
        <Bell className="h-6 w-6" />
        {hasUnreadNotifications && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
            {totalNotifications > 9 ? '9+' : totalNotifications}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notification Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 max-w-sm z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Alerts & Notifications
                  </h3>
                  {totalNotifications > 0 && (
                    <span className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs px-2 py-1 rounded-full">
                      {totalNotifications}
                    </span>
                  )}
                </div>
                {alerts.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
              {/* Connection Status */}
              {showConnectionStatus && (
                <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${
                  isConnected ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {isConnected ? (
                        <Wifi className="h-5 w-5 text-green-500" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Real-time Connection
                        </p>
                        <p className={`text-xs ${
                          isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {isConnected ? `Connected • ${serverStats?.connectedClients || 0} users online` : 'Disconnected • Alerts may be delayed'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Circle 
                        className={`h-3 w-3 ${
                          isConnected ? 'text-green-500 fill-current' : 'text-red-500 fill-current animate-pulse'
                        }`}
                      />
                      <button
                        onClick={() => setShowConnectionStatus(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Dismiss connection status"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerts List */}
              {alerts.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${getNotificationBorderColor(alert.severity)} border-l-4 ${
                        alert.isRead ? 'opacity-60' : ''
                      }`}
                      onClick={() => markAsRead(alert.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getNotificationIcon(alert.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {alert.title}
                              </p>
                              {!alert.isRead && (
                                <div className="h-2 w-2 bg-blue-500 rounded-full ml-2"></div>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {alert.message}
                            </p>
                            {alert.symbol && (
                              <div className="flex items-center justify-between mt-2 text-xs">
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {alert.symbol}
                                </span>
                                {alert.currentValue && alert.targetValue && (
                                  <span className="text-gray-500">
                                    {alert.currentValue.toFixed(2)} / {alert.targetValue.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                              {formatTimeAgo(alert.timestamp)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            clearNotification(alert.id)
                          }}
                          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Dismiss alert"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No alerts yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Set up price and technical alerts to get notified
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            {isConnected && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Real-time alerts enabled</span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Manage Alerts
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
} 