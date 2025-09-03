import { isDuplicateWebhook, clearWebhookDedupStore } from '../../server/services/mailgun-webhook-handler';

describe('webhook de-duplication', () => {
  beforeEach(() => clearWebhookDedupStore());

  it('flags duplicates based on timestamp and token', () => {
    const ts = '123';
    const token = 'abc';
    expect(isDuplicateWebhook(ts, token)).toBe(false);
    expect(isDuplicateWebhook(ts, token)).toBe(true);
  });
});