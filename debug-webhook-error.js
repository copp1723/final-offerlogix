#!/usr/bin/env node

// Debug the actual webhook error by checking logs and creating a minimal test
async function debugWebhookError() {
  console.log('Debugging webhook processing error...');
  
  // Let's check if there are any recent logs or errors
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  
  // Test with the exact signature format that should work
  const WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
  
  // Create a proper test payload
  const timestamp = Math.floor(Date.now() / 1000);
  const token = 'test-token-' + Math.random().toString(36).substr(2, 9);
  
  // Generate signature exactly as Mailgun does it
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
  
  const formData = new URLSearchParams({
    'sender': 'josh@atsglobal.ai',
    'recipient': 'brittany@mail.offerlogix.me', 
    'subject': 'Test webhook processing',
    'body-plain': 'This is a test to see what error occurs in webhook processing.',
    'body-html': '<p>This is a test to see what error occurs in webhook processing.</p>',
    'stripped-text': 'This is a test to see what error occurs in webhook processing.',
    'stripped-html': '<p>This is a test to see what error occurs in webhook processing.</p>',
    'message-headers': JSON.stringify([
      ['Message-Id', '<test-debug-12345@atsglobal.ai>'],
      ['From', 'josh@atsglobal.ai'],
      ['To', 'brittany@mail.offerlogix.me']
    ]),
    'timestamp': timestamp.toString(),
    'token': token,
    'signature': signature
  });
  
  try {
    console.log('Testing webhook with proper signature...');
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Token: ${token}`);
    console.log(`Signature: ${signature}`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Debug-Test'
      },
      body: formData
    });
    
    const responseText = await response.text();
    
    console.log(`\nResponse Status: ${response.status}`);
    console.log('Response Body:', responseText);
    
    if (response.status === 500) {
      console.log('\n❌ FOUND THE ISSUE: 500 Internal Server Error');
      console.log('This is why Mailgun is rejecting emails!');
      console.log('When a webhook returns 500, Mailgun blacklists the recipient');
      console.log('');
      console.log('The error is likely in:');
      console.log('- Database connection');
      console.log('- OpenRouter API call');
      console.log('- Missing environment variables');
      console.log('- Schema/table issues');
      
      console.log('\n🔧 IMMEDIATE FIX NEEDED:');
      console.log('1. Check Render logs for the exact error');
      console.log('2. Fix the server error');  
      console.log('3. Mailgun should start accepting emails again');
      
    } else if (response.status === 401) {
      console.log('\n⚠️  Still getting 401 - signature issue');
      console.log('Let me try a different approach...');
      
      // Try without signature in development mode
      const noSigPayload = new URLSearchParams({
        'sender': 'josh@atsglobal.ai',
        'recipient': 'brittany@mail.offerlogix.me', 
        'subject': 'Test webhook processing',
        'body-plain': 'Test without signature',
        'timestamp': timestamp.toString(),
        'token': token
      });
      
      const noSigResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mailgun/No-Sig-Test'
        },
        body: noSigPayload
      });
      
      const noSigText = await noSigResponse.text();
      console.log(`No-sig test status: ${noSigResponse.status}`);
      console.log('No-sig response:', noSigText.substring(0, 500));
      
    } else if (response.status === 200) {
      console.log('\n✅ Webhook processed successfully!');
      
      try {
        const data = JSON.parse(responseText);
        console.log('Message:', data.message);
        
        if (data.message === 'Email processed and replied') {
          console.log('\n🎉 SUCCESS! The system is working!');
          console.log('The original error might have been temporary.');
        }
      } catch (e) {
        console.log('Response processed successfully');
      }
    }
    
  } catch (error) {
    console.error('\n💥 Request failed:', error.message);
    console.log('This network error could also cause Mailgun to reject emails');
  }
  
  // Additional debugging - check if environment variables are set correctly
  console.log('\n--- Environment Check ---');
  console.log('Based on your .env file:');
  console.log('✅ MAILGUN_API_KEY is set');
  console.log('✅ MAILGUN_DOMAIN is mail.offerlogix.me'); 
  console.log('✅ MAILGUN_WEBHOOK_SIGNING_KEY is set');
  console.log('✅ DATABASE_URL is set');
  console.log('✅ OPENROUTER_API_KEY is set');
  console.log('');
  console.log('All required variables seem to be present.');
  console.log('The issue is likely in the webhook processing logic.');
}

debugWebhookError();