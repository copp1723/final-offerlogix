#!/usr/bin/env tsx

/**
 * Fix Agent Email Domain Configuration
 * Updates the AI agent configuration to include the proper email domain
 */

import dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.prod' });

async function fixAgentEmailDomain(): Promise<void> {
  console.log('🔧 FIXING AGENT EMAIL DOMAIN CONFIGURATION');
  console.log('==========================================\n');

  try {
    // Import database and schema
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    console.log('✅ Database connection established');
    
    // Get all AI agent configurations
    const agents = await db.select().from(aiAgentConfig);
    
    console.log(`📊 Found ${agents.length} AI agent configurations:`);
    
    for (const agent of agents) {
      console.log(`\n🤖 Agent: ${agent.name} (ID: ${agent.id})`);
      console.log(`   📧 Current agentEmailDomain: ${agent.agentEmailDomain || 'NOT SET'}`);
      console.log(`   ✅ Active: ${agent.isActive ? 'Yes' : 'No'}`);
      
      // Update agent with proper email domain and enable auto-respond
      const correctEmailDomain = process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us';
      const needsUpdate = !agent.agentEmailDomain ||
                         agent.agentEmailDomain !== correctEmailDomain ||
                         !agent.settings?.autoRespond;

      if (needsUpdate) {
        console.log(`   🔧 Updating agent configuration:`);
        console.log(`      - Email domain: ${correctEmailDomain}`);
        console.log(`      - Auto-respond: Enabled`);

        const updatedSettings = {
          ...agent.settings,
          autoRespond: true,
          responseDelay: 2000,
          enableHandover: true,
          handoverKeywords: ["speak to human", "talk to salesperson", "manager", "urgent"]
        };

        await db.update(aiAgentConfig)
          .set({
            agentEmailDomain: correctEmailDomain,
            settings: updatedSettings,
            updatedAt: new Date()
          })
          .where(eq(aiAgentConfig.id, agent.id));

        console.log(`   ✅ Updated agent ${agent.name}`);
      } else {
        console.log(`   ✅ Agent configuration is correct`);
      }
    }
    
    // Get the active agent configuration
    console.log('\n🔍 Checking active agent configuration...');
    
    const activeAgent = await db.select()
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.isActive, true))
      .limit(1);
    
    if (activeAgent.length > 0) {
      const agent = activeAgent[0];
      console.log(`✅ Active agent: ${agent.name}`);
      console.log(`📧 Email domain: ${agent.agentEmailDomain}`);
      console.log(`🤖 Model: ${agent.responseModel}`);
      console.log(`⚙️ Auto-respond: ${agent.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
    } else {
      console.log('❌ No active agent configuration found');
      
      // If no active agent, activate the first one
      if (agents.length > 0) {
        console.log(`🔧 Activating first agent: ${agents[0].name}`);
        
        await db.update(aiAgentConfig)
          .set({ 
            isActive: true,
            updatedAt: new Date()
          })
          .where(eq(aiAgentConfig.id, agents[0].id));
          
        console.log(`✅ Activated agent: ${agents[0].name}`);
      }
    }
    
    console.log('\n🎉 Agent email domain configuration completed!');
    
  } catch (error) {
    console.error('❌ Failed to fix agent email domain:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : '');
  }
}

async function testEmailSendingAfterFix(): Promise<void> {
  console.log('\n🧪 TESTING EMAIL SENDING AFTER FIX');
  console.log('==================================\n');
  
  try {
    const { sendCampaignEmail } = await import('../server/services/mailgun.js');
    
    const testResponse = "Hi Josh! Thanks for your interest in the Honda Civic. I'd be happy to help you with pricing and availability information. The 2024 Honda Civic starts at around $24,000 for the base LX trim. Would you like to schedule a test drive?";
    
    console.log('📧 Testing email send with auto-response flag...');
    
    const emailSent = await sendCampaignEmail(
      'josh@atsglobal.ai',
      'Re: Honda Civic Inquiry - Auto Response Test (Fixed)',
      testResponse,
      {},
      { isAutoResponse: true }
    );
    
    if (emailSent) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Check josh@atsglobal.ai inbox for the test email');
    } else {
      console.log('❌ Email sending still failed');
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error instanceof Error ? error.message : String(error));
  }
}

async function main(): Promise<void> {
  console.log('🌐 Production Environment:');
  console.log(`   Mailgun Domain: ${process.env.MAILGUN_DOMAIN}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log('');
  
  await fixAgentEmailDomain();
  await testEmailSendingAfterFix();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
