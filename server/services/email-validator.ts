interface OutboundEmailData {
  to: string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromName?: string;
  fromEmail?: string;
  campaignId?: string;
  leadId?: string;
}

interface EmailValidationResult {
  allowed: boolean;
  blocked: boolean;
  quarantined: boolean;
  requiresApproval: boolean;
  reasons: string[];
  triggeredRules: string[];
  riskScore: number;
}

interface EmailBlockRule {
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    checkMissingFields?: boolean;
    checkEmptyContent?: boolean;
    checkInvalidEmails?: boolean;
    checkSuspiciousContent?: boolean;
    checkTemplatePlaceholders?: boolean;
    checkSpamKeywords?: boolean;
    maxRecipients?: number;
    blockedDomains?: string[];
    requiredFields?: string[];
  };
  actions: {
    block?: boolean;
    quarantine?: boolean;
    requireApproval?: boolean;
    notifyAdmin?: boolean;
  };
}

interface RuleEvaluationResult {
  triggered: boolean;
  reasons: string[];
  riskScore: number;
}

class OutboundEmailWatchdog {
  private blockRules: EmailBlockRule[] = [
    {
      name: "Critical Field Validation",
      enabled: true,
      priority: 100,
      conditions: {
        checkMissingFields: true,
        requiredFields: ["to", "subject", "htmlContent"]
      },
      actions: {
        block: true,
        notifyAdmin: true
      }
    },
    {
      name: "Content Completeness Check",
      enabled: true,
      priority: 90,
      conditions: {
        checkEmptyContent: true,
        checkTemplatePlaceholders: true
      },
      actions: {
        block: true,
        notifyAdmin: true
      }
    },
    {
      name: "Email Address Validation",
      enabled: true,
      priority: 80,
      conditions: {
        checkInvalidEmails: true
      },
      actions: {
        block: true
      }
    },
    {
      name: "Spam Prevention",
      enabled: true,
      priority: 70,
      conditions: {
        checkSpamKeywords: true,
        checkSuspiciousContent: true
      },
      actions: {
        requireApproval: true,
        notifyAdmin: true
      }
    },
    {
      name: "Bulk Send Limits",
      enabled: true,
      priority: 60,
      conditions: {
        maxRecipients: 100
      },
      actions: {
        requireApproval: true
      }
    },
    {
      name: "Domain Blocklist",
      enabled: true,
      priority: 50,
      conditions: {
        blockedDomains: ["tempmail.com", "10minutemail.com", "guerrillamail.com"]
      },
      actions: {
        block: true
      }
    }
  ];

  private spamKeywords = [
    "100% FREE", "URGENT", "MAKE MONEY FAST", "CLICK HERE NOW",
    "LIMITED TIME", "ACT NOW", "GUARANTEED", "NO RISK"
  ];

  /**
   * Main validation method - call this before sending any email
   */
  async validateOutboundEmail(emailData: OutboundEmailData): Promise<EmailValidationResult> {
    const result: EmailValidationResult = {
      allowed: true,
      blocked: false,
      quarantined: false,
      requiresApproval: false,
      reasons: [],
      triggeredRules: [],
      riskScore: 0,
    };

    try {
      // Sort rules by priority (highest first)
      const sortedRules = this.blockRules
        .filter(rule => rule.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        const ruleResult = await this.evaluateRule(rule, emailData);

        if (ruleResult.triggered) {
          result.triggeredRules.push(rule.name);
          result.reasons.push(...ruleResult.reasons);
          result.riskScore += ruleResult.riskScore;

          if (rule.actions.block) {
            result.blocked = true;
            result.allowed = false;
          }

          if (rule.actions.quarantine) {
            result.quarantined = true;
            result.allowed = false;
          }

          if (rule.actions.requireApproval) {
            result.requiresApproval = true;
            result.allowed = false;
          }

          if (rule.actions.notifyAdmin) {
            await this.notifyAdmin(emailData, rule.name, ruleResult.reasons);
          }

          // If blocked or quarantined, stop processing further rules
          if (result.blocked || result.quarantined) {
            break;
          }
        }
      }

      // Cap risk score at 100
      result.riskScore = Math.min(result.riskScore, 100);

      // Log the validation result
      console.log('Email validation completed', {
        to: emailData.to,
        allowed: result.allowed,
        riskScore: result.riskScore,
        triggeredRules: result.triggeredRules.length,
      });

      return result;
    } catch (error) {
      console.error('Error validating outbound email', { error, to: emailData.to });

      // Fail safe - block email if validation fails
      return {
        allowed: false,
        blocked: true,
        quarantined: false,
        requiresApproval: false,
        reasons: ['Validation system error'],
        triggeredRules: [],
        riskScore: 100,
      };
    }
  }

  private async evaluateRule(rule: EmailBlockRule, emailData: OutboundEmailData): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      triggered: false,
      reasons: [],
      riskScore: 0
    };

    const { conditions } = rule;

    // Check missing required fields
    if (conditions.checkMissingFields && conditions.requiredFields) {
      for (const field of conditions.requiredFields) {
        if (!emailData[field as keyof OutboundEmailData] || 
            (Array.isArray(emailData[field as keyof OutboundEmailData]) && 
             (emailData[field as keyof OutboundEmailData] as any[]).length === 0)) {
          result.triggered = true;
          result.reasons.push(`Missing required field: ${field}`);
          result.riskScore += 30;
        }
      }
    }

    // Check empty content
    if (conditions.checkEmptyContent) {
      if (!emailData.subject?.trim()) {
        result.triggered = true;
        result.reasons.push("Email subject is empty");
        result.riskScore += 25;
      }
      
      if (!emailData.htmlContent?.trim()) {
        result.triggered = true;
        result.reasons.push("Email content is empty");
        result.riskScore += 30;
      }

      if (emailData.htmlContent && emailData.htmlContent.trim().length < 10) {
        result.triggered = true;
        result.reasons.push("Email content is too short");
        result.riskScore += 20;
      }
    }

    // Check template placeholders
    if (conditions.checkTemplatePlaceholders) {
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
          result.triggered = true;
          result.reasons.push("Email contains unresolved template placeholders");
          result.riskScore += 35;
          break;
        }
      }
    }

    // Check invalid email addresses
    if (conditions.checkInvalidEmails) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of emailData.to) {
        if (!emailRegex.test(email)) {
          result.triggered = true;
          result.reasons.push(`Invalid email address: ${email}`);
          result.riskScore += 25;
        }
      }
    }

    // Check spam keywords
    if (conditions.checkSpamKeywords) {
      const content = `${emailData.subject} ${emailData.htmlContent}`.toUpperCase();
      for (const keyword of this.spamKeywords) {
        if (content.includes(keyword)) {
          result.triggered = true;
          result.reasons.push(`Contains spam keyword: ${keyword}`);
          result.riskScore += 15;
        }
      }
    }

    // Check suspicious content
    if (conditions.checkSuspiciousContent) {
      const suspiciousPatterns = [
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card patterns
        /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/, // SSN patterns
        /(urgent|immediate|act now|limited time).{0,50}(click|buy|purchase)/gi
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(emailData.htmlContent) || pattern.test(emailData.subject)) {
          result.triggered = true;
          result.reasons.push("Email contains suspicious content patterns");
          result.riskScore += 20;
          break;
        }
      }
    }

    // Check recipient limits
    if (conditions.maxRecipients && emailData.to.length > conditions.maxRecipients) {
      result.triggered = true;
      result.reasons.push(`Too many recipients: ${emailData.to.length} (max: ${conditions.maxRecipients})`);
      result.riskScore += 10;
    }

    // Check blocked domains
    if (conditions.blockedDomains) {
      for (const email of emailData.to) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (domain && conditions.blockedDomains.includes(domain)) {
          result.triggered = true;
          result.reasons.push(`Blocked domain: ${domain}`);
          result.riskScore += 40;
        }
      }
    }

    return result;
  }

  private async notifyAdmin(emailData: OutboundEmailData, ruleName: string, reasons: string[]): Promise<void> {
    // In a real implementation, this would send an alert to administrators
    console.warn('Email validation alert', {
      rule: ruleName,
      reasons,
      to: emailData.to,
      subject: emailData.subject,
      campaignId: emailData.campaignId
    });

    // Could integrate with SMS alerts, Slack notifications, etc.
    // For now, we'll just log the alert
  }

  /**
   * Get validation statistics for monitoring
   */
  getValidationStats(): any {
    return {
      rulesCount: this.blockRules.length,
      enabledRules: this.blockRules.filter(r => r.enabled).length,
      spamKeywordsCount: this.spamKeywords.length
    };
  }

  /**
   * Update rule configuration
   */
  updateRule(ruleName: string, updates: Partial<EmailBlockRule>): boolean {
    const ruleIndex = this.blockRules.findIndex(r => r.name === ruleName);
    if (ruleIndex === -1) return false;

    this.blockRules[ruleIndex] = { ...this.blockRules[ruleIndex], ...updates };
    return true;
  }
}

// Export singleton instance
export const emailWatchdog = new OutboundEmailWatchdog();
export type { OutboundEmailData, EmailValidationResult };