/**
 * Security Logging and Monitoring Middleware
 * Comprehensive request/response logging for security monitoring and audit trails
 */

import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

// Security event types
export enum SecurityEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  JWT_AUTH_SUCCESS = 'jwt_auth_success',
  API_KEY_AUTH_SUCCESS = 'api_key_auth_success',
  DUAL_AUTH_SUCCESS = 'dual_auth_success',
  DUAL_AUTH_FAILURE = 'dual_auth_failure',
  OPTIONAL_AUTH_CHECK = 'optional_auth_check',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  API_KEY_USAGE = 'api_key_usage',
  VALIDATION_FAILURE = 'validation_failure',
  UPLOAD_ATTEMPT = 'upload_attempt',
  ADMIN_ACCESS = 'admin_access',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  PATH_TRAVERSAL_ATTEMPT = 'path_traversal_attempt',
  SERVER_ERROR = 'server_error'
}

// Security log entry interface
interface SecurityLogEntry {
  timestamp: Date;
  eventType: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  statusCode?: number;
  userId?: string;
  apiKeyId?: string;
  details: Record<string, any>;
  requestId: string;
}

// In-memory security log store (in production, use proper logging service)
class SecurityLogger {
  private logs: SecurityLogEntry[] = [];
  private maxLogs = 10000; // Keep last 10k logs in memory

  log(entry: SecurityLogEntry): void {
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔒 [${entry.severity.toUpperCase()}] ${entry.eventType}: ${entry.path} from ${entry.ip}`);
    }

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(entry);
    }
  }

  private async sendToLoggingService(entry: SecurityLogEntry): Promise<void> {
    try {
      // Here you would integrate with services like:
      // - Datadog
      // - New Relic
      // - Splunk
      // - ELK Stack
      // - CloudWatch
      
      // For now, just log to console in structured format
      console.log(JSON.stringify({
        level: 'security',
        ...entry
      }));
    } catch (error) {
      console.error('Failed to send security log:', error);
    }
  }

  getRecentLogs(limit: number = 100): SecurityLogEntry[] {
    return this.logs.slice(-limit);
  }

  getLogsByType(eventType: SecurityEventType, limit: number = 100): SecurityLogEntry[] {
    return this.logs
      .filter(log => log.eventType === eventType)
      .slice(-limit);
  }

  getLogsByIp(ip: string, limit: number = 100): SecurityLogEntry[] {
    return this.logs
      .filter(log => log.ip === ip)
      .slice(-limit);
  }

  getSuspiciousActivity(hours: number = 24): SecurityLogEntry[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.logs.filter(log => 
      log.timestamp >= cutoff && 
      (log.severity === 'high' || log.severity === 'critical')
    );
  }
}

export const securityLogger = new SecurityLogger();

// Extract client information
function getClientInfo(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? 
    (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim() :
    req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';

  return {
    ip,
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

// Security logging middleware
export function securityLogging(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const clientInfo = getClientInfo(req);

  // Add request ID to response headers
  res.setHeader('X-Request-ID', clientInfo.requestId);

  // Log request start for sensitive endpoints
  if (isSensitiveEndpoint(req.path)) {
    securityLogger.log({
      timestamp: new Date(),
      eventType: SecurityEventType.ADMIN_ACCESS,
      severity: 'medium',
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      path: req.path,
      method: req.method,
      requestId: clientInfo.requestId,
      details: {
        headers: sanitizeHeaders(req.headers),
        query: req.query
      }
    });
  }

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = Date.now() - startTime;
    
    // Log security-relevant responses
    if (res.statusCode >= 400 || isSensitiveEndpoint(req.path)) {
      securityLogger.log({
        timestamp: new Date(),
        eventType: res.statusCode >= 500 ? SecurityEventType.SERVER_ERROR : SecurityEventType.API_KEY_USAGE,
        severity: res.statusCode >= 500 ? 'medium' : 'low',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        requestId: clientInfo.requestId,
        details: {
          responseTime,
          hasError: res.statusCode >= 400,
          errorMessage: res.statusCode >= 400 ? body?.message || body?.error : undefined
        }
      });
    }

    return originalJson.call(this, body);
  };

  next();
}

// Morgan logging configuration
export const morganLogger = morgan((tokens, req, res) => {
  const status = tokens.status(req, res) || '';
  const method = tokens.method(req, res) || '';
  const url = tokens.url(req, res) || '';
  const responseTime = tokens['response-time'](req, res) || '';
  const contentLength = tokens.res(req, res, 'content-length') || '-';
  const userAgent = req.headers['user-agent'] || '';
  const clientInfo = getClientInfo(req as Request);

  // Structured log format
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'access',
    method,
    url,
    status: parseInt(status),
    responseTime: responseTime ? parseFloat(responseTime) : 0,
    contentLength: contentLength !== '-' ? parseInt(contentLength) : 0,
    ip: clientInfo.ip,
    userAgent,
    requestId: clientInfo.requestId
  });
});

// Authentication logging
export function logAuthEvent(
  req: Request,
  eventType: SecurityEventType,
  success: boolean,
  details: Record<string, any> = {}
) {
  const clientInfo = getClientInfo(req);
  
  securityLogger.log({
    timestamp: new Date(),
    eventType,
    severity: success ? 'low' : 'medium',
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    path: req.path,
    method: req.method,
    requestId: clientInfo.requestId,
    details: {
      success,
      ...details
    }
  });
}

// Rate limit logging
export function logRateLimitExceeded(req: Request, limit: number, current: number) {
  const clientInfo = getClientInfo(req);
  
  securityLogger.log({
    timestamp: new Date(),
    eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
    severity: 'medium',
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    path: req.path,
    method: req.method,
    requestId: clientInfo.requestId,
    details: {
      limit,
      current,
      exceeded: current - limit
    }
  });
}

// Validation failure logging
export function logValidationFailure(req: Request, errors: string[]) {
  const clientInfo = getClientInfo(req);
  
  // Determine severity based on error types
  const severity = errors.some(error => 
    error.includes('injection') || 
    error.includes('XSS') || 
    error.includes('traversal')
  ) ? 'high' : 'medium';

  securityLogger.log({
    timestamp: new Date(),
    eventType: SecurityEventType.VALIDATION_FAILURE,
    severity,
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    path: req.path,
    method: req.method,
    requestId: clientInfo.requestId,
    details: {
      errors,
      body: sanitizeBody(req.body),
      query: req.query
    }
  });
}

// API key usage logging
export function logApiKeyUsage(req: Request, apiKeyId: string, success: boolean) {
  const clientInfo = getClientInfo(req);
  
  securityLogger.log({
    timestamp: new Date(),
    eventType: SecurityEventType.API_KEY_USAGE,
    severity: 'low',
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    path: req.path,
    method: req.method,
    apiKeyId,
    requestId: clientInfo.requestId,
    details: {
      success
    }
  });
}

// File upload logging
export function logFileUpload(req: Request, files: Express.Multer.File[], success: boolean) {
  const clientInfo = getClientInfo(req);
  
  securityLogger.log({
    timestamp: new Date(),
    eventType: SecurityEventType.UPLOAD_ATTEMPT,
    severity: 'medium',
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    path: req.path,
    method: req.method,
    requestId: clientInfo.requestId,
    details: {
      success,
      fileCount: files.length,
      files: files.map(f => ({
        originalName: f.originalname,
        mimetype: f.mimetype,
        size: f.size
      }))
    }
  });
}

// Suspicious activity detection
export function detectSuspiciousActivity(req: Request): boolean {
  const clientInfo = getClientInfo(req);
  const recentLogs = securityLogger.getLogsByIp(clientInfo.ip, 50);
  const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
  
  const recentFailures = recentLogs.filter(log => 
    log.timestamp >= last5Minutes && 
    (log.eventType === SecurityEventType.AUTH_FAILURE || 
     log.eventType === SecurityEventType.VALIDATION_FAILURE ||
     log.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED)
  );

  // Suspicious if more than 5 failures in 5 minutes
  return recentFailures.length > 5;
}

// Log suspicious activity
export function logSuspiciousActivity(req: Request, reason: string) {
  const clientInfo = getClientInfo(req);
  
  securityLogger.log({
    timestamp: new Date(),
    eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: 'high',
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    path: req.path,
    method: req.method,
    requestId: clientInfo.requestId,
    details: {
      reason,
      recentActivity: securityLogger.getLogsByIp(clientInfo.ip, 10)
    }
  });
}

// Helper functions
function isSensitiveEndpoint(path: string): boolean {
  const sensitivePatterns = [
    '/api/auth',
    '/api/admin',
    '/api/users',
    '/api/clients',
    '/api/keys',
    '/upload',
    '/import'
  ];
  
  return sensitivePatterns.some(pattern => path.includes(pattern));
}

function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  delete sanitized.authorization;
  delete sanitized['x-api-key'];
  delete sanitized.cookie;
  delete sanitized['x-forwarded-for'];
  
  return sanitized;
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  delete sanitized.key;
  
  return sanitized;
}

// Security metrics endpoint
export function getSecurityMetrics(): any {
  const last24Hours = securityLogger.getSuspiciousActivity(24);
  const recentLogs = securityLogger.getRecentLogs(1000);
  
  const eventCounts = recentLogs.reduce((acc, log) => {
    acc[log.eventType] = (acc[log.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const severityCounts = recentLogs.reduce((acc, log) => {
    acc[log.severity] = (acc[log.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    timestamp: new Date().toISOString(),
    totalEvents: recentLogs.length,
    suspiciousActivity: last24Hours.length,
    eventTypes: eventCounts,
    severityDistribution: severityCounts,
    topIps: getTopIps(recentLogs, 10),
    recentFailures: recentLogs.filter(log => 
      log.eventType === SecurityEventType.AUTH_FAILURE ||
      log.eventType === SecurityEventType.VALIDATION_FAILURE
    ).slice(-10)
  };
}

function getTopIps(logs: SecurityLogEntry[], limit: number): Array<{ ip: string; count: number }> {
  const ipCounts = logs.reduce((acc, log) => {
    acc[log.ip] = (acc[log.ip] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(ipCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([ip, count]) => ({ ip, count }));
}