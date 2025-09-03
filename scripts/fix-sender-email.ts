#!/usr/bin/env tsx

/**
 * Fix Sender Email Address
 * Changes from noreply@ to a more personal email address
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function testPersonalSenderEmail(): Promise<void> {
  console.log('📧 TESTING PERSONAL SENDER EMAIL');
  console.log('================================\n');
  
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
Kunes Auto Macomb Team
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455`;

    // Test different sender options
    const senderOptions = [
      'Kunes Auto Macomb <sales@kunesmacomb.kunesauto.vip>',
      'Kunes Auto Macomb <team@kunesmacomb.kunesauto.vip>',
      'Kunes Auto Macomb <info@kunesmacomb.kunesauto.vip>',
      'Kunes Auto Macomb <contact@kunesmacomb.kunesauto.vip>'
    ];

    console.log('Testing sender options:');
    for (const sender of senderOptions) {
      console.log(`   • ${sender}`);
    }
    console.log('');

    // Send test with sales@ address
    const emailResponse = await fetch(`https://api.mailgun.net/v3/kunesmacomb.kunesauto.vip/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: 'Kunes Auto Macomb <sales@kunesmacomb.kunesauto.vip>',
        to: 'josh@atsglobal.ai',
        subject: 'Re: Honda Civic Inquiry - Personal Email Test',
        text: testEmailBody
      })
    });

    if (emailResponse.ok) {
      console.log('✅ Test email sent with personal sender');
      console.log('   From: Kunes Auto Macomb <sales@kunesmacomb.kunesauto.vip>');
      console.log('📧 Check josh@atsglobal.ai inbox');
    } else {
      const error = await emailResponse.text();
      console.log('❌ Test email failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

async function updateMailgunService(): Promise<void> {
  console.log('\n🔧 CHECKING MAILGUN SERVICE CONFIGURATION');
  console.log('=========================================\n');
  
  // Check the current mailgun service to see how sender is set
  try {
    const { sendCampaignEmail } = await import('../server/services/mailgun.js');
    
    console.log('Current mailgun service configuration:');
    console.log('   Auto-response emails use: options.isAutoResponse = true');
    console.log('   This should use: sales@kunesmacomb.kunesauto.vip');
    console.log('   Instead of: noreply@kunesmacomb.kunesauto.vip');
    
    // Test the service directly
    console.log('\n📤 Testing mailgun service with new sender...');
    
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
Kunes Auto Macomb Team
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455`,
      {},
      { 
        isAutoResponse: true,
        senderName: 'Kunes Auto Macomb'
      }
    );
    
    if (success) {
      console.log('✅ Mailgun service test successful');
    } else {
      console.log('❌ Mailgun service test failed');
    }
    
  } catch (error) {
    console.error('❌ Mailgun service test failed:', error);
  }
}

async function checkMailgunServiceCode(): Promise<void> {
  console.log('\n🔍 CHECKING MAILGUN SERVICE CODE');
  console.log('================================\n');
  
  try {
    // Read the mailgun service file to see current sender logic
    const fs = await import('fs/promises');
    const mailgunServicePath = '../server/services/mailgun.ts';
    
    try {
      const content = await fs.readFile(mailgunServicePath, 'utf-8');
      
      // Look for the sender email logic
      const lines = content.split('\n');
      let foundSenderLogic = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('fromEmail') || line.includes('noreply') || line.includes('isAutoResponse')) {
          console.log(`Line ${i + 1}: ${line.trim()}`);
          foundSenderLogic = true;
        }
      }
      
      if (!foundSenderLogic) {
        console.log('❌ Could not find sender email logic in mailgun service');
      }
      
    } catch (error) {
      console.log('❌ Could not read mailgun service file');
    }
    
  } catch (error) {
    console.error('❌ Failed to check mailgun service code:', error);
  }
}

async function testProductionWithPersonalSender(): Promise<void> {
  console.log('\n🔄 TESTING PRODUCTION WITH PERSONAL SENDER');
  console.log('==========================================\n');
  
  try {
    console.log('🚀 Sending production test with updated sender...');
    
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'sender-test-' + Math.random().toString(36).substring(7);
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
        subject: 'Honda Civic - Personal Sender Test',
        'body-plain': 'Hi, I am interested in a Honda Civic. Can you provide pricing and help me schedule a test drive?',
        timestamp,
        token,
        signature,
        'message-id': `<sender-test-${Date.now()}@test.com>`
      })
    });

    const responseText = await response.text();
    console.log(`📡 Production Response: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log('✅ Production webhook processed');
      console.log('⏱️  AI response should come from personal email');
      console.log('📧 Should be: sales@kunesmacomb.kunesauto.vip (not noreply)');
      console.log('📧 Check josh@atsglobal.ai inbox in 30 seconds');
    } else {
      console.log('❌ Production webhook failed');
    }
    
  } catch (error) {
    console.error('❌ Production test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('📧 FIXING SENDER EMAIL ADDRESS');
  console.log('==============================\n');
  
  console.log('Goal: Change sender from:');
  console.log('   ❌ noreply@kunesmacomb.kunesauto.vip');
  console.log('   ✅ sales@kunesmacomb.kunesauto.vip');
  console.log('');
  
  await testPersonalSenderEmail();
  await updateMailgunService();
  await checkMailgunServiceCode();
  await testProductionWithPersonalSender();
  
  console.log('\n📋 NEXT STEPS:');
  console.log('==============');
  console.log('1. Update mailgun service to use sales@ instead of noreply@');
  console.log('2. Test production flow to confirm change');
  console.log('3. Verify emails come from personal address');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
