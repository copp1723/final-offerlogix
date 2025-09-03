/**
 * Email Service - Handles sending and threading
 * Simple, reliable email delivery with proper threading
 */

import formData from 'form-data';
import Mailgun from 'mailgun.js';
import crypto from 'crypto';
import { Agent, Message } from './schema';

const mailgun = new Mailgun(formData as any);

interface EmailConfig {
  apiKey: string;
  baseDomain: string; // e.g., "okcrm.ai"
}

interface SendEmailParams {
  to: string;
  subject: string;
  content: string;
  agent: Agent;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
}

export class EmailService {
  private mg: any;
  private baseDomain: string;
  
  constructor(config: EmailConfig) {
    this.baseDomain = config.baseDomain;
    this.mg = mailgun.client({
      username: 'api',
      key: config.apiKey,
    });
  }

  /**
   * Generate a unique Message-ID for an email
   */
  private generateMessageId(agent: Agent): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `<${timestamp}.${random}@${agent.subdomain}.${this.baseDomain}>`;
  }

  /**
   * Build threading headers for proper email conversation threading
   */
  private buildThreadingHeaders(params: {
    messageId: string;
    threadId: string;
    inReplyTo?: string;
    references?: string[];
  }): Record<string, string> {
    const headers: Record<string, string> = {
      'Message-ID': params.messageId,
      'X-Thread-ID': params.threadId, // Custom header for our tracking
    };

    // Add In-Reply-To if this is a reply
    if (params.inReplyTo) {
      headers['In-Reply-To'] = params.inReplyTo;
    }

    // Build References chain for threading
    if (params.references && params.references.length > 0) {
      // Keep last 10 references to avoid header bloat
      const refs = params.references.slice(-10);
      if (params.inReplyTo && !refs.includes(params.inReplyTo)) {
        refs.push(params.inReplyTo);
      }
      headers['References'] = refs.join(' ');
    } else if (params.inReplyTo) {
      headers['References'] = params.inReplyTo;
    }

    return headers;
  }

  /**
   * Send an email with proper threading
   */
  async sendEmail(params: SendEmailParams): Promise<{
    success: boolean;
    messageId?: string;
    mailgunId?: string;
    error?: string;
  }> {
    try {
      const { agent, to, subject, content, threadId, inReplyTo, references } = params;
      
      // Generate unique Message-ID
      const messageId = this.generateMessageId(agent);
      
      // Build email data
      const domain = `${agent.subdomain}.${this.baseDomain}`;
      const from = `${agent.senderName} <${agent.senderEmail}>`;
      
      const emailData: any = {
        from,
        to,
        subject,
        text: content,
        html: this.generateHtmlFromText(content),
      };
      
      // Add threading headers
      const headers = this.buildThreadingHeaders({
        messageId,
        threadId: threadId || crypto.randomUUID(),
        inReplyTo,
        references,
      });
      
      // Mailgun expects headers as h: prefixed parameters
      Object.entries(headers).forEach(([key, value]) => {
        emailData[`h:${key}`] = value;
      });
      
      // Add custom headers for tracking
      emailData['h:X-Campaign-System'] = 'MailMind-v2';
      emailData['h:X-Agent-ID'] = agent.id;
      
      // Send via Mailgun
      const result = await this.mg.messages.create(domain, emailData);
      
      console.log('✅ Email sent successfully:', {
        messageId,
        mailgunId: result.id,
        from,
        to,
        threadId: headers['X-Thread-ID'],
      });
      
      return {
        success: true,
        messageId,
        mailgunId: result.id,
      };
    } catch (error: any) {
      console.error('❌ Email send failed:', error);
      return {
        success: false,
        error: error?.message || 'Failed to send email',
      };
    }
  }

  /**
   * Simple HTML generation from plain text
   */
  private generateHtmlFromText(text: string): string {
    // Convert line breaks to <br> tags
    const htmlContent = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p>${this.escapeHtml(line)}</p>`)
      .join('\n');
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    p { margin: 10px 0; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * Parse email headers from webhook data
   */
  static parseEmailHeaders(webhookData: any): {
    messageId?: string;
    inReplyTo?: string;
    references?: string[];
    threadId?: string;
  } {
    const headers: any = {};
    
    // Try to extract Message-ID
    const messageId = webhookData['Message-Id'] || 
                     webhookData['message-id'] || 
                     webhookData['Message-ID'];
    if (messageId) {
      headers.messageId = messageId.replace(/[<>]/g, '').trim();
    }
    
    // Try to extract In-Reply-To
    const inReplyTo = webhookData['In-Reply-To'] || 
                      webhookData['in-reply-to'];
    if (inReplyTo) {
      headers.inReplyTo = inReplyTo.replace(/[<>]/g, '').trim();
    }
    
    // Try to extract References
    const references = webhookData['References'] || 
                      webhookData['references'];
    if (references) {
      headers.references = references
        .split(/\s+/)
        .map((ref: string) => ref.replace(/[<>]/g, '').trim())
        .filter((ref: string) => ref.length > 0);
    }
    
    // Try to extract our custom Thread-ID
    const threadId = webhookData['X-Thread-ID'] || 
                    webhookData['x-thread-id'];
    if (threadId) {
      headers.threadId = threadId;
    }
    
    // Parse message-headers if present (Mailgun format)
    if (webhookData['message-headers']) {
      try {
        const parsedHeaders = JSON.parse(webhookData['message-headers']);
        if (Array.isArray(parsedHeaders)) {
          parsedHeaders.forEach(([key, value]: [string, string]) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'message-id' && !headers.messageId) {
              headers.messageId = value.replace(/[<>]/g, '').trim();
            } else if (lowerKey === 'in-reply-to' && !headers.inReplyTo) {
              headers.inReplyTo = value.replace(/[<>]/g, '').trim();
            } else if (lowerKey === 'references' && !headers.references) {
              headers.references = value
                .split(/\s+/)
                .map(ref => ref.replace(/[<>]/g, '').trim())
                .filter(ref => ref.length > 0);
            } else if (lowerKey === 'x-thread-id' && !headers.threadId) {
              headers.threadId = value;
            }
          });
        }
      } catch (error) {
        console.warn('Failed to parse message-headers:', error);
      }
    }
    
    return headers;
  }
}
