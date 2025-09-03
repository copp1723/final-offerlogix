/**
 * Attack Protection Middleware
 * Protection against common web application attacks
 */

import { Request, Response, NextFunction } from 'express';
import { securityPatterns } from './validation';
import { logValidationFailure, logSuspiciousActivity, detectSuspiciousActivity, SecurityEventType } from './security-logging';

// Attack detection patterns
const attackPatterns = {
  // SQL Injection patterns (more specific to avoid false positives)
  sqlInjection: {
    patterns: [
      /(\bunion\b.*\bselect\b)/gi,
      /(\bor\b\s*\d+\s*=\s*\d+)/gi,  // More specific or condition
      /(\band\b\s*\d+\s*=\s*\d+)/gi, // More specific and condition
      /(1=1|1=2|admin'--|admin"--)/gi,
      /(';--|";--|\\'\\s*OR\\s*\\'|\\\"\\s*OR\\s*\\\")/gi,
      /(DROP\s+TABLE|TRUNCATE\s+TABLE|ALTER\s+TABLE.*DROP)/gi,
      /(EXEC\s+XP_|SP_EXECUTESQL)/gi
    ],
    severity: 'high' as const
  },

  // XSS patterns (more targeted)
  xss: {
    patterns: [
      /<script\b[^>]*>.*?<\/script>/gi,
      /<iframe\b[^>]*src\s*=\s*['"]*javascript:/gi,
      /javascript:\s*[a-zA-Z]/gi,  // More specific javascript: protocol
      /vbscript:\s*[a-zA-Z]/gi,    // More specific vbscript: protocol
      /on(load|error|click|mouseover|focus|blur)\s*=\s*['"]/gi, // Specific event handlers
      /expression\s*\(\s*[a-zA-Z]/gi,
      /<img[^>]+src\s*=\s*['"]*javascript:/gi,
      /data:text\/html.*script/gi
    ],
    severity: 'high' as const
  },

  // Path Traversal patterns
  pathTraversal: {
    patterns: [
      /\.\.\//gi,
      /\.\.\\\//gi,
      /%2e%2e%2f/gi,
      /%252e%252e%252f/gi,
      /\.\.%2f/gi,
      /%2e%2e\//gi,
      /\.\.\\/gi,
      /..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/..\/etc\/passwd/gi
    ],
    severity: 'high' as const
  },

  // Command Injection patterns (more specific)
  commandInjection: {
    patterns: [
      /;\s*(cat|ls|rm|mv|cp|chmod|chown|kill)\s+/gi,
      /\|\s*(cat|ls|rm|mv|cp|wget|curl|nc)\s+/gi,
      /`(cat|ls|rm|mv|cp|wget|curl|nc)\s+/gi,
      /\$\(cat|ls|rm|mv|cp|wget|curl|nc\s+/gi,
      /&&\s*(cat|ls|rm|mv|cp|wget|curl|nc)\s+/gi
    ],
    severity: 'high' as const
  },

  // LDAP Injection patterns (much more specific)
  ldapInjection: {
    patterns: [
      /\(\&\([a-zA-Z]+=\*\)\([a-zA-Z]+=\*\)\)/gi,  // (& (attr=*)(attr=*))
      /\(\|\([a-zA-Z]+=\*\)\([a-zA-Z]+=\*\)\)/gi,  // (| (attr=*)(attr=*))
      /\(\!\([a-zA-Z]+=\w+\)\)/gi,                 // (!(attr=value))
      /\(\*\)\(\*\)/gi                             // (*)(*) - wildcard attack
    ],
    severity: 'medium' as const
  },

  // XML/XXE patterns
  xmlInjection: {
    patterns: [
      /<!ENTITY/gi,
      /<!DOCTYPE/gi,
      /SYSTEM\s+["'](?:file|http|https|ftp):/gi,
      /<!\[CDATA\[/gi,
      /&\w+;/gi
    ],
    severity: 'high' as const
  },

  // NoSQL Injection patterns
  nosqlInjection: {
    patterns: [
      /\$where/gi,
      /\$ne/gi,
      /\$gt/gi,
      /\$lt/gi,
      /\$gte/gi,
      /\$lte/gi,
      /\$in/gi,
      /\$nin/gi,
      /\$regex/gi,
      /\$exists/gi,
      /\$type/gi,
      /\$mod/gi,
      /\$all/gi,
      /\$size/gi,
      /\$elemMatch/gi
    ],
    severity: 'medium' as const
  },

  // CSRF patterns
  csrf: {
    patterns: [
      /<form\b[^>]*action\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi,
      /<img\b[^>]*src\s*=\s*["']https?:\/\/[^"']+\/[^"']*\?[^"']*>/gi
    ],
    severity: 'medium' as const
  },

  // Server-Side Template Injection
  ssti: {
    patterns: [
      /\{\{.*\}\}/gi,
      /\{%.*%\}/gi,
      /<\?.*\?>/gi,
      /<%.*%>/gi,
      /\$\{.*\}/gi
    ],
    severity: 'high' as const
  }
};

// Suspicious user agents
const suspiciousUserAgents = [
  /sqlmap/gi,
  /nikto/gi,
  /nessus/gi,
  /openvas/gi,
  /nmap/gi,
  /masscan/gi,
  /zap/gi,
  /burp/gi,
  /havij/gi,
  /pangolin/gi,
  /acunetix/gi,
  /w3af/gi,
  /dirbuster/gi,
  /gobuster/gi,
  /dirb/gi,
  /wfuzz/gi,
  /ffuf/gi
];

// Honeypot fields (fields that should never be filled by legitimate users)
const honeypotFields = ['honeypot', 'bot_field', 'email_confirm', 'website_url'];

// Rate limiting for suspicious IPs
const suspiciousIpTracker = new Map<string, { count: number; lastSeen: Date }>();

interface AttackDetectionResult {
  isAttack: boolean;
  attackTypes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string[];
}

// Main attack detection function
function detectAttacks(req: Request): AttackDetectionResult {
  const attackTypes: string[] = [];
  const details: string[] = [];
  let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Collect all input data
  const inputs = [
    ...Object.values(req.body || {}),
    ...Object.values(req.query || {}),
    ...Object.values(req.params || {}),
    req.path,
    req.headers['user-agent'] || ''
  ].filter(value => typeof value === 'string');

  // Check each attack pattern
  for (const [attackType, config] of Object.entries(attackPatterns)) {
    for (const pattern of config.patterns) {
      for (const input of inputs) {
        if (pattern.test(input)) {
          attackTypes.push(attackType);
          details.push(`${attackType} pattern detected in input: ${input.substring(0, 100)}...`);
          
          if (config.severity === 'high' && maxSeverity !== 'high') {
            maxSeverity = config.severity;
          } else if (config.severity === 'medium' && maxSeverity === 'low') {
            maxSeverity = config.severity;
          }
          break;
        }
      }
    }
  }

  // Check user agent
  const userAgent = req.headers['user-agent'] || '';
  for (const pattern of suspiciousUserAgents) {
    if (pattern.test(userAgent)) {
      attackTypes.push('suspicious_user_agent');
      details.push(`Suspicious user agent: ${userAgent}`);
      maxSeverity = maxSeverity === 'low' ? 'medium' : maxSeverity;
      break;
    }
  }

  // Check honeypot fields
  if (req.body) {
    for (const field of honeypotFields) {
      if (req.body[field] && req.body[field].trim() !== '') {
        attackTypes.push('bot_detection');
        details.push(`Honeypot field filled: ${field}`);
        maxSeverity = 'high';
      }
    }
  }

  // Check for unusual request patterns
  if (req.path.length > 1000) {
    attackTypes.push('long_path');
    details.push('Unusually long request path');
    maxSeverity = maxSeverity === 'low' ? 'medium' : maxSeverity;
  }

  if (JSON.stringify(req.body || {}).length > 100000) {
    attackTypes.push('large_payload');
    details.push('Unusually large request payload');
    maxSeverity = maxSeverity === 'low' ? 'medium' : maxSeverity;
  }

  return {
    isAttack: attackTypes.length > 0,
    attackTypes: Array.from(new Set(attackTypes)),
    severity: maxSeverity,
    details
  };
}

// Get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';
}

// Track suspicious IPs
function trackSuspiciousIP(ip: string): void {
  const now = new Date();
  const existing = suspiciousIpTracker.get(ip);
  
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
  } else {
    suspiciousIpTracker.set(ip, { count: 1, lastSeen: now });
  }

  // Clean up old entries (older than 1 hour)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  for (const [trackedIp, data] of Array.from(suspiciousIpTracker.entries())) {
    if (data.lastSeen < oneHourAgo) {
      suspiciousIpTracker.delete(trackedIp);
    }
  }
}

// Check if IP is suspicious
function isSuspiciousIP(ip: string): boolean {
  const data = suspiciousIpTracker.get(ip);
  return data ? data.count > 5 : false; // More than 5 attacks in the last hour
}

// Main attack protection middleware
export function attackProtection(req: Request, res: Response, next: NextFunction) {
  const clientIP = getClientIP(req);
  
  // Skip security checks for static assets and health checks
  const skipPaths = ['/favicon.ico', '/robots.txt', '/.well-known/', '/health', '/ping', '/status'];
  const isStaticAsset = skipPaths.some(path => req.path.startsWith(path)) || 
                      req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
  
  if (isStaticAsset) {
    return next();
  }
  
  // Skip for GET requests to root or basic pages (unless they have suspicious query parameters)
  if (req.method === 'GET' && (req.path === '/' || req.path === '/login' || req.path === '/dashboard') && 
      Object.keys(req.query).length === 0) {
    return next();
  }
  
  // Check if IP is already flagged as suspicious
  if (isSuspiciousIP(clientIP)) {
    logSuspiciousActivity(req, 'Blocked request from suspicious IP');
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP has been flagged for suspicious activity'
    });
  }

  // Detect attacks only for requests with data (POST, PUT, PATCH) or suspicious GET requests
  const shouldCheckForAttacks = req.method !== 'GET' || 
                               Object.keys(req.query).length > 0 || 
                               req.path.length > 100;
  
  if (shouldCheckForAttacks) {
    const attackResult = detectAttacks(req);
    
    if (attackResult.isAttack) {
      // Track this IP as suspicious
      trackSuspiciousIP(clientIP);
      
      // Log the attack attempt
      logValidationFailure(req, attackResult.details);
      
      // Log specific attack types
      for (const attackType of attackResult.attackTypes) {
        console.warn(`🚨 Attack detected: ${attackType} from ${clientIP} on ${req.path}`);
      }

      // For critical attacks, block immediately
      if (attackResult.severity === 'critical' || attackResult.severity === 'high') {
        return res.status(403).json({
          error: 'Security violation detected',
          message: 'Request blocked due to security policy',
          requestId: res.getHeader('X-Request-ID')
        });
      }

      // For medium severity, log but allow (with additional monitoring)
      if (attackResult.severity === 'medium') {
        console.warn(`⚠️  Medium severity attack detected but allowed: ${attackResult.attackTypes.join(', ')}`);
        // Add warning header
        res.setHeader('X-Security-Warning', 'Request flagged for security review');
      }
    }
  }

  // Check for general suspicious activity
  if (detectSuspiciousActivity(req)) {
    logSuspiciousActivity(req, 'General suspicious activity pattern detected');
    
    // Don't block, but monitor closely
    res.setHeader('X-Security-Monitor', 'true');
  }

  next();
}

// Specialized protection for specific endpoints
export const endpointProtection = {
  // Authentication endpoints (stricter)
  auth: (req: Request, res: Response, next: NextFunction) => {
    const authSpecificPatterns = [
      // /admin/gi,  // Disabled - blocks legitimate admin login
      // /root/gi,   // Disabled - too broad, blocks legitimate usernames
      // /test/gi,   // Disabled - too broad, blocks legitimate test environments
      // /guest/gi,  // Disabled - too broad, blocks legitimate guest users
      /'or'1'='1/gi,
      /"or"1"="1/gi,
      /1=1--/gi,
      /admin'--/gi,
      /admin"--/gi
    ];

    const inputs = Object.values(req.body || {}).filter(v => typeof v === 'string');
    
    for (const input of inputs) {
      for (const pattern of authSpecificPatterns) {
        if (pattern.test(input)) {
          logValidationFailure(req, [`Authentication attack pattern detected: ${input}`]);
          return res.status(403).json({
            error: 'Authentication security violation',
            message: 'Invalid authentication attempt'
          });
        }
      }
    }

    next();
  },

  // File upload endpoints
  upload: (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[] | undefined;
    
    if (files) {
      for (const file of files) {
        // Check for dangerous file extensions
        const dangerousExtensions = [
          '.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js', '.jar',
          '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh'
        ];
        
        const fileName = file.originalname.toLowerCase();
        if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
          return res.status(403).json({
            error: 'File type not allowed',
            message: 'Potentially dangerous file type detected'
          });
        }

        // Check file content for suspicious patterns
        if (file.buffer) {
          const content = file.buffer.toString('utf8', 0, Math.min(1000, file.buffer.length));
          const attackResult = detectAttacks({ ...req, body: { content } } as Request);
          
          if (attackResult.isAttack) {
            return res.status(403).json({
              error: 'Malicious file content detected',
              message: 'File contains potentially harmful content'
            });
          }
        }
      }
    }

    next();
  },

  // API endpoints with database access
  database: (req: Request, res: Response, next: NextFunction) => {
    // Extra SQL injection protection for database endpoints
    const sqlPatterns = [
      /union.*select/gi,
      /insert.*into/gi,
      /delete.*from/gi,
      /update.*set/gi,
      /drop.*table/gi,
      /create.*table/gi,
      /alter.*table/gi,
      /exec.*xp_/gi,
      /sp_executesql/gi
    ];

    const allInputs = [
      ...Object.values(req.body || {}),
      ...Object.values(req.query || {}),
      ...Object.values(req.params || {})
    ].filter(v => typeof v === 'string');

    for (const input of allInputs) {
      for (const pattern of sqlPatterns) {
        if (pattern.test(input)) {
          logValidationFailure(req, [`SQL injection attempt detected: ${input}`]);
          return res.status(403).json({
            error: 'Database security violation',
            message: 'Request blocked due to SQL injection attempt'
          });
        }
      }
    }

    next();
  }
};

// IP whitelist/blacklist functionality
const ipWhitelist = new Set<string>();
const ipBlacklist = new Set<string>();

export function addToWhitelist(ip: string): void {
  ipWhitelist.add(ip);
}

export function addToBlacklist(ip: string): void {
  ipBlacklist.add(ip);
}

export function removeFromWhitelist(ip: string): void {
  ipWhitelist.delete(ip);
}

export function removeFromBlacklist(ip: string): void {
  ipBlacklist.delete(ip);
}

// IP filtering middleware
export function ipFiltering(req: Request, res: Response, next: NextFunction) {
  const clientIP = getClientIP(req);

  // Check blacklist first
  if (ipBlacklist.has(clientIP)) {
    logSuspiciousActivity(req, 'Blocked request from blacklisted IP');
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked'
    });
  }

  // If whitelist is configured and IP is not whitelisted
  if (ipWhitelist.size > 0 && !ipWhitelist.has(clientIP)) {
    logSuspiciousActivity(req, 'Blocked request from non-whitelisted IP');
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address is not authorized'
    });
  }

  next();
}

// Get security statistics
export function getAttackStats(): any {
  const stats = {
    suspiciousIPs: Array.from(suspiciousIpTracker.entries()).map(([ip, data]) => ({
      ip,
      attackCount: data.count,
      lastSeen: data.lastSeen
    })),
    whitelistedIPs: Array.from(ipWhitelist),
    blacklistedIPs: Array.from(ipBlacklist),
    totalSuspiciousIPs: suspiciousIpTracker.size
  };

  return stats;
}