#!/usr/bin/env tsx

/**
 * Test Email Delivery Script
 * Tests sending emails to campaigns@kunesmacomb.kunesauto.vip
 */

import fetch from 'node-fetch';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us';

async function sendTestEmail(
  to: string,
  from: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> {
  if (!MAILGUN_API_KEY) {
    console.error('❌ MAILGUN_API_KEY not set');
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('from', from);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('text', text);
    if (html) {
      formData.append('html', html);
    }

    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (response.ok) {
      const result = await response.json() as { id: string; message: string };
      console.log(`✅ Email sent successfully!`);
      console.log(`   Message ID: ${result.id}`);
      console.log(`   Status: ${result.message}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to send email: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

async function testCampaignEmailDelivery(): Promise<void> {
  console.log('📧 Testing Campaign Email Delivery');
  console.log('==================================\n');

  const testEmails = [
    {
      to: 'campaigns@kunesmacomb.kunesauto.vip',
      from: `Test Campaign <noreply@${MAILGUN_DOMAIN}>`,
      subject: 'Test Campaign Email - Please Reply',
      text: `Hello!

This is a test email to verify that:
1. Emails can be delivered to campaigns@kunesmacomb.kunesauto.vip
2. The webhook endpoint receives and processes the email
3. The 2-way conversation system is working

Please reply to this email to test the complete workflow.

Best regards,
MailMind Test System`,
      html: `<html>
<body>
<h2>Test Campaign Email</h2>
<p>Hello!</p>
<p>This is a test email to verify that:</p>
<ol>
<li>Emails can be delivered to campaigns@kunesmacomb.kunesauto.vip</li>
<li>The webhook endpoint receives and processes the email</li>
<li>The 2-way conversation system is working</li>
</ol>
<p><strong>Please reply to this email to test the complete workflow.</strong></p>
<p>Best regards,<br>MailMind Test System</p>
</body>
</html>`
    }
  ];

  for (const email of testEmails) {
    console.log(`📤 Sending test email to: ${email.to}`);
    console.log(`   From: ${email.from}`);
    console.log(`   Subject: ${email.subject}`);
    
    const success = await sendTestEmail(
      email.to,
      email.from,
      email.subject,
      email.text,
      email.html
    );
    
    if (success) {
      console.log(`✅ Test email sent successfully to ${email.to}\n`);
    } else {
      console.log(`❌ Failed to send test email to ${email.to}\n`);
    }
  }
}

async function checkMailgunDomainStatus(): Promise<void> {
  console.log('🔍 Checking Mailgun Domain Status');
  console.log('=================================\n');

  if (!MAILGUN_API_KEY) {
    console.error('❌ MAILGUN_API_KEY not set');
    return;
  }

  const domainsToCheck = [
    MAILGUN_DOMAIN,
    'kunesmacomb.kunesauto.vip'
  ];

  for (const domain of domainsToCheck) {
    try {
      const response = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
        }
      });

      if (response.ok) {
        const data = await response.json() as { domain: any };
        console.log(`📧 Domain: ${domain}`);
        console.log(`   State: ${data.domain.state}`);
        console.log(`   Wildcard: ${data.domain.wildcard}`);
        console.log(`   Spam Action: ${data.domain.spam_action}`);
        
        if (data.domain.state === 'active') {
          console.log(`   ✅ Domain is active and ready for sending`);
        } else {
          console.log(`   ⚠️  Domain state: ${data.domain.state}`);
        }
      } else {
        console.log(`❌ Domain ${domain}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Error checking domain ${domain}:`, error);
    }
    console.log('');
  }
}

async function main(): Promise<void> {
  console.log('🚀 Email Delivery Testing Suite');
  console.log('===============================\n');

  console.log('📋 Configuration:');
  console.log(`   MAILGUN_API_KEY: ${MAILGUN_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   MAILGUN_DOMAIN: ${MAILGUN_DOMAIN}`);
  console.log(`   Target Email: campaigns@kunesmacomb.kunesauto.vip`);
  console.log('');

  if (!MAILGUN_API_KEY) {
    console.error('❌ Cannot proceed without MAILGUN_API_KEY');
    return;
  }

  // Check domain status first
  await checkMailgunDomainStatus();

  // Test email delivery
  await testCampaignEmailDelivery();

  console.log('📋 Next Steps:');
  console.log('   1. Check your email client for the test email');
  console.log('   2. Reply to the test email to verify webhook processing');
  console.log('   3. Check the application logs for webhook activity');
  console.log('   4. Verify that AI responses are generated and sent');
  console.log('');
  console.log('✅ Email delivery test complete!');
}

// Run the main function
main().catch(console.error);
