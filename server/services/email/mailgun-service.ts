import formData from 'form-data';
// Use dynamic import for ESM compatibility
import { EnhancedEmailValidator } from '../enhanced-email-validator';
import { EmailContentAnalyzer } from '../email-content-analyzer';
import { EmailRateLimiters } from '../email-rate-limiter';
import { sanitizeAutomotiveReply } from '../reply-sanitizer';

// Will be initialized with dynamic import
let mailgunConstructor: any = null;

// Lazy initialization of Mailgun client
let mg: any = null;
async function getMailgunClient() {
  if (!mg) {
    if (!mailgunConstructor) {
      const MailgunModule = await import('mailgun.js');
      mailgunConstructor = MailgunModule.default;
    }
    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY is required but not set');
    }
    const mailgun = new mailgunConstructor(formData);
    mg = mailgun.client({
      username: 'api',
      key: apiKey,
    });
  }
  return mg;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
  variables?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  blocked?: boolean;
  riskScore?: number;
  validationResult?: {
    isValid: boolean;
    reason?: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
  contentAnalysis?: {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    issues?: string[];
  };
  rateLimitHit?: boolean;
}

export class MailgunService {
  private domain: string;
  private defaultFrom: string;

  constructor() {
    this.domain = process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us';
    this.defaultFrom = `${process.env.EMAIL_SENDER_NAME || 'OneKeel Swarm'} <swarm@${this.domain}>`;
  }


  /**
   * Send a single email with enhanced validation and rate limiting
   */
  async sendEmail(emailData: EmailData, userId?: string): Promise<EmailResult> {
    try {
      // 1. Basic validation
      if (!emailData.to || !emailData.subject) {
        return {
          success: false,
          error: 'Email address and subject are required',
          blocked: true
        };
      }

      // 2. Enhanced email validation
      const validation = EnhancedEmailValidator.validateEmail(emailData.to);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.reason || 'Invalid email address',
          blocked: true,
          validationResult: validation
        };
      }

      // 3. Rate limiting checks
      if (userId) {
        const userLimit = EmailRateLimiters.userHourly.checkLimit(userId);
        if (!userLimit.allowed) {
          return {
            success: false,
            error: `Rate limit exceeded. Try again in ${userLimit.retryAfter} seconds`,
            blocked: true,
            rateLimitHit: true
          };
        }

        const burstLimit = EmailRateLimiters.burstProtection.checkLimit(userId);
        if (!burstLimit.allowed) {
          return {
            success: false,
            error: 'Sending too fast. Please wait a moment before sending again',
            blocked: true,
            rateLimitHit: true
          };
        }
      }

      // 4. Content analysis
      const contentAnalysis = EmailContentAnalyzer.analyzeContent(
        emailData.subject, 
        emailData.html
      );

      // Block high-risk content
      if (contentAnalysis.riskLevel === 'high') {
        return {
          success: false,
          error: 'Email content has high spam risk. Please review and modify.',
          blocked: true,
          contentAnalysis,
          validationResult: validation
        };
      }

      // 5. Enhanced HTML sanitization + placeholder cleanup
      const cleaned = sanitizeAutomotiveReply(emailData.html || '');
      const sanitizedHtml = this.sanitizeHtml(cleaned);
      
      const messageData = {
        from: emailData.from || this.defaultFrom,
        to: emailData.to,
        subject: emailData.subject,
        html: sanitizedHtml,
        text: emailData.text || this.stripHtml(sanitizedHtml),
        // Enhanced RFC compliance headers
        'h:List-Unsubscribe': `<mailto:unsubscribe@${this.domain}?subject=unsubscribe>, <https://${this.domain}/unsubscribe?email=${encodeURIComponent(emailData.to)}>`,
        'h:List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'h:Precedence': 'bulk',
        'h:Auto-Submitted': 'auto-generated',
        'h:X-Auto-Response-Suppress': 'All'
      };

      if (!this.isConfigured()) {
        console.log(`[EMAIL LOG] To: ${emailData.to}, Subject: ${emailData.subject}, Risk: ${contentAnalysis.riskLevel}`);
        
        // Record successful send for rate limiting
        if (userId) {
          EmailRateLimiters.userHourly.recordSent(userId);
          EmailRateLimiters.burstProtection.recordSent(userId);
        }
        
        return {
          success: true,
          messageId: `mock_${Date.now()}`,
          riskScore: contentAnalysis.riskScore,
          validationResult: validation,
          contentAnalysis: contentAnalysis.riskLevel !== 'low' ? contentAnalysis : undefined
        };
      }

      const client = await getMailgunClient();
      const result = await client.messages.create(
        this.domain,
        messageData
      );
      
      console.log(`✅ Email sent to ${emailData.to}:`, {
        id: result.id,
        riskScore: contentAnalysis.riskScore,
        validationRisk: validation.riskLevel
      });

      // Record successful send for rate limiting
      if (userId) {
        EmailRateLimiters.userHourly.recordSent(userId);
        EmailRateLimiters.burstProtection.recordSent(userId);
      }

      return {
        success: true,
        messageId: result.id,
        riskScore: contentAnalysis.riskScore,
        validationResult: validation,
        contentAnalysis: contentAnalysis.riskLevel !== 'low' ? contentAnalysis : undefined
      };
    } catch (error) {
      console.error(`❌ Failed to send email to ${emailData.to}:`, error);
      
      // Record bounce if it's a delivery error
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message.toLowerCase();
        if (errorMessage.includes('bounce') || errorMessage.includes('invalid') || errorMessage.includes('not found')) {
          EnhancedEmailValidator.recordBounce(emailData.to, 'hard');
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send bulk emails with enhanced validation and rate limiting
   */
  async sendBulkEmails(
    emails: EmailData[],
    userId?: string,
    campaignId?: string
  ): Promise<{ 
    sent: number; 
    failed: number; 
    blocked: number;
    errors: any[];
    summary: {
      validationIssues: number;
      contentIssues: number;
      rateLimitHits: number;
    };
  }> {
    let sent = 0;
    let failed = 0;
    let blocked = 0;
    const errors: any[] = [];
    const summary = {
      validationIssues: 0,
      contentIssues: 0,
      rateLimitHits: 0
    };

    // Pre-validate all emails
    const cleanResult = EnhancedEmailValidator.cleanEmailList(emails.map(e => e.to));
    console.log(`📧 Bulk email validation:`, cleanResult.statistics);

    // Filter to only valid emails
    const validEmails = emails.filter(email => 
      cleanResult.valid.includes(email.to.toLowerCase().trim())
    );

    // Track invalid emails
    const invalidEmails = emails.filter(email => 
      !cleanResult.valid.includes(email.to.toLowerCase().trim())
    );
    
    invalidEmails.forEach(email => {
      blocked++;
      summary.validationIssues++;
      errors.push({ 
        email: email.to, 
        error: 'Invalid or suppressed email address',
        type: 'validation'
      });
    });

    // Check campaign rate limits
    if (campaignId) {
      const campaignLimit = EmailRateLimiters.campaignHourly.checkLimit(campaignId);
      if (!campaignLimit.allowed) {
        return {
          sent: 0,
          failed: emails.length,
          blocked: emails.length,
          errors: [{ 
            error: `Campaign rate limit exceeded. Try again in ${campaignLimit.retryAfter} seconds`,
            type: 'rate_limit'
          }],
          summary: { ...summary, rateLimitHits: 1 }
        };
      }
    }

    // Send valid emails with throttling
    for (const email of validEmails) {
      try {
        const result = await this.sendEmail(email, userId);
        
        if (result.success) {
          sent++;
          if (campaignId) {
            EmailRateLimiters.campaignHourly.recordSent(campaignId);
          }
        } else {
          if (result.blocked) {
            blocked++;
            if (result.rateLimitHit) {
              summary.rateLimitHits++;
            }
            if (result.contentAnalysis?.riskLevel === 'high') {
              summary.contentIssues++;
            }
            if (!result.validationResult?.isValid) {
              summary.validationIssues++;
            }
          } else {
            failed++;
          }
          
          errors.push({ 
            email: email.to, 
            error: result.error,
            type: result.blocked ? 'blocked' : 'failed',
            details: {
              validation: result.validationResult,
              content: result.contentAnalysis
            }
          });
        }
        
        // Throttle sends to improve deliverability
        await this.delay(200); // 200ms between emails
        
      } catch (error) {
        failed++;
        errors.push({ 
          email: email.to, 
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'exception'
        });
      }
    }

    console.log(`📧 Bulk send complete:`, { sent, failed, blocked, total: emails.length });

    return { sent, failed, blocked, errors, summary };
  }

  /**
   * Send campaign emails with template and enhanced validation
   */
  async sendCampaignEmails(
    leads: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      [key: string]: any;
    }>,
    template: EmailTemplate,
    campaignId?: string,
    userId?: string
  ): Promise<{ 
    sent: number; 
    failed: number; 
    blocked: number;
    errors: any[];
    summary: {
      validationIssues: number;
      contentIssues: number;
      rateLimitHits: number;
    };
  }> {
    // Pre-process templates and validate
    const emails: EmailData[] = [];
    const templateErrors: any[] = [];

    for (const lead of leads) {
      try {
        const processedSubject = this.processTemplate(template.subject, lead);
        const processedBody = this.processTemplate(template.body, lead);
        
        // Check for unresolved placeholders
        if (this.hasUnresolvedPlaceholders(processedSubject) || 
            this.hasUnresolvedPlaceholders(processedBody)) {
          templateErrors.push({
            email: lead.email,
            error: 'Unresolved template placeholders found',
            type: 'template'
          });
          continue;
        }

        emails.push({
          to: lead.email,
          subject: processedSubject,
          html: processedBody,
        });
      } catch (error) {
        templateErrors.push({
          email: lead.email,
          error: error instanceof Error ? error.message : 'Template processing error',
          type: 'template'
        });
      }
    }

    console.log(`📧 Campaign template processing: ${emails.length} valid, ${templateErrors.length} errors`);

    const result = await this.sendBulkEmails(emails, userId, campaignId);
    
    // Combine template errors with send errors
    return {
      ...result,
      failed: result.failed + templateErrors.length,
      errors: [...result.errors, ...templateErrors]
    };
  }

  /**
   * Check for unresolved template placeholders
   */
  private hasUnresolvedPlaceholders(text: string): boolean {
    const placeholderPatterns = [
      /\{\{[^}]+\}\}/g,  // {{variable}}
      /\$\{[^}]+\}/g,    // ${variable}
      /\[Name\]/gi,      // [Name]
      /\[FIRST_NAME\]/gi, // [FIRST_NAME]
      /\[LAST_NAME\]/gi   // [LAST_NAME]
    ];
    
    return placeholderPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Process template with variables (enhanced replacement)
   */
  processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;

    // Sanitize all variable values to prevent XSS
    const sanitizedVariables: Record<string, string> = {};
    Object.entries(variables).forEach(([key, value]) => {
      // Convert to string and remove any HTML tags
      sanitizedVariables[key] = String(value || '')
        .replace(/<[^>]*>/g, '')
        .trim();
    });

    // Replace common variables
    if (sanitizedVariables.firstName) {
      processed = processed.replace(
        /\{\{firstName\}\}/g,
        sanitizedVariables.firstName
      );
      processed = processed.replace(
        /\{\{first_name\}\}/g,
        sanitizedVariables.firstName
      );
    }

    if (sanitizedVariables.lastName) {
      processed = processed.replace(
        /\{\{lastName\}\}/g,
        sanitizedVariables.lastName
      );
      processed = processed.replace(
        /\{\{last_name\}\}/g,
        sanitizedVariables.lastName
      );
    }

    if (sanitizedVariables.email) {
      processed = processed.replace(/\{\{email\}\}/g, sanitizedVariables.email);
    }

    if (sanitizedVariables.vehicleInterest) {
      processed = processed.replace(/\{\{vehicleInterest\}\}/g, sanitizedVariables.vehicleInterest);
    }

    // Replace any other custom variables
    Object.entries(sanitizedVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processed = processed.replace(regex, value);
    });

    return processed;
  }

  /**
   * Enhanced HTML sanitization
   */
  private sanitizeHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    // Remove HTML tags and clean up whitespace
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Add delay between emails
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate email configuration
   */
  isConfigured(): boolean {
    return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
  }

  /**
   * Get service status with enhanced metrics
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      domain: this.domain,
      apiKeyPresent: !!process.env.MAILGUN_API_KEY,
      validation: {
        bounceStats: EnhancedEmailValidator.getBounceStats(),
        disposableDomainsBlocked: true
      },
      rateLimits: {
        userHourly: EmailRateLimiters.userHourly.getAllUsage().length,
        campaignHourly: EmailRateLimiters.campaignHourly.getAllUsage().length,
        systemHourly: EmailRateLimiters.systemHourly.getAllUsage().length
      }
    };
  }

  /**
   * Get detailed email statistics
   */
  getEmailStats() {
    return {
      bounces: EnhancedEmailValidator.getBounceStats(),
      rateLimits: {
        activeUsers: EmailRateLimiters.userHourly.getAllUsage(),
        activeCampaigns: EmailRateLimiters.campaignHourly.getAllUsage(),
        systemUsage: EmailRateLimiters.systemHourly.getUsage('system')
      }
    };
  }

  /**
   * Administrative functions for email management
   */
  admin = {
    removeSuppression: (email: string) => EnhancedEmailValidator.removeSuppression(email),
    resetRateLimit: (identifier: string, type: 'user' | 'campaign' = 'user') => {
      if (type === 'user') {
        EmailRateLimiters.userHourly.reset(identifier);
        EmailRateLimiters.burstProtection.reset(identifier);
      } else {
        EmailRateLimiters.campaignHourly.reset(identifier);
      }
    },
    getValidationStats: () => EnhancedEmailValidator.getBounceStats(),
    analyzeContent: (subject: string, body: string) => 
      EmailContentAnalyzer.analyzeContent(subject, body)
  };
}

// Export singleton instance
export const mailgunService = new MailgunService();

// Legacy exports for backward compatibility
export const sendCampaignEmail = (emailData: any) => mailgunService.sendEmail(emailData);
export const sendBulkEmails = (emails: any[], userId?: string, campaignId?: string) => 
  mailgunService.sendBulkEmails(emails, userId, campaignId);
