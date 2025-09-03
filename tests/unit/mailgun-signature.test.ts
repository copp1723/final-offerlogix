import crypto from 'crypto';
import { verifyWebhookSignature } from '../../server/services/mailgun-webhook-handler';

describe('verifyWebhookSignature', () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = 'test-token';
  const key = 'test-signing-key';

  beforeEach(() => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = key;
  });

  afterEach(() => {
    delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  });

  it('returns true for a valid signature', () => {
    const signature = crypto
      .createHmac('sha256', key)
      .update(`${timestamp}${token}`)
      .digest('hex');
    
    expect(verifyWebhookSignature(timestamp, token, signature)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    expect(verifyWebhookSignature(timestamp, token, 'invalid-signature')).toBe(false);
  });

  it('returns false when signing key is missing', () => {
    delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    const signature = crypto
      .createHmac('sha256', key)
      .update(`${timestamp}${token}`)
      .digest('hex');
    
    expect(verifyWebhookSignature(timestamp, token, signature)).toBe(false);
  });

  it('returns false for empty parameters', () => {
    expect(verifyWebhookSignature('', '', '')).toBe(false);
  });

  it('rejects expired timestamp', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 20 * 60).toString(); // 20 minutes ago
    const signature = crypto
      .createHmac('sha256', key)
      .update(`${oldTimestamp}${token}`)
      .digest('hex');

    expect(verifyWebhookSignature(oldTimestamp, token, signature)).toBe(false);
  });

  it('handles invalid timestamp format', () => {
    const signature = crypto
      .createHmac('sha256', key)
      .update(`invalid-timestamp${token}`)
      .digest('hex');

    expect(verifyWebhookSignature('invalid-timestamp', token, signature)).toBe(false);
  });
});