export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface BulkEmailResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

export async function sendCampaignEmail(
  to: string,
  subject: string,
  content: string,
  variables: Record<string, any> = {},
  options: { isAutoResponse?: boolean } = {}
): Promise<boolean> {
  try {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.warn('Mailgun not configured - email not sent');
      return false;
    }

    const fromEmail = options.isAutoResponse 
      ? `OneKeel Swarm <noreply@${process.env.MAILGUN_DOMAIN}>`
      : `OneKeel Swarm <campaigns@${process.env.MAILGUN_DOMAIN}>`;

    const response = await fetch(
      `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          from: fromEmail,
          to: to,
          subject: subject,
          html: content,
          text: content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
          // RFC 8058 compliant headers for deliverability
          'h:List-Unsubscribe': `<mailto:unsubscribe@${process.env.MAILGUN_DOMAIN}?subject=unsubscribe>, <https://${process.env.MAILGUN_DOMAIN}/u/${encodeURIComponent(to)}>`,
          'h:List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'h:Precedence': 'bulk'
        }),
      }
    );

    if (response.ok) {
      console.log(`Email sent successfully to ${to}`);
      return true;
    } else {
      const error = await response.text();
      console.error('Mailgun API error:', error);
      return false;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function sendBulkEmails(
  emails: { to: string; subject: string; content: string }[]
): Promise<BulkEmailResult> {
  const result: BulkEmailResult = {
    success: true,
    sent: 0,
    failed: 0,
    errors: []
  };

  for (const email of emails) {
    try {
      const success = await sendCampaignEmail(email.to, email.subject, email.content);
      if (success) {
        result.sent++;
      } else {
        result.failed++;
        result.errors.push(`Failed to send to ${email.to}`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Error sending to ${email.to}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  result.success = result.failed === 0;
  return result;
}

export async function validateEmailAddresses(emails: string[]): Promise<{
  valid: string[];
  invalid: string[];
}> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    if (emailRegex.test(email.trim())) {
      valid.push(email.trim());
    } else {
      invalid.push(email.trim());
    }
  }

  return { valid, invalid };
}