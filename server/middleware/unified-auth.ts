/**
 * Unified Authentication Strategy
 * Combines JWT and API Key authentication with intelligent routing
 */

import { Request, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from './auth';
import { requireApiKey, optionalApiKey, ApiPermission } from './api-key-auth';
import { logAuthEvent, SecurityEventType } from './security-logging';

export interface UnifiedAuthRequest extends AuthenticatedRequest {
  authMethod?: 'jwt' | 'api_key' | 'both' | 'none';
  apiKey?: any;
}

/**
 * Flexible authentication that accepts either JWT token OR API key
 * Useful for endpoints that can be accessed by both authenticated users and API clients
 */
export function flexibleAuth(apiPermissions: ApiPermission[] = []) {
  return async (req: UnifiedAuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    // Try JWT authentication first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        await new Promise<void>((resolve, reject) => {
          authenticateToken(req, res, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        req.authMethod = 'jwt';
        logAuthEvent(req, SecurityEventType.JWT_AUTH_SUCCESS, true, { message: 'Flexible auth using JWT' });
        return next();
      } catch (jwtError) {
        // JWT failed, try API key if available
      }
    }

    // Try API key authentication
    if (apiKeyHeader) {
      try {
        await new Promise<void>((resolve, reject) => {
          requireApiKey(apiPermissions)(req, res, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        req.authMethod = 'api_key';
        logAuthEvent(req, SecurityEventType.API_KEY_AUTH_SUCCESS, true, { message: 'Flexible auth using API key' });
        return next();
      } catch (apiError) {
        // Both methods failed
      }
    }

    // Neither authentication method succeeded
    req.authMethod = 'none';
    logAuthEvent(req, SecurityEventType.AUTH_FAILURE, false, { message: 'Flexible auth failed - no valid JWT or API key' });
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide either a valid JWT token or API key',
      acceptedMethods: ['Bearer token', 'X-API-Key header']
    });
  };
}

/**
 * Requires BOTH JWT and API key authentication
 * Useful for highly sensitive operations
 */
export function dualAuth(apiPermissions: ApiPermission[] = []) {
  return async (req: UnifiedAuthRequest, res: Response, next: NextFunction) => {
    let jwtValid = false;
    let apiKeyValid = false;

    // Validate JWT token
    try {
      await new Promise<void>((resolve, reject) => {
        authenticateToken(req, res, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      jwtValid = true;
    } catch (jwtError) {
      // JWT validation failed
    }

    // Validate API key
    try {
      await new Promise<void>((resolve, reject) => {
        requireApiKey(apiPermissions)(req, res, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      apiKeyValid = true;
    } catch (apiError) {
      // API key validation failed
    }

    if (jwtValid && apiKeyValid) {
      req.authMethod = 'both';
      logAuthEvent(req, SecurityEventType.DUAL_AUTH_SUCCESS, true, { message: 'Both JWT and API key validated' });
      return next();
    }

    req.authMethod = 'none';
    const missingMethods = [];
    if (!jwtValid) missingMethods.push('valid JWT token');
    if (!apiKeyValid) missingMethods.push('valid API key');

    logAuthEvent(req, SecurityEventType.DUAL_AUTH_FAILURE, false, { message: `Missing: ${missingMethods.join(', ')}` });
    return res.status(401).json({
      error: 'Dual authentication required',
      message: `Both JWT token and API key required. Missing: ${missingMethods.join(', ')}`,
      requiredMethods: ['Bearer token', 'X-API-Key header']
    });
  };
}

/**
 * Enhanced optional authentication that enriches request with auth info
 * Works with JWT, API key, or no authentication
 */
export function enrichedOptionalAuth(apiPermissions: ApiPermission[] = []) {
  return async (req: UnifiedAuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];
    
    let hasJWT = false;
    let hasAPIKey = false;

    // Try JWT authentication (optional)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        await new Promise<void>((resolve, reject) => {
          optionalAuth(req, res, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        hasJWT = true;
      } catch (error) {
        // JWT failed, continue
      }
    }

    // Try API key authentication (optional)
    if (apiKeyHeader) {
      try {
        await new Promise<void>((resolve, reject) => {
          optionalApiKey(req, res, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        hasAPIKey = true;
      } catch (error) {
        // API key failed, continue
      }
    }

    // Set authentication method based on what succeeded
    if (hasJWT && hasAPIKey) {
      req.authMethod = 'both';
    } else if (hasJWT) {
      req.authMethod = 'jwt';
    } else if (hasAPIKey) {
      req.authMethod = 'api_key';
    } else {
      req.authMethod = 'none';
    }

    logAuthEvent(req, SecurityEventType.OPTIONAL_AUTH_CHECK, true, { message: `Auth method: ${req.authMethod}` });
    next();
  };
}

/**
 * Smart authentication that chooses the best method based on request context
 */
export function smartAuth(apiPermissions: ApiPermission[] = []) {
  return (req: UnifiedAuthRequest, res: Response, next: NextFunction) => {
    const userAgent = req.headers['user-agent'] || '';
    const contentType = req.headers['content-type'] || '';
    const origin = req.headers.origin;

    // Browser requests typically use JWT
    if (origin && userAgent.includes('Mozilla')) {
      return authenticateToken(req, res, (err) => {
        if (err) {
          req.authMethod = 'none';
          return res.status(401).json({
            error: 'JWT authentication required',
            message: 'Browser requests must use JWT authentication',
            authMethod: 'Bearer token'
          });
        }
        req.authMethod = 'jwt';
        next();
      });
    }

    // API clients typically use API keys
    if (contentType.includes('application/json') && !origin) {
      return requireApiKey(apiPermissions)(req, res, (err) => {
        if (err) {
          req.authMethod = 'none';
          return res.status(401).json({
            error: 'API key authentication required',
            message: 'API requests must use API key authentication',
            authMethod: 'X-API-Key header'
          });
        }
        req.authMethod = 'api_key';
        next();
      });
    }

    // Fallback to flexible authentication
    return flexibleAuth(apiPermissions)(req, res, next);
  };
}

/**
 * Authentication strategy selector based on endpoint type
 */
export const authStrategies = {
  // Public endpoints - no auth required
  public: [],

  // API endpoints accessible by authenticated users or API clients
  flexible: (permissions: ApiPermission[] = []) => [flexibleAuth(permissions)],

  // Browser-only endpoints (user dashboard, etc.)
  userOnly: [authenticateToken],

  // API-only endpoints (integrations, webhooks, etc.)
  apiOnly: (permissions: ApiPermission[] = []) => [requireApiKey(permissions)],

  // High-security endpoints requiring both auth methods
  highSecurity: (permissions: ApiPermission[] = []) => [dualAuth(permissions)],

  // Optional auth with enriched context
  optional: (permissions: ApiPermission[] = []) => [enrichedOptionalAuth(permissions)],

  // Smart context-aware auth
  smart: (permissions: ApiPermission[] = []) => [smartAuth(permissions)]
};

/**
 * Middleware to set auth context in response headers (for debugging)
 */
export function authContextMiddleware(req: UnifiedAuthRequest, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('X-Auth-Method', req.authMethod || 'none');
    res.setHeader('X-User-ID', req.user?.id || 'none');
    res.setHeader('X-API-Key-ID', req.apiKey?.id || 'none');
  }
  next();
}

/**
 * Authentication metrics for monitoring
 */
export function getAuthMetrics() {
  // This would typically pull from a metrics store
  return {
    authMethods: {
      jwt: { total: 0, successful: 0, failed: 0 },
      apiKey: { total: 0, successful: 0, failed: 0 },
      dual: { total: 0, successful: 0, failed: 0 },
      flexible: { total: 0, successful: 0, failed: 0 }
    },
    lastUpdated: new Date().toISOString()
  };
}