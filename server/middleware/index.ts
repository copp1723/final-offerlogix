/**
 * Security Middleware Integration
 * Centralized security middleware orchestration
 */

import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

// Import all security middleware
import { 
  globalRateLimit, 
  routeSpecificRateLimit, 
  rateLimiters,
  cleanupOldRateLimitRecords 
} from './rate-limiting';

import { 
  applySecurity, 
  securityHeaders, 
  additionalSecurityHeaders,
  endpointSecurity,
  validateContentType 
} from './security-headers';

import { 
  validateRequest, 
  validateFileUpload, 
  validateRequestSize, 
  validateJsonDepth,
  handleValidationErrors,
  commonValidations 
} from './validation';

import { 
  securityLogging, 
  morganLogger, 
  logAuthEvent,
  logRateLimitExceeded,
  logValidationFailure,
  getSecurityMetrics 
} from './security-logging';

import { 
  attackProtection, 
  endpointProtection, 
  ipFiltering,
  getAttackStats 
} from './attack-protection';

import { 
  requireApiKey, 
  optionalApiKey, 
  requireAdmin as requireApiKeyAdmin, 
  requireReadAccess, 
  requireWriteAccess,
  ApiPermission,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  getApiKeyStats 
} from './api-key-auth';

import { 
  authenticateToken,
  requireAdmin,
  requireManagerOrAdmin,
  optionalAuth,
  type AuthenticatedRequest
} from './auth';

import { 
  securityConfig, 
  securityConfigMiddleware,
  getSecurityConfig,
  updateSecurityConfig,
  securityHealthCheck 
} from './security-config';

import {
  getSecurityAlerts,
  triggerAlertCheck,
  getAlertStats,
  SecurityMonitoringService
} from './security-alerts';

// Comprehensive security middleware application
export function applyComprehensiveSecurity(app: Express): void {
  console.log('🔒 Applying comprehensive security middleware...');

  // 1. Basic security headers (first layer)
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' }
  }));

  // 2. Request size limits
  app.use(validateRequestSize(10 * 1024 * 1024)); // 10MB max

  // 3. JSON depth validation
  app.use(validateJsonDepth(10));

  // 4. Security logging (before other middleware)
  app.use(morganLogger);
  app.use(securityLogging);

  // 5. Security configuration injection
  app.use(securityConfigMiddleware);

  // 6. Enhanced security headers and CORS
  app.use(applySecurity);

  // 7. IP filtering (if enabled)
  if (securityConfig.isFeatureEnabled('ipBlacklisting') || securityConfig.isFeatureEnabled('ipWhitelisting')) {
    app.use(ipFiltering);
  }

  // 8. Attack protection (if enabled)
  if (securityConfig.isFeatureEnabled('attackProtection')) {
    app.use(attackProtection);
  }

  // 9. Global rate limiting
  if (securityConfig.getConfig().rateLimiting.enabled) {
    app.use(globalRateLimit);
  }

  console.log('✅ Security middleware applied successfully');
}

// Security middleware for different endpoint types
export const securityMiddleware = {
  // Public endpoints (minimal security)
  public: [
    endpointSecurity.public,
    validateContentType(['application/json', 'text/plain'])
  ],

  // API endpoints (standard security)
  api: [
    endpointSecurity.api,
    routeSpecificRateLimit,
    validateContentType(['application/json', 'application/x-www-form-urlencoded'])
  ],

  // Authenticated API endpoints (JWT authentication)
  authenticatedApi: [
    authenticateToken,
    endpointSecurity.api,
    routeSpecificRateLimit,
    validateContentType(['application/json', 'application/x-www-form-urlencoded'])
  ],

  // Optional JWT authentication (for endpoints that work with or without auth)
  optionalJwtApi: [
    optionalAuth,
    endpointSecurity.api,
    routeSpecificRateLimit,
    validateContentType(['application/json', 'application/x-www-form-urlencoded'])
  ],

  // Protected API endpoints (require API key)
  protectedApi: (permissions: ApiPermission[] = []) => [
    requireApiKey(permissions),
    endpointSecurity.api,
    routeSpecificRateLimit,
    validateContentType(['application/json', 'application/x-www-form-urlencoded'])
  ],

  // Admin endpoints (maximum security - JWT auth)
  admin: [
    authenticateToken,
    requireAdmin,
    endpointSecurity.admin,
    rateLimiters.auth,
    validateContentType(['application/json'])
  ],

  // API Key Admin endpoints (maximum security - API key auth)
  apiKeyAdmin: [
    requireApiKeyAdmin,
    endpointSecurity.admin,
    rateLimiters.auth,
    validateContentType(['application/json'])
  ],

  // Authentication endpoints
  auth: [
    // endpointProtection.auth,  // Disabled - too restrictive
    rateLimiters.auth,
    validateContentType(['application/json', 'application/x-www-form-urlencoded'])
  ],

  // File upload endpoints
  upload: [
    requireApiKey([ApiPermission.UPLOAD_FILES]),
    endpointProtection.upload,
    endpointSecurity.upload,
    rateLimiters.upload,
    validateFileUpload({
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'text/csv',
        'application/json',
        'image/png',
        'image/jpeg',
        'image/gif',
        'application/pdf',
        'text/plain'
      ],
      maxFiles: 10
    })
  ],

  // AI/LLM processing endpoints
  ai: [
    requireApiKey([ApiPermission.AI_PROCESSING]),
    endpointSecurity.api,
    rateLimiters.ai,
    validateContentType(['application/json'])
  ],

  // Database access endpoints
  database: [
    requireApiKey([ApiPermission.READ_LEADS, ApiPermission.WRITE_LEADS]),
    endpointProtection.database,
    endpointSecurity.api,
    routeSpecificRateLimit
  ]
};

// Security monitoring endpoints
export function setupSecurityEndpoints(app: Express): void {
  // Security health check
  app.get('/api/security/health', securityMiddleware.apiKeyAdmin, securityHealthCheck);

  // Security configuration management
  app.get('/api/security/config', securityMiddleware.apiKeyAdmin, getSecurityConfig);
  app.put('/api/security/config', securityMiddleware.apiKeyAdmin, updateSecurityConfig);

  // Security metrics and monitoring
  app.get('/api/security/metrics', securityMiddleware.apiKeyAdmin, (req: Request, res: Response) => {
    try {
      const metrics = getSecurityMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get security metrics' });
    }
  });

  // Attack statistics
  app.get('/api/security/attacks', securityMiddleware.apiKeyAdmin, (req: Request, res: Response) => {
    try {
      const stats = getAttackStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get attack statistics' });
    }
  });

  // API key management endpoints
  app.get('/api/security/api-keys', securityMiddleware.apiKeyAdmin, listApiKeys);
  app.post('/api/security/api-keys', securityMiddleware.apiKeyAdmin, [
    // Note: Add proper validation schema here if needed
    handleValidationErrors
  ], createApiKey);
  app.delete('/api/security/api-keys/:id', securityMiddleware.apiKeyAdmin, revokeApiKey);

  // API key statistics
  app.get('/api/security/api-keys/stats', securityMiddleware.apiKeyAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await getApiKeyStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get API key statistics' });
    }
  });

  // Security alerts endpoints
  app.get('/api/security/alerts', securityMiddleware.apiKeyAdmin, getSecurityAlerts);
  app.post('/api/security/alerts/check', securityMiddleware.apiKeyAdmin, triggerAlertCheck);
  app.get('/api/security/alerts/stats', securityMiddleware.apiKeyAdmin, getAlertStats);

  console.log('🔧 Security endpoints configured');
}

// Periodic cleanup tasks
export function startSecurityCleanupTasks(): void {
  // Clean up old rate limit records every hour
  setInterval(() => {
    cleanupOldRateLimitRecords().catch(error => {
      console.error('Rate limit cleanup error:', error);
    });
  }, 60 * 60 * 1000); // 1 hour

  // Start security monitoring service
  const monitoringService = SecurityMonitoringService.getInstance();
  monitoringService.start(5); // Check every 5 minutes

  console.log('🧹 Security cleanup tasks started');
  console.log('🔍 Security monitoring service started');
}

// Error handler for security middleware
export function securityErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log security-related errors
  if (err.code === 'EBADCSRFTOKEN') {
    console.warn('CSRF token validation failed:', req.ip);
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Request blocked due to CSRF protection'
    });
  }

  if (err.status === 429) {
    logRateLimitExceeded(req, err.limit || 0, err.current || 0);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: err.message || 'Rate limit exceeded',
      retryAfter: err.retryAfter
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request Too Large',
      message: 'Request payload too large'
    });
  }

  // Log and pass through other errors
  console.error('Security middleware error:', err);
  next(err);
}

// Security middleware test endpoints (development only)
export function setupSecurityTestEndpoints(app: Express): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Test rate limiting
  app.get('/api/test/rate-limit', (req: Request, res: Response) => {
    res.json({ message: 'Rate limit test endpoint', timestamp: new Date() });
  });

  // Test attack detection
  app.post('/api/test/attack-detection', (req: Request, res: Response) => {
    res.json({ message: 'Attack detection test endpoint', body: req.body });
  });

  // Test API key authentication
  app.get('/api/test/auth', requireApiKey([ApiPermission.READ_LEADS]), (req: any, res: Response) => {
    res.json({ 
      message: 'API key authentication test', 
      apiKey: req.apiKey,
      timestamp: new Date() 
    });
  });

  console.log('🧪 Security test endpoints configured (development only)');
}

// Export all for convenience
export {
  // Rate limiting
  routeSpecificRateLimit,
  rateLimiters,
  
  // Security headers
  applySecurity,
  endpointSecurity,
  
  // Validation
  validateRequest,
  validateFileUpload,
  handleValidationErrors,
  commonValidations,
  
  // API Key Authentication
  requireApiKey,
  optionalApiKey,
  requireApiKeyAdmin,
  ApiPermission,
  
  // JWT Authentication
  authenticateToken,
  requireAdmin,
  requireManagerOrAdmin,
  optionalAuth,
  AuthenticatedRequest,
  
  // Attack protection
  attackProtection,
  endpointProtection,
  
  // Logging
  securityLogging,
  logAuthEvent,
  
  // Configuration
  securityConfig
};