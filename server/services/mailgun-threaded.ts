/**
 * Mailgun reply helper with threading headers
 */
import { sendCampaignEmail } from './mailgun';

export async function sendThreadedReply(opts: {
  to: string;
  subject: string;
  html: string;
  messageId?: string; // our reply's Message-ID
  inReplyTo?: string; // original Message-ID
  references?: string[]; // chain of IDs
  domainOverride?: string; // per-tenant subdomain
  conversationId?: string; // for plus-addressing token
  campaignId?: string; // for tracking headers
}): Promise<boolean> {
  // Use configured From; keep threading headers.
  const from = process.env.MAILGUN_FROM_EMAIL;
  const idDomain = (opts.domainOverride || process.env.MAILGUN_DOMAIN || '')
    .split('@').pop()!.trim() || 'mail.offerlogix.me';
  
  // Build conversation token for plus-addressing fallback
  const convToken = opts.conversationId ? `conv_${opts.conversationId}` : null;
  const replyToEmail = convToken ? `brittany+${convToken}@${idDomain}` : undefined;

  return sendCampaignEmail(
    opts.to,
    opts.subject,
    opts.html,
    { 
      from: from || undefined,
      replyTo: replyToEmail
    },
    {
      // Treat as normal send so configured From is honored
      isAutoResponse: false,
      domainOverride: opts.domainOverride,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
      // Backup headers for conversation mapping
      headers: {
        ...(opts.messageId ? { 'Message-ID': `<${opts.messageId}>` } : {}),
        ...(opts.conversationId ? { 'X-Conversation-ID': String(opts.conversationId) } : {}),
        ...(opts.campaignId ? { 'X-Campaign-ID': String(opts.campaignId) } : {}),
      },
      // Critical: make this look like a human reply, not a bulk send
      suppressBulkHeaders: true,
    }
  );
}
