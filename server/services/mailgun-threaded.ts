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
  return sendCampaignEmail(
    opts.to,
    opts.subject,
    opts.html,
    {},
    {
      isAutoResponse: true,
      domainOverride: opts.domainOverride,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
    }
  );
}

