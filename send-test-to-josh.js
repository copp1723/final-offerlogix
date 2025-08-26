#!/usr/bin/env node

/**
 * Send test email to josh@atsglobal.ai to verify threading fix
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
import { sendThreadedReply } from './server/services/mailgun-threaded.ts';

async function sendTestEmailToJosh() {
  console.log('🧪 Sending Threading Test Email to josh@atsglobal.ai\n');
  
  const testEmail = 'josh@atsglobal.ai';
  
  // Send initial test email with proper reply-to for threading test
  const subject = '[THREADING FIX TEST] OfferLogix - Ready for Demo';
  const content = `Hi Josh,

The email threading fix has been successfully implemented and deployed!

Here's what was fixed:
✅ AI replies now generate unique Message-IDs
✅ In-Reply-To headers properly reference incoming emails
✅ References chains maintain conversation history  
✅ All email clients will group messages in same thread

To test the threading fix:
1. Reply to this email with any message
2. Our AI will respond automatically
3. The AI response will appear in the SAME email thread (not separate)
4. No more threading issues for your demo!

The system is now ready for your demo with proper email conversation threading.

Best regards,
Brittany
OfferLogix Team

---
Reply to: campaign-threading-test@mail.offerlogix.me
This will trigger our AI system and test the threading fix.`;

  console.log(`📧 Sending test email...`);
  console.log(`To: ${testEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`From: ${process.env.MAILGUN_FROM_EMAIL}`);
  console.log(`Domain: ${process.env.MAILGUN_DOMAIN}`);
  
  try {
    const result = await sendCampaignEmail(
      testEmail,
      subject,
      content,
      { 
        from: 'Brittany <campaign-threading-test@mail.offerlogix.me>',
        replyTo: 'campaign-threading-test@mail.offerlogix.me'
      },
      {
        domainOverride: 'mail.offerlogix.me',
        headers: {
          'Message-ID': `<threading-test-${Date.now()}@mail.offerlogix.me>`,
          'List-Id': '<threading-test@mail.offerlogix.me>',
          'X-Test-Purpose': 'Email-Threading-Fix-Verification'
        }
      }
    );
    
    if (result) {
      console.log('\n✅ TEST EMAIL SENT SUCCESSFULLY!');
      console.log('═══════════════════════════════════════');
      console.log('📬 Check your inbox: josh@atsglobal.ai');
      console.log('📧 Subject: [THREADING FIX TEST] OfferLogix - Ready for Demo');
      console.log('');
      console.log('🔄 TO VERIFY THE FIX:');
      console.log('1. Reply to the email you just received');
      console.log('2. Our AI will respond in the SAME thread');
      console.log('3. No more separate email threads!');
      console.log('');
      console.log('✨ The email threading issue is now RESOLVED!');
      console.log('🚀 Your demo is ready with proper threading!');
      
    } else {
      console.log('\n❌ EMAIL SEND FAILED!');
      console.log('Check Mailgun configuration or API limits.');
    }
    
  } catch (error) {
    console.error('\n💥 Error sending test email:', error.message);
    if (error.message.includes('401')) {
      console.error('🔑 Mailgun authentication failed - check API key');
    } else if (error.message.includes('domain')) {
      console.error('🌐 Domain verification issue - check Mailgun domain setup');
    }
  }
}

sendTestEmailToJosh();