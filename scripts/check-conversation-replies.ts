#!/usr/bin/env node

/**
 * Check for replies in V2 conversations
 * Analyzes message data to see lead engagement
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function checkConversationReplies() {
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
    console.log('📊 ANALYZING V2 CONVERSATION ENGAGEMENT\n');

    // Get conversation and message statistics
    const conversationStats = await sql`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
        COUNT(CASE WHEN status = 'handed_over' THEN 1 END) as handed_over_conversations,
        AVG(message_count) as avg_message_count,
        MAX(message_count) as max_message_count,
        MIN(message_count) as min_message_count
      FROM conversations_v2;
    `;

    console.log('📈 CONVERSATION OVERVIEW:');
    const stats = conversationStats[0];
    console.log(`   Total Conversations: ${stats.total_conversations}`);
    console.log(`   Active: ${stats.active_conversations}`);
    console.log(`   Handed Over: ${stats.handed_over_conversations}`);
    console.log(`   Avg Messages per Conversation: ${parseFloat(stats.avg_message_count).toFixed(1)}`);
    console.log(`   Max Messages in a Conversation: ${stats.max_message_count}`);
    console.log(`   Min Messages in a Conversation: ${stats.min_message_count}\n`);

    // Check message breakdown by sender
    const messageStats = await sql`
      SELECT 
        sender,
        COUNT(*) as message_count,
        COUNT(DISTINCT conversation_id) as conversations_with_messages
      FROM messages_v2 
      GROUP BY sender
      ORDER BY message_count DESC;
    `;

    console.log('💬 MESSAGE BREAKDOWN BY SENDER:');
    messageStats.forEach(stat => {
      console.log(`   ${stat.sender.toUpperCase()}: ${stat.message_count} messages in ${stat.conversations_with_messages} conversations`);
    });
    console.log();

    // Find conversations with lead replies
    const conversationsWithReplies = await sql`
      SELECT 
        c.id,
        c.lead_email,
        c.subject,
        c.message_count,
        c.status,
        c.created_at,
        COUNT(CASE WHEN m.sender = 'lead' THEN 1 END) as lead_messages,
        COUNT(CASE WHEN m.sender = 'agent' THEN 1 END) as agent_messages
      FROM conversations_v2 c
      LEFT JOIN messages_v2 m ON c.id = m.conversation_id
      GROUP BY c.id, c.lead_email, c.subject, c.message_count, c.status, c.created_at
      HAVING COUNT(CASE WHEN m.sender = 'lead' THEN 1 END) > 0
      ORDER BY lead_messages DESC, c.created_at DESC
      LIMIT 20;
    `;

    console.log(`🎯 CONVERSATIONS WITH LEAD REPLIES (${conversationsWithReplies.length} found):`);
    if (conversationsWithReplies.length === 0) {
      console.log('   ❌ No conversations found with lead replies');
    } else {
      conversationsWithReplies.forEach((conv, index) => {
        console.log(`   ${index + 1}. ${conv.lead_email}`);
        console.log(`      Subject: "${conv.subject}"`);
        console.log(`      Lead Messages: ${conv.lead_messages}, Agent Messages: ${conv.agent_messages}`);
        console.log(`      Status: ${conv.status}, Created: ${conv.created_at}`);
        console.log();
      });
    }

    // Check for recent message activity
    const recentMessages = await sql`
      SELECT 
        m.sender,
        m.content,
        m.created_at,
        c.lead_email,
        c.subject
      FROM messages_v2 m
      JOIN conversations_v2 c ON m.conversation_id = c.id
      WHERE m.sender = 'lead'
      ORDER BY m.created_at DESC
      LIMIT 10;
    `;

    console.log(`📨 RECENT LEAD MESSAGES (${recentMessages.length} found):`);
    if (recentMessages.length === 0) {
      console.log('   ❌ No recent lead messages found');
    } else {
      recentMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. From: ${msg.lead_email}`);
        console.log(`      Subject: "${msg.subject}"`);
        console.log(`      Message: "${msg.content.substring(0, 100)}..."`);
        console.log(`      Sent: ${msg.created_at}`);
        console.log();
      });
    }

    // Check message status distribution
    const messageStatusStats = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM messages_v2 
      GROUP BY status
      ORDER BY count DESC;
    `;

    console.log('📋 MESSAGE STATUS BREAKDOWN:');
    messageStatusStats.forEach(stat => {
      console.log(`   ${stat.status.toUpperCase()}: ${stat.count} messages`);
    });
    console.log();

    // Check for conversations that might have failed to send
    const failedMessages = await sql`
      SELECT 
        c.lead_email,
        c.subject,
        COUNT(CASE WHEN m.status = 'failed' THEN 1 END) as failed_messages,
        COUNT(CASE WHEN m.status = 'sent' THEN 1 END) as sent_messages,
        COUNT(CASE WHEN m.status = 'pending' THEN 1 END) as pending_messages
      FROM conversations_v2 c
      LEFT JOIN messages_v2 m ON c.id = m.conversation_id
      GROUP BY c.id, c.lead_email, c.subject
      HAVING COUNT(CASE WHEN m.status = 'failed' THEN 1 END) > 0
      ORDER BY failed_messages DESC
      LIMIT 10;
    `;

    console.log(`❌ CONVERSATIONS WITH FAILED MESSAGES (${failedMessages.length} found):`);
    if (failedMessages.length === 0) {
      console.log('   ✅ No failed messages found');
    } else {
      failedMessages.forEach((conv, index) => {
        console.log(`   ${index + 1}. ${conv.lead_email} - "${conv.subject}"`);
        console.log(`      Failed: ${conv.failed_messages}, Sent: ${conv.sent_messages}, Pending: ${conv.pending_messages}`);
      });
    }

    console.log('\n🔍 ANALYSIS SUMMARY:');
    const totalMessages = messageStats.reduce((sum, stat) => sum + parseInt(stat.message_count), 0);
    const leadMessages = messageStats.find(stat => stat.sender === 'lead')?.message_count || 0;
    const agentMessages = messageStats.find(stat => stat.sender === 'agent')?.message_count || 0;
    
    console.log(`   📊 Total Messages: ${totalMessages}`);
    console.log(`   🤖 Agent Messages: ${agentMessages}`);
    console.log(`   👤 Lead Messages: ${leadMessages}`);
    console.log(`   📈 Reply Rate: ${totalMessages > 0 ? ((leadMessages / agentMessages) * 100).toFixed(2) : 0}%`);
    console.log(`   💬 Conversations with Replies: ${conversationsWithReplies.length} out of ${stats.total_conversations}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkConversationReplies().catch(console.error);
