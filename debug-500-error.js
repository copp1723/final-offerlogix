#!/usr/bin/env node

// Debug the 500 error by testing different scenarios
import crypto from 'crypto';

async function debug500Error() {
  console.log('🔍 Debugging the 500 error in webhook...');
  
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  const WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
  
  // Test 1: Very minimal payload
  console.log('\n1. Testing with minimal payload...');
  const timestamp1 = Math.floor(Date.now() / 1000);
  const token1 = 'minimal-test';
  const signature1 = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
    .update(timestamp1 + token1)
    .digest('hex');
  
  const minimalPayload = new URLSearchParams({
    'sender': 'test@example.com',
    'recipient': 'brittany@mail.offerlogix.me',
    'subject': 'Test',
    'body-plain': 'Hello',
    'stripped-text': 'Hello',
    'message-headers': '[]',
    'timestamp': timestamp1.toString(),
    'token': token1,
    'signature': signature1
  });
  
  try {
    const response1 = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Debug-Minimal'
      },
      body: minimalPayload
    });
    
    const text1 = await response1.text();
    console.log(`Minimal test: ${response1.status}`);
    if (response1.status !== 200) {
      console.log(`Error: ${text1}`);
    } else {
      console.log('✅ Minimal payload works!');
    }
    
  } catch (error) {
    console.log('❌ Minimal test failed:', error.message);
  }
  
  // Test 2: Check if the issue is with lead creation
  console.log('\n2. Testing with known sender...');
  const timestamp2 = Math.floor(Date.now() / 1000);
  const token2 = 'known-sender';
  const signature2 = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
    .update(timestamp2 + token2)
    .digest('hex');
  
  const knownSenderPayload = new URLSearchParams({
    'sender': 'josh@atsglobal.ai',  // This should match domain suffix
    'recipient': 'brittany@mail.offerlogix.me',
    'subject': 'Simple test',
    'body-plain': 'Quick test message',
    'stripped-text': 'Quick test message',
    'message-headers': JSON.stringify([['From', 'josh@atsglobal.ai']]),
    'timestamp': timestamp2.toString(),
    'token': token2,
    'signature': signature2
  });
  
  try {
    const response2 = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Debug-KnownSender'
      },
      body: knownSenderPayload
    });
    
    const text2 = await response2.text();
    console.log(`Known sender test: ${response2.status}`);
    if (response2.status !== 200) {
      console.log(`Error: ${text2}`);
    } else {
      console.log('✅ Known sender works!');
      try {
        const data = JSON.parse(text2);
        console.log(`Result: ${data.message}`);
      } catch (e) {
        console.log('Success response received');
      }
    }
    
  } catch (error) {
    console.log('❌ Known sender test failed:', error.message);
  }
  
  // Test 3: Check database connectivity
  console.log('\n3. Testing database connectivity...');
  try {
    const dbTest = await fetch('https://final-offerlogix.onrender.com/api/debug/database');
    const dbData = await dbTest.json();
    console.log(`Database: ${dbData.status}`);
    if (dbData.status === 'connected') {
      console.log('✅ Database is working');
    } else {
      console.log('❌ Database issue');
    }
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  }
  
  console.log('\n--- DIAGNOSIS ---');
  console.log('The 500 error suggests:');
  console.log('1. Code deployment might not be complete');
  console.log('2. There might be a different database constraint issue');
  console.log('3. Environment variables might be missing');
  console.log('4. OpenRouter API call might be failing');
  console.log('5. Some dependency might be missing');
  console.log('');
  console.log('Next steps:');
  console.log('1. Check Render deployment status');
  console.log('2. Verify all environment variables are set');
  console.log('3. Check for any remaining database constraint issues');
  console.log('4. Look at recent deployment logs');
}

debug500Error();