#!/usr/bin/env tsx

/**
 * Trigger AI Response Test
 * Sends a test reply that should trigger an AI response
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

async function sendTestReplyFromKnownLead(): Promise<void> {
  console.log('🧪 Sending Test Reply from Known Lead');
  console.log('====================================\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'ai-test-' + Math.random().toString(36).substring(7);
  const signature = generateMailgunSignature(timestamp, token);

  // Use josh@atsglobal.ai since we know it exists as a lead
  const testReply = {
    sender: 'josh@atsglobal.ai',
    recipient: 'campaigns@kunesmacomb.kunesauto.vip',
    subject: 'Re: AI Response Test - Please Reply',
    'body-plain': `Hi there!

I'm very interested in scheduling a test drive for a Honda Accord. I have a 2018 Toyota Camry that I'd like to trade in as well.

Could you please let me know:
1. What Honda Accord models do you have available?
2. What's the trade-in value of my 2018 Camry?
3. When can I schedule a test drive?

I'm looking to make a decision this week, so I'd appreciate a quick response.

Thanks!
Josh`,
    'stripped-text': `Hi there!

I'm very interested in scheduling a test drive for a Honda Accord. I have a 2018 Toyota Camry that I'd like to trade in as well.

Could you please let me know:
1. What Honda Accord models do you have available?
2. What's the trade-in value of my 2018 Camry?
3. When can I schedule a test drive?

I'm looking to make a decision this week, so I'd appreciate a quick response.

Thanks!
Josh`,
    'message-id': '<ai-response-test-' + Date.now() + '@atsglobal.ai>',
    'Message-Id': '<ai-response-test-' + Date.now() + '@atsglobal.ai>',
    timestamp: timestamp,
    token: token,
    signature: signature,
    'From': 'josh@atsglobal.ai',
    'To': 'campaigns@kunesmacomb.kunesauto.vip',
    'Subject': 'Re: AI Response Test - Please Reply',
    'Date': new Date().toUTCString()
  };

  console.log('📤 Sending test reply that should trigger AI response:');
  console.log(`   From: ${testReply.sender} (known lead)`);
  console.log(`   To: ${testReply.recipient}`);
  console.log(`   Subject: ${testReply.subject}`);
  console.log(`   Content includes: test drive request, trade-in inquiry, urgency`);
  console.log(`   Expected: AI should generate automotive sales response`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Test-AI-Response'
      },
      body: new URLSearchParams(testReply as any).toString()
    });

    console.log(`\n📡 Webhook Response: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);

    if (response.status === 200) {
      console.log('\n✅ Test reply processed successfully!');
      console.log('🤖 AI response should be generated and sent via email');
      console.log('📧 Check the email inbox for josh@atsglobal.ai for the AI response');
      console.log('⏱️  AI response generation may take 10-30 seconds');
    } else {
      console.log(`\n❌ Test reply processing failed: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Error sending test reply:', error);
  }
}

async function checkForAIResponseInDatabase(): Promise<void> {
  console.log('\n🔍 Checking for AI Responses in Database');
  console.log('=======================================\n');

  // Wait a bit for AI response to be generated
  console.log('⏱️  Waiting 15 seconds for AI response generation...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  try {
    // Check recent Mailgun activity for outbound emails
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us';

    if (MAILGUN_API_KEY) {
      const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/events?limit=10`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
        }
      });

      if (response.ok) {
        const data = await response.json() as { items: any[] };
        const recentEvents = data.items || [];

        // Look for recent outbound emails to josh@atsglobal.ai
        const aiResponses = recentEvents.filter(event => 
          event.recipient === 'josh@atsglobal.ai' && 
          (event.event === 'accepted' || event.event === 'delivered') &&
          new Date(event.timestamp * 1000).getTime() > Date.now() - (5 * 60 * 1000) // Last 5 minutes
        );

        if (aiResponses.length > 0) {
          console.log('✅ AI Response Email Found!');
          aiResponses.forEach((event, index) => {
            console.log(`   ${index + 1}. [${event.event.toUpperCase()}] to ${event.recipient}`);
            console.log(`      Subject: ${event.message?.headers?.subject || 'N/A'}`);
            console.log(`      Time: ${new Date(event.timestamp * 1000).toLocaleString()}`);
          });
        } else {
          console.log('❌ No AI response emails found in recent Mailgun events');
          console.log('   This suggests the AI response generation may not be working');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking for AI responses:', error);
  }
}

async function main(): Promise<void> {
  console.log('🤖 AI Response System Test');
  console.log('==========================\n');

  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.error('❌ MAILGUN_WEBHOOK_SIGNING_KEY not set');
    return;
  }

  // Send test reply from known lead
  await sendTestReplyFromKnownLead();

  // Check for AI response
  await checkForAIResponseInDatabase();

  console.log('\n📋 Test Summary:');
  console.log('   • If AI response email is found: System is working correctly');
  console.log('   • If no AI response email: Check application logs for errors');
  console.log('   • The AI should respond with automotive sales information');
  console.log('   • Response should address test drive, trade-in, and urgency');
}

// Run the main function
main().catch(console.error);
