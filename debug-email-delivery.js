#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Debugging Email Delivery Issue');
console.log('=================================');

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFrom = process.env.MAILGUN_FROM_EMAIL || `test@${mailgunDomain}`;

console.log(`Domain: ${mailgunDomain}`);
console.log(`From: ${mailgunFrom}`);
console.log(`API Key: ${mailgunApiKey ? mailgunApiKey.substring(0, 10) + '...' : 'NOT SET'}`);

// Test domain status
console.log('\n1. Testing Domain Status...');
try {
  const response = await fetch(`https://api.mailgun.net/v3/domains/${mailgunDomain}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`
    }
  });
  
  if (response.ok) {
    const domain = await response.json();
    console.log('✅ Domain Status:', domain.domain?.state || 'Unknown');
    console.log('   SMTP Login:', domain.domain?.smtp_login || 'Not set');
  } else {
    console.log(`❌ Domain check failed: ${response.status}`);
    console.log(await response.text());
  }
} catch (error) {
  console.log(`❌ Domain check error: ${error.message}`);
}

// Test email validation for the recipient
console.log('\n2. Testing Email Validation...');
try {
  const response = await fetch(`https://api.mailgun.net/v4/address/validate`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`
    },
    body: new URLSearchParams({
      address: 'josh@taglobal.ai'
    })
  });
  
  if (response.ok) {
    const validation = await response.json();
    console.log('✅ Email Validation Result:');
    console.log('   Valid:', validation.is_valid);
    console.log('   Risk:', validation.risk || 'Unknown');
    console.log('   Reason:', validation.reason || 'None');
  } else {
    console.log(`⚠️  Email validation returned: ${response.status}`);
  }
} catch (error) {
  console.log(`❌ Email validation error: ${error.message}`);
}

// Send test email with delivery tracking
console.log('\n3. Sending Test Email with Tracking...');
try {
  const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      from: mailgunFrom,
      to: 'josh@taglobal.ai',
      subject: 'MailMind Test Email - Debug Attempt',
      text: `This is a debug test email from MailMind.
      
Time: ${new Date().toISOString()}
Domain: ${mailgunDomain}
From: ${mailgunFrom}

If you receive this, the email system is working correctly.`,
      'o:tracking': 'yes',
      'o:tracking-clicks': 'yes',
      'o:tracking-opens': 'yes'
    })
  });
  
  if (response.status === 200) {
    const result = await response.json();
    console.log('✅ Email queued successfully');
    console.log(`   Message ID: ${result.id}`);
    console.log(`   Message: ${result.message}`);
    
    // Wait a moment then check events
    console.log('\n4. Checking Delivery Events...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const eventsResponse = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/events?limit=5`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`
      }
    });
    
    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      console.log('Recent events:', events.items?.length || 0);
      events.items?.forEach(event => {
        console.log(`   ${event.event}: ${event.recipient} at ${new Date(event.timestamp * 1000).toLocaleTimeString()}`);
      });
    } else {
      console.log(`Events check failed: ${eventsResponse.status}`);
    }
    
  } else {
    console.log(`❌ Email send failed: ${response.status}`);
    const errorText = await response.text();
    console.log(`Error: ${errorText}`);
  }
} catch (error) {
  console.log(`❌ Email send error: ${error.message}`);
}

console.log('\n📋 Debugging Complete');
console.log('Check your email now for the debug test message.');
console.log('If still no email, there may be a domain/DNS configuration issue.');