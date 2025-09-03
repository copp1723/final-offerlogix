#!/usr/bin/env node

/**
 * Debug current V2 reply issue
 */

import dotenv from 'dotenv';
dotenv.config();

async function debugCurrentIssue() {
  console.log('🔍 DEBUGGING V2 REPLY ISSUE');
  console.log('============================');
  
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN_DEFAULT || 'mg.watchdogai.us';
  
  if (!apiKey) {
    console.log('❌ No MAILGUN_API_KEY found');
    return;
  }
  
  // Check routes configuration
  console.log('\n📋 MAILGUN ROUTES:');
  try {
    const routesResponse = await fetch('https://api.mailgun.net/v3/routes', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    
    if (routesResponse.ok) {
      const routesData = await routesResponse.json();
      console.log(`Found ${routesData.items?.length || 0} routes:`);
      
      routesData.items?.forEach((route, idx) => {
        console.log(`\n${idx + 1}. Priority: ${route.priority}`);
        console.log(`   Expression: ${route.expression}`);
        console.log(`   Actions: ${JSON.stringify(route.actions)}`);
        console.log(`   Description: ${route.description || 'No description'}`);
        
        // Check if this would catch riley@kunesmacomb.kunesauto.vip
        if (route.expression.includes('kunesmacomb.kunesauto.vip') || 
            route.expression.includes('riley@') ||
            route.expression.includes('kunesmacomb')) {
          console.log('   🎯 WOULD MATCH RILEY EMAIL');
        }
      });
    } else {
      console.log('❌ Failed to fetch routes:', routesResponse.statusText);
    }
  } catch (error) {
    console.log('❌ Error checking routes:', error.message);
  }
  
  // Check recent logs
  console.log('\n📧 RECENT MAILGUN ACTIVITY:');
  try {
    const logsUrl = `https://api.mailgun.net/v3/${domain}/log`;
    const logsResponse = await fetch(logsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    
    if (logsResponse.ok) {
      const logsData = await logsResponse.json();
      console.log(`Found ${logsData.items?.length || 0} recent log entries`);
      
      // Look for activity in last 30 minutes
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      const recentEntries = logsData.items?.filter(item => {
        const timestamp = new Date(item.timestamp * 1000);
        return timestamp.getTime() > thirtyMinutesAgo;
      }) || [];
      
      if (recentEntries.length === 0) {
        console.log('❌ No activity in last 30 minutes');
        console.log('   This means your reply never reached Mailgun');
        console.log('   Check: Did you reply to the correct email address?');
      } else {
        console.log(`\n📋 Last ${recentEntries.length} entries:`);
        recentEntries.forEach((entry, idx) => {
          const timestamp = new Date(entry.timestamp * 1000).toLocaleString();
          console.log(`\n${idx + 1}. [${timestamp}] ${entry.event}`);
          console.log(`   From: ${entry.sender || 'N/A'}`);
          console.log(`   To: ${entry.recipient || 'N/A'}`);
          console.log(`   Subject: ${entry.subject || 'N/A'}`);
          if (entry.url) {
            console.log(`   Webhook URL: ${entry.url}`);
          }
          if (entry['delivery-status']) {
            console.log(`   Status: ${entry['delivery-status']}`);
          }
        });
      }
    } else {
      console.log('❌ Failed to fetch logs:', logsResponse.statusText);
    }
  } catch (error) {
    console.log('❌ Error checking logs:', error.message);
  }
  
  // Check if webhook URL is reachable
  console.log('\n🔗 WEBHOOK CONNECTIVITY:');
  try {
    const webhookUrl = 'https://mailmind-swarm-ccl-3-final.onrender.com/v2/inbound/mailgun';
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: 'ping' })
    });
    
    console.log(`Webhook URL: ${webhookUrl}`);
    console.log(`Response: ${response.status} ${response.statusText}`);
    
    if (response.status === 404) {
      console.log('❌ V2 webhook endpoint not found - deployment issue?');
    } else if (response.status === 401) {
      console.log('✅ Webhook reachable (signature validation working)');
    } else {
      console.log(`⚠️  Unexpected response: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Webhook unreachable:', error.message);
  }
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Check if your reply went to riley@kunesmacomb.kunesauto.vip');
  console.log('2. Verify Mailgun route is catching emails to that domain');
  console.log('3. Confirm webhook endpoint is deployed and accessible');
  console.log('4. Enable V2_LOG_EVENTS=true to see detailed processing');
}

debugCurrentIssue().catch(console.error);