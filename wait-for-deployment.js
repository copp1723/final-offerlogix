#!/usr/bin/env node

// Wait for deployment and test the webhook periodically
async function waitForDeployment() {
  console.log('Waiting for Render deployment to complete...');
  console.log('The code changes have been pushed to GitHub.');
  console.log('Render should automatically redeploy the application.');
  console.log('');
  
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes with 10 second intervals
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Attempt ${attempts}/${maxAttempts} - Testing webhook...`);
    
    try {
      const testResult = await testWebhook();
      
      if (testResult.status === 200) {
        console.log('\n🎉 SUCCESS! Deployment is complete and webhook is working!');
        console.log('You can now try sending an email to brittany@mail.offerlogix.me');
        return;
      } else if (testResult.status === 500) {
        console.log(`Still getting 500 error. Waiting for deployment...`);
      } else {
        console.log(`Status: ${testResult.status} - Still deploying...`);
      }
      
    } catch (error) {
      console.log(`Network error: ${error.message}`);
    }
    
    if (attempts < maxAttempts) {
      console.log('Waiting 10 seconds before next attempt...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log('\n⏰ Timeout waiting for deployment.');
  console.log('Please check the Render dashboard for deployment status:');
  console.log('https://dashboard.render.com -> final-offerlogix -> Deployments');
}

async function testWebhook() {
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  const WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
  
  // Create test payload
  const timestamp = Math.floor(Date.now() / 1000);
  const token = 'deployment-test-' + Math.random().toString(36).substr(2, 9);
  
  const crypto = await import('crypto');
  const signature = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
  
  const formData = new URLSearchParams({
    'sender': 'josh@atsglobal.ai',
    'recipient': 'brittany@mail.offerlogix.me', 
    'subject': 'Deployment Test',
    'body-plain': 'Testing after deployment fix.',
    'stripped-text': 'Testing after deployment fix.',
    'message-headers': JSON.stringify([
      ['Message-Id', '<deployment-test@atsglobal.ai>']
    ]),
    'timestamp': timestamp.toString(),
    'token': token,
    'signature': signature
  });
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Deployment-Test'
    },
    body: formData,
    timeout: 10000
  });
  
  return { status: response.status, body: await response.text() };
}

waitForDeployment();