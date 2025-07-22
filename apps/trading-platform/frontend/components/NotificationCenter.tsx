'use client'

import React, { useState } from 'react'
import { useWebSocketContext } from './WebSocketProvider'
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
  ChevronUp
} from 'lucide-react'

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [showConnectionStatus, setShowConnectionStatus] = useState(true)
  const {
    isConnected,
    connectionStatus,
    notifications,
    clearNotification,
    clearAllNotifications
  } = useWebSocketContext()

  const getNotificationIcon = (type: string) => {
    switch (type) {
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

  const getNotificationBorderColor = (type: string) => {
    switch (type) {
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

  // Count total notifications (including connection status if shown)
  const totalNotifications = notifications.length + (showConnectionStatus && !isConnected ? 1 : 0)
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
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
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
                    Notifications
                  </h3>
                  {totalNotifications > 0 && (
                    <span className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs px-2 py-1 rounded-full">
                      {totalNotifications}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {totalNotifications > 0 && (
                    <button
                      onClick={() => {
                        clearAllNotifications()
                        setShowConnectionStatus(true) // Reset connection status visibility
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Notification Content */}
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
                          Real-time Data
                        </p>
                        <p className={`text-xs ${
                          isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {connectionStatus}
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

              {/* Notifications List */}
              {notifications.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${getNotificationBorderColor(notification.type)} border-l-4`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                              {formatTimeAgo(notification.timestamp)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => clearNotification(notification.id)}
                          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Dismiss notification"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showConnectionStatus && (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No notifications
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    You're all caught up!
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {(notifications.length > 0 || showConnectionStatus) && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    Close
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