/**
 * Mailgun reply helper with threading headers
 */
import { sendCampaignEmail } from './mailgun';

export async function sendThreadedReply(opts: {
  to: string;
  subject: string;
  html: string;
  inReplyTo?: string; // original Message-ID
  references?: string[]; // chain of IDs
  domainOverride?: string; // per-tenant subdomain
}): Promise<boolean> {
  // Use configured From identity (conversational), keep threading headers.
  const from = process.env.MAILGUN_FROM_EMAIL 
    || (opts.domainOverride ? `Team <swarm@${opts.domainOverride}>` : undefined);

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
    }
  );
}
