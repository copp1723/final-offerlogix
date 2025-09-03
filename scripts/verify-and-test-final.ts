#!/usr/bin/env tsx

/**
 * Final Verification and Test
 * Verifies the database state and tests the complete AI response flow
 */

import dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.prod' });

async function verifyDatabaseState(): Promise<void> {
  console.log('🔍 VERIFYING DATABASE STATE');
  console.log('===========================\n');

  try {
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get fresh data from database
    const activeAgent = await db.select()
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.isActive, true))
      .limit(1);
    
    if (activeAgent.length > 0) {
      const agent = activeAgent[0];
      console.log('✅ Active Agent Found:');
      console.log(`   Name: ${agent.name}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Email Domain: ${agent.agentEmailDomain}`);
      console.log(`   Settings:`, JSON.stringify(agent.settings, null, 2));
      console.log(`   Auto-respond: ${agent.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
      
      return agent;
    } else {
      console.log('❌ No active agent found');
      return null;
    }
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    return null;
  }
}

async function testEmailSendingDirect(): Promise<void> {
  console.log('\n📧 TESTING EMAIL SENDING DIRECTLY');
  console.log('=================================\n');
  
  try {
    // Test without auto-response flag first
    const { sendCampaignEmail } = await import('../server/services/mailgun.js');
    
    console.log('📤 Testing regular email send (no auto-response flag)...');
    
    const regularEmailSent = await sendCampaignEmail(
      'josh@atsglobal.ai',
      'Test Email - Regular Send',
      'This is a test email sent without the auto-response flag.',
      {}
    );
    
    if (regularEmailSent) {
      console.log('✅ Regular email sent successfully!');
    } else {
      console.log('❌ Regular email failed');
    }
    
    // Now test with auto-response flag
    console.log('\n📤 Testing auto-response email send...');
    
    const autoResponseEmailSent = await sendCampaignEmail(
      'josh@atsglobal.ai',
      'Test Email - Auto Response',
      'This is a test auto-response email.',
      {},
      { isAutoResponse: true }
    );
    
    if (autoResponseEmailSent) {
      console.log('✅ Auto-response email sent successfully!');
    } else {
      console.log('❌ Auto-response email failed');
    }
    
  } catch (error) {
    console.error('❌ Email testing failed:', error);
  }
}

async function testCompleteAIResponseFlow(): Promise<void> {
  console.log('\n🤖 TESTING COMPLETE AI RESPONSE FLOW');
  console.log('====================================\n');
  
  try {
    // Test the complete flow: webhook -> AI response -> email send
    console.log('📧 Simulating inbound email webhook...');
    
    const { InboundEmailService } = await import('../server/services/inbound-email.js');
    
    // Create mock request data
    const mockWebhookData = {
      sender: 'josh@atsglobal.ai',
      recipient: 'campaigns@mg.watchdogai.us',
      subject: 'Honda Civic Inquiry - Final Test',
      'body-plain': 'Hi, I am very interested in the Honda Civic. Can you please provide me with pricing information and schedule a test drive? This is urgent as I need to make a decision soon.',
      timestamp: Math.floor(Date.now() / 1000).toString(),
      token: 'final-test-' + Math.random().toString(36).substring(7),
      'message-id': `<final-test-${Date.now()}@test.com>`,
      'Message-Id': `<final-test-${Date.now()}@test.com>`
    };
    
    // Add signature
    const crypto = await import('crypto');
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';
    const signature = crypto.createHmac('sha256', signingKey)
      .update(mockWebhookData.timestamp + mockWebhookData.token)
      .digest('hex');
    
    const fullWebhookData = {
      ...mockWebhookData,
      signature
    };
    
    // Create mock request and response
    const mockReq = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: fullWebhookData,
      ip: '127.0.0.1'
    };
    
    let responseStatus = 200;
    let responseData = null;
    
    const mockRes = {
      status: (code: number) => {
        responseStatus = code;
        return mockRes;
      },
      json: (data: any) => {
        responseData = data;
        console.log(`📤 Webhook Response: ${responseStatus}`, data);
        return mockRes;
      },
      send: (data: any) => {
        responseData = data;
        console.log(`📤 Webhook Response: ${responseStatus}`, data);
        return mockRes;
      }
    };
    
    console.log('🚀 Processing webhook...');
    
    // Process the webhook
    await InboundEmailService.handleInboundEmail(mockReq as any, mockRes as any);
    
    if (responseStatus === 200) {
      console.log('✅ Webhook processed successfully!');
      console.log('⏱️  Waiting 5 seconds for AI response to be sent...');
      
      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('📧 Check josh@atsglobal.ai inbox for AI response');
    } else {
      console.log(`❌ Webhook processing failed: ${responseStatus}`);
    }
    
  } catch (error) {
    console.error('❌ Complete flow test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('🎯 FINAL AI RESPONSE SYSTEM VERIFICATION');
  console.log('========================================\n');
  
  console.log('🌐 Environment:');
  console.log(`   AI Model: ${process.env.AI_MODEL}`);
  console.log(`   Mailgun Domain: ${process.env.MAILGUN_DOMAIN}`);
  console.log(`   OpenRouter API: ${process.env.OPENROUTER_API_KEY ? 'Configured' : 'Missing'}`);
  console.log('');
  
  await verifyDatabaseState();
  await testEmailSendingDirect();
  await testCompleteAIResponseFlow();
  
  console.log('\n🎉 FINAL VERIFICATION COMPLETE!');
  console.log('===============================');
  console.log('If all tests passed, the AI response system should now be working.');
  console.log('Send a test email to campaigns@mg.watchdogai.us to verify.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
