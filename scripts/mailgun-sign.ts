#!/usr/bin/env tsx
import crypto from 'crypto';
import fs from 'fs';

export interface SignedWebhook {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': Record<string, unknown>;
}

/**
 * Generate a Mailgun-signed webhook payload
 */
export function generateSignedWebhook(eventData: Record<string, unknown>, timestamp: string = Math.floor(Date.now() / 1000).toString()): SignedWebhook {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || process.env.MAILGUN_SIGNING_KEY;
  if (!signingKey) {
    throw new Error('MAILGUN_WEBHOOK_SIGNING_KEY not set');
  }

  // Validate timestamp (reject if older than 15 minutes for replay protection)
  const now = Math.floor(Date.now() / 1000);
  const timestampNum = parseInt(timestamp);
  if (isNaN(timestampNum) || (now - timestampNum) > 900) {
    throw new Error('Invalid or expired timestamp');
  }

  const token = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(`${timestamp}${token}`)
    .digest('hex');
  return {
    signature: {
      timestamp,
      token,
      signature,
    },
    'event-data': eventData,
  };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, payloadArg, timestampArg] = process.argv;
  if (!payloadArg) {
    console.error('Usage: tsx scripts/mailgun-sign.ts <payload.json|json-string> [timestamp]');
    console.error('');
    console.error('Examples:');
    console.error('  tsx scripts/mailgun-sign.ts payload.json');
    console.error('  tsx scripts/mailgun-sign.ts \'{"event":"delivered","id":"abc123"}\'');
    process.exit(1);
  }

  let eventData: Record<string, unknown>;
  try {
    if (payloadArg.startsWith('{') || payloadArg.startsWith('[')) {
      eventData = JSON.parse(payloadArg);
    } else {
      if (!fs.existsSync(payloadArg)) {
        console.error(`File not found: ${payloadArg}`);
        process.exit(1);
      }
      const raw = fs.readFileSync(payloadArg, 'utf8');
      eventData = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse payload:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    const timestamp = timestampArg || Math.floor(Date.now() / 1000).toString();
    const body = generateSignedWebhook(eventData, timestamp);
    const json = JSON.stringify(body);

    console.info('Headers:');
    console.info('  Content-Type: application/json');
    console.info('');
    console.info('Payload:');
    console.info(json);
    console.info('');
    console.info('Example curl:');
    console.info('curl -X POST http://localhost:3000/api/email-reliability/webhook/mailgun \\');
    console.info('  -H "Content-Type: application/json" \\');
    console.info(`  -d '${json}'`);
  } catch (err) {
    console.error('Failed to generate signed webhook:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}