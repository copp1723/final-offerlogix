/**
 * Correlation ID Middleware
 * Implements request correlation IDs for distributed tracing and debugging
 */

import { Request, Response, NextFunction } from 'express';
import { log } from './logger';

// Extend Express Request type to include correlation ID and session properties
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
      sessionID?: string;
    }
  }
}

/**
 * Generate a unique correlation ID for each request
 */
function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Correlation ID middleware
 * Adds correlation ID to request and response headers for tracing
 */
export function correlationMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  const startTime = Date.now();
  
  // Extract or generate correlation ID
  const correlationId = (
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    generateCorrelationId()
  ) as string;

  // Add to request object
  req.correlationId = correlationId;
  req.startTime = startTime;

  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);

  // Log request start
  const requestLogger = log.fromRequest(req);
  requestLogger.info('Request started', {
    component: 'http',
    operation: 'request_start',
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    headers: sanitizeHeaders(req.headers),
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'] 
      ? parseInt(req.headers['content-length'] as string) 
      : undefined
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    
    // Log response
    requestLogger.api('Request completed', {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      requestSize: req.headers['content-length'] 
        ? parseInt(req.headers['content-length'] as string) 
        : undefined,
      responseSize: body ? JSON.stringify(body).length : undefined
    });

    // Log errors with more detail
    if (isError) {
      requestLogger.error('Request failed', {
        error: new Error(`HTTP ${res.statusCode}: ${body?.message || 'Unknown error'}`),
        statusCode: res.statusCode,
        path: req.path,
        method: req.method,
        responseTime,
        errorCode: body?.code,
        severity: res.statusCode >= 500 ? 'high' : 'medium'
      });
    }

    return originalJson.call(this, body);
  };

  // Override res.send to log response for non-JSON responses
  const originalSend = res.send;
  res.send = function(body: any) {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    
    if (!res.headersSent && !res.getHeader('Content-Type')?.toString().includes('json')) {
      requestLogger.api('Request completed (non-JSON)', {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        responseSize: body ? body.length : undefined
      });

      if (isError) {
        requestLogger.error('Request failed (non-JSON)', {
          error: new Error(`HTTP ${res.statusCode}`),
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
          responseTime,
          severity: res.statusCode >= 500 ? 'high' : 'medium'
        });
      }
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Enhanced request logging middleware
 * Logs detailed request information for debugging and monitoring
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestLogger = log.fromRequest(req);
  const startTime = Date.now();

  // Log request details
  requestLogger.debug('Processing request', {
    component: 'http',
    operation: 'request_processing',
    path: req.path,
    method: req.method,
    query: req.query,
    params: req.params,
    body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined,
    sessionId: req.sessionID,
    authenticated: !!(req as any).user,
    userId: (req as any).user?.id,
    tenantId: (req as any).tenant?.id
  });

  // Track response timing
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    requestLogger[level]('Request finished', {
      component: 'http',
      operation: 'request_finish',
      statusCode: res.statusCode,
      responseTime,
      path: req.path,
      method: req.method,
      success: res.statusCode < 400
    });
  });

  next();
}

/**
 * Error logging middleware
 * Captures and logs unhandled errors in the request pipeline
 */
export function errorLoggingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestLogger = log.fromRequest(req);
  
  requestLogger.error('Unhandled request error', {
    error,
    component: 'http',
    operation: 'error_handler',
    path: req.path,
    method: req.method,
    statusCode: res.statusCode || 500,
    severity: 'high',
    stackTrace: error.stack
  });

  // Don't call next() to prevent the error from propagating
  // Let the application's error handler deal with it
  next(error);
}

/**
 * Security event logging middleware
 * Logs security-relevant events and suspicious activity
 */
export function securityLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestLogger = log.fromRequest(req);

  // Log sensitive endpoint access
  if (isSensitiveEndpoint(req.path)) {
    requestLogger.security('Sensitive endpoint accessed', {
      eventType: 'sensitive_endpoint_access',
      severity: 'medium',
      sourceIp: getClientIp(req),
      targetResource: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      authenticated: !!(req as any).user,
      userId: (req as any).user?.id
    });
  }

  // Log authentication attempts
  if (req.path.includes('/auth/') || req.path.includes('/login')) {
    requestLogger.security('Authentication attempt', {
      eventType: 'auth_attempt',
      severity: 'low',
      sourceIp: getClientIp(req),
      targetResource: req.path,
      method: req.method
    });
  }

  // Log file upload attempts
  if (req.path.includes('/upload') || req.headers['content-type']?.includes('multipart/form-data')) {
    requestLogger.security('File upload attempt', {
      eventType: 'file_upload',
      severity: 'medium',
      sourceIp: getClientIp(req),
      targetResource: req.path,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });
  }

  next();
}

// Helper functions

function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  const sensitiveHeaders = [
    'authorization', 'cookie', 'x-api-key', 'x-auth-token',
    'proxy-authorization', 'x-forwarded-for'
  ];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'credit_card', 'ssn', 'api_key', 'private_key'
  ];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function isSensitiveEndpoint(path: string): boolean {
  const sensitivePatterns = [
    '/api/auth',
    '/api/admin',
    '/api/users',
    '/api/clients',
    '/api/keys',
    '/api/settings',
    '/upload',
    '/import',
    '/export',
    '/backup'
  ];
  
  return sensitivePatterns.some(pattern => path.includes(pattern));
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
    : req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';
  
  return ip;
}