#!/usr/bin/env tsx

/**
 * Check Subdomain Configuration
 * Examines current agent config and subdomain setup
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function checkAgentConfig(): Promise<void> {
  console.log('🔍 CHECKING AGENT CONFIGURATION');
  console.log('==============================\n');

  try {
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get all agent configurations
    const agents = await db.select().from(aiAgentConfig);
    
    console.log(`📊 Found ${agents.length} AI agent configurations:\n`);
    
    for (const agent of agents) {
      console.log(`🤖 Agent: ${agent.name}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Active: ${agent.isActive ? 'Yes' : 'No'}`);
      console.log(`   Email Domain: ${agent.agentEmailDomain || 'NOT SET'}`);
      console.log(`   Auto-respond: ${agent.settings?.autoRespond ? 'Enabled' : 'Disabled'}`);
      console.log(`   Created: ${agent.createdAt}`);
      console.log('');
    }
    
    // Check active agent specifically
    const [activeAgent] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.isActive, true));
    
    if (activeAgent) {
      console.log('✅ ACTIVE AGENT DETAILS:');
      console.log(`   Name: ${activeAgent.name}`);
      console.log(`   Email Domain: ${activeAgent.agentEmailDomain}`);
      console.log(`   Settings:`, JSON.stringify(activeAgent.settings, null, 2));
    } else {
      console.log('❌ No active agent found');
    }
    
  } catch (error) {
    console.error('❌ Failed to check agent config:', error);
  }
}

async function checkMailgunDomains(): Promise<void> {
  console.log('\n📧 CHECKING MAILGUN DOMAINS');
  console.log('===========================\n');
  
  try {
    // Check main domain
    const mainDomainResponse = await fetch(`https://api.mailgun.net/v3/domains/mg.watchdogai.us`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
      }
    });
    
    if (mainDomainResponse.ok) {
      const mainDomain = await mainDomainResponse.json();
      console.log('✅ Main Domain (mg.watchdogai.us):');
      console.log(`   State: ${mainDomain.domain?.state}`);
      console.log(`   Type: ${mainDomain.domain?.type}`);
    } else {
      console.log('❌ Main domain check failed');
    }
    
    // Check if Kunes subdomain still exists
    const kunesSubdomainResponse = await fetch(`https://api.mailgun.net/v3/domains/kunesmacomb.kunesauto.vip`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
      }
    });
    
    if (kunesSubdomainResponse.ok) {
      const kunesSubdomain = await kunesSubdomainResponse.json();
      console.log('\n⚠️  Kunes Subdomain (kunesmacomb.kunesauto.vip) STILL EXISTS:');
      console.log(`   State: ${kunesSubdomain.domain?.state}`);
      console.log(`   Type: ${kunesSubdomain.domain?.type}`);
      console.log('   This subdomain should be removed if no longer needed');
    } else {
      console.log('\n✅ Kunes subdomain (kunesmacomb.kunesauto.vip) not found - likely removed');
    }
    
    // List all domains
    const allDomainsResponse = await fetch(`https://api.mailgun.net/v3/domains`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
      }
    });
    
    if (allDomainsResponse.ok) {
      const allDomains = await allDomainsResponse.json();
      console.log('\n📋 ALL MAILGUN DOMAINS:');
      for (const domain of allDomains.items || []) {
        console.log(`   • ${domain.name} (${domain.state})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to check Mailgun domains:', error);
  }
}

async function checkCurrentEmailFlow(): Promise<void> {
  console.log('\n🔄 CHECKING CURRENT EMAIL FLOW');
  console.log('==============================\n');
  
  console.log('Current setup:');
  console.log(`   Production Mailgun Domain: ${process.env.MAILGUN_DOMAIN}`);
  console.log(`   AI responses sent from: noreply@${process.env.MAILGUN_DOMAIN}`);
  console.log(`   Webhook receives at: campaigns@${process.env.MAILGUN_DOMAIN}`);
  console.log('');
  
  // Test current email sending
  try {
    const testResponse = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: `AI Assistant <noreply@${process.env.MAILGUN_DOMAIN}>`,
        to: 'josh@atsglobal.ai',
        subject: 'Subdomain Check Test',
        text: 'This email confirms the current domain setup is working.'
      })
    });

    if (testResponse.ok) {
      console.log('✅ Current email flow is working');
      console.log('📧 Test email sent to josh@atsglobal.ai');
    } else {
      const error = await testResponse.text();
      console.log('❌ Current email flow failed:', error);
    }
  } catch (error) {
    console.log('❌ Email flow test error:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 SUBDOMAIN CONFIGURATION CHECK');
  console.log('=================================\n');
  
  await checkAgentConfig();
  await checkMailgunDomains();
  await checkCurrentEmailFlow();
  
  console.log('\n📋 SUMMARY:');
  console.log('===========');
  console.log('• Check if Kunes subdomain still exists in Mailgun');
  console.log('• Verify agent config is using correct domain');
  console.log('• Confirm current email flow is working');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
