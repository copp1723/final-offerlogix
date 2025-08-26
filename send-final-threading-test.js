#!/usr/bin/env node

/**
 * Final threading test - send new email to josh@atsglobal.ai with the critical fix applied
 */

// Set environment variables
process.env.APP_URL = 'https://final-offerlogix.onrender.com';
process.env.CLIENT_URL = 'https://final-offerlogix.onrender.com';
process.env.CORS_ORIGIN = 'https://final-offerlogix.onrender.com';
process.env.DATABASE_URL = 'postgresql://offerlogix_db_user:0qVzb7nAW0Ue1ihbTniiMon1gCfesTK4@dpg-d2edm53uibrs73ft94l0-a.oregon-postgres.render.com/offerlogix_db';
process.env.FRONTEND_URL = 'https://final-offerlogix.onrender.com';
process.env.INBOUND_ACCEPT_DOMAIN_SUFFIX = 'offerlogix.me';
process.env.INBOUND_REQUIRE_CAMPAIGN_REPLY = 'true';
process.env.MAILGUN_API_KEY = 'f710691aaf88ffc683699386bcadb2e5-97129d72-433bb02c';
process.env.MAILGUN_DOMAIN = 'mail.offerlogix.me';
process.env.MAILGUN_FROM_EMAIL = 'Brittany <brittany@mail.offerlogix.me>';
process.env.MAILGUN_TRACKING_DOMAIN = 'final-offerlogix.onrender.com';
process.env.MAILGUN_WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
process.env.NODE_ENV = 'production';
process.env.OPENROUTER_API_KEY = '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';
process.env.SESSION_SECRET = 'd3dca156cc035837e9ab515fb6d938a4';
process.env.SITE_URL = 'https://final-offerlogix.onrender.com';

import { sendCampaignEmail } from './server/services/mailgun.ts';

async function sendFinalThreadingTest() {
  console.log('🔧 FINAL THREADING TEST - Critical Fix Applied!\n');
  
  const testEmail = 'josh@atsglobal.ai';
  const timestamp = Date.now();
  
  const subject = `[FINAL THREADING TEST] Fix Applied - Test #${timestamp.toString().slice(-6)}`;
  const content = `Hi Josh,

The CRITICAL threading fix has been applied and deployed!

🔧 What was wrong before:
- System used INCOMING email's Message-ID for In-Reply-To
- Should have used ORIGINAL email's Message-ID instead
- That's why replies appeared as separate threads!

✅ What's fixed now:
- Extracts References and In-Reply-To from your reply
- Finds the ORIGINAL Message-ID from our campaign email  
- Uses ORIGINAL Message-ID for proper In-Reply-To header
- Maintains complete References chain for thread continuity

🧪 TEST INSTRUCTIONS:
1. Reply to THIS email with any message
2. Our AI will automatically respond
3. The AI response should appear in the SAME email thread
4. No more separate threads!

This is a brand new test email with the critical fix applied.
The previous threading issue should now be completely resolved.

Let's see if this finally works!

Best regards,
Brittany
OfferLogix Team

---
Test ID: FINAL-FIX-${timestamp}
Reply-To: campaign-final-test@mail.offerlogix.me`;

  console.log(`📧 Sending FINAL threading test...`);
  console.log(`To: ${testEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Test ID: FINAL-FIX-${timestamp}`);
  
  try {
    const result = await sendCampaignEmail(
      testEmail,
      subject,
      content,
      { 
        from: 'Brittany <campaign-final-test@mail.offerlogix.me>',
        replyTo: 'campaign-final-test@mail.offerlogix.me'
      },
      {
        domainOverride: 'mail.offerlogix.me',
        headers: {
          'Message-ID': `<final-threading-test-${timestamp}@mail.offerlogix.me>`,
          'List-Id': '<final-threading-test@mail.offerlogix.me>',
          'X-Threading-Fix': 'Applied',
          'X-Test-Timestamp': timestamp.toString()
        }
      }
    );
    
    if (result) {
      console.log('\n🚀 FINAL TEST EMAIL SENT!');
      console.log('═══════════════════════════════════════════════');
      console.log('📬 CHECK YOUR INBOX: josh@atsglobal.ai');
      console.log(`📧 Subject: ${subject}`);
      console.log('');
      console.log('🔬 TO TEST THE CRITICAL FIX:');
      console.log('1. Reply to the NEW email you just received');
      console.log('2. AI will respond with the threading fix applied');
      console.log('3. Response should appear in SAME thread');
      console.log('');
      console.log('💡 This is a completely new test with the root cause fixed.');
      console.log('🎯 The threading should finally work correctly now!');
      
    } else {
      console.log('\n❌ FINAL TEST EMAIL SEND FAILED!');
    }
    
  } catch (error) {
    console.error('\n💥 Error sending final test email:', error.message);
  }
}

sendFinalThreadingTest();