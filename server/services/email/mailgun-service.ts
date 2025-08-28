import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);

// Lazy initialization of Mailgun client
let mg: any = null;
function getMailgunClient() {
  if (!mg) {
    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY is required but not set');
    }
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
}

export class MailgunService {
  private domain: string;
  private defaultFrom: string;

  constructor() {
    this.domain = process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us';
    this.defaultFrom = `OneKeel Swarm <swarm@${this.domain}>`;
  }

  /**
   * Send a single email with basic validation
   */
  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    try {
      // Basic email validation
      if (!emailData.to || !emailData.subject) {
        return {
          success: false,
          error: 'Email address and subject are required'
        };
      }

      // Enhanced HTML sanitization - allow safe formatting tags
      const sanitizedHtml = this.sanitizeHtml(emailData.html);

      const messageData = {
        from: emailData.from || this.defaultFrom,
        to: emailData.to,
        subject: emailData.subject,
        html: sanitizedHtml,
        text: emailData.text || this.stripHtml(sanitizedHtml),
      };

      if (!this.isConfigured()) {
        console.log(`[EMAIL LOG] To: ${emailData.to}, Subject: ${emailData.subject}`);
        return {
          success: true,
          messageId: `mock_${Date.now()}`,
          riskScore: 0,
        };
      }

      const result = await getMailgunClient().messages.create(
        this.domain,
        messageData
      );
      console.log(`✅ Email sent to ${emailData.to}:`, result.id);

      return {
        success: true,
        messageId: result.id,
        riskScore: 0,
      };
    } catch (error) {
      console.error(`❌ Failed to send email to ${emailData.to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send bulk emails (for campaigns)
   */
  async sendBulkEmails(
    emails: EmailData[]
  ): Promise<{ sent: number; failed: number; errors: any[] }> {
    let sent = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push({ email: email.to, error: result.error });
        }
        // Add delay to respect rate limits
        await this.delay(100);
      } catch (error) {
        failed++;
        errors.push({ email: email.to, error });
      }
    }

    return { sent, failed, errors };
  }

  /**
   * Send campaign emails with template
   */
  async sendCampaignEmails(
    leads: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      [key: string]: any;
    }>,
    template: EmailTemplate
  ): Promise<{ sent: number; failed: number; errors: any[] }> {
    const emails: EmailData[] = leads.map(lead => ({
      to: lead.email,
      subject: this.processTemplate(template.subject, lead),
      html: this.processTemplate(template.body, lead),
    }));

    return await this.sendBulkEmails(emails);
  }

  /**
   * Process template with variables (simple replacement)
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
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    // Convert formatting tags to plain text equivalents
    let text = html
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')  // Convert back to markdown-style bold
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')          // Convert back to markdown-style italic
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '$1')         // Remove code tags but keep content
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1')          // Convert list items to bullet points
      .replace(/<ul[^>]*>.*?<\/ul>/gi, '')                 // Remove ul tags (content already converted)
      .replace(/<br[^>]*\/?>/gi, '\n')                    // Convert br to line breaks
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')          // Convert p to double line breaks
      .replace(/<[^>]*>/g, '')                            // Remove any remaining HTML tags
      .replace(/\s+/g, ' ')                               // Clean up whitespace
      .trim();

    return text;
  }

  /**
   * Enhanced HTML sanitization allowing safe formatting tags
   */
  private sanitizeHtml(html: string): string {
    // Remove dangerous tags and attributes
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:(?!image\/(?:png|jpg|jpeg|gif|webp|svg\+xml))[^;]/gi, '');

    // Allow only safe tags: p, br, strong, em, code, ul, li
    const allowedTags = ['p', 'br', 'strong', 'em', 'code', 'ul', 'li'];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    sanitized = sanitized.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        // Remove dangerous attributes but keep the tag
        return match.replace(/\s+[a-zA-Z-]+\s*=\s*["'][^"']*["']/g, '');
      }
      return ''; // Remove disallowed tags
    });

    return sanitized;
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
   * Get service status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      domain: this.domain,
      apiKeyPresent: !!process.env.MAILGUN_API_KEY,
    };
  }
}

// Export singleton instance
export const mailgunService = new MailgunService();

// Legacy exports for backward compatibility
export const sendCampaignEmail = mailgunService.sendEmail.bind(mailgunService);
export const sendBulkEmails = mailgunService.sendBulkEmails.bind(mailgunService);