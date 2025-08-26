#!/usr/bin/env node

// Check recent webhook attempts to see what's failing
import crypto from 'crypto';

async function checkRecentWebhookStatus() {
  console.log('Checking recent webhook attempts...');
  
  const WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  
  // Test multiple scenarios to see what's happening
  
  console.log('\n1. Testing basic connectivity...');
  try {
    const pingResponse = await fetch('https://final-offerlogix.onrender.com/api/debug/ping');
    const pingData = await pingResponse.json();
    console.log(`✅ App is running: ${pingData.status} (${pingData.environment})`);
  } catch (error) {
    console.log('❌ App connectivity failed:', error.message);
  }
  
  console.log('\n2. Testing webhook endpoint accessibility...');
  try {
    const headResponse = await fetch(webhookUrl, { method: 'HEAD' });
    console.log(`✅ Webhook endpoint accessible: ${headResponse.status}`);
  } catch (error) {
    console.log('❌ Webhook endpoint failed:', error.message);
  }
  
  console.log('\n3. Testing webhook with minimal payload...');
  const timestamp = Math.floor(Date.now() / 1000);
  const token = 'test-minimal-' + Math.random().toString(36).substr(2, 6);
  const signature = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
  
  const minimalPayload = new URLSearchParams({
    'sender': 'test@example.com',
    'recipient': 'brittany@mail.offerlogix.me',
    'subject': 'Minimal test',
    'body-plain': 'Test',
    'stripped-text': 'Test',
    'message-headers': '[]',
    'timestamp': timestamp.toString(),
    'token': token,
    'signature': signature
  });
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Debug-Test'
      },
      body: minimalPayload
    });
    
    const responseText = await response.text();
    console.log(`Response: ${response.status}`);
    
    if (response.status === 500) {
      console.log('❌ Still getting 500 error');
      console.log('Response body:', responseText);
      
      // The issue might be:
      console.log('\n🔍 Possible issues:');
      console.log('1. New deployment not yet active');
      console.log('2. Database schema mismatch'); 
      console.log('3. OpenRouter API issue');
      console.log('4. Missing environment variables');
      console.log('5. Code compilation error');
      
    } else if (response.status === 200) {
      console.log('✅ Success! Webhook is now working');
      try {
        const data = JSON.parse(responseText);
        console.log('Response:', data.message);
      } catch (e) {
        console.log('Success response received');
      }
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
      console.log('Response:', responseText.substring(0, 200));
    }
    
  } catch (error) {
    console.log('❌ Webhook test failed:', error.message);
  }
  
  console.log('\n--- STATUS SUMMARY ---');
  console.log('If still getting 500 errors:');
  console.log('1. Check Render deployment status');
  console.log('2. View recent logs in Render dashboard');
  console.log('3. Look for specific error messages');
  console.log('4. Verify environment variables are set correctly');
}

checkRecentWebhookStatus();