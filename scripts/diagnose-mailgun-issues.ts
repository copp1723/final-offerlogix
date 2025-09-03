#!/usr/bin/env tsx

/**
 * Mailgun Issues Diagnostic Script
 * Diagnoses email delivery and webhook authentication issues
 */

import crypto from 'crypto';
import fetch from 'node-fetch';

// Environment variables
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const WEBHOOK_URL = 'https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound';

interface MailgunDomain {
  name: string;
  state: string;
  smtp_login: string;
  smtp_password: string;
  wildcard: boolean;
  spam_action: string;
  created_at: string;
  receiving_dns_records?: any[];
  sending_dns_records?: any[];
}

interface MailgunRoute {
  id: string;
  priority: number;
  description: string;
  expression: string;
  actions: string[];
  created_at: string;
}

async function checkMailgunAuth(): Promise<boolean> {
  if (!MAILGUN_API_KEY) {
    console.error('❌ MAILGUN_API_KEY not set');
    return false;
  }

  try {
    const response = await fetch('https://api.mailgun.net/v3/domains', {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      console.log('✅ Mailgun API authentication successful');
      return true;
    } else {
      console.error(`❌ Mailgun API authentication failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Mailgun API connection error:', error);
    return false;
  }
}

async function listMailgunDomains(): Promise<MailgunDomain[]> {
  if (!MAILGUN_API_KEY) return [];

  try {
    const response = await fetch('https://api.mailgun.net/v3/domains', {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json() as { items: MailgunDomain[] };
      return data.items || [];
    }
  } catch (error) {
    console.error('Error fetching domains:', error);
  }
  return [];
}

async function checkDomainConfiguration(domain: string): Promise<void> {
  if (!MAILGUN_API_KEY) return;

  try {
    const response = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const domainData = await response.json() as { domain: MailgunDomain };
      console.log(`\n📧 Domain: ${domain}`);
      console.log(`   State: ${domainData.domain.state}`);
      console.log(`   Wildcard: ${domainData.domain.wildcard}`);
      console.log(`   Spam Action: ${domainData.domain.spam_action}`);
      
      if (domainData.domain.receiving_dns_records) {
        console.log('   📥 Receiving DNS Records:');
        domainData.domain.receiving_dns_records.forEach(record => {
          console.log(`      ${record.record_type}: ${record.name} -> ${record.value}`);
        });
      }
    } else {
      console.error(`❌ Domain ${domain} not found or not accessible`);
    }
  } catch (error) {
    console.error(`Error checking domain ${domain}:`, error);
  }
}

async function listMailgunRoutes(): Promise<MailgunRoute[]> {
  if (!MAILGUN_API_KEY) return [];

  try {
    const response = await fetch('https://api.mailgun.net/v3/routes', {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json() as { items: MailgunRoute[] };
      return data.items || [];
    }
  } catch (error) {
    console.error('Error fetching routes:', error);
  }
  return [];
}

function generateWebhookSignature(timestamp: string, token: string): string {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    throw new Error('MAILGUN_WEBHOOK_SIGNING_KEY not set');
  }

  return crypto
    .createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
}

async function testWebhookSignature(): Promise<void> {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.error('❌ MAILGUN_WEBHOOK_SIGNING_KEY not set');
    return;
  }

  console.log('\n🔐 Testing Webhook Signature Generation:');
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'test-token-' + Math.random().toString(36).substring(7);
  
  try {
    const signature = generateWebhookSignature(timestamp, token);
    console.log(`✅ Signature generated successfully`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Token: ${token}`);
    console.log(`   Signature: ${signature}`);
    console.log(`   Signing Key: ${MAILGUN_WEBHOOK_SIGNING_KEY.substring(0, 8)}...`);
  } catch (error) {
    console.error('❌ Signature generation failed:', error);
  }
}

async function testWebhookEndpoint(): Promise<void> {
  console.log('\n🌐 Testing Webhook Endpoint Accessibility:');
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET',
      timeout: 10000
    });
    
    console.log(`📡 Webhook endpoint response: ${response.status} ${response.statusText}`);
    
    if (response.status === 404) {
      console.log('✅ Endpoint is accessible (404 expected for GET request)');
    } else if (response.status === 405) {
      console.log('✅ Endpoint is accessible (405 Method Not Allowed expected for GET request)');
    } else {
      console.log(`⚠️  Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Webhook endpoint not accessible:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 Mailgun Issues Diagnostic Report');
  console.log('=====================================\n');

  // Check basic configuration
  console.log('📋 Environment Configuration:');
  console.log(`   MAILGUN_API_KEY: ${MAILGUN_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   MAILGUN_DOMAIN: ${MAILGUN_DOMAIN || '❌ Not set'}`);
  console.log(`   MAILGUN_WEBHOOK_SIGNING_KEY: ${MAILGUN_WEBHOOK_SIGNING_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   WEBHOOK_URL: ${WEBHOOK_URL}`);

  // Test Mailgun authentication
  console.log('\n🔑 Testing Mailgun Authentication:');
  const authSuccess = await checkMailgunAuth();
  
  if (!authSuccess) {
    console.log('\n❌ Cannot proceed with domain checks due to authentication failure');
    return;
  }

  // List all domains
  console.log('\n📧 Configured Mailgun Domains:');
  const domains = await listMailgunDomains();
  
  if (domains.length === 0) {
    console.log('❌ No domains found');
  } else {
    domains.forEach(domain => {
      console.log(`   • ${domain.name} (${domain.state})`);
    });
  }

  // Check specific domains
  const domainsToCheck = [
    'mg.watchdogai.us',
    'kunesmacomb.kunesauto.vip',
    'kunesauto.vip'
  ];

  for (const domain of domainsToCheck) {
    await checkDomainConfiguration(domain);
  }

  // List routes
  console.log('\n🛣️  Configured Mailgun Routes:');
  const routes = await listMailgunRoutes();
  
  if (routes.length === 0) {
    console.log('❌ No routes found');
  } else {
    routes.forEach(route => {
      console.log(`   • ${route.expression}`);
      console.log(`     Actions: ${route.actions.join(', ')}`);
    });
  }

  // Test webhook signature
  await testWebhookSignature();

  // Test webhook endpoint
  await testWebhookEndpoint();

  console.log('\n📋 Recommendations:');
  
  // Check if kunesmacomb.kunesauto.vip is configured
  const kunesmacomDomain = domains.find(d => d.name === 'kunesmacomb.kunesauto.vip');
  if (!kunesmacomDomain) {
    console.log('❌ Domain kunesmacomb.kunesauto.vip is NOT configured in Mailgun');
    console.log('   → Add this domain to your Mailgun account');
    console.log('   → Configure DNS records as specified in kunesauto-vip-dns-setup.md');
  }

  // Check for routes handling campaigns@kunesmacomb.kunesauto.vip
  const campaignRoute = routes.find(r => 
    r.expression.includes('campaigns@kunesmacomb.kunesauto.vip') ||
    r.expression.includes('kunesmacomb.kunesauto.vip')
  );
  
  if (!campaignRoute) {
    console.log('❌ No route found for campaigns@kunesmacomb.kunesauto.vip');
    console.log('   → Create a Mailgun route to forward emails to the webhook endpoint');
  }

  console.log('\n✅ Diagnostic complete');
}

// Run the main function
main().catch(console.error);
