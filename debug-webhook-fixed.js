#!/usr/bin/env node

// Debug the actual webhook error - fixed version
import crypto from 'crypto';

async function debugWebhookError() {
  console.log('Debugging webhook processing error...');
  
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  const WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
  
  // Create a proper test payload
  const timestamp = Math.floor(Date.now() / 1000);
  const token = 'test-token-' + Math.random().toString(36).substr(2, 9);
  
  // Generate signature exactly as Mailgun does it
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
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun/Debug-Test'
      },
      body: formData
    });
    
    const responseText = await response.text();
    
    console.log(`Response Status: ${response.status}`);
    console.log('Response Body:', responseText.substring(0, 1000));
    
    if (response.status === 500) {
      console.log('\n❌ FOUND THE ISSUE: 500 Internal Server Error');
      console.log('This is exactly why Mailgun is rejecting emails with 550!');
      console.log('');
      console.log('When Mailgun tries to deliver an email to your webhook');
      console.log('and gets a 500 error, it marks the recipient as invalid');
      console.log('and returns "550 5.0.1 Recipient rejected" to the sender.');
      console.log('');
      console.log('🔧 TO FIX THIS:');
      console.log('1. Check your Render app logs for the exact error');
      console.log('2. Common issues:');
      console.log('   - Database connection failure');
      console.log('   - Missing tables/columns');
      console.log('   - OpenRouter API timeout');
      console.log('   - Invalid environment variables');
      console.log('3. Once fixed, emails should start working immediately');
      
    } else if (response.status === 200) {
      console.log('\n✅ Webhook is working correctly!');
      try {
        const data = JSON.parse(responseText);
        console.log('Result:', data.message);
      } catch (e) {
        console.log('Webhook processed successfully');
      }
      console.log('\nIf webhook is working now, try sending another email.');
      console.log('The 550 error might have been temporary.');
      
    } else {
      console.log(`\n⚠️  Unexpected status: ${response.status}`);
      console.log('This could also cause email delivery issues.');
    }
    
  } catch (error) {
    console.error('\n💥 Network error:', error.message);
    console.log('Network issues can also cause Mailgun to reject emails');
  }
  
  console.log('\n--- NEXT STEPS ---');
  console.log('1. Go to https://dashboard.render.com');
  console.log('2. Find your "final-offerlogix" service');
  console.log('3. Click "Logs" to see recent errors');
  console.log('4. Look for errors that happened when Mailgun tried to deliver');
  console.log('5. Fix the server-side error');
  console.log('6. Test sending an email again');
  console.log('');
  console.log('The 550 rejection is definitely a webhook processing issue,');
  console.log('not a DNS or routing problem.');
}

debugWebhookError();