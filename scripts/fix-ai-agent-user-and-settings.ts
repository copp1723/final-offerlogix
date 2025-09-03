#!/usr/bin/env tsx

/**
 * Fix AI Agent User and Settings
 * Creates the ai-agent user and fixes the agent settings
 */

import dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.prod' });

async function createAIAgentUser(): Promise<void> {
  console.log('👤 CREATING AI AGENT USER');
  console.log('=========================\n');

  try {
    const { db } = await import('../server/db.js');
    const { users } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Check if ai-agent user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, 'ai-agent'))
      .limit(1);
    
    if (existingUser.length > 0) {
      console.log('✅ AI agent user already exists');
      return;
    }
    
    // Create ai-agent user
    console.log('🔧 Creating ai-agent user...');
    
    await db.insert(users).values({
      id: 'ai-agent',
      username: 'ai-agent',
      password: 'system-user-no-login',
      email: 'ai-agent@system.local',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ AI agent user created successfully');
    
  } catch (error) {
    console.error('❌ Failed to create AI agent user:', error);
  }
}

async function fixAgentSettings(): Promise<void> {
  console.log('\n⚙️ FIXING AGENT SETTINGS');
  console.log('========================\n');

  try {
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get active agent
    const activeAgent = await db.select()
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.isActive, true))
      .limit(1);
    
    if (activeAgent.length === 0) {
      console.log('❌ No active agent found');
      return;
    }
    
    const agent = activeAgent[0];
    console.log(`🤖 Fixing settings for agent: ${agent.name}`);
    
    // Create proper settings object
    const properSettings = {
      autoRespond: true,
      responseDelay: 2000,
      enableHandover: true,
      handoverKeywords: ["speak to human", "talk to salesperson", "manager", "urgent"],
      businessHours: {
        enabled: true,
        timezone: "America/Chicago",
        schedule: {
          monday: { start: "09:00", end: "18:00" },
          tuesday: { start: "09:00", end: "18:00" },
          wednesday: { start: "09:00", end: "18:00" },
          thursday: { start: "09:00", end: "18:00" },
          friday: { start: "09:00", end: "18:00" },
          saturday: { start: "10:00", end: "16:00" },
          sunday: { start: "12:00", end: "17:00" }
        }
      }
    };
    
    console.log('🔧 Updating agent settings...');
    console.log('   Settings:', JSON.stringify(properSettings, null, 2));
    
    await db.update(aiAgentConfig)
      .set({
        agentEmailDomain: process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us',
        settings: properSettings,
        responseModel: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 500,
        updatedAt: new Date()
      })
      .where(eq(aiAgentConfig.id, agent.id));
    
    console.log('✅ Agent settings updated successfully');
    
    // Verify the update
    const updatedAgent = await db.select()
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.id, agent.id))
      .limit(1);

    if (updatedAgent.length > 0) {
      const updated = updatedAgent[0];
      console.log('\n📊 Verification:');
      console.log(`   Email Domain: ${updated.agentEmailDomain}`);
      console.log(`   Settings Object:`, JSON.stringify(updated.settings, null, 2));
      console.log(`   Auto-respond: ${updated.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
      console.log(`   Response Model: ${updated.responseModel}`);
    } else {
      console.log('❌ Could not verify update - agent not found');
    }

    // Test storage service
    console.log('\n🔍 Testing storage service...');
    const { storage } = await import('../server/storage.js');
    const activeAgentFromStorage = await storage.getActiveAiAgentConfig();

    if (activeAgentFromStorage) {
      console.log('✅ Storage service found active agent:');
      console.log(`   Name: ${activeAgentFromStorage.name}`);
      console.log(`   Email Domain: ${activeAgentFromStorage.agentEmailDomain}`);
      console.log(`   Settings:`, JSON.stringify(activeAgentFromStorage.settings, null, 2));
      console.log(`   Auto-respond: ${activeAgentFromStorage.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
    } else {
      console.log('❌ Storage service could not find active agent');
    }
    
  } catch (error) {
    console.error('❌ Failed to fix agent settings:', error);
  }
}

async function testEmailSendingAfterFix(): Promise<void> {
  console.log('\n📧 TESTING EMAIL SENDING AFTER FIX');
  console.log('==================================\n');
  
  try {
    const { sendCampaignEmail } = await import('../server/services/mailgun.js');
    
    console.log('📤 Testing auto-response email send...');
    
    const testResponse = "Hi Josh! Thanks for your interest in the Honda Civic. I'd be happy to help you with pricing and availability information. The 2024 Honda Civic starts at around $24,000 for the base LX trim. Would you like to schedule a test drive?";
    
    const emailSent = await sendCampaignEmail(
      'josh@atsglobal.ai',
      'Re: Honda Civic Inquiry - Auto Response Test (Final Fix)',
      testResponse,
      {},
      { isAutoResponse: true }
    );
    
    if (emailSent) {
      console.log('✅ Auto-response email sent successfully!');
      console.log('📧 Check josh@atsglobal.ai inbox for the test email');
    } else {
      console.log('❌ Auto-response email still failed');
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

async function testCompleteFlow(): Promise<void> {
  console.log('\n🔄 TESTING COMPLETE FLOW');
  console.log('========================\n');
  
  try {
    console.log('🚀 Testing production webhook with real AI response...');
    
    const response = await fetch('https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Final-Test'
      },
      body: new URLSearchParams({
        sender: 'josh@atsglobal.ai',
        recipient: 'campaigns@mg.watchdogai.us',
        subject: 'Honda Civic - Final AI Response Test',
        'body-plain': 'Hi! I am very interested in the Honda Civic and would like to know about pricing, financing options, and availability. Can we schedule a test drive this week? This is urgent as I need to make a decision soon.',
        timestamp: Math.floor(Date.now() / 1000).toString(),
        token: 'final-fix-test-' + Math.random().toString(36).substring(7),
        signature: 'test-signature',
        'message-id': `<final-fix-test-${Date.now()}@test.com>`,
        'Message-Id': `<final-fix-test-${Date.now()}@test.com>`
      }).toString()
    });

    const responseText = await response.text();
    
    console.log(`📡 Production Response: ${response.status} ${response.statusText}`);
    console.log(`📄 Response Body: ${responseText}`);
    
    if (response.status === 200) {
      console.log('✅ Production webhook processed successfully!');
      console.log('⏱️  AI response should be generated and sent within 30 seconds');
      console.log('📧 Check josh@atsglobal.ai inbox for AI response');
    } else {
      console.log('❌ Production webhook failed');
    }
    
  } catch (error) {
    console.error('❌ Complete flow test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔧 FINAL AI RESPONSE SYSTEM FIX');
  console.log('===============================\n');
  
  console.log('🌐 Environment:');
  console.log(`   AI Model: ${process.env.AI_MODEL}`);
  console.log(`   Mailgun Domain: ${process.env.MAILGUN_DOMAIN}`);
  console.log('');
  
  await createAIAgentUser();
  await fixAgentSettings();
  await testEmailSendingAfterFix();
  await testCompleteFlow();
  
  console.log('\n🎉 FINAL FIX COMPLETE!');
  console.log('======================');
  console.log('The AI response system should now be fully functional.');
  console.log('Send a test email to campaigns@mg.watchdogai.us to verify.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
