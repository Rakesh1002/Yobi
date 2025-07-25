import winston from 'winston'

// Create a shared logger configuration with proper transports
export const createLogger = (service: string) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const transports: winston.transport[] = []
  
  // Add console transport only if stdout is available and not detached
  if (process.stdout && process.stdout.writable && !isProduction) {
    try {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
          handleExceptions: false,
          handleRejections: false
        })
      )
    } catch (error) {
      // Ignore console transport errors
    }
  }
  
  // Always add file transports
  transports.push(
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  )

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service },
    transports,
    
    // Handle exceptions and rejections with file only
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' })
    ],
    
    // Prevent crashes from transport errors
    exitOnError: false
  })

  // Add error handling for transport failures
  logger.on('error', (error) => {
    // Silently ignore transport errors to prevent crashes
    console.error('Logger transport error:', error.message)
  })

  return logger
}

// Export a default logger for general use
export const logger = createLogger('data-collector') 