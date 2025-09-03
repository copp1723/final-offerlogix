#!/usr/bin/env tsx

/**
 * Test Riley Donovan Sender
 * Tests the new Riley Donovan sender email
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function testRileySender(): Promise<void> {
  console.log('📧 TESTING RILEY DONOVAN SENDER');
  console.log('==============================\n');
  
  try {
    const testEmailBody = `Hope you're doing well! I wanted to reach out about your Honda Civic inquiry.

We're helping customers like you with:
• Competitive pricing and financing options
• Comprehensive vehicle inspections
• Trade-in evaluations
• Extended warranty options

Our customers typically experience:
• Fast, no-pressure sales process
• Transparent pricing
• Expert service and support

Would you be interested in scheduling a quick test drive to see how the Civic fits your needs?

I'd love to show you why Kunes Auto Macomb has been serving the Macomb community for years.

Best regards,
Riley Donovan
Client Success
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455`;

    // Test direct email with Riley's address
    const emailResponse = await fetch(`https://api.mailgun.net/v3/kunesmacomb.kunesauto.vip/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
        to: 'josh@atsglobal.ai',
        subject: 'Re: Honda Civic Inquiry - Riley Test',
        text: testEmailBody
      })
    });

    if (emailResponse.ok) {
      console.log('✅ Test email sent with Riley sender');
      console.log('   From: Riley Donovan <riley@kunesmacomb.kunesauto.vip>');
      console.log('📧 Check josh@atsglobal.ai inbox');
    } else {
      const error = await emailResponse.text();
      console.log('❌ Test email failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

async function testMailgunService(): Promise<void> {
  console.log('\n🔧 TESTING MAILGUN SERVICE WITH RILEY');
  console.log('====================================\n');
  
  try {
    const { sendCampaignEmail } = await import('../server/services/mailgun.js');
    
    console.log('📤 Testing mailgun service with auto-response flag...');
    
    const success = await sendCampaignEmail(
      'josh@atsglobal.ai',
      'Re: Honda Civic Inquiry - Service Test',
      `Hope you're doing well! I wanted to reach out about your Honda Civic inquiry.

We're helping customers like you with:
• Competitive pricing and financing options
• Comprehensive vehicle inspections
• Trade-in evaluations
• Extended warranty options

Would you be interested in scheduling a quick test drive?

Best regards,
Riley Donovan
Client Success
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455`,
      {},
      { 
        isAutoResponse: true,
        domainOverride: 'kunesmacomb.kunesauto.vip'
      }
    );
    
    if (success) {
      console.log('✅ Mailgun service test successful');
      console.log('   Should be from: Riley Donovan <riley@kunesmacomb.kunesauto.vip>');
    } else {
      console.log('❌ Mailgun service test failed');
    }
    
  } catch (error) {
    console.error('❌ Mailgun service test failed:', error);
  }
}

async function testProductionFlow(): Promise<void> {
  console.log('\n🔄 TESTING PRODUCTION FLOW WITH RILEY');
  console.log('====================================\n');
  
  try {
    console.log('🚀 Sending production test with Riley sender...');
    
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'riley-sender-' + Math.random().toString(36).substring(7);
    const signature = crypto.createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '')
      .update(timestamp + token)
      .digest('hex');

    const response = await fetch('https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        sender: 'josh@atsglobal.ai',
        recipient: 'campaigns@kunesmacomb.kunesauto.vip',
        subject: 'Honda Civic - Riley Sender Test',
        'body-plain': 'Hi, I am interested in a Honda Civic. Can you provide pricing information and help me schedule a test drive?',
        timestamp,
        token,
        signature,
        'message-id': `<riley-sender-${Date.now()}@test.com>`
      })
    });

    const responseText = await response.text();
    console.log(`📡 Production Response: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log('✅ Production webhook processed');
      console.log('⏱️  AI response should come from Riley Donovan');
      console.log('📧 From: Riley Donovan <riley@kunesmacomb.kunesauto.vip>');
      console.log('📧 Check josh@atsglobal.ai inbox in 30 seconds');
    } else {
      console.log('❌ Production webhook failed');
    }
    
  } catch (error) {
    console.error('❌ Production test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('👤 TESTING RILEY DONOVAN SENDER');
  console.log('===============================\n');
  
  console.log('Expected sender change:');
  console.log('   ❌ Kunes Auto Macomb <sales@kunesmacomb.kunesauto.vip>');
  console.log('   ✅ Riley Donovan <riley@kunesmacomb.kunesauto.vip>');
  console.log('');
  
  await testRileySender();
  await testMailgunService();
  await testProductionFlow();
  
  console.log('\n🎉 RILEY DONOVAN SENDER TESTS COMPLETE');
  console.log('=====================================');
  console.log('AI responses should now come from Riley Donovan personally');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
