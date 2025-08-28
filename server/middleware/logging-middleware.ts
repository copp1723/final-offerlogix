import { Request, Response, NextFunction } from 'express';
import { log } from '../logging/logger';

/**
 * Request logging middleware
 * Captures all API requests with timing and context
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestLogger = log.fromRequest(req);

  // Log incoming request
  requestLogger.info('API Request received', {
    component: 'api',
    endpoint: req.path,
    method: req.method,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'origin': req.headers.origin
    }
  });

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    
    // Log API response
    requestLogger.api('API Response sent', {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      requestSize: parseInt(req.headers['content-length'] || '0'),
      responseSize: res.get('content-length') ? parseInt(res.get('content-length')!) : 0
    });

    // Call original end and return result
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Security logging middleware
 * Detects and logs suspicious patterns
 */
export function securityLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    /\.\.\//g,  // Path traversal
    /<script/gi, // XSS attempts
    /union\s+select/gi, // SQL injection
    /javascript:/gi, // Script injection
    /eval\(/gi, // Code injection
  ];

  const url = req.url;
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const combinedContent = `${url} ${body}`;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(combinedContent)) {
      log.security('Suspicious request detected', {
        eventType: 'suspicious_request',
        severity: 'medium' as const,
        sourceIp: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        pattern: pattern.toString(),
        actionTaken: 'logged'
      });
      break;
    }
  }

  next();
}

/**
 * Error logging middleware
 * Captures and logs all errors with context
 */
export function errorLoggingMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  const requestLogger = log.fromRequest(req);
  
  requestLogger.error('Unhandled error in request', {
    error,
    component: 'api',
    operation: `${req.method} ${req.path}`,
    severity: res.statusCode >= 500 ? 'high' as const : 'medium' as const
  });

  // Don't interfere with existing error handling
  next(error);
}

/**
 * Database operation wrapper with logging
 */
export function withDatabaseLogging<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return fn()
    .then(result => {
      const duration = Date.now() - startTime;
      log.database('Database operation completed', {
        operation: operation as any,
        table,
        duration,
        status: 'success'
      });
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      log.database('Database operation failed', {
        operation: operation as any,
        table,
        duration,
        status: 'error',
        error: error.message
      });
      throw error;
    });
}