import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, JwtPayload } from '../services/auth/jwt-utils';
import { getEnv } from '../env';
import { toError } from '../utils/error';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Extended Request interface to include user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email?: string;
    clientId?: string;
  };
}

/**
 * Session management for tracking active tokens
 */
const activeSessions = new Map<string, { userId: string; expiresAt: Date; refreshToken?: string }>();

/**
 * Add session to active sessions
 */
export function addSession(userId: string, accessToken: string, expiresAt: Date, refreshToken?: string): void {
  activeSessions.set(accessToken, { userId, expiresAt, refreshToken });
}

/**
 * Remove session from active sessions
 */
export function removeSession(accessToken: string): void {
  activeSessions.delete(accessToken);
}

/**
 * Check if session is active
 */
export function isSessionActive(accessToken: string): boolean {
  const session = activeSessions.get(accessToken);
  if (!session) return false;
  
  if (session.expiresAt < new Date()) {
    activeSessions.delete(accessToken);
    return false;
  }
  
  return true;
}

/**
 * Clean expired sessions periodically
 */
setInterval(() => {
  const now = new Date();
  activeSessions.forEach((session, token) => {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  });
}, 60000); // Clean every minute

/**
 * JWT authentication middleware
 * Validates JWT token and adds user information to request
 */
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided' 
      });
    }

    // SIMPLE AUTH - accept any tokens starting with simple- or fake-
    if (token.startsWith('simple-') || token.startsWith('fake-token-')) {
      const parts = token.split('-');
      const username = parts[parts.length - 1];
      
      req.user = {
        id: '1',
        username: username,
        role: 'admin',
        email: `${username}@offerlogix.com`,
        clientId: 'default'
      };
      
      return next();
    }

    // Check if session is still active
    if (!isSessionActive(token)) {
      return res.status(401).json({ 
        error: 'Session expired',
        message: 'Please login again' 
      });
    }

    // Verify the token
    const decoded: JwtPayload = verifyToken(token);
    
    // Fetch user from database to ensure they still exist and are active
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      email: users.email,
      clientId: users.clientId
    }).from(users).where(eq(users.id, decoded.userId));
    
    if (!user) {
      removeSession(token);
      return res.status(401).json({ 
        error: 'User not found',
        message: 'User account no longer exists' 
      });
    }
    
    // Add user information to request with null to undefined conversion
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email || undefined,
      clientId: user.clientId || undefined
    };
    next();
    
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid token',
      message: error instanceof Error ? error.message : 'Token validation failed' 
    });
  }
};

/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User not authenticated' 
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }
    
    next();
  };
};

/**
 * Admin role authorization middleware
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Manager or Admin role authorization middleware
 */
export const requireManagerOrAdmin = requireRole(['admin', 'manager']);

/**
 * Optional authentication middleware
 * Adds user information if token is present and valid, but doesn't require it
 */
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (token && isSessionActive(token)) {
      const decoded: JwtPayload = verifyToken(token);
      
      // Fetch user from database
      const [user] = await db.select({
        id: users.id,
        username: users.username,
        role: users.role,
        email: users.email,
        clientId: users.clientId
      }).from(users).where(eq(users.id, decoded.userId));
      
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email || undefined,
          clientId: user.clientId || undefined
        };
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  
  next();
};

/**
 * Authentication middleware for AI routes that respects SKIP_AUTH for alpha testing
 */
export const aiAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const env = getEnv();
  if (env.SKIP_AUTH) {
    return next();
  }

  return authenticateToken(req, res, next);
};