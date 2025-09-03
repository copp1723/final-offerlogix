import validator from 'email-validator';

export interface EmailValidationResult {
  isValid: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
  suggestions?: string[];
}

export interface ContentValidationResult {
  allowed: boolean;
  blocked: boolean;
  quarantined: boolean;
  requiresApproval: boolean;
  reasons: string[];
  triggeredRules: string[];
  riskScore: number;
}

export interface BounceRecord {
  email: string;
  count: number;
  lastBounce: Date;
  type: 'soft' | 'hard';
}

/**
 * Enhanced Email Validator with immediate delivery improvements
 * Zero infrastructure dependencies - uses in-memory tracking
 */
export class EnhancedEmailValidator {
  private static bounceTracker = new Map<string, BounceRecord>();
  private static suppressedEmails = new Set<string>();
  
  // Common disposable/temporary email domains
  private static disposableDomains = new Set([
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'yopmail.com', 'throwaway.email',
    'temp-mail.org', 'getnada.com', 'sharklasers.com',
    'dispostable.com', 'emailondeck.com'
  ]);

  /**
   * Comprehensive email validation with deliverability checks
   */
  static validateEmail(email: string): EmailValidationResult {
    if (!email || typeof email !== 'string') {
      return {
        isValid: false,
        reason: 'Email is required',
        riskLevel: 'high'
      };
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Basic syntax validation
    if (!validator.validate(trimmedEmail)) {
      return {
        isValid: false,
        reason: 'Invalid email format',
        riskLevel: 'high',
        suggestions: ['Check for typos in email address']
      };
    }

    // Check if email is suppressed due to bounces
    if (this.suppressedEmails.has(trimmedEmail)) {
      return {
        isValid: false,
        reason: 'Email is suppressed due to previous bounces',
        riskLevel: 'high'
      };
    }

    const domain = trimmedEmail.split('@')[1];
    
    // Check for disposable email domains
    if (this.disposableDomains.has(domain)) {
      return {
        isValid: false,
        reason: 'Disposable email addresses are not allowed',
        riskLevel: 'high',
        suggestions: ['Use a permanent email address']
      };
    }

    // Check bounce history
    const bounceRecord = this.bounceTracker.get(trimmedEmail);
    if (bounceRecord) {
      if (bounceRecord.type === 'hard') {
        return {
          isValid: false,
          reason: 'Email has hard bounced previously',
          riskLevel: 'high'
        };
      }
      
      if (bounceRecord.count >= 3) {
        return {
          isValid: false,
          reason: 'Email has multiple soft bounces',
          riskLevel: 'high'
        };
      }

      if (bounceRecord.count >= 2) {
        return {
          isValid: true,
          reason: 'Email has previous soft bounces',
          riskLevel: 'medium',
          suggestions: ['Monitor delivery carefully']
        };
      }
    }

    // Additional risk assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const suggestions: string[] = [];

    // Check for common typos in popular domains
    const similarDomains: Record<string, string[]> = {
      'gmail.com': ['gmai.com', 'gmial.com', 'gamail.com'],
      'yahoo.com': ['yaho.com', 'yahho.com', 'yahooo.com'],
      'hotmail.com': ['hotmai.com', 'hotmial.com', 'hotmeil.com']
    };

    for (const [correct, typos] of Object.entries(similarDomains)) {
      if (typos.includes(domain)) {
        riskLevel = 'medium';
        suggestions.push(`Did you mean ${correct}?`);
        break;
      }
    }

    return {
      isValid: true,
      riskLevel,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Clean and validate a list of emails
   */
  static cleanEmailList(emails: string[]): {
    valid: string[];
    invalid: string[];
    duplicatesRemoved: number;
    statistics: {
      total: number;
      valid: number;
      invalid: number;
      suppressed: number;
    };
  } {
    const seen = new Set<string>();
    const valid: string[] = [];
    const invalid: string[] = [];
    let duplicatesRemoved = 0;
    let suppressed = 0;

    for (const email of emails) {
      if (!email) continue;
      
      const trimmedEmail = email.toLowerCase().trim();
      
      // Check for duplicates
      if (seen.has(trimmedEmail)) {
        duplicatesRemoved++;
        continue;
      }
      seen.add(trimmedEmail);

      const validation = this.validateEmail(trimmedEmail);
      
      if (validation.isValid) {
        valid.push(trimmedEmail);
      } else {
        invalid.push(trimmedEmail);
        if (validation.reason?.includes('suppressed')) {
          suppressed++;
        }
      }
    }

    return {
      valid,
      invalid,
      duplicatesRemoved,
      statistics: {
        total: emails.length,
        valid: valid.length,
        invalid: invalid.length,
        suppressed
      }
    };
  }

  /**
   * Record a bounce for future validation
   */
  static recordBounce(email: string, type: 'soft' | 'hard' = 'soft'): void {
    const trimmedEmail = email.toLowerCase().trim();
    const existing = this.bounceTracker.get(trimmedEmail);
    
    if (existing) {
      existing.count++;
      existing.lastBounce = new Date();
      existing.type = type === 'hard' ? 'hard' : existing.type;
    } else {
      this.bounceTracker.set(trimmedEmail, {
        email: trimmedEmail,
        count: 1,
        lastBounce: new Date(),
        type
      });
    }

    // Auto-suppress after 3 soft bounces or 1 hard bounce
    if (type === 'hard' || (existing && existing.count >= 3)) {
      this.suppressedEmails.add(trimmedEmail);
    }
  }

  /**
   * Get bounce statistics for monitoring
   */
  static getBounceStats(): {
    totalBounces: number;
    softBounces: number;
    hardBounces: number;
    suppressedEmails: number;
  } {
    let softBounces = 0;
    let hardBounces = 0;

    for (const bounce of this.bounceTracker.values()) {
      if (bounce.type === 'hard') {
        hardBounces++;
      } else {
        softBounces++;
      }
    }

    return {
      totalBounces: this.bounceTracker.size,
      softBounces,
      hardBounces,
      suppressedEmails: this.suppressedEmails.size
    };
  }

  /**
   * Remove a suppressed email (for admin override)
   */
  static removeSuppression(email: string): boolean {
    const trimmedEmail = email.toLowerCase().trim();
    return this.suppressedEmails.delete(trimmedEmail);
  }

  /**
   * Check if email is currently suppressed
   */
  static isSuppressed(email: string): boolean {
    return this.suppressedEmails.has(email.toLowerCase().trim());
  }

  /**
   * Validate email content for potential issues
   * Simplified version of the complex rule-based system
   */
  static validateEmailContent(emailData: {
    to: string[];
    subject: string;
    htmlContent: string;
    textContent?: string;
  }): ContentValidationResult {
    const result: ContentValidationResult = {
      allowed: true,
      blocked: false,
      quarantined: false,
      requiresApproval: false,
      reasons: [],
      triggeredRules: [],
      riskScore: 0,
    };

    try {
      // Check for missing required fields
      if (!emailData.to || emailData.to.length === 0) {
        result.blocked = true;
        result.allowed = false;
        result.reasons.push('Missing recipient email addresses');
        result.triggeredRules.push('missing_recipients');
        result.riskScore += 100;
        return result;
      }

      if (!emailData.subject || emailData.subject.trim() === '') {
        result.blocked = true;
        result.allowed = false;
        result.reasons.push('Missing email subject');
        result.triggeredRules.push('missing_subject');
        result.riskScore += 50;
      }

      if (!emailData.htmlContent || emailData.htmlContent.trim() === '') {
        result.blocked = true;
        result.allowed = false;
        result.reasons.push('Missing email content');
        result.triggeredRules.push('missing_content');
        result.riskScore += 50;
      }

      // Check for template placeholders
      const placeholderPatterns = [
        /\[Name\]/gi,
        /\[FIRST_NAME\]/gi,
        /\[LAST_NAME\]/gi,
        /\[EMAIL\]/gi,
        /\{\{.*\}\}/g,
        /\$\{.*\}/g
      ];

      for (const pattern of placeholderPatterns) {
        if (pattern.test(emailData.htmlContent) || pattern.test(emailData.subject)) {
          result.quarantined = true;
          result.allowed = false;
          result.reasons.push('Email contains unresolved template placeholders');
          result.triggeredRules.push('template_placeholders');
          result.riskScore += 35;
          break;
        }
      }

      // Validate email addresses
      for (const email of emailData.to) {
        const validation = this.validateEmail(email);
        if (!validation.isValid) {
          result.blocked = true;
          result.allowed = false;
          result.reasons.push(`Invalid email address: ${email} - ${validation.reason}`);
          result.triggeredRules.push('invalid_email');
          result.riskScore += 25;
        }
      }

      // Check for excessive recipients
      if (emailData.to.length > 100) {
        result.requiresApproval = true;
        result.allowed = false;
        result.reasons.push(`Too many recipients: ${emailData.to.length} (max: 100)`);
        result.triggeredRules.push('excessive_recipients');
        result.riskScore += 10;
      }

      // Cap risk score at 100
      result.riskScore = Math.min(result.riskScore, 100);

      return result;
    } catch (error) {
      // Fail safe - block email if validation fails
      return {
        allowed: false,
        blocked: true,
        quarantined: false,
        requiresApproval: false,
        reasons: ['Content validation system error'],
        triggeredRules: ['system_error'],
        riskScore: 100,
      };
    }
  }
}
