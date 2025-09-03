#!/usr/bin/env tsx

/**
 * Test Webhook Endpoint Script
 * Tests the webhook endpoint with proper Mailgun signature
 */

import crypto from 'crypto';
import fetch from 'node-fetch';

const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const WEBHOOK_URL = 'https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound';

function generateMailgunSignature(timestamp: string, token: string): string {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    throw new Error('MAILGUN_WEBHOOK_SIGNING_KEY not set');
  }

  return crypto
    .createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
}

async function testWebhookWithSignature(): Promise<void> {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.error('❌ MAILGUN_WEBHOOK_SIGNING_KEY not set');
    return;
  }

  console.log('🧪 Testing Webhook Endpoint with Valid Signature');
  console.log('================================================\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'test-token-' + Math.random().toString(36).substring(7);
  const signature = generateMailgunSignature(timestamp, token);

  // Create a test inbound email payload
  const testPayload = {
    sender: 'test@example.com',
    recipient: 'campaigns@kunesmacomb.kunesauto.vip',
    subject: 'Test Email for Campaign',
    'body-plain': 'This is a test email to verify the webhook is working.',
    'stripped-text': 'This is a test email to verify the webhook is working.',
    'message-id': '<test-' + Date.now() + '@example.com>',
    timestamp: timestamp,
    token: token,
    signature: signature,
    'Message-Id': '<test-' + Date.now() + '@example.com>'
  };

  console.log('📤 Sending test webhook payload:');
  console.log(`   Timestamp: ${timestamp}`);
  console.log(`   Token: ${token}`);
  console.log(`   Signature: ${signature}`);
  console.log(`   Sender: ${testPayload.sender}`);
  console.log(`   Recipient: ${testPayload.recipient}`);
  console.log(`   Subject: ${testPayload.subject}`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Test'
      },
      body: new URLSearchParams(testPayload as any).toString()
    });

    console.log(`\n📡 Webhook Response: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);

    if (response.status === 200) {
      console.log('✅ Webhook test successful! The endpoint is working correctly.');
    } else if (response.status === 401) {
      console.log('❌ Webhook authentication failed. Signature verification issue.');
    } else if (response.status === 400) {
      console.log('⚠️  Bad request. Check the payload format.');
    } else {
      console.log(`⚠️  Unexpected response status: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error);
  }
}

async function testWebhookWithoutSignature(): Promise<void> {
  console.log('\n🧪 Testing Webhook Endpoint without Signature (should fail)');
  console.log('=========================================================\n');

  const testPayload = {
    sender: 'test@example.com',
    recipient: 'campaigns@kunesmacomb.kunesauto.vip',
    subject: 'Test Email without Signature',
    'body-plain': 'This should fail signature verification.',
    'stripped-text': 'This should fail signature verification.',
    'message-id': '<test-no-sig-' + Date.now() + '@example.com>',
    timestamp: Math.floor(Date.now() / 1000).toString(),
    token: 'invalid-token',
    signature: 'invalid-signature'
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Test'
      },
      body: new URLSearchParams(testPayload as any).toString()
    });

    console.log(`📡 Webhook Response: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);

    if (response.status === 401) {
      console.log('✅ Signature verification working correctly (rejected invalid signature).');
    } else {
      console.log(`⚠️  Expected 401, got ${response.status}. Signature verification may be bypassed.`);
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 Webhook Endpoint Testing');
  console.log('===========================\n');

  console.log('📋 Configuration:');
  console.log(`   Webhook URL: ${WEBHOOK_URL}`);
  console.log(`   Signing Key: ${MAILGUN_WEBHOOK_SIGNING_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.log('\n❌ Cannot test webhook without signing key');
    return;
  }

  // Test with valid signature
  await testWebhookWithSignature();

  // Test with invalid signature
  await testWebhookWithoutSignature();

  console.log('\n📋 Summary:');
  console.log('   • If both tests show expected results, webhook authentication is working');
  console.log('   • If signature verification is bypassed, check NODE_ENV and signing key');
  console.log('   • The webhook should accept valid signatures and reject invalid ones');
}

// Run the main function
main().catch(console.error);
