import formData from 'form-data';
import Mailgun from 'mailgun.js';

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
  const client = getMailgunClient();
  const domain = process.env.MAILGUN_DOMAIN!;

  const messageData = {
    from: `${emailData.fromName || 'AutoCampaigns AI'} <${emailData.fromEmail || `noreply@${domain}`}>`,
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.htmlContent,
    text: emailData.textContent || stripHtml(emailData.htmlContent)
  };

  try {
    const response = await client.messages.create(domain, messageData);
    return response;
  } catch (error) {
    console.error('Mailgun send error:', error);
    throw new Error('Failed to send email via Mailgun');
  }
}

export async function sendBulkEmails(emails: EmailData[]): Promise<any[]> {
  const results = [];
  
  for (const email of emails) {
    try {
      const result = await sendCampaignEmail(email);
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }
  
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