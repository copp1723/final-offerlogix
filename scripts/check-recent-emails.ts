#!/usr/bin/env tsx

/**
 * Check Recent Email Activity Script
 * Verifies if emails are actually being sent despite UI showing 0
 */

import fetch from 'node-fetch';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us';

async function checkRecentMailgunActivity(): Promise<void> {
  if (!MAILGUN_API_KEY) {
    console.error('❌ MAILGUN_API_KEY not set');
    return;
  }

  console.log('📧 Checking Recent Mailgun Activity');
  console.log('==================================\n');

  try {
    // Get recent events from Mailgun
    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/events?limit=50`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json() as { items: any[] };
      const events = data.items || [];

      console.log(`📊 Found ${events.length} recent events\n`);

      // Filter for recent events (last hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentEvents = events.filter(event => {
        const eventTime = new Date(event.timestamp * 1000).getTime();
        return eventTime > oneHourAgo;
      });

      console.log(`🕐 Events in the last hour: ${recentEvents.length}\n`);

      if (recentEvents.length > 0) {
        console.log('📋 Recent Email Activity:');
        recentEvents.forEach((event, index) => {
          const timestamp = new Date(event.timestamp * 1000).toLocaleString();
          const recipient = event.recipient || 'N/A';
          const eventType = event.event || 'unknown';
          const subject = event.message?.headers?.subject || 'N/A';
          
          console.log(`   ${index + 1}. [${timestamp}] ${eventType.toUpperCase()}`);
          console.log(`      To: ${recipient}`);
          console.log(`      Subject: ${subject}`);
          
          if (event.event === 'failed') {
            console.log(`      ❌ Failure Reason: ${event['delivery-status']?.description || event.reason || 'Unknown'}`);
          } else if (event.event === 'accepted') {
            console.log(`      ✅ Message accepted for delivery`);
          }
          console.log('');
        });
      } else {
        console.log('ℹ️  No recent email activity found in the last hour');
      }

      // Check for any campaign-related emails
      const campaignEmails = events.filter(event => 
        event.recipient?.includes('campaigns@') || 
        event.message?.headers?.subject?.toLowerCase().includes('campaign') ||
        event.message?.headers?.subject?.toLowerCase().includes('test')
      );

      if (campaignEmails.length > 0) {
        console.log(`🎯 Campaign-related emails found: ${campaignEmails.length}`);
        campaignEmails.slice(0, 5).forEach((event, index) => {
          const timestamp = new Date(event.timestamp * 1000).toLocaleString();
          console.log(`   ${index + 1}. [${timestamp}] ${event.event} - ${event.recipient}`);
        });
      }

    } else {
      console.error(`❌ Failed to fetch events: ${response.status} ${response.statusText}`);
    }

  } catch (error) {
    console.error('❌ Error checking Mailgun activity:', error);
  }
}

async function checkMailgunStats(): Promise<void> {
  if (!MAILGUN_API_KEY) return;

  console.log('\n📊 Mailgun Domain Statistics');
  console.log('============================\n');

  try {
    // Get domain stats
    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/stats/total?event=accepted&event=delivered&event=failed&duration=1d`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    if (response.ok) {
      const data = await response.json() as { stats: any[] };
      const stats = data.stats || [];

      if (stats.length > 0) {
        const latestStats = stats[0];
        console.log('📈 Last 24 Hours:');
        console.log(`   Accepted: ${latestStats.accepted?.total || 0}`);
        console.log(`   Delivered: ${latestStats.delivered?.total || 0}`);
        console.log(`   Failed: ${latestStats.failed?.total || 0}`);
      } else {
        console.log('ℹ️  No statistics available');
      }
    }
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 Email Activity Verification');
  console.log('==============================\n');

  console.log('📋 Configuration:');
  console.log(`   MAILGUN_API_KEY: ${MAILGUN_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   MAILGUN_DOMAIN: ${MAILGUN_DOMAIN}`);
  console.log('');

  if (!MAILGUN_API_KEY) {
    console.error('❌ Cannot check email activity without MAILGUN_API_KEY');
    return;
  }

  await checkRecentMailgunActivity();
  await checkMailgunStats();

  console.log('\n💡 Interpretation:');
  console.log('   • If you see "accepted" events, emails are being sent successfully');
  console.log('   • If you see "delivered" events, emails reached their destination');
  console.log('   • If you see "failed" events, check the failure reasons');
  console.log('   • The UI showing "0 sent" might be a reporting bug, not an actual failure');
}

// Run the main function
main().catch(console.error);
