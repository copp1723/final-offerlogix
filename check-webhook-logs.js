#!/usr/bin/env node

// Check what's happening with the webhook processing
import crypto from 'crypto';

async function checkWebhookProcessing() {
  console.log('🔍 Investigating why AI response wasn\'t received...');
  
  const webhookUrl = 'https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound';
  const WEBHOOK_SIGNING_KEY = '31420435df8ff885a971b2eab64ba00e';
  
  // Create a test that simulates the exact email that was sent
  const timestamp = Math.floor(Date.now() / 1000);
  const token = 'investigation-' + Math.random().toString(36).substr(2, 6);
  const signature = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
  
  const testPayload = new URLSearchParams({
    'sender': 'josh@atsglobal.ai',
    'recipient': 'brittany@mail.offerlogix.me',
    'subject': 'OfferLogix Payment Solutions - Quick Question',
    'body-plain': `Hi,

I manage marketing for several dealerships and I'm curious about OfferLogix.

We're struggling with accurate payment ads and compliance across different platforms. I heard you help dealerships with this.

Could you tell me more about how OfferLogix works and what results other dealers are seeing?

Thanks!

Josh
josh@atsglobal.ai`,
    'body-html': `<p>Hi,</p>
<p>I manage marketing for several dealerships and I'm curious about OfferLogix.</p>
<p>We're struggling with accurate payment ads and compliance across different platforms. I heard you help dealerships with this.</p>
<p>Could you tell me more about how OfferLogix works and what results other dealers are seeing?</p>
<p>Thanks!</p>
<p>Josh<br>josh@atsglobal.ai</p>`,
    'stripped-text': `Hi,

I manage marketing for several dealerships and I'm curious about OfferLogix.

We're struggling with accurate payment ads and compliance across different platforms. I heard you help dealerships with this.

Could you tell me more about how OfferLogix works and what results other dealers are seeing?

Thanks!

Josh`,
    'stripped-html': `<p>Hi,</p>
<p>I manage marketing for several dealerships and I'm curious about OfferLogix.</p>
<p>We're struggling with accurate payment ads and compliance across different platforms. I heard you help dealerships with this.</p>
<p>Could you tell me more about how OfferLogix works and what results other dealers are seeing?</p>
<p>Thanks!</p>
<p>Josh</p>`,
    'message-headers': JSON.stringify([
      ['Message-Id', '<investigation-test@atsglobal.ai>'],
      ['From', 'josh@atsglobal.ai'],
      ['To', 'brittany@mail.offerlogix.me'],
      ['Subject', 'OfferLogix Payment Solutions - Quick Question']
    ]),
    'timestamp': timestamp.toString(),
    'token': token,
    'signature': signature
  });
  
  try {
    console.log('Testing webhook with realistic email content...');
    console.log('');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mailgun-Investigation'
      },
      body: testPayload
    });
    
    const responseText = await response.text();
    
    console.log(`Webhook Response Status: ${response.status}`);
    console.log(`Response Body: ${responseText}`);
    console.log('');
    
    if (response.status === 200) {
      console.log('✅ Webhook processed successfully!');
      
      try {
        const data = JSON.parse(responseText);
        console.log(`Result: ${data.message}`);
        
        if (data.message === 'Email processed and replied') {
          console.log('');
          console.log('🎉 SUCCESS! The AI should have sent a response.');
          console.log('Check your inbox (josh@atsglobal.ai) for the AI reply.');
          console.log('');
          console.log('If you still don\'t see it:');
          console.log('1. Check spam/junk folder');
          console.log('2. Email might take 1-2 minutes to arrive');
          console.log('3. Check if there are any email filters blocking it');
          
        } else {
          console.log('');
          console.log('⚠️  Webhook processed but didn\'t send reply:');
          console.log(`Reason: ${data.message}`);
          
          if (data.message.includes('Rate-limited')) {
            console.log('The AI is rate-limited. Wait 15 minutes and try again.');
          } else if (data.message.includes('Handover')) {
            console.log('The AI decided to hand over to human instead of replying.');
          } else if (data.message.includes('not identified')) {
            console.log('Lead not found - the system couldn\'t identify the sender.');
          }
        }
        
      } catch (e) {
        console.log('Response processed successfully (non-JSON response)');
      }
      
    } else if (response.status === 500) {
      console.log('❌ Internal server error in webhook');
      console.log('There\'s still an issue with the webhook processing.');
      console.log('This would cause Mailgun to reject emails again.');
      
    } else {
      console.log(`⚠️  Unexpected webhook status: ${response.status}`);
      console.log('This could indicate authentication or routing issues.');
    }
    
  } catch (error) {
    console.error('💥 Error testing webhook:', error.message);
    console.log('Network connectivity issue with the webhook endpoint.');
  }
  
  // Also check if OpenRouter API is working
  console.log('\n--- Checking OpenRouter API ---');
  try {
    const testAI = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer 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`
      }
    });
    
    if (testAI.ok) {
      console.log('✅ OpenRouter API is accessible');
    } else {
      console.log(`❌ OpenRouter API issue: ${testAI.status}`);
      console.log('This could prevent AI responses from being generated.');
    }
    
  } catch (error) {
    console.log('❌ OpenRouter API connection failed:', error.message);
  }
}

checkWebhookProcessing();