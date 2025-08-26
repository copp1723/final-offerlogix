/**
 * Main Logger Interface
 * Provides a clean, typed interface for structured logging throughout the application
 */

import { logger as winstonLogger, performanceLogger } from './config';
import { Request } from 'express';

// Log context interface for structured logging
export interface LogContext {
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  component?: string;
  operation?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: any;
}

// Error logging interface
export interface ErrorContext extends LogContext {
  error: Error;
  stackTrace?: string;
  errorCode?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// Security event interface
export interface SecurityContext extends LogContext {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threatLevel?: number;
  actionTaken?: string;
  sourceIp?: string;
  targetResource?: string;
}

// Performance logging interface
export interface PerformanceContext extends LogContext {
  operation: string;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  resourcesUsed?: string[];
  status: 'success' | 'failure' | 'timeout';
}

// Database operation logging
export interface DatabaseContext extends LogContext {
  query?: string;
  table?: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'transaction';
  duration?: number;
  rowsAffected?: number;
  connectionPool?: {
    total: number;
    active: number;
    idle: number;
  };
}

// API operation logging
export interface ApiContext extends LogContext {
  endpoint: string;
  method: string;
  statusCode?: number;
  responseTime?: number;
  requestSize?: number;
  responseSize?: number;
  rateLimited?: boolean;
}

// AI/LLM operation logging
export interface AiContext extends LogContext {
  provider: string;
  model: string;
  tokenCount?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
  latency?: number;
  promptLength?: number;
  responseLength?: number;
}

class Logger {
  /**
   * Log debug information
   */
  debug(message: string, context?: LogContext): void {
    winstonLogger.debug(message, this.sanitizeContext(context));
  }

  /**
   * Log general information
   */
  info(message: string, context?: LogContext): void {
    winstonLogger.info(message, this.sanitizeContext(context));
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: LogContext): void {
    winstonLogger.warn(message, this.sanitizeContext(context));
  }

  /**
   * Log errors with structured context
   */
  error(message: string, context?: ErrorContext): void {
    const errorContext = context ? {
      ...this.sanitizeContext(context),
      ...(context.error && {
        errorName: context.error.name,
        errorMessage: context.error.message,
        stackTrace: context.error.stack,
      })
    } : {};

    winstonLogger.error(message, errorContext);

    // Track error for performance metrics
    performanceLogger.logRequest(0, true);
  }

  /**
   * Log security events
   */
  security(message: string, context: SecurityContext): void {
    const securityContext = {
      ...this.sanitizeContext(context),
      level: 'security',
      timestamp: new Date().toISOString()
    };

    (winstonLogger as any).security(message, securityContext);
  }

  /**
   * Log performance metrics
   */
  performance(message: string, context: PerformanceContext): void {
    const perfContext = {
      ...this.sanitizeContext(context),
      component: 'performance'
    };

    winstonLogger.info(message, perfContext);

    // Track performance metric
    performanceLogger.logRequest(context.duration, context.status === 'failure');
  }

  /**
   * Log database operations
   */
  database(message: string, context: DatabaseContext): void {
    const dbContext = {
      ...this.sanitizeContext(context),
      component: 'database',
      // Sanitize query to remove sensitive data
      query: context.query ? this.sanitizeQuery(context.query) : undefined
    };

    winstonLogger.info(message, dbContext);
  }

  /**
   * Log API operations
   */
  api(message: string, context: ApiContext): void {
    const apiContext = {
      ...this.sanitizeContext(context),
      component: 'api'
    };

    winstonLogger.info(message, apiContext);

    // Track API performance
    if (context.responseTime) {
      performanceLogger.logRequest(
        context.responseTime, 
        (context.statusCode || 0) >= 400
      );
    }
  }

  /**
   * Log AI/LLM operations
   */
  ai(message: string, context: AiContext): void {
    const aiContext = {
      ...this.sanitizeContext(context),
      component: 'ai'
    };

    winstonLogger.info(message, aiContext);
  }

  /**
   * Create logger with default context (for request-scoped logging)
   */
  withContext(context: LogContext): Logger {
    const contextualLogger = new Logger();
    const originalSanitize = contextualLogger.sanitizeContext.bind(contextualLogger);
    
    contextualLogger.sanitizeContext = (additionalContext?: LogContext) => {
      return originalSanitize({ ...context, ...additionalContext });
    };

    return contextualLogger;
  }

  /**
   * Create logger from Express request
   */
  fromRequest(req: Request): Logger {
    const context: LogContext = {
      correlationId: this.getCorrelationId(req),
      requestId: req.headers['x-request-id'] as string,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenant?.id || (req as any).clientId,
      sessionId: (req as any).sessionID || 'no-session',
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined
    };

    return this.withContext(context);
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context?: LogContext): LogContext {
    if (!context) return {};

    const sanitized = { ...context };

    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'authorization',
      'cookie', 'session', 'credit_card', 'ssn', 'api_key'
    ];

    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });

    // Sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Sanitize nested objects
   */
  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => 
        typeof item === 'object' ? this.sanitizeObject(item) : item
      );
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized = { ...obj };
      const sensitiveFields = [
        'password', 'secret', 'token', 'key', 'authorization'
      ];

      sensitiveFields.forEach(field => {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]';
        }
      });

      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize SQL queries to remove sensitive data
   */
  private sanitizeQuery(query: string): string {
    // Replace potential sensitive patterns
    return query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, "password='[REDACTED]'")
      .replace(/token\s*=\s*['"][^'"]*['"]/gi, "token='[REDACTED]'")
      .replace(/key\s*=\s*['"][^'"]*['"]/gi, "key='[REDACTED]'")
      .replace(/secret\s*=\s*['"][^'"]*['"]/gi, "secret='[REDACTED]'");
  }

  /**
   * Extract correlation ID from request
   */
  private getCorrelationId(req: Request): string {
    return (
      req.headers['x-correlation-id'] ||
      req.headers['x-request-id'] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    ) as string;
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded 
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
      : req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';
    
    return ip;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics() {
    return performanceLogger.getMetrics();
  }
}

// Export singleton instance
export const log = new Logger();

// Export class for testing
export { Logger };

export default log;