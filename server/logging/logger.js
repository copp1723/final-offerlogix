import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log format for structured logging
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, userId, requestId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: service || 'mailmind',
      ...(userId && { userId }),
      ...(requestId && { requestId }),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, userId, requestId, ...meta }) => {
    let logLine = `${timestamp} [${level}]`;
    
    if (service) logLine += ` [${service}]`;
    if (userId) logLine += ` [user:${userId}]`;
    if (requestId) logLine += ` [req:${requestId.slice(-8)}]`;
    
    logLine += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logLine += ` ${JSON.stringify(meta)}`;
    }
    
    return logLine;
  })
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'mailmind',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Combined application log
    new winston.transports.File({
      filename: path.join(logsDir, 'application.log'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 10
    }),
    
    // Security-specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            type: 'security',
            message,
            ...meta
          });
        })
      )
    }),
    
    // Debug log (development only)
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.File({
        filename: path.join(logsDir, 'debug.log'),
        level: 'debug',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 3
      })
    ] : [])
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

/**
 * Enhanced logger class with context and convenience methods
 */
class EnhancedLogger {
  constructor(context = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext) {
    return new EnhancedLogger({ ...this.context, ...additionalContext });
  }

  /**
   * Create logger from Express request
   */
  fromRequest(req) {
    const context = {
      requestId: req.requestId || req.headers['x-request-id'],
      userId: req.user?.userId,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.url
    };
    return this.child(context);
  }

  /**
   * Log with specific level and context
   */
  _log(level, message, meta = {}) {
    logger.log(level, message, { ...this.context, ...meta });
  }

  // Standard logging methods
  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  error(message, meta = {}) {
    // Handle Error objects
    if (message instanceof Error) {
      meta = { ...meta, stack: message.stack };
      message = message.message;
    }
    this._log('error', message, meta);
  }

  // Domain-specific logging methods
  api(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'api' });
  }

  security(message, meta = {}) {
    this._log('warn', message, { ...meta, category: 'security' });
  }

  auth(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'auth' });
  }

  campaign(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'campaign' });
  }

  email(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'email' });
  }

  ai(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'ai' });
  }

  webhook(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'webhook' });
  }

  database(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'database' });
  }

  performance(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'performance' });
  }

  audit(message, meta = {}) {
    this._log('info', message, { ...meta, category: 'audit' });
  }
}

/**
 * Global logger instance
 */
const log = new EnhancedLogger();

/**
 * Performance monitoring helpers
 */
export const performance = {
  startTimer: (name) => {
    const start = Date.now();
    return {
      end: (meta = {}) => {
        const duration = Date.now() - start;
        log.performance(`${name} completed`, { ...meta, duration });
        return duration;
      }
    };
  },

  measure: async (name, fn, meta = {}) => {
    const timer = performance.startTimer(name);
    try {
      const result = await fn();
      timer.end({ ...meta, success: true });
      return result;
    } catch (error) {
      timer.end({ ...meta, success: false, error: error.message });
      throw error;
    }
  }
};

/**
 * Structured error logging
 */
export const logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    ...context
  };

  log.error('Application error occurred', errorInfo);
};

/**
 * Security event logging
 */
export const logSecurityEvent = (event, details = {}) => {
  log.security(`Security event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Audit trail logging
 */
export const logAuditEvent = (action, resource, details = {}) => {
  log.audit(`Audit: ${action} ${resource}`, {
    action,
    resource,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Request/Response logging helper
 */
export const logApiCall = (req, res, duration, error = null) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    userId: req.user?.userId,
    requestId: req.requestId
  };

  if (error) {
    log.error('API call failed', { ...logData, error: error.message });
  } else {
    log.api('API call completed', logData);
  }
};

// Export the main logger and utilities
export default log;
export { 
  logger, 
  EnhancedLogger,
  performance as performanceLogger
};