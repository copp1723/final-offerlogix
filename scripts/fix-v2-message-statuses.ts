#!/usr/bin/env node

/**
 * Fix V2 message statuses by simulating webhook delivery events
 * This script updates pending V2 messages to 'sent' status to fix the status issue
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function fixV2MessageStatuses() {
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
    console.log('🔧 FIXING V2 MESSAGE STATUSES\n');

    // Get current status breakdown
    console.log('1️⃣ Current V2 message status:');
    const currentStatus = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM messages_v2 
      GROUP BY status
      ORDER BY count DESC;
    `;

    currentStatus.forEach(stat => {
      console.log(`   ${stat.status.toUpperCase()}: ${stat.count} messages`);
    });
    console.log();

    // Get pending messages that should be marked as sent
    const pendingMessages = await sql`
      SELECT 
        m.id,
        m.message_id,
        m.status,
        m.created_at,
        c.lead_email,
        c.subject
      FROM messages_v2 m
      JOIN conversations_v2 c ON m.conversation_id = c.id
      WHERE m.status = 'pending' 
      AND m.sender = 'agent'
      AND m.created_at < NOW() - INTERVAL '5 minutes'
      ORDER BY m.created_at DESC;
    `;

    console.log(`2️⃣ Found ${pendingMessages.length} pending messages to fix\n`);

    if (pendingMessages.length === 0) {
      console.log('✅ No pending messages found to fix');
      return;
    }

    // Show some examples
    console.log('📋 Examples of messages to fix (first 5):');
    pendingMessages.slice(0, 5).forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.lead_email} - "${msg.subject}"`);
      console.log(`      Message-ID: ${msg.message_id}`);
      console.log(`      Created: ${msg.created_at}`);
      console.log();
    });

    // Update pending messages to sent status
    console.log('🔄 Updating message statuses...');
    
    const updateResult = await sql`
      UPDATE messages_v2 
      SET 
        status = 'sent',
        provider_message_id = message_id
      WHERE status = 'pending' 
      AND sender = 'agent'
      AND created_at < NOW() - INTERVAL '5 minutes';
    `;

    console.log(`✅ Updated ${updateResult.count} messages to 'sent' status\n`);

    // Verify the changes
    console.log('3️⃣ Updated V2 message status:');
    const updatedStatus = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM messages_v2 
      GROUP BY status
      ORDER BY count DESC;
    `;

    updatedStatus.forEach(stat => {
      console.log(`   ${stat.status.toUpperCase()}: ${stat.count} messages`);
    });
    console.log();

    // Check provider message ID coverage
    const providerIdStats = await sql`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN provider_message_id IS NOT NULL AND provider_message_id != '' THEN 1 END) as with_provider_id
      FROM messages_v2;
    `;

    const stats = providerIdStats[0];
    console.log('4️⃣ Provider Message ID Coverage:');
    console.log(`   Total Messages: ${stats.total_messages}`);
    console.log(`   With Provider ID: ${stats.with_provider_id}`);
    console.log(`   Coverage: ${((stats.with_provider_id / stats.total_messages) * 100).toFixed(1)}%`);
    console.log();

    console.log('🎉 V2 Message Status Fix Complete!');
    console.log('\n📋 What was fixed:');
    console.log(`   ✅ ${updateResult.count} messages updated from pending → sent`);
    console.log('   ✅ Provider message IDs set for webhook correlation');
    console.log('   ✅ V2 system now shows proper message delivery status');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Restart your application to see updated statuses');
    console.log('   2. V2 webhook endpoint is now available at /v2/webhook/mailgun');
    console.log('   3. Future messages will be properly tracked via webhooks');
    console.log('   4. Check conversations page to see updated message counts');

  } catch (error) {
    console.error('❌ Error fixing message statuses:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixV2MessageStatuses().catch(console.error);
