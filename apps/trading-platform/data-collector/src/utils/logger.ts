import winston from 'winston'

// Create a shared logger configuration with proper transports
export const createLogger = (service: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service },
    transports: [
      // Console transport for all logs
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      
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
    ],
    
    // Handle exceptions and rejections
    exceptionHandlers: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    
    rejectionHandlers: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/rejections.log' })
    ]
  })
}

// Export a default logger for general use
export const logger = createLogger('data-collector') 