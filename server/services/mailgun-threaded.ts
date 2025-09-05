/**
 * Simple Mailgun email service - NO COMPLEX THREADING
 * Just clean, reliable email sending
 */
import { sendCampaignEmail } from './mailgun';

export async function sendThreadedReply(opts: {
  to: string;
  subject: string;
  html: string;
  domainOverride?: string;
  conversationId?: string;
  campaignId?: string;
}): Promise<boolean> {
  // Clean, professional sender - NO plus-addressing
  const idDomain = (opts.domainOverride || process.env.MAILGUN_DOMAIN || '')
    .split('@').pop()!.trim() || 'mail.offerlogix.me';
  
  const fromEmail = `Brittany Simpson <brittany@${idDomain}>`;
  const replyToEmail = `brittany@${idDomain}`; // Clean reply-to
  
  // Simple subject handling - email clients will thread by subject
  const cleanSubject = opts.subject.startsWith('Re: ') ? opts.subject : `Re: ${opts.subject}`;
  
  console.log('[Simple Email] Sending clean email:', {
    from: fromEmail,
    to: opts.to,
    subject: cleanSubject
  });

  return sendCampaignEmail(
    opts.to,
    cleanSubject,
    opts.html,
    { 
      from: fromEmail,
      replyTo: replyToEmail
    },
    {
      // Simple personal reply
      isAutoResponse: false,
      domainOverride: opts.domainOverride,
      // Add tracking headers (hidden from customer)
      headers: {
        'X-Conversation-ID': opts.conversationId || 'unknown',
        'X-Campaign-ID': opts.campaignId || 'none',
      },
      suppressBulkHeaders: true,
    }
  );
}