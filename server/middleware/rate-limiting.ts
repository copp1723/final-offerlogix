/**
 * Comprehensive Rate Limiting Middleware
 * Implements multi-tier rate limiting with different strategies per endpoint type
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { rateLimitAttempts, apiKeys } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// Rate limit configurations per tier
export const RATE_LIMIT_TIERS = {
  // General API limits
  general: {
    standard: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
    premium: { windowMs: 15 * 60 * 1000, max: 300 },  // 300 requests per 15 minutes
    enterprise: { windowMs: 15 * 60 * 1000, max: 1000 } // 1000 requests per 15 minutes
  },
  
  // Authentication endpoints (stricter)
  auth: {
    standard: { windowMs: 15 * 60 * 1000, max: 5 },   // 5 requests per 15 minutes
    premium: { windowMs: 15 * 60 * 1000, max: 10 },   // 10 requests per 15 minutes
    enterprise: { windowMs: 15 * 60 * 1000, max: 20 }  // 20 requests per 15 minutes
  },
  
  // File upload endpoints
  upload: {
    standard: { windowMs: 60 * 60 * 1000, max: 10 },  // 10 requests per hour
    premium: { windowMs: 60 * 60 * 1000, max: 50 },   // 50 requests per hour
    enterprise: { windowMs: 60 * 60 * 1000, max: 200 } // 200 requests per hour
  },
  
  // AI/LLM endpoints (expensive operations)
  ai: {
    standard: { windowMs: 60 * 1000, max: 20 },       // 20 requests per minute
    premium: { windowMs: 60 * 1000, max: 100 },       // 100 requests per minute
    enterprise: { windowMs: 60 * 1000, max: 500 }     // 500 requests per minute
  },
  
  // Unauthenticated (more restrictive)
  unauthenticated: {
    standard: { windowMs: 15 * 60 * 1000, max: 50 },  // 50 requests per 15 minutes
    premium: { windowMs: 15 * 60 * 1000, max: 50 },   // Same as standard
    enterprise: { windowMs: 15 * 60 * 1000, max: 50 } // Same as standard
  }
} as const;

// Get client IP address with proxy support
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';
}

// Get rate limit tier from API key or default to standard
async function getRateLimitTier(req: Request): Promise<keyof typeof RATE_LIMIT_TIERS.general> {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (!apiKeyHeader) {
    return 'standard';
  }
  
  try {
    // Extract API key from Bearer token or direct header
    const apiKey = typeof apiKeyHeader === 'string' 
      ? apiKeyHeader.replace('Bearer ', '') 
      : apiKeyHeader[0];
    
    // Look up API key in database
    const [keyRecord] = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, apiKey)) // Note: In practice, this should be hashed
      .limit(1);
    
    if (keyRecord && keyRecord.isActive) {
      return keyRecord.rateLimitTier as keyof typeof RATE_LIMIT_TIERS.general;
    }
  } catch (error) {
    console.error('Error checking API key tier:', error);
  }
  
  return 'standard';
}

// Custom rate limit store with database persistence
class DatabaseRateLimitStore {
  async increment(identifier: string, endpoint: string, windowMs: number): Promise<{ totalHits: number; resetTime: Date }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    const windowEnd = new Date(now.getTime() + windowMs);
    
    try {
      // Check existing attempts in current window
      const existingAttempts = await db.select()
        .from(rateLimitAttempts)
        .where(
          and(
            eq(rateLimitAttempts.identifier, identifier),
            eq(rateLimitAttempts.endpoint, endpoint),
            gte(rateLimitAttempts.windowEnd, now),
            lte(rateLimitAttempts.windowStart, windowStart)
          )
        );
      
      const totalAttempts = existingAttempts.reduce((sum, attempt) => sum + attempt.attempts, 0);
      
      // Create or update attempt record
      await db.insert(rateLimitAttempts).values({
        identifier,
        endpoint,
        attempts: 1,
        windowStart: now,
        windowEnd
      });
      
      return {
        totalHits: totalAttempts + 1,
        resetTime: windowEnd
      };
    } catch (error) {
      console.error('Database rate limit store error:', error);
      // Fallback to allow request if database is unavailable
      return {
        totalHits: 1,
        resetTime: windowEnd
      };
    }
  }
  
  async decrement(identifier: string, endpoint: string): Promise<void> {
    // Optional: implement decrement logic if needed
  }
  
  async resetKey(identifier: string, endpoint: string): Promise<void> {
    try {
      // Remove old rate limit records for this identifier/endpoint
      await db.delete(rateLimitAttempts)
        .where(
          and(
            eq(rateLimitAttempts.identifier, identifier),
            eq(rateLimitAttempts.endpoint, endpoint)
          )
        );
    } catch (error) {
      console.error('Error resetting rate limit key:', error);
    }
  }
}

// Create rate limiter factory
export function createRateLimiter(
  category: keyof typeof RATE_LIMIT_TIERS,
  options: { 
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get client identifier (IP or API key)
      const clientIp = getClientIp(req);
      const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
      const identifier = apiKeyHeader ? `api_key:${apiKeyHeader}` : `ip:${clientIp}`;
      
      // Get rate limit tier
      const tier = await getRateLimitTier(req);
      const limits = RATE_LIMIT_TIERS[category][tier];
      
      // Check rate limit
      const store = new DatabaseRateLimitStore();
      const endpoint = req.path;
      const result = await store.increment(identifier, endpoint, limits.windowMs);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limits.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.max - result.totalHits));
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000));
      res.setHeader('X-RateLimit-Window', limits.windowMs / 1000);
      
      if (result.totalHits > limits.max) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: options.message || `Rate limit exceeded. Maximum ${limits.max} requests per ${limits.windowMs / 1000} seconds.`,
          retryAfter: Math.ceil((result.resetTime.getTime() - Date.now()) / 1000)
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If rate limiting fails, allow the request to proceed
      next();
    }
  };
}

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  // General API endpoints
  general: createRateLimiter('general', {
    message: 'Too many requests. Please try again later.'
  }),
  
  // Authentication endpoints (login, register, password reset)
  auth: createRateLimiter('auth', {
    message: 'Too many authentication attempts. Please wait before trying again.'
  }),
  
  // File upload endpoints
  upload: createRateLimiter('upload', {
    message: 'Upload rate limit exceeded. Please wait before uploading more files.'
  }),
  
  // AI/LLM processing endpoints
  ai: createRateLimiter('ai', {
    message: 'AI processing rate limit exceeded. Please wait before making more requests.'
  }),
  
  // Unauthenticated endpoints
  unauthenticated: createRateLimiter('unauthenticated', {
    message: 'Rate limit exceeded for unauthenticated requests.'
  })
};

// Cleanup function for old rate limit records
export async function cleanupOldRateLimitRecords(): Promise<void> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Delete records older than 24 hours
    await db.delete(rateLimitAttempts)
      .where(lte(rateLimitAttempts.createdAt, oneDayAgo));
      
    console.log('Cleaned up old rate limit records');
  } catch (error) {
    console.error('Error cleaning up rate limit records:', error);
  }
}

// Route-specific rate limiting middleware
export function routeSpecificRateLimit(req: Request, res: Response, next: NextFunction) {
  const path = req.path.toLowerCase();
  
  // Authentication routes
  if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
    return rateLimiters.auth(req, res, next);
  }
  
  // File upload routes
  if (path.includes('/upload') || path.includes('/import') || req.headers['content-type']?.includes('multipart/form-data')) {
    return rateLimiters.upload(req, res, next);
  }
  
  // AI processing routes
  if (path.includes('/ai') || path.includes('/openai') || path.includes('/llm') || 
      path.includes('/campaigns/chat') || path.includes('/suggestions')) {
    return rateLimiters.ai(req, res, next);
  }
  
  // Check if request is authenticated
  const hasAuth = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['cookie'];
  
  if (!hasAuth) {
    return rateLimiters.unauthenticated(req, res, next);
  }
  
  // Default to general rate limiting
  return rateLimiters.general(req, res, next);
}

// Global rate limiting with different strategies
export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: async (req) => {
    const tier = await getRateLimitTier(req);
    const baseLimits = { standard: 60, premium: 200, enterprise: 500 };
    return baseLimits[tier];
  },
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req)
});