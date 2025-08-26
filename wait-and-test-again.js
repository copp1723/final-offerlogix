#!/usr/bin/env node

// Wait for deployment and test webhook again
import crypto from 'crypto';

async function waitAndTest() {
  console.log('⏰ Waiting for deployment to complete...');
  console.log('The rebuild has been triggered. Waiting 2 minutes for deployment...');
  
  // Wait 2 minutes for deployment
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  console.log('\n🔍 Testing webhook after forced rebuild...');
  
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  const WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
  
  const timestamp = Math.floor(Date.now() / 1000);
  const token = 'post-rebuild-test';
  const signature = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
  
  const testPayload = new URLSearchParams({
    'sender': 'josh@atsglobal.ai',
    'recipient': 'brittany@mail.offerlogix.me',
    'subject': 'Post-rebuild test',
    'body-plain': 'Testing webhook after forced rebuild deployment.',
    'stripped-text': 'Testing webhook after forced rebuild deployment.',
    'message-headers': JSON.stringify([['From', 'josh@atsglobal.ai']]),
    'timestamp': timestamp.toString(),
    'token': token,
    'signature': signature
  });
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Post-Rebuild-Test'
      },
      body: testPayload
    });
    
    const responseText = await response.text();
    
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${responseText}`);
    
    if (response.status === 200) {
      console.log('\n🎉 SUCCESS! Webhook is now working after rebuild!');
      
      try {
        const data = JSON.parse(responseText);
        if (data.message === 'Email processed and replied') {
          console.log('✅ AI should have sent a response!');
          console.log('Check your inbox (josh@atsglobal.ai) for the AI reply.');
          
          // Now send a real test email
          console.log('\n📧 Sending real test email to verify end-to-end flow...');
          await sendRealTestEmail();
          
        } else {
          console.log(`Result: ${data.message}`);
        }
      } catch (e) {
        console.log('Success response received');
      }
      
    } else if (response.status === 500) {
      console.log('\n❌ Still getting 500 error after rebuild');
      console.log('The issue may be deeper than deployment. Could be:');
      console.log('1. OpenRouter API call failing');
      console.log('2. Database schema mismatch');
      console.log('3. Missing environment variables');
      console.log('4. Code logic error in AI processing');
      
    } else {
      console.log(`\n⚠️  Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
  }
}

async function sendRealTestEmail() {
  const MAILGUN_API_KEY = 'f710691aaf88ffc683699386bcadb2e5-97129d72-433bb02c';
  const fromDomain = 'veeotto.ai';
  
  const emailData = {
    from: 'josh@atsglobal.ai',
    to: 'brittany@mail.offerlogix.me',
    subject: 'Testing OfferLogix AI Response System',
    text: `Hi Brittany,

I'm testing the OfferLogix two-way conversation system.

I manage digital marketing for several automotive dealerships and I'm interested in learning more about how OfferLogix handles payment advertising compliance.

Could you tell me more about your solution?

Thanks!
Josh`
  };
  
  const body = new URLSearchParams({
    from: `Josh <${emailData.from}>`,
    to: emailData.to,
    subject: emailData.subject,
    text: emailData.text,
    'h:Reply-To': emailData.from
  });

  const url = `https://api.mailgun.net/v3/${fromDomain}/messages`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Real email sent! Message ID: ${data.id}`);
      console.log('⏰ Check your inbox in 1-2 minutes for AI response!');
    } else {
      console.log('❌ Failed to send real email');
    }
    
  } catch (error) {
    console.log('❌ Real email send failed:', error.message);
  }
}

waitAndTest();