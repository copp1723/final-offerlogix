import { describe, test, expect, jest } from '@jest/globals';
import crypto from 'crypto';

// Mock heavy deps to avoid loading ConversationEngine/db
jest.mock('../db', () => ({ dbV2: {}, v2schema: {} }));
jest.mock('../services/conversation/ConversationEngine', () => ({ ConversationEngine: { processInbound: jest.fn(), sendEmail: jest.fn() } }));
import { verifyMailgunSignature } from '../routes/inbound';

describe('v2:mailgun webhook signature', () => {
  test('valid signature passes', () => {
    const signingKey = 'test_signing_key';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'abc123';
    const signature = crypto.createHmac('sha256', signingKey).update(`${timestamp}${token}`).digest('hex');
    const body = { signature: { timestamp, token, signature } };
    expect(verifyMailgunSignature(body, signingKey)).toBe(true);
  });

  test('invalid signature fails', () => {
    const signingKey = 'test_signing_key';
    const body = { signature: { timestamp: '0', token: 'x', signature: 'bad' } };
    expect(verifyMailgunSignature(body, signingKey)).toBe(false);
  });
});
