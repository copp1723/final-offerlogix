export interface RateLimitConfig {
  maxEmails: number;
  windowMs: number;
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstHit: number;
}

/**
 * Simple in-memory rate limiter for email sending
 * Zero external dependencies - perfect for immediate implementation
 */
export class EmailRateLimit {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if email sending is allowed for identifier
   */
  checkLimit(identifier: string): RateLimitResult {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    
    let entry = this.store.get(key);
    
    // Create new entry if doesn't exist or window has expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstHit: now
      };
      this.store.set(key, entry);
    }

    // Check if limit exceeded
    const allowed = entry.count < this.config.maxEmails;
    const remaining = Math.max(0, this.config.maxEmails - entry.count);
    const resetTime = new Date(entry.resetTime);
    
    let retryAfter: number | undefined;
    if (!allowed) {
      retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    }

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter
    };
  }

  /**
   * Record an email being sent
   */
  recordSent(identifier: string): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const entry = this.store.get(key);
    
    if (entry) {
      entry.count++;
      this.store.set(key, entry);
    }
  }

  /**
   * Get current usage stats for identifier
   */
  getUsage(identifier: string): { count: number; limit: number; remaining: number; resetTime: Date } {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const entry = this.store.get(key);
    const now = Date.now();
    
    if (!entry || now > entry.resetTime) {
      return {
        count: 0,
        limit: this.config.maxEmails,
        remaining: this.config.maxEmails,
        resetTime: new Date(now + this.config.windowMs)
      };
    }

    return {
      count: entry.count,
      limit: this.config.maxEmails,
      remaining: Math.max(0, this.config.maxEmails - entry.count),
      resetTime: new Date(entry.resetTime)
    };
  }

  /**
   * Reset rate limit for specific identifier (admin override)
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    this.store.delete(key);
  }

  /**
   * Get all current rate limit entries for monitoring
   */
  getAllUsage(): Array<{ identifier: string; count: number; resetTime: Date }> {
    const results: Array<{ identifier: string; count: number; resetTime: Date }> = [];
    const now = Date.now();
    
    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.resetTime) {
        results.push({
          identifier: key,
          count: entry.count,
          resetTime: new Date(entry.resetTime)
        });
      }
    }
    
    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.store.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} expired rate limit entries`);
    }
  }

  /**
   * Destroy the rate limiter and cleanup
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Pre-configured rate limiters for different use cases
 */
export class EmailRateLimiters {
  // Limit users to 100 emails per hour
  static readonly userHourly = new EmailRateLimit({
    maxEmails: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (userId: string) => `user:${userId}:hourly`
  });

  // Limit campaigns to 500 emails per hour
  static readonly campaignHourly = new EmailRateLimit({
    maxEmails: 500,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (campaignId: string) => `campaign:${campaignId}:hourly`
  });

  // Global system limit - 1000 emails per hour
  static readonly systemHourly = new EmailRateLimit({
    maxEmails: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: () => 'system:global:hourly'
  });

  // Limit per IP for API calls - 50 emails per hour
  static readonly ipHourly = new EmailRateLimit({
    maxEmails: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (ip: string) => `ip:${ip}:hourly`
  });

  // Burst protection - 10 emails per minute
  static readonly burstProtection = new EmailRateLimit({
    maxEmails: 10,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (identifier: string) => `burst:${identifier}:minute`
  });
}
