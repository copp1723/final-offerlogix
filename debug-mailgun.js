#!/usr/bin/env node

/**
 * Debug Mailgun API issue - test different endpoints and regions
 */

import dotenv from 'dotenv';
dotenv.config();

async function testMailgunEndpoints() {
  console.log('🔍 Debugging Mailgun API Issue');
  console.log('================================');
  
  const domain = process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;
  
  console.log(`Domain: ${domain}`);
  console.log(`API Key: ${apiKey ? 'configured' : 'missing'}`);
  
  const regions = [
    { name: 'US', base: 'https://api.mailgun.net/v3' },
    { name: 'EU', base: 'https://api.eu.mailgun.net/v3' }
  ];
  
  for (const region of regions) {
    console.log(`\n=== Testing ${region.name} Region ===`);
    
    try {
      // Test 1: Account info
      console.log('🔍 Testing account info...');
      const accountUrl = `${region.base}/domains`;
      const accountResponse = await fetch(accountUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
        }
      });
      
      console.log(`Account endpoint: ${accountResponse.status} ${accountResponse.statusText}`);
      
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        console.log(`✅ Account accessible in ${region.name} region`);
        console.log(`Available domains: ${accountData.items?.length || 0}`);
        
        if (accountData.items?.length > 0) {
          console.log('Domains:');
          accountData.items.forEach((domain, idx) => {
            console.log(`  ${idx + 1}. ${domain.name} (${domain.state})`);
          });
          
          // Check if our domain is in the list
          const ourDomain = accountData.items.find(d => d.name === domain);
          if (ourDomain) {
            console.log(`✅ Found our domain: ${domain} (state: ${ourDomain.state})`);
          } else {
            console.log(`❌ Our domain ${domain} not found in this region`);
          }
        }
      } else {
        const errorText = await accountResponse.text().catch(() => '');
        console.log(`❌ Account not accessible: ${errorText}`);
      }
      
      // Test 2: Specific domain endpoint  
      console.log(`🔍 Testing specific domain endpoint...`);
      const domainUrl = `${region.base}/${domain}`;
      const domainResponse = await fetch(domainUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
        }
      });
      
      console.log(`Domain endpoint: ${domainResponse.status} ${domainResponse.statusText}`);
      
      if (domainResponse.ok) {
        const domainData = await domainResponse.json();
        console.log(`✅ Domain ${domain} accessible in ${region.name} region`);
        console.log(`Domain state: ${domainData.domain?.state || 'unknown'}`);
        console.log(`Domain type: ${domainData.domain?.type || 'unknown'}`);
        
        // Test 3: Message sending endpoint
        console.log(`🔍 Testing message endpoint...`);
        const messageUrl = `${region.base}/${domain}/messages`;
        
        // Just test if endpoint exists (don't send)
        const testBody = new URLSearchParams({
          from: process.env.MAILGUN_FROM_EMAIL,
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test'
        });
        
        // Use a HEAD request to test endpoint without sending
        const messageResponse = await fetch(messageUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: testBody
        });
        
        console.log(`Message endpoint: ${messageResponse.status} ${messageResponse.statusText}`);
        
        if (messageResponse.ok || messageResponse.status === 400) {
          // 400 is OK - means endpoint exists but validation failed (expected with test@example.com)
          console.log(`✅ Message endpoint accessible in ${region.name} region`);
        }
        
      } else {
        const errorText = await domainResponse.text().catch(() => '');
        console.log(`❌ Domain not accessible: ${errorText}`);
      }
      
    } catch (error) {
      console.log(`❌ Error testing ${region.name} region: ${error.message}`);
    }
  }
}

async function testApiKeyFormat() {
  console.log('\n=== API Key Format Test ===');
  const apiKey = process.env.MAILGUN_API_KEY;
  
  if (!apiKey) {
    console.log('❌ No API key provided');
    return;
  }
  
  console.log(`Key length: ${apiKey.length}`);
  console.log(`Key format: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  
  // Test if it looks like a valid Mailgun key
  if (apiKey.match(/^[a-f0-9]{32}-[a-f0-9]{8}-[a-f0-9]{8}$/)) {
    console.log('✅ API key format looks correct');
  } else {
    console.log('⚠️  API key format may be incorrect (expected: 32chars-8chars-8chars)');
  }
}

async function main() {
  await testApiKeyFormat();
  await testMailgunEndpoints();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});