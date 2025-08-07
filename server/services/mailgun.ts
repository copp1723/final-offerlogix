import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { emailWatchdog, type OutboundEmailData, type EmailValidationResult } from './email-validator';

const mailgun = new Mailgun(formData);

let mg: any = null;

function getMailgunClient() {
  if (!mg && process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    mg = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY,
    });
  }
  if (!mg) {
    throw new Error("Mailgun not configured - API key and domain required");
  }
  return mg;
}

export interface EmailData {
  to: string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromName?: string;
  fromEmail?: string;
}

export async function sendCampaignEmail(emailData: EmailData): Promise<any> {
  // Validate email before sending
  const validationData: OutboundEmailData = {
    to: emailData.to,
    subject: emailData.subject,
    htmlContent: emailData.htmlContent,
    textContent: emailData.textContent,
    fromName: emailData.fromName,
    fromEmail: emailData.fromEmail
  };

  const validation = await emailWatchdog.validateOutboundEmail(validationData);
  
  if (!validation.allowed) {
    const error = new Error(`Email blocked by validation: ${validation.reasons.join(', ')}`);
    console.error('Email validation failed:', {
      reasons: validation.reasons,
      triggeredRules: validation.triggeredRules,
      riskScore: validation.riskScore,
      to: emailData.to,
      subject: emailData.subject
    });
    throw error;
  }

  if (validation.requiresApproval) {
    console.warn('Email requires manual approval:', {
      reasons: validation.reasons,
      to: emailData.to,
      subject: emailData.subject
    });
    throw new Error(`Email requires manual approval: ${validation.reasons.join(', ')}`);
  }

  const client = getMailgunClient();
  const domain = process.env.MAILGUN_DOMAIN!;

  const messageData = {
    from: `${emailData.fromName || 'AutoCampaigns AI'} <${emailData.fromEmail || process.env.MAILGUN_FROM_EMAIL || `noreply@${domain}`}>`,
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.htmlContent,
    text: emailData.textContent || stripHtml(emailData.htmlContent)
  };

  try {
    const response = await client.messages.create(domain, messageData);
    console.log('Email sent successfully after validation:', {
      to: emailData.to,
      subject: emailData.subject,
      riskScore: validation.riskScore
    });
    return response;
  } catch (error) {
    console.error('Mailgun send error:', error);
    throw new Error('Failed to send email via Mailgun');
  }
}

export async function sendBulkEmails(emails: EmailData[]): Promise<any[]> {
  const results = [];
  
  // Pre-validate all emails first
  console.log(`Starting bulk email validation for ${emails.length} emails`);
  let validEmails = 0;
  let blockedEmails = 0;
  
  for (const email of emails) {
    try {
      const validationData: OutboundEmailData = {
        to: email.to,
        subject: email.subject,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
        fromName: email.fromName,
        fromEmail: email.fromEmail
      };

      const validation = await emailWatchdog.validateOutboundEmail(validationData);
      
      if (!validation.allowed) {
        blockedEmails++;
        results.push({ 
          success: false, 
          error: `Email validation failed: ${validation.reasons.join(', ')}`,
          blocked: true,
          reasons: validation.reasons
        });
        continue;
      }

      if (validation.requiresApproval) {
        results.push({ 
          success: false, 
          error: `Email requires manual approval: ${validation.reasons.join(', ')}`,
          requiresApproval: true,
          reasons: validation.reasons
        });
        continue;
      }

      validEmails++;
      const result = await sendCampaignEmail(email);
      results.push({ success: true, result, riskScore: validation.riskScore });
    } catch (error) {
      results.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  
  console.log(`Bulk email send completed: ${validEmails} sent, ${blockedEmails} blocked, ${emails.length - validEmails - blockedEmails} failed`);
  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export async function validateEmailAddresses(emails: string[]): Promise<{ valid: string[], invalid: string[] }> {
  const client = getMailgunClient();
  const domain = process.env.MAILGUN_DOMAIN!;
  
  const valid: string[] = [];
  const invalid: string[] = [];
  
  for (const email of emails) {
    try {
      const result = await client.validate.get(email);
      if (result.result === 'deliverable') {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    } catch (error) {
      invalid.push(email);
    }
  }
  
  return { valid, invalid };
}