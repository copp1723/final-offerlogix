/**
 * Mailgun HMAC-SHA256 Signature Helper
 * 
 * Utilities for signing test payloads with Mailgun webhook signature verification.
 * Implements the exact same algorithm used by Mailgun for webhook authentication.
 */

import { createHmac } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface MailgunSignature {
  timestamp: string;
  token: string;
  signature: string;
}

export interface SignedWebhookPayload {
  signature: MailgunSignature;
  'event-data': any;
}

export interface SigningOptions {
  timestamp?: string;
  token?: string;
  signingKey: string;
}

// ============================================================================
// MAILGUN SIGNATURE VERIFICATION
// ============================================================================

/**
 * Generate Mailgun webhook signature using HMAC-SHA256
 * 
 * Mailgun signature algorithm:
 * 1. Concatenate timestamp + token
 * 2. HMAC-SHA256 with signing key
 * 3. Return hex digest
 */
export function generateMailgunSignature(
  timestamp: string,
  token: string,
  signingKey: string
): string {
  const data = timestamp + token;
  return createHmac('sha256', signingKey)
    .update(data)
    .digest('hex');
}

/**
 * Verify Mailgun webhook signature
 * Returns true if signature is valid
 */
export function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string
): boolean {
  const expectedSignature = generateMailgunSignature(timestamp, token, signingKey);
  return signature === expectedSignature;
}

/**
 * Create a complete signed webhook payload for testing
 */
export function createSignedWebhookPayload(
  eventData: any,
  options: SigningOptions
): SignedWebhookPayload {
  const timestamp = options.timestamp || Math.floor(Date.now() / 1000).toString();
  const token = options.token || `test-token-${Date.now()}`;
  const signature = generateMailgunSignature(timestamp, token, options.signingKey);

  return {
    signature: {
      timestamp,
      token,
      signature,
    },
    'event-data': eventData,
  };
}

// ============================================================================
// DETERMINISTIC TESTING HELPERS
// ============================================================================

/**
 * Create deterministic signature for stable testing
 * Uses fixed timestamp and token for reproducible results
 */
export function createDeterministicSignature(
  eventData: any,
  signingKey: string,
  testId: string = 'default'
): SignedWebhookPayload {
  // Use deterministic values for stable testing
  const timestamp = '1704067200'; // Fixed: 2024-01-01 12:00:00 UTC
  const token = `deterministic-token-${testId}`;
  
  return createSignedWebhookPayload(eventData, {
    timestamp,
    token,
    signingKey,
  });
}

/**
 * Sign all fixtures in a directory with deterministic signatures
 */
export function signFixturePayload(
  fixtureData: any,
  signingKey: string
): any {
  if (!fixtureData.mailgun_payload) {
    throw new Error('Fixture must have mailgun_payload property');
  }

  const testId = fixtureData.scenario || 'default';
  const signedPayload = createDeterministicSignature(
    fixtureData.mailgun_payload,
    signingKey,
    testId
  );

  // Update the fixture with the signed payload
  return {
    ...fixtureData,
    signature: signedPayload.signature,
    signed_payload: signedPayload,
  };
}

// ============================================================================
// EXPRESS REQUEST HELPERS
// ============================================================================

/**
 * Create Express request-like object for testing webhook endpoints
 */
export function createWebhookRequest(
  signedPayload: SignedWebhookPayload,
  additionalHeaders: Record<string, string> = {}
): any {
  return {
    body: signedPayload,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mailgun/Test',
      ...additionalHeaders,
    },
    method: 'POST',
    url: '/v2/inbound/mailgun',
  };
}

/**
 * Create invalid signature request for testing error handling
 */
export function createInvalidSignatureRequest(
  eventData: any,
  signingKey: string
): any {
  const validPayload = createDeterministicSignature(eventData, signingKey);
  
  // Corrupt the signature
  const invalidPayload = {
    ...validPayload,
    signature: {
      ...validPayload.signature,
      signature: 'invalid-signature-12345',
    },
  };

  return createWebhookRequest(invalidPayload);
}

// ============================================================================
// BATCH FIXTURE PROCESSING
// ============================================================================

/**
 * Process multiple fixtures and sign them all
 */
export function signAllFixtures(
  fixtures: Record<string, any>,
  signingKey: string
): Record<string, any> {
  const signedFixtures: Record<string, any> = {};

  for (const [name, fixture] of Object.entries(fixtures)) {
    try {
      signedFixtures[name] = signFixturePayload(fixture, signingKey);
    } catch (error) {
      console.warn(`Failed to sign fixture ${name}:`, error);
      signedFixtures[name] = fixture; // Keep original if signing fails
    }
  }

  return signedFixtures;
}

// ============================================================================
// CONSTANTS FOR TESTING
// ============================================================================

export const TEST_SIGNING_KEY = 'test-mailgun-signing-key-for-v2-testing';

export const DETERMINISTIC_SIGNATURES = {
  'new-thread': {
    timestamp: '1704067200',
    token: 'deterministic-token-new-thread',
    expectedSignature: generateMailgunSignature(
      '1704067200',
      'deterministic-token-new-thread',
      TEST_SIGNING_KEY
    ),
  },
  'deep-thread': {
    timestamp: '1704153600',
    token: 'deterministic-token-deep-thread',
    expectedSignature: generateMailgunSignature(
      '1704153600',
      'deterministic-token-deep-thread',
      TEST_SIGNING_KEY
    ),
  },
  'edge-cases': {
    timestamp: '1704240000',
    token: 'deterministic-token-edge-cases',
    expectedSignature: generateMailgunSignature(
      '1704240000',
      'deterministic-token-edge-cases',
      TEST_SIGNING_KEY
    ),
  },
};
