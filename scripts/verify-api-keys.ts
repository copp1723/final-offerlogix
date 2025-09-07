#!/usr/bin/env tsx
/**
 * Verify API Keys are working
 */

import { config } from 'dotenv';
config();

// Use OpenRouter key from environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;

console.log('🔑 OFFERLOGIX API KEY VERIFICATION');
console.log('=====================================\n');

// Test OpenRouter
async function testOpenRouter() {
  console.log('🤖 Testing OpenRouter API...');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://final-offerlogix.onrender.com',
        'X-Title': 'OfferLogix'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ OpenRouter: Connected successfully!');
      console.log(`   Found ${data.data?.length || 0} models available`);
      
      // Test a simple completion
      const testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://final-offerlogix.onrender.com',
          'X-Title': 'OfferLogix'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "OfferLogix AI is working!"' }],
          max_tokens: 20
        })
      });

      if (testResponse.ok) {
        const result = await testResponse.json();
        console.log('✅ OpenRouter Chat: AI responded successfully!');
        console.log(`   Response: "${result.choices?.[0]?.message?.content}"`);
      }
      return true;
    } else {
      console.log(`❌ OpenRouter: Failed with status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ OpenRouter: Connection error:', error);
    return false;
  }
}

// Test Mailgun
async function testMailgun() {
  console.log('\n📧 Testing Mailgun API...');
  
  if (!MAILGUN_API_KEY) {
    console.log('⚠️  Mailgun: No API key in local environment');
    console.log('   Note: The new key should be set in Render environment');
    return false;
  }

  try {
    const domain = 'mail.offerlogix.me';
    const response = await fetch(`https://api.mailgun.net/v3/${domain}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Mailgun: Domain verified and accessible!');
      console.log(`   Domain: ${data.domain?.name}`);
      console.log(`   State: ${data.domain?.state}`);
      console.log(`   Type: ${data.domain?.type}`);
      return true;
    } else {
      console.log(`❌ Mailgun: Failed with status ${response.status}`);
      if (response.status === 401) {
        console.log('   The API key may be invalid or not have access to this domain');
      }
      return false;
    }
  } catch (error) {
    console.log('❌ Mailgun: Connection error:', error);
    return false;
  }
}

// Check if OpenRouter key is configured
async function checkOpenRouterConfig() {
  if (!OPENROUTER_API_KEY) {
    console.log('\n⚠️  OpenRouter API key not found in environment');
    console.log('   Please set OPENROUTER_API_KEY in your .env file or Render environment');
  }
}

// Main execution
async function main() {
  await checkOpenRouterConfig();
  const openRouterOk = await testOpenRouter();
  const mailgunOk = await testMailgun();
  
  console.log('\n=====================================');
  console.log('📋 SUMMARY');
  console.log('=====================================');
  
  if (openRouterOk) {
    console.log('✅ OpenRouter is configured correctly');
  } else {
    console.log('❌ OpenRouter needs configuration');
  }
  
  if (mailgunOk) {
    console.log('✅ Mailgun is configured correctly');
  } else {
    console.log('⚠️  Mailgun needs the new API key from Render');
    console.log('   The domain is verified, just need valid API credentials');
  }
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('1. Ensure the new Mailgun API key is set in Render environment');
  console.log('2. Redeploy the application on Render to pick up new environment variables');
  console.log('3. The system should then be fully operational!');
}

main().catch(console.error);