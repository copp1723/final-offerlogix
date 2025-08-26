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
}): Promise<boolean> {
  // Use configured From; keep threading headers.
  const from = process.env.MAILGUN_FROM_EMAIL;
  const idDomain = (opts.domainOverride || process.env.MAILGUN_DOMAIN || '')
    .split('@').pop()!.trim() || 'mail.offerlogix.me';

  return sendCampaignEmail(
    opts.to,
    opts.subject,
    opts.html,
    from ? { from } : {},
    {
      // Treat as normal send so configured From is honored
      isAutoResponse: false,
      domainOverride: opts.domainOverride,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
      // Mailgun ignores custom Message-ID; rely on In-Reply-To/References.
      // We still pass it for completeness, but it's not required.
      headers: opts.messageId ? { 'Message-ID': `<${opts.messageId}>` } : undefined,
      // Critical: make this look like a human reply, not a bulk send
      suppressBulkHeaders: true,
    }
  );
}
