/**
 * Security Headers Middleware
 * Implements comprehensive security headers for protection against common attacks
 */

import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Security configuration
export const securityConfig = {
  // Environment-based settings
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Allowed origins for CORS
  allowedOrigins: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://ccl-3-final.onrender.com',
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.CORS_ORIGIN
  ].filter(Boolean),
  
  // CSP configuration
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite in development
        "'unsafe-eval'", // Required for development
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com",
        "blob:", // For web workers
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for styled components and Tailwind
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'",
        "https://api.openai.com",
        "https://api.mailgun.net",
        "https://api.twilio.com",
        "wss://ccl-3-final.onrender.com",
        "wss://localhost:*",
        "ws://localhost:*",
        process.env.API_URL,
        process.env.WEBSOCKET_URL
      ].filter(Boolean) as string[],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
};

// Enhanced CORS middleware with origin validation
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  
  // Allow requests without origin (mobile apps, curl, etc.)
  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (securityConfig.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (securityConfig.isDevelopment) {
    // In development, allow localhost on any port
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Client-ID',
    'X-Request-ID'
  ].join(', '));
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}

// Security headers using Helmet
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: securityConfig.isProduction ? {
    directives: securityConfig.contentSecurityPolicy.directives
  } : false,
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled for compatibility
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Frameguard (X-Frame-Options)
  frameguard: { action: 'deny' },
  
  // Hide Powered-By header
  hidePoweredBy: true,
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff (X-Content-Type-Options)
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Permissions Policy - Note: Not supported in this helmet version
  // permissionsPolicy: {
  //   features: {
  //     camera: ['none'],
  //     microphone: ['none'],
  //     geolocation: ['none'],
  //     payment: ['none'],
  //     accelerometer: ['none'],
  //     gyroscope: ['none'],
  //     magnetometer: ['none'],
  //     usb: ['none'],
  //     bluetooth: ['none']
  //   }
  // },
  
  // Referrer Policy
  referrerPolicy: { policy: 'no-referrer-when-downgrade' },
  
  // X-Permitted-Cross-Domain-Policies
  xssFilter: true
});

// Additional custom security headers
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Cache control for sensitive endpoints
  if (req.path.includes('/api/auth') || req.path.includes('/api/users')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // API versioning header
  res.setHeader('X-API-Version', '1.0');
  
  // Request ID for tracking
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

// HTTPS redirect middleware for production
export function httpsRedirect(req: Request, res: Response, next: NextFunction) {
  if (securityConfig.isProduction && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
}

// Security context middleware - adds security information to request
export function securityContext(req: Request, res: Response, next: NextFunction) {
  // Add security context to request
  (req as any).security = {
    isSecure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    userAgent: req.headers['user-agent'],
    clientIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    requestId: res.getHeader('X-Request-ID'),
    timestamp: new Date().toISOString()
  };
  
  next();
}

// Combined security middleware
export function applySecurity(req: Request, res: Response, next: NextFunction) {
  // Apply all security middleware in sequence
  httpsRedirect(req, res, (err) => {
    if (err) return next(err);
    
    corsMiddleware(req, res, (err) => {
      if (err) return next(err);
      
      additionalSecurityHeaders(req, res, (err) => {
        if (err) return next(err);
        
        securityContext(req, res, next);
      });
    });
  });
}

// Security middleware for different endpoint types
export const endpointSecurity = {
  // Public endpoints (less restrictive)
  public: (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  },
  
  // API endpoints (standard security)
  api: (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  },
  
  // Admin endpoints (highest security)
  admin: (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  },
  
  // File upload endpoints
  upload: (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  }
};

// Content type validation
export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.headers['content-type'];
      
      if (!contentType) {
        return res.status(400).json({
          error: 'Content-Type header is required'
        });
      }
      
      const isAllowed = allowedTypes.some(type => 
        contentType.toLowerCase().includes(type.toLowerCase())
      );
      
      if (!isAllowed) {
        return res.status(415).json({
          error: 'Unsupported Content-Type',
          allowed: allowedTypes
        });
      }
    }
    
    next();
  };
}

// Security monitoring headers
export function securityMonitoring(req: Request, res: Response, next: NextFunction) {
  // Add timing information
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  
  // Security event logging
  if (req.path.includes('admin') || req.path.includes('auth')) {
    console.log(`Security-sensitive request: ${req.method} ${req.path} from ${req.ip}`);
  }
  
  next();
}