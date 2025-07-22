import winston from 'winston'

// Safe JSON stringify that handles circular references
const safeStringify = (obj: any): string => {
  const seen = new WeakSet()
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)
    }
    return value
  })
}

// Sanitize error objects for logging
const sanitizeForLogging = (obj: any): any => {
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
      code: (obj as any).code,
      status: (obj as any).status
    }
  }
  
  if (typeof obj === 'object' && obj !== null) {
    // Handle axios error objects specifically
    if (obj.response || obj.request || obj.config) {
      return {
        message: obj.message,
        code: obj.code,
        status: obj.response?.status,
        statusText: obj.response?.statusText,
        url: obj.config?.url,
        method: obj.config?.method
      }
    }
    
    // For other objects, try to safely extract key properties
    const sanitized: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key]
        if (typeof value !== 'function' && key !== 'request' && key !== 'socket' && key !== 'connection') {
          sanitized[key] = typeof value === 'object' ? sanitizeForLogging(value) : value
        }
      }
    }
    return sanitized
  }
  
  return obj
}

export const createLogger = (service: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, service: logService, ...meta }) => {
        try {
          // Sanitize meta object to prevent circular references
          const sanitizedMeta = sanitizeForLogging(meta)
          return safeStringify({
            timestamp,
            level,
            service: service || logService,
            message,
            ...sanitizedMeta
          })
        } catch (error) {
          // Fallback if sanitization fails
          return safeStringify({
            timestamp,
            level,
            service: service || logService,
            message: typeof message === 'string' ? message : '[Complex Object]',
            error: 'Failed to serialize log data'
          })
        }
      })
    ),
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, service: logService }) => {
            return `${timestamp} [${service || logService}] ${level}: ${message}`
          })
        )
      }),
      new winston.transports.File({ 
        filename: 'combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ]
  })
} 