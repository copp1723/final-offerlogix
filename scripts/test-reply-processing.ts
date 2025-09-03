#!/usr/bin/env tsx

/**
 * Test Reply Processing Script
 * Simulates a lead replying to a campaign email to test the inbound processing
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

async function simulateLeadReply(): Promise<void> {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.error('❌ MAILGUN_WEBHOOK_SIGNING_KEY not set');
    return;
  }

  console.log('📧 Simulating Lead Reply to Campaign Email');
  console.log('==========================================\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'reply-test-' + Math.random().toString(36).substring(7);
  const signature = generateMailgunSignature(timestamp, token);

  // Simulate a realistic reply from a lead
  const replyPayload = {
    // Lead replying to campaign
    sender: 'john.customer@gmail.com', // This should be a lead in your system
    recipient: 'campaigns@kunesmacomb.kunesauto.vip', // Your campaign email
    subject: 'Re: Time for a seasonal service check', // Reply to campaign subject
    'body-plain': `Hi there,

I'm interested in learning more about your seasonal service offers. I have a 2019 Honda Accord that needs an oil change and tire rotation.

When would be a good time to schedule an appointment?

Thanks,
John Customer`,
    'stripped-text': `Hi there,

I'm interested in learning more about your seasonal service offers. I have a 2019 Honda Accord that needs an oil change and tire rotation.

When would be a good time to schedule an appointment?

Thanks,
John Customer`,
    'message-id': '<reply-test-' + Date.now() + '@gmail.com>',
    'Message-Id': '<reply-test-' + Date.now() + '@gmail.com>',
    timestamp: timestamp,
    token: token,
    signature: signature,
    // Additional Mailgun fields
    'From': 'john.customer@gmail.com',
    'To': 'campaigns@kunesmacomb.kunesauto.vip',
    'Subject': 'Re: Time for a seasonal service check',
    'Date': new Date().toUTCString(),
    'In-Reply-To': '<original-campaign-email@mg.watchdogai.us>',
    'References': '<original-campaign-email@mg.watchdogai.us>'
  };

  console.log('📤 Sending simulated lead reply:');
  console.log(`   From: ${replyPayload.sender}`);
  console.log(`   To: ${replyPayload.recipient}`);
  console.log(`   Subject: ${replyPayload.subject}`);
  console.log(`   Content: ${replyPayload['body-plain'].substring(0, 100)}...`);
  console.log(`   Timestamp: ${timestamp}`);
  console.log(`   Signature: ${signature.substring(0, 16)}...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Inbound'
      },
      body: new URLSearchParams(replyPayload as any).toString()
    });

    console.log(`\n📡 Webhook Response: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);

    // Analyze the response
    if (response.status === 200) {
      console.log('✅ Reply processed successfully!');
    } else if (response.status === 202) {
      if (responseText.includes('Lead not identified')) {
        console.log('❌ ISSUE FOUND: Lead not identified');
        console.log('   This means the system cannot match the reply to an existing lead');
        console.log('   Possible causes:');
        console.log('   1. No lead exists with email: john.customer@gmail.com');
        console.log('   2. Lead identification logic is not working');
        console.log('   3. Campaign tracking is missing');
      } else if (responseText.includes('Duplicate message')) {
        console.log('⚠️  Message marked as duplicate (this is normal for repeated tests)');
      } else {
        console.log('✅ Reply accepted but with status:', responseText);
      }
    } else if (response.status === 401) {
      console.log('❌ Authentication failed - signature verification issue');
    } else {
      console.log(`⚠️  Unexpected response: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing reply processing:', error);
  }
}

async function testWithExistingLead(): Promise<void> {
  console.log('\n📧 Testing with Potentially Existing Lead Email');
  console.log('==============================================\n');

  // Try with josh@atsglobal.ai since we saw it in the Mailgun logs
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'existing-lead-' + Math.random().toString(36).substring(7);
  const signature = generateMailgunSignature(timestamp, token);

  const replyPayload = {
    sender: 'josh@atsglobal.ai', // This email appeared in your Mailgun logs
    recipient: 'campaigns@kunesmacomb.kunesauto.vip',
    subject: 'Re: Time for a seasonal service check',
    'body-plain': 'I received your email and I\'m interested in scheduling a service appointment. Please let me know your availability.',
    'stripped-text': 'I received your email and I\'m interested in scheduling a service appointment. Please let me know your availability.',
    'message-id': '<existing-lead-' + Date.now() + '@atsglobal.ai>',
    'Message-Id': '<existing-lead-' + Date.now() + '@atsglobal.ai>',
    timestamp: timestamp,
    token: token,
    signature: signature
  };

  console.log('📤 Testing with email that received campaign:');
  console.log(`   From: ${replyPayload.sender}`);
  console.log(`   To: ${replyPayload.recipient}`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Inbound'
      },
      body: new URLSearchParams(replyPayload as any).toString()
    });

    console.log(`\n📡 Response: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log(`📄 Body: ${responseText}`);

    if (responseText.includes('Lead not identified')) {
      console.log('\n❌ PROBLEM CONFIRMED: Lead identification is failing');
      console.log('   Even emails that received campaigns cannot be identified as leads');
      console.log('   This suggests the lead database may be empty or the lookup logic is broken');
    } else {
      console.log('\n✅ This email was successfully identified as a lead');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 Reply Processing Diagnostic');
  console.log('=============================\n');

  console.log('📋 Configuration:');
  console.log(`   Webhook URL: ${WEBHOOK_URL}`);
  console.log(`   Signing Key: ${MAILGUN_WEBHOOK_SIGNING_KEY ? '✅ Set' : '❌ Not set'}`);

  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.log('\n❌ Cannot test without signing key');
    return;
  }

  // Test 1: Simulate new lead reply
  await simulateLeadReply();

  // Test 2: Test with email that we know received a campaign
  await testWithExistingLead();

  console.log('\n📋 Diagnosis Summary:');
  console.log('   • If both tests show "Lead not identified", the issue is:');
  console.log('     1. No leads exist in the database, OR');
  console.log('     2. Lead identification logic is broken');
  console.log('   • If one works but not the other, it\'s a data issue');
  console.log('   • If both work, the reply processing system is functional');
}

// Run the main function
main().catch(console.error);
