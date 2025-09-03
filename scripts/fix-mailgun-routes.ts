#!/usr/bin/env tsx

/**
 * Fix Mailgun Routes Script
 * Adds missing routes for campaigns@kunesmacomb.kunesauto.vip
 */

import fetch from 'node-fetch';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const WEBHOOK_URL = 'https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound';

interface MailgunRoute {
  id: string;
  priority: number;
  description: string;
  expression: string;
  actions: string[];
  created_at: string;
}

async function createMailgunRoute(
  expression: string,
  actions: string[],
  description: string,
  priority: number = 0
): Promise<boolean> {
  if (!MAILGUN_API_KEY) {
    console.error('❌ MAILGUN_API_KEY not set');
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('priority', priority.toString());
    formData.append('description', description);
    formData.append('expression', expression);
    actions.forEach(action => formData.append('action', action));

    const response = await fetch('https://api.mailgun.net/v3/routes', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (response.ok) {
      const result = await response.json() as { route: MailgunRoute };
      console.log(`✅ Route created successfully:`);
      console.log(`   Expression: ${result.route.expression}`);
      console.log(`   Actions: ${result.route.actions.join(', ')}`);
      console.log(`   ID: ${result.route.id}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to create route: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error creating route:', error);
    return false;
  }
}

async function listExistingRoutes(): Promise<MailgunRoute[]> {
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

async function checkRouteExists(expression: string): Promise<boolean> {
  const routes = await listExistingRoutes();
  return routes.some(route => route.expression === expression);
}

async function main(): Promise<void> {
  console.log('🔧 Fixing Mailgun Routes for Kunes Auto Group');
  console.log('===============================================\n');

  if (!MAILGUN_API_KEY) {
    console.error('❌ MAILGUN_API_KEY not set. Please set the environment variable.');
    return;
  }

  // Routes to create
  const routesToCreate = [
    {
      expression: 'match_recipient("campaigns@kunesmacomb.kunesauto.vip")',
      actions: [`forward("${WEBHOOK_URL}")`, 'stop()'],
      description: 'Forward campaigns@kunesmacomb.kunesauto.vip to MailMind webhook'
    },
    {
      expression: 'match_recipient(".*@kunesmacomb.kunesauto.vip")',
      actions: [`forward("${WEBHOOK_URL}")`, 'stop()'],
      description: 'Forward all emails to kunesmacomb.kunesauto.vip to MailMind webhook'
    }
  ];

  console.log('📋 Checking existing routes...\n');

  for (const route of routesToCreate) {
    const exists = await checkRouteExists(route.expression);
    
    if (exists) {
      console.log(`✅ Route already exists: ${route.expression}`);
    } else {
      console.log(`➕ Creating route: ${route.expression}`);
      const success = await createMailgunRoute(
        route.expression,
        route.actions,
        route.description
      );
      
      if (success) {
        console.log(`✅ Successfully created route for ${route.expression}\n`);
      } else {
        console.log(`❌ Failed to create route for ${route.expression}\n`);
      }
    }
  }

  console.log('🎯 Route creation complete!');
  console.log('\n📧 You can now send emails to:');
  console.log('   • campaigns@kunesmacomb.kunesauto.vip');
  console.log('   • Any email address @kunesmacomb.kunesauto.vip');
  console.log('\n🔄 These will be forwarded to your webhook endpoint for processing.');
}

// Run the main function
main().catch(console.error);
