/**
 * Security Configuration Management System
 * Centralized security configuration and policy management
 */

import { Request, Response, NextFunction } from 'express';

// Utility type for deep partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Security configuration interface
export interface SecurityConfig {
  // Rate limiting
  rateLimiting: {
    enabled: boolean;
    tiers: {
      standard: { windowMs: number; max: number };
      premium: { windowMs: number; max: number };
      enterprise: { windowMs: number; max: number };
    };
    endpoints: {
      auth: { windowMs: number; max: number };
      upload: { windowMs: number; max: number };
      ai: { windowMs: number; max: number };
      unauthenticated: { windowMs: number; max: number };
    };
  };

  // Authentication
  authentication: {
    apiKeyRequired: boolean;
    sessionTimeout: number; // minutes
    maxLoginAttempts: number;
    lockoutDuration: number; // minutes
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
  };

  // Input validation
  validation: {
    maxRequestSize: number; // bytes
    maxJsonDepth: number;
    allowedFileTypes: string[];
    maxFileSize: number; // bytes
    maxFilesPerRequest: number;
    sanitizeInputs: boolean;
    blockSqlInjection: boolean;
    blockXss: boolean;
    blockPathTraversal: boolean;
  };

  // Security headers
  headers: {
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubdomains: boolean;
      preload: boolean;
    };
    csp: {
      enabled: boolean;
      reportOnly: boolean;
      directives: Record<string, string[]>;
    };
    xssProtection: boolean;
    noSniff: boolean;
    frameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
    referrerPolicy: string;
  };

  // Monitoring and logging
  monitoring: {
    logSecurityEvents: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    alertOnAttacks: boolean;
    suspiciousActivityThreshold: number;
    ipTrackingEnabled: boolean;
    geoLocationTracking: boolean;
  };

  // Feature flags
  features: {
    attackProtection: boolean;
    honeypotFields: boolean;
    botDetection: boolean;
    ipWhitelisting: boolean;
    ipBlacklisting: boolean;
    apiKeyRotation: boolean;
    sessionManagement: boolean;
  };

  // Environment-specific settings
  environment: {
    development: DeepPartial<SecurityConfig>;
    staging: DeepPartial<SecurityConfig>;
    production: DeepPartial<SecurityConfig>;
  };
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
  rateLimiting: {
    enabled: false,
    tiers: {
      standard: { windowMs: 15 * 60 * 1000, max: 100 },
      premium: { windowMs: 15 * 60 * 1000, max: 300 },
      enterprise: { windowMs: 15 * 60 * 1000, max: 1000 }
    },
    endpoints: {
      auth: { windowMs: 15 * 60 * 1000, max: 5 },
      upload: { windowMs: 60 * 60 * 1000, max: 10 },
      ai: { windowMs: 60 * 1000, max: 20 },
      unauthenticated: { windowMs: 15 * 60 * 1000, max: 50 }
    }
  },

  authentication: {
    apiKeyRequired: false,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }
  },

  validation: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxJsonDepth: 10,
    allowedFileTypes: [
      'text/csv',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/gif',
      'application/pdf',
      'text/plain'
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerRequest: 10,
    sanitizeInputs: true,
    blockSqlInjection: true,
    blockXss: true,
    blockPathTraversal: true
  },

  headers: {
    hsts: {
      enabled: true,
      maxAge: 31536000, // 1 year
      includeSubdomains: true,
      preload: true
    },
    csp: {
      enabled: true,
      reportOnly: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https://api.openai.com', 'https://api.mailgun.net']
      }
    },
    xssProtection: true,
    noSniff: true,
    frameOptions: 'DENY',
    referrerPolicy: 'no-referrer-when-downgrade'
  },

  monitoring: {
    logSecurityEvents: true,
    logLevel: 'warn',
    alertOnAttacks: true,
    suspiciousActivityThreshold: 5,
    ipTrackingEnabled: true,
    geoLocationTracking: false
  },

  features: {
    attackProtection: false,
    honeypotFields: false,
    botDetection: false,
    ipWhitelisting: false,
    ipBlacklisting: false,
    apiKeyRotation: false,
    sessionManagement: false
  },

  environment: {
    development: {
      rateLimiting: { enabled: false },
      headers: { csp: { enabled: false } },
      monitoring: { logLevel: 'debug' }
    },
    staging: {
      monitoring: { logLevel: 'info' }
    },
    production: {
      authentication: { apiKeyRequired: true },
      features: { attackProtection: false },
      monitoring: { logLevel: 'warn' }
    }
  }
};

// Security configuration manager
class SecurityConfigManager {
  private config: SecurityConfig;
  private environment: 'development' | 'staging' | 'production';

  constructor() {
    this.environment = (process.env.NODE_ENV as any) || 'development';
    this.config = this.loadConfig();
  }

  private loadConfig(): SecurityConfig {
    // Start with default config
    let config = { ...defaultSecurityConfig };

    // Apply environment-specific overrides
    const envConfig = config.environment[this.environment];
    if (envConfig) {
      config = this.mergeConfigs(config, envConfig);
    }

    // Apply any runtime environment variables
    config = this.applyEnvironmentVariables(config);

    return config;
  }

  private mergeConfigs(base: any, override: any): any {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private applyEnvironmentVariables(config: SecurityConfig): SecurityConfig {
    // Rate limiting
    if (process.env.RATE_LIMIT_ENABLED !== undefined) {
      config.rateLimiting.enabled = process.env.RATE_LIMIT_ENABLED === 'true';
    }

    // API key requirement
    if (process.env.API_KEY_REQUIRED !== undefined) {
      config.authentication.apiKeyRequired = process.env.API_KEY_REQUIRED === 'true';
    }

    // Max request size
    if (process.env.MAX_REQUEST_SIZE) {
      config.validation.maxRequestSize = parseInt(process.env.MAX_REQUEST_SIZE);
    }

    // Security features
    if (process.env.ATTACK_PROTECTION !== undefined) {
      config.features.attackProtection = process.env.ATTACK_PROTECTION === 'true';
    }

    if (process.env.LOG_SECURITY_EVENTS !== undefined) {
      config.monitoring.logSecurityEvents = process.env.LOG_SECURITY_EVENTS === 'true';
    }

    return config;
  }

  getConfig(): SecurityConfig {
    return this.config;
  }

  updateConfig(updates: DeepPartial<SecurityConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  getRateLimitConfig(tier: string = 'standard') {
    return this.config.rateLimiting.tiers[tier as keyof typeof this.config.rateLimiting.tiers] || 
           this.config.rateLimiting.tiers.standard;
  }

  getEndpointRateLimit(endpoint: string) {
    const endpointKey = endpoint as keyof typeof this.config.rateLimiting.endpoints;
    return this.config.rateLimiting.endpoints[endpointKey] || 
           this.config.rateLimiting.tiers.standard;
  }

  isFeatureEnabled(feature: keyof SecurityConfig['features']): boolean {
    return this.config.features[feature];
  }

  getValidationConfig() {
    return this.config.validation;
  }

  getHeadersConfig() {
    return this.config.headers;
  }

  getMonitoringConfig() {
    return this.config.monitoring;
  }

  getAuthConfig() {
    return this.config.authentication;
  }
}

// Global security config instance
export const securityConfig = new SecurityConfigManager();

// Middleware to inject security config into request
export function securityConfigMiddleware(req: Request, res: Response, next: NextFunction) {
  (req as any).securityConfig = securityConfig.getConfig();
  next();
}

// Admin endpoint to get current security configuration
export function getSecurityConfig(req: Request, res: Response) {
  try {
    const config = securityConfig.getConfig();
    
    // Remove sensitive information before sending
    const sanitizedConfig = {
      ...config,
      environment: {
        current: process.env.NODE_ENV,
        // Don't expose other environment configs
      }
    };

    res.json({
      config: sanitizedConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting security config:', error);
    res.status(500).json({
      error: 'Failed to retrieve security configuration'
    });
  }
}

// Admin endpoint to update security configuration
export function updateSecurityConfig(req: Request, res: Response) {
  try {
    const updates = req.body;
    
    // Validate the updates (basic validation)
    if (typeof updates !== 'object' || updates === null) {
      return res.status(400).json({
        error: 'Invalid configuration updates'
      });
    }

    // Apply updates
    securityConfig.updateConfig(updates);

    res.json({
      message: 'Security configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating security config:', error);
    res.status(500).json({
      error: 'Failed to update security configuration'
    });
  }
}

// Security health check endpoint
export function securityHealthCheck(req: Request, res: Response) {
  try {
    const config = securityConfig.getConfig();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      features: {
        rateLimiting: config.rateLimiting.enabled,
        attackProtection: config.features.attackProtection,
        apiKeyAuth: config.authentication.apiKeyRequired,
        inputValidation: config.validation.sanitizeInputs,
        securityHeaders: config.headers.hsts.enabled,
        monitoring: config.monitoring.logSecurityEvents
      },
      warnings: [] as string[]
    };

    // Check for potential security issues
    if (!config.rateLimiting.enabled) {
      healthStatus.warnings.push('Rate limiting is disabled');
    }

    if (!config.features.attackProtection) {
      healthStatus.warnings.push('Attack protection is disabled');
    }

    if (!config.authentication.apiKeyRequired && process.env.NODE_ENV === 'production') {
      healthStatus.warnings.push('API key authentication is disabled in production');
    }

    if (!config.headers.hsts.enabled && process.env.NODE_ENV === 'production') {
      healthStatus.warnings.push('HSTS is disabled in production');
    }

    if (healthStatus.warnings.length > 0) {
      healthStatus.status = 'warning';
    }

    res.json(healthStatus);
  } catch (error) {
    console.error('Security health check error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Security health check failed'
    });
  }
}

// Utility functions for middleware configuration
export function shouldApplyRateLimit(endpoint: string): boolean {
  return securityConfig.getConfig().rateLimiting.enabled;
}

export function shouldApplyAttackProtection(): boolean {
  return securityConfig.isFeatureEnabled('attackProtection');
}

export function shouldRequireApiKey(): boolean {
  return securityConfig.getConfig().authentication.apiKeyRequired;
}

export function shouldSanitizeInputs(): boolean {
  return securityConfig.getConfig().validation.sanitizeInputs;
}

export function shouldLogSecurityEvents(): boolean {
  return securityConfig.getConfig().monitoring.logSecurityEvents;
}

// Configuration presets for different security levels
export const securityPresets: Record<string, DeepPartial<SecurityConfig>> = {
  // Development environment - relaxed security
  development: {
    rateLimiting: { enabled: false },
    authentication: { apiKeyRequired: false },
    headers: { csp: { enabled: false } },
    features: { attackProtection: false },
    monitoring: { logLevel: 'debug' as const }
  },

  // Testing environment - moderate security
  testing: {
    rateLimiting: { enabled: true },
    authentication: { apiKeyRequired: true },
    features: { attackProtection: true },
    monitoring: { logLevel: 'info' as const }
  },

  // Production environment - maximum security
  production: {
    rateLimiting: { enabled: true },
    authentication: { apiKeyRequired: true },
    features: { attackProtection: true },
    headers: { hsts: { enabled: true } },
    monitoring: { logLevel: 'warn' as const, alertOnAttacks: true }
  }
};

// Apply security preset
export function applySecurityPreset(preset: keyof typeof securityPresets) {
  const presetConfig = securityPresets[preset];
  if (presetConfig) {
    securityConfig.updateConfig(presetConfig);
    console.log(`Applied security preset: ${preset}`);
  }
}