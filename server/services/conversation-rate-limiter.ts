import { getEnv } from '../env';

export interface RateLimitConfig {
  maxMessages: number;
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
 * Simple in-memory rate limiter for AI conversation throttling
 * Zero external dependencies - perfect for immediate implementation
 */
export class ConversationRateLimit {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if AI response is allowed for conversation
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
    const allowed = entry.count < this.config.maxMessages;
    const remaining = Math.max(0, this.config.maxMessages - entry.count);
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
   * Record an AI response being sent
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
   * Get current usage stats for conversation
   */
  getUsage(identifier: string): { count: number; limit: number; remaining: number; resetTime: Date } {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const entry = this.store.get(key);
    const now = Date.now();
    
    if (!entry || now > entry.resetTime) {
      return {
        count: 0,
        limit: this.config.maxMessages,
        remaining: this.config.maxMessages,
        resetTime: new Date(now + this.config.windowMs)
      };
    }

    return {
      count: entry.count,
      limit: this.config.maxMessages,
      remaining: Math.max(0, this.config.maxMessages - entry.count),
      resetTime: new Date(entry.resetTime)
    };
  }

  /**
   * Reset rate limit for specific conversation (admin override)
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
      console.log(`🧹 Cleaned up ${toDelete.length} expired conversation rate limit entries`);
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
 * Pre-configured rate limiters for AI conversations
 * Using environment configuration for flexibility
 */
export class ConversationRateLimiters {
  private static env = getEnv();

  // AI Conversation throttling - configurable via environment  
  static readonly aiConversation = new ConversationRateLimit({
    maxMessages: 1, // One AI response allowed per window
    windowMs: ConversationRateLimiters.env.AI_CONVERSATION_COOLDOWN_MS, // 5 minutes by default
    keyGenerator: (conversationId: string) => `ai:conversation:${conversationId}`
  });

  // Lead-level throttling - prevents spam from single lead
  static readonly leadDaily = new ConversationRateLimit({
    maxMessages: 20, // Max 20 AI responses per lead per day
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    keyGenerator: (leadEmail: string) => `ai:lead:${leadEmail}:daily`
  });

  // Campaign-level throttling - prevents campaign overload
  static readonly campaignHourly = new ConversationRateLimit({
    maxMessages: 50, // Max 50 AI responses per campaign per hour
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (campaignId: string) => `ai:campaign:${campaignId}:hourly`
  });

  // System-level protection - global AI response limit
  static readonly systemHourly = new ConversationRateLimit({
    maxMessages: 200, // Max 200 AI responses per hour system-wide
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: () => 'ai:system:hourly'
  });

  // Burst protection for active conversations
  static readonly burstProtection = new ConversationRateLimit({
    maxMessages: 3, // Max 3 quick responses
    windowMs: 2 * 60 * 1000, // 2 minute window
    keyGenerator: (identifier: string) => `ai:burst:${identifier}`
  });

  /**
   * Check if AI response is allowed using all applicable rate limiters
   */
  static checkAIResponseAllowed(conversationId: string, leadEmail?: string, campaignId?: string): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  } {
    // Check conversation-specific limit (primary throttling)
    const conversationLimit = this.aiConversation.checkLimit(conversationId);
    if (!conversationLimit.allowed) {
      return {
        allowed: false,
        reason: 'Conversation cooldown active',
        retryAfter: conversationLimit.retryAfter
      };
    }

    // Check system-wide limit
    const systemLimit = this.systemHourly.checkLimit('system');
    if (!systemLimit.allowed) {
      return {
        allowed: false,
        reason: 'System rate limit exceeded',
        retryAfter: systemLimit.retryAfter
      };
    }

    // Check lead-specific limit if provided
    if (leadEmail) {
      const leadLimit = this.leadDaily.checkLimit(leadEmail);
      if (!leadLimit.allowed) {
        return {
          allowed: false,
          reason: 'Lead daily limit exceeded',
          retryAfter: leadLimit.retryAfter
        };
      }
    }

    // Check campaign-specific limit if provided
    if (campaignId) {
      const campaignLimit = this.campaignHourly.checkLimit(campaignId);
      if (!campaignLimit.allowed) {
        return {
          allowed: false,
          reason: 'Campaign rate limit exceeded',
          retryAfter: campaignLimit.retryAfter
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record AI response being sent across all applicable limiters
   */
  static recordAIResponseSent(conversationId: string, leadEmail?: string, campaignId?: string): void {
    this.aiConversation.recordSent(conversationId);
    this.systemHourly.recordSent('system');

    if (leadEmail) {
      this.leadDaily.recordSent(leadEmail);
    }

    if (campaignId) {
      this.campaignHourly.recordSent(campaignId);
    }
  }

  /**
   * Get comprehensive rate limit status for monitoring
   */
  static getStatus(conversationId: string, leadEmail?: string, campaignId?: string): {
    conversation: { count: number; limit: number; remaining: number; resetTime: Date };
    system: { count: number; limit: number; remaining: number; resetTime: Date };
    lead?: { count: number; limit: number; remaining: number; resetTime: Date };
    campaign?: { count: number; limit: number; remaining: number; resetTime: Date };
  } {
    const status: any = {
      conversation: this.aiConversation.getUsage(conversationId),
      system: this.systemHourly.getUsage('system')
    };

    if (leadEmail) {
      status.lead = this.leadDaily.getUsage(leadEmail);
    }

    if (campaignId) {
      status.campaign = this.campaignHourly.getUsage(campaignId);
    }

    return status;
  }
}