/**
 * Enhanced Validation and Sanitization Middleware
 * Comprehensive input validation, sanitization, and security checks
 */

import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import { z } from 'zod';

export interface ValidationSchemas {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

// Input sanitization functions
export const sanitizers = {
  // Remove HTML tags and dangerous characters
  sanitizeHtml: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  },

  // Sanitize for SQL injection prevention
  sanitizeSql: (input: string): string => {
    return input
      .replace(/['";\\]/g, '') // Remove dangerous SQL characters
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL block comments
      .replace(/\*\//g, '')
      .trim();
  },

  // Email sanitization
  sanitizeEmail: (email: string): string => {
    return email.toLowerCase().trim();
  },

  // Phone number sanitization
  sanitizePhone: (phone: string): string => {
    return phone.replace(/[^\d+\-\s()]/g, '').trim();
  },

  // General text sanitization
  sanitizeText: (text: string): string => {
    return text
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/\0/g, '') // Remove null bytes
      .trim();
  }
};

// Security validation patterns
export const securityPatterns = {
  // SQL injection patterns
  sqlInjection: /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UNION|UPDATE|FROM|WHERE|JOIN)\b)|(\b(script|javascript|vbscript|onload|onerror|onclick)\b)|(\'|\"|;|--|\/\*|\*\/)/gi,
  
  // XSS patterns
  xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  
  // Path traversal patterns
  pathTraversal: /(\.\.|\/\.\.|\\\.\.)/g,
  
  // Command injection patterns
  commandInjection: /(\||&|;|`|\$\(|<|>)/g,

  // NoSQL injection patterns
  nosqlInjection: /(\$where|\$ne|\$gt|\$lt|\$regex|\$in|\$nin)/gi
};

// Enhanced Zod validation with security checks
export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Security validation first
      const securityResult = performSecurityValidation(req);
      if (!securityResult.isValid) {
        return res.status(400).json({
          error: 'Security validation failed',
          details: securityResult.errors
        });
      }

      // Apply sanitization
      req.body = sanitizeObject(req.body);
      req.query = sanitizeObject(req.query);
      req.params = sanitizeObject(req.params);

      // Zod validation
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }
      
      console.error('Validation error:', error);
      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
}

// Security validation function
function performSecurityValidation(req: Request): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check all input sources
  const inputs = [
    ...Object.values(req.body || {}),
    ...Object.values(req.query || {}),
    ...Object.values(req.params || {})
  ].filter(value => typeof value === 'string');

  for (const input of inputs) {
    // SQL injection check
    if (securityPatterns.sqlInjection.test(input)) {
      errors.push('Potential SQL injection detected');
    }

    // XSS check
    if (securityPatterns.xss.test(input)) {
      errors.push('Potential XSS attack detected');
    }

    // Path traversal check
    if (securityPatterns.pathTraversal.test(input)) {
      errors.push('Path traversal attempt detected');
    }

    // Command injection check
    if (securityPatterns.commandInjection.test(input)) {
      errors.push('Potential command injection detected');
    }

    // NoSQL injection check
    if (securityPatterns.nosqlInjection.test(input)) {
      errors.push('Potential NoSQL injection detected');
    }
  }

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)] // Remove duplicates
  };
}

// Sanitize object recursively
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizers.sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Express-validator chains for common validations
export const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .customSanitizer(sanitizers.sanitizeEmail)
    .withMessage('Valid email is required'),

  password: body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be 8-128 characters with uppercase, lowercase, number, and special character'),

  phone: body('phone')
    .optional()
    .isMobilePhone('any')
    .customSanitizer(sanitizers.sanitizePhone)
    .withMessage('Valid phone number is required'),

  name: body('name')
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .customSanitizer(sanitizers.sanitizeText)
    .withMessage('Name must be 1-100 characters, letters only'),

  id: param('id')
    .isUUID()
    .withMessage('Valid UUID is required'),

  text: body('text')
    .isLength({ max: 5000 })
    .customSanitizer(sanitizers.sanitizeHtml)
    .withMessage('Text must be less than 5000 characters'),

  url: body('url')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Valid URL is required')
};

// File upload validation
export function validateFileUpload(options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[] | undefined;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded'
      });
    }

    // Check file count
    if (options.maxFiles && files.length > options.maxFiles) {
      return res.status(400).json({
        error: `Too many files. Maximum ${options.maxFiles} allowed.`
      });
    }

    // Validate each file
    for (const file of files) {
      // Check file size
      if (options.maxSize && file.size > options.maxSize) {
        return res.status(400).json({
          error: `File ${file.originalname} is too large. Maximum size: ${options.maxSize} bytes`
        });
      }

      // Check file type
      if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `File ${file.originalname} has invalid type. Allowed: ${options.allowedTypes.join(', ')}`
        });
      }

      // Check filename for security
      if (securityPatterns.pathTraversal.test(file.originalname)) {
        return res.status(400).json({
          error: `Invalid filename: ${file.originalname}`
        });
      }
    }

    next();
  };
}

// Validation result handler
export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  
  next();
}

// Request size validation
export function validateRequestSize(maxSize: number = 1024 * 1024) { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request too large',
        maxSize,
        received: contentLength
      });
    }
    
    next();
  };
}

// JSON depth validation to prevent DoS
export function validateJsonDepth(maxDepth: number = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      const depth = getObjectDepth(req.body);
      
      if (depth > maxDepth) {
        return res.status(400).json({
          error: 'JSON structure too deep',
          maxDepth,
          actualDepth: depth
        });
      }
    }
    
    next();
  };
}

// Helper function to calculate object depth
function getObjectDepth(obj: any): number {
  if (typeof obj !== 'object' || obj === null) {
    return 0;
  }
  
  let maxDepth = 0;
  for (const value of Object.values(obj)) {
    const depth = getObjectDepth(value);
    maxDepth = Math.max(maxDepth, depth);
  }
  
  return maxDepth + 1;
}