#!/usr/bin/env node

/**
 * Check V2 webhook handling and message status updates
 * Investigates why V2 messages are stuck in PENDING status
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function checkV2WebhookHandling() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.DATABASE_URL.includes('render.com') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('🔍 INVESTIGATING V2 MESSAGE STATUS ISSUE\n');

    // Check V2 message status distribution
    console.log('1️⃣ V2 MESSAGE STATUS BREAKDOWN:');
    const v2MessageStatus = await sql`
      SELECT 
        status,
        COUNT(*) as count,
        MIN(created_at) as earliest,
        MAX(created_at) as latest
      FROM messages_v2 
      GROUP BY status
      ORDER BY count DESC;
    `;

    v2MessageStatus.forEach(stat => {
      console.log(`   ${stat.status.toUpperCase()}: ${stat.count} messages`);
      console.log(`      Earliest: ${stat.earliest}`);
      console.log(`      Latest: ${stat.latest}`);
    });
    console.log();

    // Check if V2 messages have Mailgun message IDs
    console.log('2️⃣ V2 MESSAGE ID TRACKING:');
    const messageIdStats = await sql`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN message_id IS NOT NULL AND message_id != '' THEN 1 END) as with_message_id,
        COUNT(CASE WHEN provider_message_id IS NOT NULL AND provider_message_id != '' THEN 1 END) as with_provider_id
      FROM messages_v2;
    `;

    const stats = messageIdStats[0];
    console.log(`   Total V2 Messages: ${stats.total_messages}`);
    console.log(`   With Message-ID: ${stats.with_message_id}`);
    console.log(`   With Provider Message-ID: ${stats.with_provider_id}`);
    console.log();

    // Check recent V2 messages for debugging
    console.log('3️⃣ RECENT V2 MESSAGES (Last 10):');
    const recentMessages = await sql`
      SELECT 
        m.id,
        m.status,
        m.message_id,
        m.provider_message_id,
        m.created_at,
        c.lead_email,
        c.subject
      FROM messages_v2 m
      JOIN conversations_v2 c ON m.conversation_id = c.id
      WHERE m.sender = 'agent'
      ORDER BY m.created_at DESC
      LIMIT 10;
    `;

    recentMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.lead_email} - "${msg.subject}"`);
      console.log(`      Status: ${msg.status}`);
      console.log(`      Message-ID: ${msg.message_id || 'NONE'}`);
      console.log(`      Provider-ID: ${msg.provider_message_id || 'NONE'}`);
      console.log(`      Created: ${msg.created_at}`);
      console.log();
    });

    // Check V1 email delivery events for comparison
    console.log('4️⃣ V1 EMAIL DELIVERY EVENTS (Recent):');
    const v1DeliveryEvents = await sql`
      SELECT 
        event_type,
        COUNT(*) as count,
        MAX(timestamp) as latest_event
      FROM email_delivery_events 
      WHERE timestamp > NOW() - INTERVAL '7 days'
      GROUP BY event_type
      ORDER BY count DESC;
    `;

    if (v1DeliveryEvents.length === 0) {
      console.log('   ❌ No V1 delivery events found in last 7 days');
    } else {
      v1DeliveryEvents.forEach(event => {
        console.log(`   ${event.event_type.toUpperCase()}: ${event.count} events (latest: ${event.latest_event})`);
      });
    }
    console.log();

    // Check webhook configuration
    console.log('5️⃣ WEBHOOK CONFIGURATION:');
    console.log(`   V2_MAILGUN_ENABLED: ${process.env.V2_MAILGUN_ENABLED}`);
    console.log(`   MAILGUN_SIGNING_KEY: ${process.env.MAILGUN_SIGNING_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`   MAILGUN_API_KEY: ${process.env.MAILGUN_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`   MAILGUN_DOMAIN: ${process.env.MAILGUN_DOMAIN || 'NOT SET'}`);
    console.log();

    // Check if there are any V2 webhook endpoints
    console.log('6️⃣ POTENTIAL ISSUES:');
    
    const pendingMessages = v2MessageStatus.find(s => s.status === 'pending')?.count || 0;
    const sentMessages = v2MessageStatus.find(s => s.status === 'sent')?.count || 0;
    
    if (pendingMessages > sentMessages * 10) {
      console.log('   🚨 HIGH PENDING MESSAGE COUNT:');
      console.log(`      ${pendingMessages} pending vs ${sentMessages} sent messages`);
      console.log('      This suggests messages are being created but not sent');
      console.log();
    }

    if (stats.with_provider_id === 0) {
      console.log('   🚨 NO PROVIDER MESSAGE IDS:');
      console.log('      V2 messages have no provider_message_id from Mailgun');
      console.log('      This suggests webhooks are not updating V2 message status');
      console.log();
    }

    // Check if V2 webhook handler exists
    console.log('7️⃣ RECOMMENDATIONS:');
    console.log('   Based on the analysis:');
    
    if (pendingMessages > 100) {
      console.log('   🔧 ISSUE: V2 messages stuck in PENDING status');
      console.log('   💡 SOLUTION: V2 webhook handler needs to update message status');
      console.log('   📋 ACTION: Check if V2 webhook endpoint exists and is configured');
    }
    
    if (stats.with_provider_id === 0) {
      console.log('   🔧 ISSUE: No Mailgun provider IDs in V2 messages');
      console.log('   💡 SOLUTION: V2 webhook handler needs to set provider_message_id');
      console.log('   📋 ACTION: Ensure V2 webhook processes Mailgun delivery events');
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('   1. Check if V2 webhook endpoint exists: /v2/webhook/mailgun');
    console.log('   2. Verify Mailgun is configured to send webhooks to V2 endpoint');
    console.log('   3. Test V2 webhook with a sample delivery event');
    console.log('   4. Update V2 message status from pending → sent on delivery');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkV2WebhookHandling().catch(console.error);
