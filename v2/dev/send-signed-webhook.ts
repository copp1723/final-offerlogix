#!/usr/bin/env ts-node

/**
 * Send Signed Webhook - Development Script
 * 
 * Sends a properly signed Mailgun webhook to a local server for testing.
 * Useful for testing webhook endpoints during development.
 */

import { createTestWebhookPayload, loadFixtureByScenario } from '../tests/helpers/fixture-loader';
import { createWebhookRequest } from '../tests/helpers/mailgun-signer';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:3000',
  webhookPath: '/v2/inbound/mailgun',
  signingKey: process.env.MAILGUN_SIGNING_KEY || 'dev-signing-key-12345',
  scenario: 'new-thread',
};

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function sendSignedWebhook(options: {
  serverUrl?: string;
  webhookPath?: string;
  signingKey?: string;
  scenario?: string;
  verbose?: boolean;
} = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  console.log('🚀 Sending signed webhook to local server...\n');
  
  try {
    // Load the fixture for the specified scenario
    console.log(`📋 Loading fixture for scenario: ${config.scenario}`);
    const fixture = loadFixtureByScenario(config.scenario, config.signingKey);
    
    if (!fixture) {
      throw new Error(`No fixture found for scenario: ${config.scenario}`);
    }
    
    console.log(`✅ Loaded fixture: ${fixture.name}`);
    
    // Create the signed webhook payload
    console.log('🔐 Creating signed webhook payload...');
    const webhookPayload = createTestWebhookPayload(config.scenario, config.signingKey);
    
    if (config.verbose) {
      console.log('\n📦 Webhook Payload:');
      console.log(JSON.stringify(webhookPayload, null, 2));
    }
    
    // Send the webhook
    const url = `${config.serverUrl}${config.webhookPath}`;
    console.log(`📡 Sending POST request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mailgun/Dev-Script',
      },
      body: JSON.stringify(webhookPayload),
    });
    
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Webhook sent successfully!');
      
      const responseText = await response.text();
      if (responseText && config.verbose) {
        console.log('\n📄 Response Body:');
        console.log(responseText);
      }
    } else {
      console.log('❌ Webhook failed');
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Error sending webhook:', error);
    process.exit(1);
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function printUsage() {
  console.log(`
Usage: npx ts-node v2/dev/send-signed-webhook.ts [options]

Options:
  --server-url <url>     Server URL (default: http://localhost:3000)
  --webhook-path <path>  Webhook endpoint path (default: /v2/inbound/mailgun)
  --signing-key <key>    Mailgun signing key (default: from env or dev key)
  --scenario <name>      Fixture scenario to use (default: new-thread)
  --verbose              Show detailed output
  --help                 Show this help message

Available scenarios:
  - new-thread           Lead's first reply (new conversation)
  - deep-thread          3rd hop in conversation chain
  - edge-cases           Various edge cases and malformed data

Examples:
  # Send basic new thread webhook
  npx ts-node v2/dev/send-signed-webhook.ts

  # Send deep thread webhook with verbose output
  npx ts-node v2/dev/send-signed-webhook.ts --scenario deep-thread --verbose

  # Send to different server
  npx ts-node v2/dev/send-signed-webhook.ts --server-url http://localhost:8080
`);
}

// Parse command line arguments
function parseArgs(): any {
  const args = process.argv.slice(2);
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
        
      case '--server-url':
        options.serverUrl = args[++i];
        break;
        
      case '--webhook-path':
        options.webhookPath = args[++i];
        break;
        
      case '--signing-key':
        options.signingKey = args[++i];
        break;
        
      case '--scenario':
        options.scenario = args[++i];
        break;
        
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
        
      default:
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }
  
  return options;
}

// Run the script if called directly
if (require.main === module) {
  const options = parseArgs();
  sendSignedWebhook(options).catch(console.error);
}

export { sendSignedWebhook };
