import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';

// Import the types and interfaces we need
const { sign, verify, decode } = jwt;

// Define error classes since they might not be exported
class TokenExpiredError extends Error {
  name: string = 'TokenExpiredError';
  constructor(message: string, public expiredAt: Date) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

class JsonWebTokenError extends Error {
  name: string = 'JsonWebTokenError';
  constructor(message: string) {
    super(message);
    this.name = 'JsonWebTokenError';
  }
}

/**
 * JWT payload interface
 */
export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  clientId?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_ACCESS_EXPIRES_IN: string | number = process.env.JWT_ACCESS_EXPIRES_IN || '24h'; // Access token expires in 24 hours
const JWT_REFRESH_EXPIRES_IN: string | number = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Refresh token expires in 7 days

/**
 * Generate an access JWT token
 * @param payload - The payload to include in the token
 * @returns The signed JWT token
 */
export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'mailmind-auth',
    audience: 'mailmind-app'
  } as SignOptions);
}

/**
 * Generate a refresh JWT token
 * @param payload - The payload to include in the token (usually just userId)
 * @returns The signed JWT refresh token
 */
export function generateRefreshToken(payload: { userId: string }): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'mailmind-auth',
    audience: 'mailmind-app'
  } as SignOptions);
}

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @returns The decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = verify(token, JWT_SECRET, {
      issuer: 'mailmind-auth',
      audience: 'mailmind-app'
    } as VerifyOptions) as JwtPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Decode a JWT token without verification (for debugging purposes only)
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if invalid
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - The Authorization header value
 * @returns The extracted token or null
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Check if token is expired (without verifying signature)
 * @param token - The JWT token to check
 * @returns True if token is expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
}