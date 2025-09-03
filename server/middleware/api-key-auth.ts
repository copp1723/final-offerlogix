/**
 * API Key Authentication and Management Middleware
 * Handles API key validation, generation, and management
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { apiKeys, ApiKey } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { logApiKeyUsage, logAuthEvent, SecurityEventType } from './security-logging';

// Extend Request interface to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        permissions: string[];
        rateLimitTier: string;
        clientId: string | null;
        userId: string | null;
      };
    }
  }
}

// API key format: mk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random characters)
// or mk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx for test keys
const API_KEY_PREFIX = 'mk_';
const API_KEY_LENGTH = 40; // 8 chars prefix + 32 chars random

// Permission scopes
export enum ApiPermission {
  // Read permissions
  READ_LEADS = 'read:leads',
  READ_CAMPAIGNS = 'read:campaigns',
  READ_CONVERSATIONS = 'read:conversations',
  READ_USERS = 'read:users',
  READ_CLIENTS = 'read:clients',
  READ_ANALYTICS = 'read:analytics',

  // Write permissions
  WRITE_LEADS = 'write:leads',
  WRITE_CAMPAIGNS = 'write:campaigns',
  WRITE_CONVERSATIONS = 'write:conversations',
  WRITE_USERS = 'write:users',
  WRITE_CLIENTS = 'write:clients',

  // Special permissions
  ADMIN = 'admin',
  UPLOAD_FILES = 'upload:files',
  AI_PROCESSING = 'ai:processing',
  WEBHOOK_ACCESS = 'webhook:access',
  BULK_OPERATIONS = 'bulk:operations'
}

// Default permission sets
export const PERMISSION_SETS = {
  read_only: [
    ApiPermission.READ_LEADS,
    ApiPermission.READ_CAMPAIGNS,
    ApiPermission.READ_CONVERSATIONS,
    ApiPermission.READ_ANALYTICS
  ],
  standard: [
    ApiPermission.READ_LEADS,
    ApiPermission.READ_CAMPAIGNS,
    ApiPermission.READ_CONVERSATIONS,
    ApiPermission.WRITE_LEADS,
    ApiPermission.WRITE_CAMPAIGNS,
    ApiPermission.WRITE_CONVERSATIONS,
    ApiPermission.AI_PROCESSING
  ],
  full_access: [
    ...Object.values(ApiPermission)
  ]
};

// Generate a new API key
export async function generateApiKey(data: {
  name: string;
  description?: string;
  permissions: string[];
  rateLimitTier?: 'standard' | 'premium' | 'enterprise';
  clientId?: string;
  userId?: string;
  expiresAt?: Date;
}): Promise<{ apiKey: string; keyRecord: ApiKey }> {
  // Generate random key
  const randomPart = crypto.randomBytes(16).toString('hex');
  const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const fullKey = `${API_KEY_PREFIX}${environment}_${randomPart}`;
  
  // Hash the key for storage
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
  const keyPrefix = fullKey.substring(0, 8);

  // Insert into database
  const [keyRecord] = await db.insert(apiKeys).values({
    keyHash,
    keyPrefix,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    rateLimitTier: data.rateLimitTier || 'standard',
    clientId: data.clientId || null,
    userId: data.userId || null,
    expiresAt: data.expiresAt || null
  }).returning();

  return {
    apiKey: fullKey,
    keyRecord
  };
}

// Validate and retrieve API key information
async function validateApiKey(keyString: string): Promise<ApiKey | null> {
  try {
    // Hash the provided key
    const keyHash = crypto.createHash('sha256').update(keyString).digest('hex');
    
    // Look up in database
    const [keyRecord] = await db.select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.isActive, true)
        )
      )
      .limit(1);

    if (!keyRecord) {
      return null;
    }

    // Check if expired
    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return null;
    }

    // Update last used timestamp
    await db.update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    return keyRecord;
  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}

// Extract API key from request
function extractApiKey(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  // Check query parameter (less secure, only for testing)
  if (process.env.NODE_ENV !== 'production' && req.query.api_key) {
    return req.query.api_key as string;
  }

  return null;
}

// Main API key authentication middleware
export function requireApiKey(permissions: ApiPermission[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyString = extractApiKey(req);
      
      if (!keyString) {
        logAuthEvent(req, SecurityEventType.AUTH_FAILURE, false, {
          reason: 'No API key provided'
        });
        return res.status(401).json({
          error: 'Authentication required',
          message: 'API key is required. Provide it via Authorization header or X-API-Key header.'
        });
      }

      // Validate format
      if (!keyString.startsWith(API_KEY_PREFIX) || keyString.length !== API_KEY_LENGTH) {
        logAuthEvent(req, SecurityEventType.AUTH_FAILURE, false, {
          reason: 'Invalid API key format',
          keyPrefix: keyString.substring(0, 8)
        });
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key format is invalid'
        });
      }

      // Validate key
      const keyRecord = await validateApiKey(keyString);
      
      if (!keyRecord) {
        logAuthEvent(req, SecurityEventType.AUTH_FAILURE, false, {
          reason: 'API key not found or expired',
          keyPrefix: keyString.substring(0, 8)
        });
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key is invalid or has expired'
        });
      }

      // Check permissions
      const userPermissions = keyRecord.permissions as string[];
      const hasRequiredPermissions = permissions.every(permission => 
        userPermissions.includes(permission) || userPermissions.includes(ApiPermission.ADMIN)
      );

      if (!hasRequiredPermissions) {
        logAuthEvent(req, SecurityEventType.AUTH_FAILURE, false, {
          reason: 'Insufficient permissions',
          required: permissions,
          available: userPermissions,
          keyId: keyRecord.id
        });
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'API key does not have required permissions',
          required: permissions,
          available: userPermissions
        });
      }

      // Log successful usage
      logApiKeyUsage(req, keyRecord.id, true);
      logAuthEvent(req, SecurityEventType.AUTH_SUCCESS, true, {
        keyId: keyRecord.id,
        permissions: userPermissions
      });

      // Attach API key info to request
      req.apiKey = {
        id: keyRecord.id,
        permissions: userPermissions,
        rateLimitTier: keyRecord.rateLimitTier || 'standard',
        clientId: keyRecord.clientId,
        userId: keyRecord.userId
      };

      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Internal error during authentication'
      });
    }
  };
}

// Optional API key middleware (doesn't fail if no key provided)
export function optionalApiKey(req: Request, res: Response, next: NextFunction) {
  const keyString = extractApiKey(req);
  
  if (!keyString) {
    return next();
  }

  // If key is provided, validate it
  requireApiKey([])(req, res, next);
}

// Admin-only middleware
export const requireAdmin = requireApiKey([ApiPermission.ADMIN]);

// Read-only access middleware
export const requireReadAccess = (resource: string) => {
  const permission = `read:${resource}` as ApiPermission;
  return requireApiKey([permission]);
};

// Write access middleware
export const requireWriteAccess = (resource: string) => {
  const permission = `write:${resource}` as ApiPermission;
  return requireApiKey([permission]);
};

// API key management routes
export async function listApiKeys(req: Request, res: Response) {
  try {
    // Only return keys for the requesting user/client
    const clientId = req.apiKey?.clientId;
    const userId = req.apiKey?.userId;
    
    const query = db.select({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      description: apiKeys.description,
      permissions: apiKeys.permissions,
      rateLimitTier: apiKeys.rateLimitTier,
      isActive: apiKeys.isActive,
      lastUsed: apiKeys.lastUsed,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt
    }).from(apiKeys);

    let whereCondition = undefined;
    if (clientId) {
      whereCondition = eq(apiKeys.clientId, clientId);
    } else if (userId) {
      whereCondition = eq(apiKeys.userId, userId);
    }

    const keys = whereCondition ? await query.where(whereCondition) : await query;
    
    res.json({
      keys,
      total: keys.length
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({
      error: 'Failed to list API keys'
    });
  }
}

export async function createApiKey(req: Request, res: Response) {
  try {
    const { name, description, permissions, rateLimitTier, expiresAt } = req.body;
    
    // Validate permissions
    const validPermissions = Object.values(ApiPermission);
    const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p as ApiPermission));
    
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        error: 'Invalid permissions',
        invalidPermissions
      });
    }

    // Generate the key
    const result = await generateApiKey({
      name,
      description,
      permissions,
      rateLimitTier,
      clientId: req.apiKey?.clientId || undefined,
      userId: req.apiKey?.userId || undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: result.apiKey,
      keyInfo: {
        id: result.keyRecord.id,
        keyPrefix: result.keyRecord.keyPrefix,
        name: result.keyRecord.name,
        permissions: result.keyRecord.permissions,
        rateLimitTier: result.keyRecord.rateLimitTier,
        expiresAt: result.keyRecord.expiresAt
      },
      warning: 'Store this API key securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({
      error: 'Failed to create API key'
    });
  }
}

export async function revokeApiKey(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Update the key to inactive
    const [updatedKey] = await db.update(apiKeys)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(apiKeys.id, id),
          // Ensure user can only revoke their own keys
          req.apiKey?.clientId ? eq(apiKeys.clientId, req.apiKey.clientId) : 
          req.apiKey?.userId ? eq(apiKeys.userId, req.apiKey.userId) : 
          eq(apiKeys.id, 'never_match') // Fallback to prevent unauthorized access
        )
      )
      .returning();

    if (!updatedKey) {
      return res.status(404).json({
        error: 'API key not found'
      });
    }

    res.json({
      message: 'API key revoked successfully',
      revokedKey: {
        id: updatedKey.id,
        keyPrefix: updatedKey.keyPrefix,
        name: updatedKey.name
      }
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({
      error: 'Failed to revoke API key'
    });
  }
}

// Utility function to check if request has specific permission
export function hasPermission(req: Request, permission: ApiPermission): boolean {
  return req.apiKey?.permissions.includes(permission) || 
         req.apiKey?.permissions.includes(ApiPermission.ADMIN) || 
         false;
}

// Middleware to check specific permission
export function checkPermission(permission: ApiPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasPermission(req, permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission
      });
    }
    next();
  };
}

// Get API key statistics
export async function getApiKeyStats(): Promise<any> {
  try {
    const totalKeys = await db.select().from(apiKeys);
    const activeKeys = totalKeys.filter(key => key.isActive);
    const expiredKeys = totalKeys.filter(key => 
      key.expiresAt && new Date() > key.expiresAt
    );

    const tierDistribution = activeKeys.reduce((acc, key) => {
      acc[key.rateLimitTier || 'standard'] = (acc[key.rateLimitTier || 'standard'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentlyUsed = activeKeys.filter(key => 
      key.lastUsed && new Date(key.lastUsed) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return {
      total: totalKeys.length,
      active: activeKeys.length,
      expired: expiredKeys.length,
      recentlyUsed: recentlyUsed.length,
      tierDistribution,
      lastCreated: totalKeys.length > 0 ? 
        totalKeys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt :
        null
    };
  } catch (error) {
    console.error('Error getting API key stats:', error);
    return null;
  }
}