import winston from 'winston'

export const createLogger = (service: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, service: logService, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          service: service || logService,
          message,
          ...meta
        })
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