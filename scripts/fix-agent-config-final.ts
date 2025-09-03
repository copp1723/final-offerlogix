#!/usr/bin/env tsx

/**
 * Fix Agent Configuration Final
 * Ensures the Kunes Macomb agent is properly configured
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function fixAgentConfiguration(): Promise<void> {
  console.log('🔧 FIXING AGENT CONFIGURATION');
  console.log('=============================\n');

  try {
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get the Kunes Macomb agent
    const kunesMacombId = '2e7bbd27-f1a0-44e6-95c6-4b2cea8a2360';
    const [agent] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.id, kunesMacombId));
    
    if (!agent) {
      console.log('❌ Kunes Macomb agent not found');
      return;
    }
    
    console.log(`🤖 Current agent status:`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Active: ${agent.isActive ? 'Yes' : 'No'}`);
    console.log(`   Email Domain: ${agent.agentEmailDomain}`);
    console.log(`   Auto-respond: ${agent.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
    
    // Fix configuration
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
    
    console.log('\n🔧 Updating agent configuration...');
    
    // First, deactivate all other agents
    await db.update(aiAgentConfig)
      .set({ isActive: false })
      .where(eq(aiAgentConfig.isActive, true));
    
    // Then activate and configure the Kunes Macomb agent
    await db.update(aiAgentConfig)
      .set({
        name: 'Kunes Auto Macomb AI Assistant',
        agentEmailDomain: 'kunesmacomb.kunesauto.vip',
        settings: properSettings,
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(aiAgentConfig.id, kunesMacombId));
    
    console.log('✅ Agent configuration updated');
    
    // Verify the update
    const [updatedAgent] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.id, kunesMacombId));
    
    if (updatedAgent) {
      console.log('\n📊 Verification:');
      console.log(`   Name: ${updatedAgent.name}`);
      console.log(`   Active: ${updatedAgent.isActive ? 'Yes' : 'No'}`);
      console.log(`   Email Domain: ${updatedAgent.agentEmailDomain}`);
      console.log(`   Auto-respond: ${updatedAgent.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
      
      if (updatedAgent.isActive && 
          updatedAgent.agentEmailDomain === 'kunesmacomb.kunesauto.vip' && 
          updatedAgent.settings?.autoRespond) {
        console.log('\n✅ Agent configuration is now correct!');
      } else {
        console.log('\n❌ Agent configuration still has issues');
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to fix agent configuration:', error);
  }
}

async function testConfiguration(): Promise<void> {
  console.log('\n🧪 TESTING CONFIGURATION');
  console.log('========================\n');
  
  try {
    // Test the storage service
    const { storage } = await import('../server/storage.js');
    const activeAgent = await storage.getActiveAiAgentConfig();
    
    if (activeAgent) {
      console.log('✅ Storage service found active agent:');
      console.log(`   Name: ${activeAgent.name}`);
      console.log(`   Email Domain: ${activeAgent.agentEmailDomain}`);
      console.log(`   Auto-respond: ${activeAgent.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
    } else {
      console.log('❌ Storage service could not find active agent');
    }
    
    // Test AI response generation
    console.log('\n🤖 Testing AI response generation...');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-chat',
        messages: [
          { role: 'system', content: 'You are Riley Donovan, Client Success representative for Kunes Auto Macomb.' },
          { role: 'user', content: 'I am interested in a Honda Civic. Can you help?' }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    });

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      if (aiResponse) {
        console.log('✅ AI response generation working');
      } else {
        console.log('❌ AI response generation failed');
      }
    } else {
      console.log('❌ AI API connection failed');
    }
    
    // Test email sending
    console.log('\n📧 Testing email sending...');
    
    const emailResponse = await fetch(`https://api.mailgun.net/v3/kunesmacomb.kunesauto.vip/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
        to: 'josh@atsglobal.ai',
        subject: 'Configuration Test - System Ready',
        text: 'This email confirms the Kunes Auto Macomb system is properly configured and ready for the final test.'
      })
    });

    if (emailResponse.ok) {
      console.log('✅ Email sending working');
      console.log('📧 Test email sent to josh@atsglobal.ai');
    } else {
      const error = await emailResponse.text();
      console.log('❌ Email sending failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔧 FINAL AGENT CONFIGURATION FIX');
  console.log('=================================\n');
  
  await fixAgentConfiguration();
  await testConfiguration();
  
  console.log('\n🎉 CONFIGURATION FIX COMPLETE');
  console.log('=============================');
  console.log('The system should now be ready for the final 2-way campaign test.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
