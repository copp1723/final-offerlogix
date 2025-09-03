import { v4 as uuidv4 } from 'uuid';
import log, { 
  logger, 
  EnhancedLogger, 
  logError, 
  logSecurityEvent, 
  logAuditEvent, 
  logApiCall,
  performanceLogger
} from './logger.js';

/**
 * Logging middleware and utilities for Express.js
 * Provides structured logging, correlation IDs, and request tracking
 */

/**
 * Correlation ID middleware
 * Adds a unique correlation ID to each request for tracking across services
 */
export const correlationMiddleware = (req, res, next) => {
  // Check if correlation ID already exists (from load balancer, etc.)
  const existingId = req.headers['x-correlation-id'] || 
                    req.headers['x-request-id'] || 
                    req.headers['x-trace-id'];
  
  const correlationId = existingId || `corr_${uuidv4()}`;
  
  // Add correlation ID to request
  req.correlationId = correlationId;
  req.requestId = correlationId; // Alias for backward compatibility
  
  // Add to response headers
  res.set('X-Correlation-ID', correlationId);
  res.set('X-Request-ID', correlationId);
  
  // Create request-scoped logger
  req.log = log.fromRequest(req);
  
  next();
};

/**
 * Request logging middleware
 * Logs incoming requests with timing and response information
 */
export const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Skip logging for health checks and static assets
  const skipPaths = ['/health', '/api/health', '/favicon.ico'];
  const shouldSkip = skipPaths.some(path => req.path === path) || 
                    req.path.startsWith('/static/') ||
                    req.path.startsWith('/assets/');
  
  if (shouldSkip) {
    return next();
  }

  // Log incoming request
  req.log.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    contentLength: req.headers['content-length'],
    contentType: req.headers['content-type']
  });

  // Capture response details
  const originalSend = res.send;
  res.send = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log response
    req.log.info('Request completed', {
      statusCode: res.statusCode,
      duration,
      contentLength: Buffer.isBuffer(data) ? data.length : 
                    typeof data === 'string' ? data.length : 
                    data ? JSON.stringify(data).length : 0
    });

    // Performance warnings for slow requests
    if (duration > 5000) { // 5 seconds
      req.log.warn('Slow request detected', {
        duration,
        threshold: 5000
      });
    }

    return originalSend.call(this, data);
  };

  // Handle connection close/abort
  req.on('close', () => {
    if (!res.headersSent) {
      req.log.warn('Request connection closed unexpectedly', {
        duration: Date.now() - startTime
      });
    }
  });

  next();
};

/**
 * Error logging middleware
 * Captures and logs application errors with context
 */
export const errorLoggingMiddleware = (err, req, res, next) => {
  const errorId = `err_${uuidv4()}`;
  
  // Prepare error context
  const errorContext = {
    errorId,
    url: req.url,
    method: req.method,
    correlationId: req.correlationId,
    userId: req.user?.userId,
    clientId: req.user?.clientId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    body: req.method !== 'GET' ? req.body : undefined,
    params: req.params,
    query: req.query
  };

  // Log error with full context
  if (req.log) {
    req.log.error('Request error occurred', {
      error: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status || err.statusCode,
      ...errorContext
    });
  } else {
    logError(err, errorContext);
  }

  // Add error ID to response
  res.set('X-Error-ID', errorId);
  
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    if (err.status >= 400 && err.status < 500) {
      // Client errors - safe to expose
      return res.status(err.status).json({
        error: err.message,
        code: err.code,
        errorId
      });
    } else {
      // Server errors - hide details
      return res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        errorId
      });
    }
  } else {
    // Development - expose full error details
    return res.status(err.status || 500).json({
      error: err.message,
      code: err.code,
      stack: err.stack,
      errorId,
      context: errorContext
    });
  }
};

/**
 * Security logging middleware
 * Monitors and logs security-related events
 */
export const securityLoggingMiddleware = (req, res, next) => {
  // Monitor for suspicious activity
  const suspiciousPatterns = [
    /\.\.\//g, // Directory traversal
    /<script/gi, // XSS attempts
    /union.*select/gi, // SQL injection
    /javascript:/gi, // JavaScript protocol
    /vbscript:/gi, // VBScript protocol
  ];

  const checkForSuspicious = (str) => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  // Check URL for suspicious patterns
  if (checkForSuspicious(req.url)) {
    logSecurityEvent('suspicious_url_pattern', {
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId
    });
  }

  // Check headers for suspicious content
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === 'string' && checkForSuspicious(value)) {
      logSecurityEvent('suspicious_header_content', {
        header: key,
        value: value.substring(0, 100), // Truncate for logging
        ip: req.ip,
        correlationId: req.correlationId
      });
    }
  });

  // Monitor for unusual request sizes
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB
    logSecurityEvent('large_request_body', {
      contentLength,
      url: req.url,
      ip: req.ip,
      correlationId: req.correlationId
    });
  }

  // Monitor for rapid requests from same IP
  const ip = req.ip;
  const now = Date.now();
  
  if (!global.ipRequestCounts) {
    global.ipRequestCounts = new Map();
  }

  const ipData = global.ipRequestCounts.get(ip) || { count: 0, firstRequest: now };
  ipData.count++;
  ipData.lastRequest = now;

  // Check for rapid requests (more than 100 in 1 minute)
  if (ipData.count > 100 && (now - ipData.firstRequest) < 60000) {
    logSecurityEvent('rapid_requests_detected', {
      ip,
      requestCount: ipData.count,
      timeWindow: now - ipData.firstRequest,
      correlationId: req.correlationId
    });
  }

  // Clean up old IP data periodically
  if (Math.random() < 0.01) { // 1% chance per request
    const cutoff = now - 60000; // 1 minute ago
    for (const [ipKey, data] of global.ipRequestCounts.entries()) {
      if (data.lastRequest < cutoff) {
        global.ipRequestCounts.delete(ipKey);
      } else {
        // Reset count for continuing IPs
        data.count = Math.max(0, data.count - 10);
        data.firstRequest = Math.max(data.firstRequest, cutoff);
      }
    }
  }

  global.ipRequestCounts.set(ip, ipData);
  
  next();
};

/**
 * Authentication logging middleware
 * Logs authentication attempts and user sessions
 */
export const authLoggingMiddleware = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(obj) {
    // Log successful authentication
    if (req.path.includes('/auth/') || req.path.includes('/login')) {
      if (res.statusCode === 200 && obj.token) {
        logAuditEvent('user_login_success', 'authentication', {
          userId: obj.user?.id || obj.userId,
          username: obj.user?.username || obj.username,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: req.correlationId
        });
      } else if (res.statusCode >= 400) {
        logSecurityEvent('authentication_failure', {
          statusCode: res.statusCode,
          error: obj.error,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: req.correlationId
        });
      }
    }

    return originalJson.call(this, obj);
  };

  next();
};

/**
 * Database operation logging middleware
 */
export const dbLoggingMiddleware = (req, res, next) => {
  // This would typically integrate with your database layer
  // For now, we'll just add a helper to the request
  req.logDbOperation = (operation, table, details = {}) => {
    if (req.log) {
      req.log.database(`Database ${operation}`, {
        operation,
        table,
        ...details
      });
    }
  };
  
  next();
};

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  // Add performance timer to request
  req.perf = {
    startTime,
    mark: (name) => {
      const currentTime = process.hrtime.bigint();
      const duration = Number(currentTime - startTime) / 1000000; // Convert to milliseconds
      
      req.log?.performance(`Performance mark: ${name}`, {
        mark: name,
        duration,
        memoryUsage: process.memoryUsage()
      });
      
      return duration;
    }
  };

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    const endMemory = process.memoryUsage();
    
    const memoryDelta = {
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };

    if (duration > 1000 || memoryDelta.heapUsed > 10 * 1024 * 1024) { // Log if >1s or >10MB memory
      req.log?.performance('Request performance metrics', {
        duration,
        memoryDelta,
        statusCode: res.statusCode
      });
    }
  });

  next();
};

// Export all logging functions and middleware
export {
  log,
  logger,
  EnhancedLogger,
  logError,
  logSecurityEvent,
  logAuditEvent,
  logApiCall,
  performanceLogger
};

// Export convenience logging functions
export const createLogger = (context = {}) => new EnhancedLogger(context);
export const getRequestLogger = (req) => log.fromRequest(req);

// Export all middleware as a bundle for easy application
export const applyAllLoggingMiddleware = (app) => {
  app.use(correlationMiddleware);
  app.use(securityLoggingMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(authLoggingMiddleware);
  app.use(dbLoggingMiddleware);
  app.use(performanceMiddleware);
};

// Default export
export default log;