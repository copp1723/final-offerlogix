#!/usr/bin/env tsx

/**
 * Fix Kunes Macomb Domain Configuration
 * Updates the active agent to use kunesmacomb.kunesauto.vip
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function fixKunesMacombAgent(): Promise<void> {
  console.log('🔧 FIXING KUNES MACOMB AGENT CONFIGURATION');
  console.log('==========================================\n');

  try {
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get the Kunes Macomb agent (ID: 2e7bbd27-f1a0-44e6-95c6-4b2cea8a2360)
    const kunesMacombId = '2e7bbd27-f1a0-44e6-95c6-4b2cea8a2360';
    const [agent] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.id, kunesMacombId));
    
    if (!agent) {
      console.log('❌ Kunes Macomb agent not found');
      return;
    }
    
    console.log(`🤖 Found agent: ${agent.name}`);
    console.log(`   Current domain: ${agent.agentEmailDomain}`);
    console.log(`   Active: ${agent.isActive ? 'Yes' : 'No'}`);
    
    // Update agent configuration
    const updatedSettings = {
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
    console.log('   Setting domain: kunesmacomb.kunesauto.vip');
    console.log('   Enabling auto-respond');
    console.log('   Setting as active agent');
    
    await db.update(aiAgentConfig)
      .set({
        agentEmailDomain: 'kunesmacomb.kunesauto.vip',
        settings: updatedSettings,
        isActive: true,
        name: 'Kunes Auto Macomb AI Assistant',
        updatedAt: new Date()
      })
      .where(eq(aiAgentConfig.id, kunesMacombId));
    
    // Deactivate other agents
    await db.update(aiAgentConfig)
      .set({ isActive: false })
      .where(eq(aiAgentConfig.isActive, true))
      .where(eq(aiAgentConfig.id, kunesMacombId, false));
    
    console.log('✅ Agent configuration updated');
    
    // Verify the update
    const [updatedAgent] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.id, kunesMacombId));
    
    if (updatedAgent) {
      console.log('\n📊 Verification:');
      console.log(`   Name: ${updatedAgent.name}`);
      console.log(`   Email Domain: ${updatedAgent.agentEmailDomain}`);
      console.log(`   Active: ${updatedAgent.isActive ? 'Yes' : 'No'}`);
      console.log(`   Auto-respond: ${updatedAgent.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to fix Kunes Macomb agent:', error);
  }
}

async function testKunesSubdomain(): Promise<void> {
  console.log('\n📧 TESTING KUNES SUBDOMAIN');
  console.log('==========================\n');
  
  try {
    // Test Mailgun domain
    const domainResponse = await fetch(`https://api.mailgun.net/v3/domains/kunesmacomb.kunesauto.vip`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
      }
    });
    
    if (domainResponse.ok) {
      const domain = await domainResponse.json();
      console.log('✅ Kunes Macomb subdomain exists:');
      console.log(`   Domain: kunesmacomb.kunesauto.vip`);
      console.log(`   State: ${domain.domain?.state}`);
      console.log(`   Type: ${domain.domain?.type}`);
    } else {
      console.log('❌ Kunes Macomb subdomain not found');
      return;
    }
    
    // Test email sending from Kunes subdomain
    console.log('\n📤 Testing email from Kunes subdomain...');
    
    const emailResponse = await fetch(`https://api.mailgun.net/v3/kunesmacomb.kunesauto.vip/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: 'Kunes Auto Macomb <noreply@kunesmacomb.kunesauto.vip>',
        to: 'josh@atsglobal.ai',
        subject: 'Kunes Macomb Domain Test',
        text: 'This email confirms the Kunes Macomb subdomain is working correctly.'
      })
    });

    if (emailResponse.ok) {
      console.log('✅ Email sent successfully from Kunes subdomain');
      console.log('📧 Check josh@atsglobal.ai inbox');
    } else {
      const error = await emailResponse.text();
      console.log('❌ Email sending failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Subdomain test failed:', error);
  }
}

async function testCompleteFlow(): Promise<void> {
  console.log('\n🔄 TESTING COMPLETE KUNES FLOW');
  console.log('==============================\n');
  
  try {
    console.log('🚀 Sending test webhook to production...');
    
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'kunes-test-' + Math.random().toString(36).substring(7);
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
        subject: 'Kunes Macomb Test - Honda Civic Inquiry',
        'body-plain': 'Hi, I am interested in a Honda Civic at your Macomb location. Can you provide pricing and schedule a test drive?',
        timestamp,
        token,
        signature,
        'message-id': `<kunes-test-${Date.now()}@test.com>`
      })
    });

    const responseText = await response.text();
    console.log(`📡 Production Response: ${response.status} ${response.statusText}`);
    console.log(`📄 Response: ${responseText}`);
    
    if (response.status === 200) {
      console.log('✅ Production webhook processed successfully');
      console.log('⏱️  AI response should be sent from noreply@kunesmacomb.kunesauto.vip');
      console.log('📧 Check josh@atsglobal.ai inbox in 30 seconds');
    } else {
      console.log('❌ Production webhook failed');
    }
    
  } catch (error) {
    console.error('❌ Complete flow test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('🏪 KUNES AUTO MACOMB SETUP');
  console.log('==========================\n');
  
  console.log('Target Configuration:');
  console.log('   Agent: Kunes Auto Macomb AI Assistant');
  console.log('   Domain: kunesmacomb.kunesauto.vip');
  console.log('   From: Kunes Auto Macomb <noreply@kunesmacomb.kunesauto.vip>');
  console.log('   To: campaigns@kunesmacomb.kunesauto.vip');
  console.log('');
  
  await fixKunesMacombAgent();
  await testKunesSubdomain();
  await testCompleteFlow();
  
  console.log('\n🎉 KUNES MACOMB SETUP COMPLETE');
  console.log('==============================');
  console.log('AI responses should now come from:');
  console.log('Kunes Auto Macomb <noreply@kunesmacomb.kunesauto.vip>');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
