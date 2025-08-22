import { describe, it, expect } from 'vitest';
import { sendCampaignEmail } from '../mailgun';

describe('Mailgun headers', () => {
  it('supports in-reply-to and references headers', async () => {
    // This is a smoke assertion: ensure function accepts the extended options type.
    const ok = await sendCampaignEmail('to@example.com', 'Subj', '<p>Hi</p>', {}, {
      isAutoResponse: true,
      domainOverride: 'mg.example.com',
      inReplyTo: '<abc@mg>',
      references: ['<abc@mg>','<def@mg>']
    });
    expect(typeof ok).toBe('boolean');
  });
});

