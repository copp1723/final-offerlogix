import { calculateBackoffDelay } from '../../server/services/email-queue';

describe('email queue backoff', () => {
  it('uses exponential backoff', () => {
    expect(calculateBackoffDelay(1)).toBe(2000);
    expect(calculateBackoffDelay(2)).toBe(4000);
    expect(calculateBackoffDelay(3)).toBe(8000);
  });
});