#!/usr/bin/env tsx

/**
 * Test AI Response Generation Script
 * Tests if the AI auto-response system is working
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { leads, conversations, conversationMessages, aiAgentConfig } from '../shared/schema.js';
import { eq, desc } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function checkAIConfiguration(): Promise<void> {
  console.log('🤖 AI Configuration Check');
  console.log('=========================\n');

  console.log('📋 Environment Variables:');
  console.log(`   OPENROUTER_API_KEY: ${OPENROUTER_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   AI_MODEL: ${process.env.AI_MODEL || 'Not set'}`);
  console.log(`   ENABLE_AGENTS: ${process.env.ENABLE_AGENTS || 'Not set'}`);

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    return;
  }

  try {
    const sql = postgres(DATABASE_URL, { ssl: 'require' });
    const db = drizzle(sql);

    // Check AI agent configurations
    const agentConfigs = await db
      .select()
      .from(aiAgentConfig)
      .orderBy(desc(aiAgentConfig.createdAt));

    console.log(`\n🤖 AI Agent Configurations: ${agentConfigs.length}`);

    if (agentConfigs.length > 0) {
      agentConfigs.forEach((config, index) => {
        console.log(`   ${index + 1}. ${config.name}`);
        console.log(`      ID: ${config.id}`);
        console.log(`      Active: ${config.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`      Model: ${config.model || 'Not set'}`);
        console.log(`      Domain: ${config.agentEmailDomain || 'Not set'}`);
        console.log('');
      });

      // Check for active agent
      const activeAgent = agentConfigs.find(config => config.isActive);
      if (activeAgent) {
        console.log('✅ Active AI agent found');
      } else {
        console.log('❌ No active AI agent configured');
      }
    } else {
      console.log('❌ No AI agent configurations found');
    }

    await sql.end();
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

async function checkConversationFlow(): Promise<void> {
  console.log('\n💬 Conversation Flow Analysis');
  console.log('=============================\n');

  if (!DATABASE_URL) return;

  try {
    const sql = postgres(DATABASE_URL, { ssl: 'require' });
    const db = drizzle(sql);

    // Get recent conversations with message counts
    const recentConversations = await db
      .select({
        id: conversations.id,
        subject: conversations.subject,
        status: conversations.status,
        leadId: conversations.leadId,
        createdAt: conversations.createdAt
      })
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(5);

    console.log('📋 Recent Conversations:');
    
    for (const conv of recentConversations) {
      console.log(`\n   Conversation: ${conv.subject || 'No subject'}`);
      console.log(`   ID: ${conv.id}`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Lead ID: ${conv.leadId || 'None'}`);

      // Get messages for this conversation
      const messages = await db
        .select({
          id: conversationMessages.id,
          content: conversationMessages.content,
          messageType: conversationMessages.messageType,
          isFromAI: conversationMessages.isFromAI,
          createdAt: conversationMessages.createdAt,
          senderId: conversationMessages.senderId,
          leadId: conversationMessages.leadId
        })
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conv.id))
        .orderBy(desc(conversationMessages.createdAt));

      console.log(`   Messages: ${messages.length}`);
      
      let humanMessages = 0;
      let aiMessages = 0;
      
      messages.forEach((msg, index) => {
        const sender = msg.isFromAI ? 'AI' : 'Human';
        const preview = msg.content ? msg.content.substring(0, 40) + '...' : 'No content';
        console.log(`      ${index + 1}. [${sender}] ${preview}`);
        
        if (msg.isFromAI) {
          aiMessages++;
        } else {
          humanMessages++;
        }
      });

      console.log(`   Summary: ${humanMessages} human, ${aiMessages} AI messages`);
      
      if (humanMessages > 0 && aiMessages === 0) {
        console.log('   ❌ ISSUE: Human messages but no AI responses!');
      } else if (aiMessages > 0) {
        console.log('   ✅ AI responses are being generated');
      }
    }

    await sql.end();
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

async function testAIResponseGeneration(): Promise<void> {
  console.log('\n🧪 Testing AI Response Generation');
  console.log('=================================\n');

  if (!OPENROUTER_API_KEY) {
    console.log('❌ Cannot test AI responses without OPENROUTER_API_KEY');
    return;
  }

  try {
    // Test OpenRouter API connection
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('✅ OpenRouter API connection successful');
      
      // Test a simple AI generation
      const testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'openai/gpt-5-chat',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful automotive sales assistant.'
            },
            {
              role: 'user',
              content: 'I\'m interested in scheduling a test drive.'
            }
          ],
          max_tokens: 100
        })
      });

      if (testResponse.ok) {
        const result = await testResponse.json();
        const aiReply = result.choices?.[0]?.message?.content;
        
        if (aiReply) {
          console.log('✅ AI response generation working');
          console.log(`   Sample response: ${aiReply.substring(0, 100)}...`);
        } else {
          console.log('❌ AI response generation failed - no content returned');
        }
      } else {
        console.log(`❌ AI response generation failed: ${testResponse.status} ${testResponse.statusText}`);
      }
    } else {
      console.log(`❌ OpenRouter API connection failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ AI test error:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 AI Response System Diagnostic');
  console.log('================================\n');

  await checkAIConfiguration();
  await checkConversationFlow();
  await testAIResponseGeneration();

  console.log('\n💡 Diagnostic Summary:');
  console.log('   • If human messages exist but no AI responses:');
  console.log('     1. Check AI agent configuration is active');
  console.log('     2. Verify OpenRouter API key is working');
  console.log('     3. Check auto-response logic in inbound-email.ts');
  console.log('   • If AI responses exist, the system is working correctly');
  console.log('   • If no conversations exist, leads aren\'t replying to campaigns');
}

// Run the main function
main().catch(console.error);
