#!/usr/bin/env tsx

/**
 * Test Email Sending Capability
 * 
 * This script comprehensively tests the email sending capability of the OFFERLOGIX system.
 * It verifies:
 * 1. Mailgun API connectivity and configuration
 * 2. Domain validation and DNS settings
 * 3. Email sending functionality
 * 4. Template rendering and personalization
 * 5. Campaign email delivery
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Configuration from environment
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mail.offerlogix.me';
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || 'Brittany <brittany@mail.offerlogix.me>';
const DATABASE_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_URL || 'https://final-offerlogix.onrender.com';

// Test results tracking
interface TestResult {
  test: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];

// Database connection
let pool: Pool | null = null;

function logTest(test: string, status: 'SUCCESS' | 'FAILURE' | 'WARNING', message: string, details?: any) {
  const icon = status === 'SUCCESS' ? '✅' : status === 'FAILURE' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
  testResults.push({ test, status, message, details });
}

async function testMailgunConnection(): Promise<boolean> {
  console.log('\n🔌 Testing Mailgun API Connection...');
  
  if (!MAILGUN_API_KEY) {
    logTest('Mailgun API Key', 'FAILURE', 'MAILGUN_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.mailgun.net/v3/domains', {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json() as { items: any[] };
      logTest('Mailgun API Connection', 'SUCCESS', `Connected successfully. Found ${data.items.length} domains`);
      return true;
    } else {
      logTest('Mailgun API Connection', 'FAILURE', `API returned ${response.status}: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    logTest('Mailgun API Connection', 'FAILURE', `Connection failed: ${error}`);
    return false;
  }
}

async function testDomainConfiguration(): Promise<boolean> {
  console.log('\n🌐 Testing Domain Configuration...');
  
  if (!MAILGUN_API_KEY) {
    logTest('Domain Configuration', 'FAILURE', 'Cannot test without API key');
    return false;
  }

  try {
    const response = await fetch(`https://api.mailgun.net/v3/domains/${MAILGUN_DOMAIN}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json() as { domain: any };
      const domain = data.domain;
      
      logTest('Domain Status', domain.state === 'active' ? 'SUCCESS' : 'WARNING', 
        `Domain ${MAILGUN_DOMAIN} is ${domain.state}`, {
          wildcard: domain.wildcard,
          spam_action: domain.spam_action,
          type: domain.type,
          created_at: domain.created_at
        });

      // Check DNS records
      if (domain.receiving_dns_records) {
        const mxRecords = domain.receiving_dns_records.filter((r: any) => r.record_type === 'MX');
        if (mxRecords.length > 0) {
          logTest('MX Records', 'SUCCESS', `Found ${mxRecords.length} MX records configured`);
        } else {
          logTest('MX Records', 'WARNING', 'No MX records found - inbound email may not work');
        }
      }

      return domain.state === 'active';
    } else {
      logTest('Domain Configuration', 'FAILURE', `Cannot retrieve domain info: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Domain Configuration', 'FAILURE', `Error checking domain: ${error}`);
    return false;
  }
}

async function testSendSimpleEmail(): Promise<boolean> {
  console.log('\n📧 Testing Simple Email Send...');
  
  if (!MAILGUN_API_KEY) {
    logTest('Simple Email Send', 'FAILURE', 'Cannot send without API key');
    return false;
  }

  const testEmail = {
    to: 'test@example.com',
    from: MAILGUN_FROM_EMAIL,
    subject: `OFFERLOGIX Email Test - ${new Date().toISOString()}`,
    text: 'This is a test email from OFFERLOGIX to verify email sending capability.',
    html: '<h2>OFFERLOGIX Email Test</h2><p>This is a test email to verify email sending capability.</p>'
  };

  try {
    const formData = new URLSearchParams();
    formData.append('from', testEmail.from);
    formData.append('to', testEmail.to);
    formData.append('subject', testEmail.subject);
    formData.append('text', testEmail.text);
    formData.append('html', testEmail.html);
    formData.append('o:testmode', 'yes'); // Use test mode to avoid actually sending

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
      logTest('Simple Email Send', 'SUCCESS', 'Email queued successfully', {
        message_id: result.id,
        status: result.message
      });
      return true;
    } else {
      const error = await response.text();
      logTest('Simple Email Send', 'FAILURE', `Failed to send: ${response.status}`, { error });
      return false;
    }
  } catch (error) {
    logTest('Simple Email Send', 'FAILURE', `Error sending email: ${error}`);
    return false;
  }
}

async function testTemplateEmail(): Promise<boolean> {
  console.log('\n📝 Testing Template Email with Variables...');
  
  if (!MAILGUN_API_KEY) {
    logTest('Template Email', 'FAILURE', 'Cannot send without API key');
    return false;
  }

  const templateVariables = {
    recipient_name: 'John Doe',
    dealership_name: 'Kunes Macomb',
    vehicle_interest: '2024 Honda Accord',
    special_offer: '0% APR financing'
  };

  const htmlTemplate = `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>Hello %recipient.recipient_name%!</h2>
        <p>Thank you for your interest in the <strong>%recipient.vehicle_interest%</strong> at %recipient.dealership_name%.</p>
        <p>We have a special offer just for you: <strong>%recipient.special_offer%</strong></p>
        <p>Reply to this email or call us to schedule a test drive!</p>
        <p>Best regards,<br>The %recipient.dealership_name% Team</p>
      </body>
    </html>
  `;

  try {
    const formData = new URLSearchParams();
    formData.append('from', MAILGUN_FROM_EMAIL);
    formData.append('to', 'test@example.com');
    formData.append('subject', 'Special Offer on Your Dream Car - %recipient.vehicle_interest%');
    formData.append('html', htmlTemplate);
    formData.append('o:testmode', 'yes');
    
    // Add template variables
    Object.entries(templateVariables).forEach(([key, value]) => {
      formData.append(`v:${key}`, value);
    });

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
      logTest('Template Email', 'SUCCESS', 'Template email with variables sent successfully', {
        message_id: result.id,
        variables_used: Object.keys(templateVariables)
      });
      return true;
    } else {
      const error = await response.text();
      logTest('Template Email', 'FAILURE', `Failed to send template: ${response.status}`, { error });
      return false;
    }
  } catch (error) {
    logTest('Template Email', 'FAILURE', `Error sending template email: ${error}`);
    return false;
  }
}

async function testCampaignEmailCapability(): Promise<boolean> {
  console.log('\n🚀 Testing Campaign Email Capability...');
  
  if (!DATABASE_URL) {
    logTest('Campaign Email', 'WARNING', 'DATABASE_URL not configured - skipping database tests');
    return false;
  }

  try {
    // Connect to database
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    // Test database connection
    const client = await pool.connect();
    
    // Check for campaigns
    const campaignResult = await client.query(`
      SELECT id, name, status, agent_config_id, communication_type 
      FROM campaigns 
      WHERE status = 'active' 
      LIMIT 5
    `);

    if (campaignResult.rows.length > 0) {
      logTest('Active Campaigns', 'SUCCESS', `Found ${campaignResult.rows.length} active campaigns`, {
        campaigns: campaignResult.rows.map(c => ({ id: c.id, name: c.name, type: c.communication_type }))
      });
    } else {
      logTest('Active Campaigns', 'WARNING', 'No active campaigns found in database');
    }

    // Check for email templates
    const templateResult = await client.query(`
      SELECT t.id, t.subject, t.campaign_id, c.name as campaign_name
      FROM templates t
      JOIN campaigns c ON t.campaign_id = c.id
      LIMIT 5
    `);

    if (templateResult.rows.length > 0) {
      logTest('Email Templates', 'SUCCESS', `Found ${templateResult.rows.length} email templates`, {
        templates: templateResult.rows.map(t => ({ 
          subject: t.subject.substring(0, 50), 
          campaign: t.campaign_name 
        }))
      });
    } else {
      logTest('Email Templates', 'WARNING', 'No email templates found in database');
    }

    // Check for leads
    const leadResult = await client.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email
      FROM leads
    `);

    const leadCount = leadResult.rows[0];
    if (leadCount.total > 0) {
      logTest('Lead Database', 'SUCCESS', `Found ${leadCount.total} leads (${leadCount.with_email} with emails)`);
    } else {
      logTest('Lead Database', 'WARNING', 'No leads found in database');
    }

    client.release();
    return true;
  } catch (error) {
    logTest('Campaign Email Capability', 'FAILURE', `Database error: ${error}`);
    return false;
  }
}

async function testEmailTracking(): Promise<boolean> {
  console.log('\n📊 Testing Email Tracking Capabilities...');
  
  if (!MAILGUN_API_KEY) {
    logTest('Email Tracking', 'FAILURE', 'Cannot test without API key');
    return false;
  }

  try {
    // Check domain tracking settings
    const response = await fetch(`https://api.mailgun.net/v3/domains/${MAILGUN_DOMAIN}/tracking`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const tracking = await response.json() as { tracking: any };
      logTest('Email Tracking', 'SUCCESS', 'Tracking configuration retrieved', {
        click_tracking: tracking.tracking?.click?.active || false,
        open_tracking: tracking.tracking?.open?.active || false,
        unsubscribe_tracking: tracking.tracking?.unsubscribe?.active || false
      });
      return true;
    } else {
      logTest('Email Tracking', 'WARNING', 'Could not retrieve tracking settings');
      return false;
    }
  } catch (error) {
    logTest('Email Tracking', 'FAILURE', `Error checking tracking: ${error}`);
    return false;
  }
}

async function testWebhookConfiguration(): Promise<boolean> {
  console.log('\n🔗 Testing Webhook Configuration...');
  
  if (!MAILGUN_API_KEY) {
    logTest('Webhook Configuration', 'FAILURE', 'Cannot test without API key');
    return false;
  }

  try {
    const response = await fetch(`https://api.mailgun.net/v3/domains/${MAILGUN_DOMAIN}/webhooks`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json() as { webhooks: any };
      const webhooks = data.webhooks || {};
      
      const expectedWebhooks = ['delivered', 'opened', 'clicked', 'complained', 'permanent_fail'];
      const configuredWebhooks = Object.keys(webhooks).filter(k => webhooks[k]?.urls?.length > 0);
      
      if (configuredWebhooks.length > 0) {
        logTest('Webhook Configuration', 'SUCCESS', `Found ${configuredWebhooks.length} configured webhooks`, {
          configured: configuredWebhooks,
          urls: Object.entries(webhooks).reduce((acc, [key, value]: [string, any]) => {
            if (value?.urls?.length > 0) {
              acc[key] = value.urls[0];
            }
            return acc;
          }, {} as any)
        });
      } else {
        logTest('Webhook Configuration', 'WARNING', 'No webhooks configured - email events will not be tracked');
      }
      
      return configuredWebhooks.length > 0;
    } else {
      logTest('Webhook Configuration', 'FAILURE', `Cannot retrieve webhooks: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Webhook Configuration', 'FAILURE', `Error checking webhooks: ${error}`);
    return false;
  }
}

async function generateSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 EMAIL CAPABILITY TEST SUMMARY');
  console.log('='.repeat(80));
  
  const successCount = testResults.filter(r => r.status === 'SUCCESS').length;
  const failureCount = testResults.filter(r => r.status === 'FAILURE').length;
  const warningCount = testResults.filter(r => r.status === 'WARNING').length;
  
  console.log(`\n📊 Results: ${successCount} SUCCESS, ${failureCount} FAILURE, ${warningCount} WARNING\n`);
  
  // Group results by status
  const failures = testResults.filter(r => r.status === 'FAILURE');
  const warnings = testResults.filter(r => r.status === 'WARNING');
  const successes = testResults.filter(r => r.status === 'SUCCESS');
  
  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    failures.forEach(r => console.log(`   - ${r.test}: ${r.message}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(r => console.log(`   - ${r.test}: ${r.message}`));
  }
  
  if (successes.length > 0) {
    console.log('\n✅ SUCCESSES:');
    successes.forEach(r => console.log(`   - ${r.test}: ${r.message}`));
  }
  
  // Overall assessment
  console.log('\n' + '='.repeat(80));
  if (failureCount === 0) {
    console.log('✅ EMAIL CAPABILITY: OPERATIONAL');
    console.log('The email system is functioning correctly and ready for production use.');
  } else if (failureCount <= 2) {
    console.log('⚠️  EMAIL CAPABILITY: PARTIALLY OPERATIONAL');
    console.log('The email system has some issues but core functionality may still work.');
  } else {
    console.log('❌ EMAIL CAPABILITY: NOT OPERATIONAL');
    console.log('The email system has critical issues that need to be resolved.');
  }
  console.log('='.repeat(80));
}

async function main() {
  console.log('🚀 OFFERLOGIX EMAIL CAPABILITY TEST');
  console.log('====================================');
  console.log('Testing email sending capabilities in production configuration...\n');
  
  console.log('📋 Configuration:');
  console.log(`   MAILGUN_API_KEY: ${MAILGUN_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   MAILGUN_DOMAIN: ${MAILGUN_DOMAIN}`);
  console.log(`   FROM_EMAIL: ${MAILGUN_FROM_EMAIL}`);
  console.log(`   DATABASE_URL: ${DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   APP_URL: ${APP_URL}`);
  
  // Run all tests
  await testMailgunConnection();
  await testDomainConfiguration();
  await testSendSimpleEmail();
  await testTemplateEmail();
  await testCampaignEmailCapability();
  await testEmailTracking();
  await testWebhookConfiguration();
  
  // Generate summary
  await generateSummary();
  
  // Cleanup
  if (pool) {
    await pool.end();
  }
  
  // Exit with appropriate code
  const failureCount = testResults.filter(r => r.status === 'FAILURE').length;
  process.exit(failureCount > 0 ? 1 : 0);
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});