#!/usr/bin/env tsx

/**
 * Test Production AI Response System
 * Tests the live production system directly
 */

import crypto from 'crypto';
import fetch from 'node-fetch';

// PRODUCTION ENVIRONMENT VARIABLES
const PROD_WEBHOOK_URL = 'https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound';
const PROD_MAILGUN_SIGNING_KEY = 'REDACTED';
const PROD_MAILGUN_API_KEY = 'REDACTED';
const PROD_MAILGUN_DOMAIN = 'mg.watchdogai.us';

function generateMailgunSignature(timestamp: string, token: string): string {
  return crypto
    .createHmac('sha256', PROD_MAILGUN_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
}

async function sendProductionTestReply(): Promise<void> {
  console.log('🚀 PRODUCTION AI Response Test');
  console.log('==============================\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'prod-ai-test-' + Math.random().toString(36).substring(7);
  const signature = generateMailgunSignature(timestamp, token);

  // Use josh@atsglobal.ai since we know it exists as a lead in production
  const testReply = {
    sender: 'josh@atsglobal.ai',
    recipient: 'campaigns@kunesmacomb.kunesauto.vip',
    subject: 'Re: URGENT - Need AI Response Test',
    'body-plain': `Hi there!

This is a PRODUCTION TEST of the AI response system.

I'm very interested in:
1. Scheduling a test drive for a Honda Accord TODAY
2. Getting a trade-in quote for my 2018 Toyota Camry
3. Learning about financing options with good credit

I need to make a decision THIS WEEK, so please respond quickly with:
- Available Honda Accord models and pricing
- Trade-in value estimate
- Financing rates and monthly payments
- When I can schedule a test drive

This is urgent - I'm ready to buy!

Thanks,
Josh`,
    'stripped-text': `Hi there!

This is a PRODUCTION TEST of the AI response system.

I'm very interested in:
1. Scheduling a test drive for a Honda Accord TODAY
2. Getting a trade-in quote for my 2018 Toyota Camry
3. Learning about financing options with good credit

I need to make a decision THIS WEEK, so please respond quickly with:
- Available Honda Accord models and pricing
- Trade-in value estimate
- Financing rates and monthly payments
- When I can schedule a test drive

This is urgent - I'm ready to buy!

Thanks,
Josh`,
    'message-id': '<prod-ai-test-' + Date.now() + '@atsglobal.ai>',
    'Message-Id': '<prod-ai-test-' + Date.now() + '@atsglobal.ai>',
    timestamp: timestamp,
    token: token,
    signature: signature,
    'From': 'josh@atsglobal.ai',
    'To': 'campaigns@kunesmacomb.kunesauto.vip',
    'Subject': 'Re: URGENT - Need AI Response Test',
    'Date': new Date().toUTCString(),
    'In-Reply-To': '<original-campaign@mg.watchdogai.us>',
    'References': '<original-campaign@mg.watchdogai.us>'
  };

  console.log('📤 Sending PRODUCTION test reply:');
  console.log(`   🌐 URL: ${PROD_WEBHOOK_URL}`);
  console.log(`   📧 From: ${testReply.sender} (KNOWN LEAD)`);
  console.log(`   📧 To: ${testReply.recipient}`);
  console.log(`   📋 Subject: ${testReply.subject}`);
  console.log(`   🔥 Content: HIGH URGENCY automotive sales inquiry`);
  console.log(`   ⏰ Timestamp: ${timestamp}`);
  console.log(`   🔐 Signature: ${signature.substring(0, 16)}...`);

  try {
    const response = await fetch(PROD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Production-AI-Test'
      },
      body: new URLSearchParams(testReply as any).toString()
    });

    console.log(`\n📡 PRODUCTION Response: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);

    if (response.status === 200) {
      console.log('\n✅ PRODUCTION webhook processed successfully!');
      console.log('🤖 AI response should be generated and sent via Mailgun');
      console.log('📧 Check josh@atsglobal.ai inbox for AI response');
      console.log('⏱️  AI response should arrive within 30 seconds');
    } else {
      console.log(`\n❌ PRODUCTION webhook failed: ${response.status}`);
      return;
    }

  } catch (error) {
    console.error('❌ PRODUCTION test failed:', error);
    return;
  }

  // Wait and check for AI response in Mailgun
  console.log('\n⏱️  Waiting 20 seconds for AI response...');
  await new Promise(resolve => setTimeout(resolve, 20000));

  await checkProductionMailgunEvents();
}

async function checkProductionMailgunEvents(): Promise<void> {
  console.log('\n🔍 Checking PRODUCTION Mailgun Events');
  console.log('====================================\n');

  try {
    const response = await fetch(`https://api.mailgun.net/v3/${PROD_MAILGUN_DOMAIN}/events?limit=20&begin=${Math.floor(Date.now()/1000) - 300}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${PROD_MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (!response.ok) {
      console.error(`❌ Mailgun API error: ${response.status}`);
      return;
    }

    const data = await response.json() as { items: any[] };
    const events = data.items || [];

    console.log(`📊 Found ${events.length} recent Mailgun events`);

    // Look for outbound emails to josh@atsglobal.ai in the last 5 minutes
    const recentOutbound = events.filter(event => 
      event.recipient === 'josh@atsglobal.ai' && 
      (event.event === 'accepted' || event.event === 'delivered') &&
      new Date(event.timestamp * 1000).getTime() > Date.now() - (5 * 60 * 1000)
    );

    if (recentOutbound.length > 0) {
      console.log('🎉 AI RESPONSE EMAILS FOUND!');
      recentOutbound.forEach((event, index) => {
        console.log(`\n   ${index + 1}. [${event.event.toUpperCase()}] AI Response`);
        console.log(`      📧 To: ${event.recipient}`);
        console.log(`      📋 Subject: ${event.message?.headers?.subject || 'N/A'}`);
        console.log(`      ⏰ Time: ${new Date(event.timestamp * 1000).toLocaleString()}`);
        console.log(`      🆔 Message ID: ${event.id}`);
      });
      console.log('\n✅ AI RESPONSE SYSTEM IS WORKING! 🎉');
    } else {
      console.log('❌ No AI response emails found');
      
      // Show all recent events for debugging
      console.log('\n📋 All Recent Events (last 5 minutes):');
      const recentEvents = events.filter(event => 
        new Date(event.timestamp * 1000).getTime() > Date.now() - (5 * 60 * 1000)
      );
      
      if (recentEvents.length > 0) {
        recentEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. [${event.event}] ${event.recipient || 'N/A'} - ${new Date(event.timestamp * 1000).toLocaleString()}`);
        });
      } else {
        console.log('   No recent events found');
      }
    }

  } catch (error) {
    console.error('❌ Error checking Mailgun events:', error);
  }
}

async function main(): Promise<void> {
  console.log('🚀 PRODUCTION AI Response System Test');
  console.log('=====================================\n');

  console.log('🌐 PRODUCTION Environment:');
  console.log(`   Webhook: ${PROD_WEBHOOK_URL}`);
  console.log(`   Mailgun Domain: ${PROD_MAILGUN_DOMAIN}`);
  console.log(`   Test Lead: josh@atsglobal.ai`);
  console.log('');

  await sendProductionTestReply();

  console.log('\n📋 PRODUCTION Test Summary:');
  console.log('   • If AI response found: 🎉 SYSTEM IS WORKING!');
  console.log('   • If no AI response: Check production logs for errors');
  console.log('   • AI should respond with automotive sales info');
  console.log('   • Response should address urgency and all inquiries');
}

// Run the main function
main().catch(console.error);
