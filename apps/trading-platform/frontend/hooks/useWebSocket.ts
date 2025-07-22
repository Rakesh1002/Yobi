import { useEffect, useRef, useState, useCallback } from 'react'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
}

export interface WebSocketOptions {
  url: string
  protocols?: string[]
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
  onMessage?: (message: WebSocketMessage) => void
}

export interface WebSocketState {
  socket: WebSocket | null
  lastMessage: WebSocketMessage | null
  readyState: number
  reconnectCount: number
  isConnected: boolean
}

export function useWebSocket(options: WebSocketOptions) {
  const {
    url,
    protocols = [],
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onOpen,
    onClose,
    onError,
    onMessage
  } = options

  const [state, setState] = useState<WebSocketState>({
    socket: null,
    lastMessage: null,
    readyState: WebSocket.CONNECTING,
    reconnectCount: 0,
    isConnected: false
  })

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const shouldReconnectRef = useRef(true)
  const messageQueueRef = useRef<string[]>([])

  const connect = useCallback(() => {
    try {
      const socket = new WebSocket(url, protocols)

      socket.onopen = (event) => {
        console.log('WebSocket connected:', url)
        setState(prev => ({
          ...prev,
          socket,
          readyState: socket.readyState,
          reconnectCount: 0,
          isConnected: true
        }))

        // Send any queued messages
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift()
          if (message && socket.readyState === WebSocket.OPEN) {
            socket.send(message)
          }
        }

        onOpen?.(event)
      }

      socket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        setState(prev => ({
          ...prev,
          socket: null,
          readyState: WebSocket.CLOSED,
          isConnected: false
        }))

        onClose?.(event)

        // Attempt to reconnect if it wasn't a clean close and we haven't exceeded max attempts
        if (shouldReconnectRef.current && 
            state.reconnectCount < maxReconnectAttempts && 
            event.code !== 1000) {
          console.log(`Attempting to reconnect in ${reconnectInterval}ms (attempt ${state.reconnectCount + 1}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setState(prev => ({
              ...prev,
              reconnectCount: prev.reconnectCount + 1
            }))
            connect()
          }, reconnectInterval)
        }
      }

      socket.onerror = (event) => {
        console.error('WebSocket error:', event)
        onError?.(event)
      }

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setState(prev => ({
            ...prev,
            lastMessage: message
          }))
          onMessage?.(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      setState(prev => ({
        ...prev,
        socket,
        readyState: socket.readyState
      }))

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }, [url, protocols, reconnectInterval, maxReconnectAttempts, onOpen, onClose, onError, onMessage, state.reconnectCount])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (state.socket) {
      state.socket.close(1000, 'Manual disconnect')
    }
  }, [state.socket])

  const sendMessage = useCallback((message: any) => {
    const messageString = typeof message === 'string' ? message : JSON.stringify(message)
    
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.send(messageString)
    } else {
      // Queue the message for when connection is restored
      messageQueueRef.current.push(messageString)
    }
  }, [state.socket])

  // Subscribe to specific message types
  const subscribe = useCallback((messageType: string, callback: (data: any) => void) => {
    const handleMessage = (message: WebSocketMessage) => {
      if (message.type === messageType) {
        callback(message.data)
      }
    }

    // Add to existing onMessage callback
    const originalOnMessage = onMessage
    options.onMessage = (message: WebSocketMessage) => {
      originalOnMessage?.(message)
      handleMessage(message)
    }

    return () => {
      // Cleanup subscription
      options.onMessage = originalOnMessage
    }
  }, [onMessage, options])

  // Connect on mount
  useEffect(() => {
    shouldReconnectRef.current = true
    connect()

    return () => {
      shouldReconnectRef.current = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (state.socket) {
        state.socket.close(1000, 'Component unmount')
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    subscribe
  }
} 