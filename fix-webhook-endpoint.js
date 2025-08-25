#!/usr/bin/env node

// Test the webhook endpoint from Mailgun's perspective
async function fixWebhookEndpoint() {
  console.log('Testing webhook endpoint accessibility...');
  
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  
  // Test 1: Check if endpoint responds to HEAD request (what Mailgun might do)
  try {
    console.log('\n1. Testing HEAD request (Mailgun health check)...');
    const headResponse = await fetch(webhookUrl, { 
      method: 'HEAD',
      timeout: 5000
    });
    console.log(`HEAD Response: ${headResponse.status}`);
    
    if (headResponse.status === 404) {
      console.log('❌ Endpoint returns 404 - route not configured properly');
    } else if (headResponse.status >= 200 && headResponse.status < 300) {
      console.log('✅ Endpoint is accessible');
    } else if (headResponse.status === 405) {
      console.log('✅ Endpoint exists but only accepts POST (normal)');
    }
  } catch (error) {
    console.log('❌ HEAD request failed:', error.message);
    console.log('This could cause Mailgun to reject emails');
  }
  
  // Test 2: Check HTTPS certificate
  try {
    console.log('\n2. Testing HTTPS certificate...');
    const response = await fetch(webhookUrl, { method: 'GET' });
    console.log('✅ HTTPS certificate is valid');
  } catch (error) {
    if (error.message.includes('certificate')) {
      console.log('❌ HTTPS certificate issue:', error.message);
      console.log('Mailgun requires valid HTTPS for webhooks');
    }
  }
  
  // Test 3: Test with minimal POST payload
  try {
    console.log('\n3. Testing minimal POST (simulating Mailgun test)...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun Test'
      },
      body: 'sender=test@example.com&recipient=brittany@mail.offerlogix.me&subject=test'
    });
    
    console.log(`POST Response: ${response.status}`);
    const responseText = await response.text();
    
    if (response.status === 401) {
      console.log('⚠️  Webhook requires authentication (expected)');
    } else if (response.status === 500) {
      console.log('❌ Internal server error in webhook');
      console.log('This could cause Mailgun to reject emails');
    } else {
      console.log('Response preview:', responseText.substring(0, 200));
    }
    
  } catch (error) {
    console.log('❌ POST test failed:', error.message);
  }
  
  // Test 4: Check if the app is running
  try {
    console.log('\n4. Testing main application health...');
    const healthUrl = 'https://final-offerlogix.onrender.com/api/debug/ping';
    const response = await fetch(healthUrl);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Main application is running');
      console.log(`Environment: ${data.environment}`);
      console.log(`Database: ${data.databaseUrl ? 'Connected' : 'Not connected'}`);
    } else {
      console.log('❌ Main application health check failed');
    }
    
  } catch (error) {
    console.log('❌ Application health check failed:', error.message);
    console.log('If the app is down, Mailgun will reject emails');
  }
  
  console.log('\n--- DIAGNOSIS ---');
  console.log('Based on the 550 5.0.1 Recipient rejected error:');
  console.log('');
  console.log('1. Domain and DNS are configured correctly');
  console.log('2. Inbound route exists in Mailgun');
  console.log('3. The rejection is happening at delivery time');
  console.log('');
  console.log('Possible causes:');
  console.log('- Webhook endpoint is returning errors');
  console.log('- App is down or unresponsive');
  console.log('- Database connection issues');
  console.log('- OpenRouter API issues');
  console.log('');
  console.log('SOLUTION: Check application logs at:');
  console.log('https://dashboard.render.com -> final-offerlogix -> Logs');
}

fixWebhookEndpoint();