#!/usr/bin/env tsx

/**
 * Debug Reply Processing
 * Investigates why replies aren't generating AI responses
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function checkLeadInDatabase(): Promise<void> {
  console.log('🔍 CHECKING LEAD IN DATABASE');
  console.log('============================\n');

  try {
    const { storage } = await import('../server/storage.js');
    
    // Check if lead exists for copp.josh17@gmail.com
    const lead = await storage.getLeadByEmail('copp.josh17@gmail.com');
    
    if (lead) {
      console.log('✅ Lead found in database:');
      console.log(`   ID: ${lead.id}`);
      console.log(`   Email: ${lead.email}`);
      console.log(`   Name: ${lead.firstName} ${lead.lastName}`);
      console.log(`   Created: ${lead.createdAt}`);
    } else {
      console.log('❌ Lead NOT found in database for copp.josh17@gmail.com');
      console.log('   This could be why auto-responses are not working');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

async function checkConversations(): Promise<void> {
  console.log('\n💬 CHECKING CONVERSATIONS');
  console.log('=========================\n');

  try {
    const { db } = await import('../server/db.js');
    const { conversations, conversationMessages } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get lead first
    const { storage } = await import('../server/storage.js');
    const lead = await storage.getLeadByEmail('copp.josh17@gmail.com');
    
    if (!lead) {
      console.log('❌ No lead found, cannot check conversations');
      return;
    }
    
    // Check conversations for this lead
    const leadConversations = await db.select()
      .from(conversations)
      .where(eq(conversations.leadId, lead.id));
    
    console.log(`📊 Found ${leadConversations.length} conversations for lead`);
    
    for (const conv of leadConversations) {
      console.log(`\n💬 Conversation: ${conv.id}`);
      console.log(`   Subject: ${conv.subject}`);
      console.log(`   Created: ${conv.createdAt}`);
      
      // Get messages for this conversation
      const messages = await db.select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conv.id));
      
      console.log(`   Messages: ${messages.length}`);
      
      for (const msg of messages) {
        console.log(`   📨 ${msg.senderId}: ${msg.content.substring(0, 50)}...`);
        console.log(`      Sent: ${msg.sentAt}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Conversation check failed:', error);
  }
}

async function testWebhookProcessing(): Promise<void> {
  console.log('\n🔄 TESTING WEBHOOK PROCESSING');
  console.log('=============================\n');

  try {
    console.log('🚀 Simulating your reply to test webhook processing...');
    
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'debug-reply-' + Math.random().toString(36).substring(7);
    const signature = crypto.createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '')
      .update(timestamp + token)
      .digest('hex');

    const replyData = {
      sender: 'copp.josh17@gmail.com',
      recipient: 'campaigns@kunesmacomb.kunesauto.vip',
      subject: 'Re: Truck prices are wild right now',
      'body-plain': 'Im actually interested in what you can offer yes but before talking to anyone, can you tell me about the gmc denali package options? I am looking for luxury',
      timestamp,
      token,
      signature,
      'message-id': `<debug-reply-${Date.now()}@gmail.com>`,
      'Message-Id': `<debug-reply-${Date.now()}@gmail.com>`
    };

    const response = await fetch('https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(replyData)
    });

    const responseText = await response.text();
    console.log(`📡 Webhook Response: ${response.status} ${response.statusText}`);
    console.log(`📄 Response Body: ${responseText}`);
    
    if (response.status === 200) {
      console.log('✅ Webhook processed successfully');
      console.log('⏱️  If AI response is working, you should receive an email within 30 seconds');
    } else {
      console.log('❌ Webhook processing failed');
    }
    
  } catch (error) {
    console.error('❌ Webhook test failed:', error);
  }
}

async function checkAIAgentConfig(): Promise<void> {
  console.log('\n🤖 CHECKING AI AGENT CONFIGURATION');
  console.log('==================================\n');

  try {
    const { storage } = await import('../server/storage.js');
    const activeAgent = await storage.getActiveAiAgentConfig();
    
    if (activeAgent) {
      console.log('✅ Active AI agent found:');
      console.log(`   Name: ${activeAgent.name}`);
      console.log(`   Email Domain: ${activeAgent.agentEmailDomain}`);
      console.log(`   Model: ${activeAgent.model}`);
      console.log(`   Active: ${activeAgent.isActive}`);
    } else {
      console.log('❌ No active AI agent found');
      console.log('   This would prevent auto-responses from being generated');
    }
    
  } catch (error) {
    console.error('❌ AI agent check failed:', error);
  }
}

async function testAIResponseGeneration(): Promise<void> {
  console.log('\n🧠 TESTING AI RESPONSE GENERATION');
  console.log('=================================\n');

  try {
    const testMessage = "Im actually interested in what you can offer yes but before talking to anyone, can you tell me about the gmc denali package options? I am looking for luxury";
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-chat',
        messages: [
          { 
            role: 'system', 
            content: 'You are Riley Donovan, Client Success representative for Kunes Auto Macomb. Respond professionally about GMC Denali options.' 
          },
          { role: 'user', content: testMessage }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    });

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      
      if (aiResponse) {
        console.log('✅ AI response generation working');
        console.log(`📝 Response preview: ${aiResponse.substring(0, 100)}...`);
      } else {
        console.log('❌ AI returned empty response');
      }
    } else {
      const error = await response.text();
      console.log('❌ AI API request failed:', error);
    }
    
  } catch (error) {
    console.error('❌ AI response test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 DEBUGGING REPLY PROCESSING ISSUE');
  console.log('===================================\n');
  
  console.log('Issue: Campaign sent, reply received, but no AI auto-response');
  console.log('Email: copp.josh17@gmail.com → campaigns@kunesmacomb.kunesauto.vip');
  console.log('Expected: AI response from Riley Donovan');
  console.log('');
  
  await checkLeadInDatabase();
  await checkConversations();
  await checkAIAgentConfig();
  await testAIResponseGeneration();
  await testWebhookProcessing();
  
  console.log('\n📋 DEBUGGING SUMMARY');
  console.log('===================');
  console.log('Check the results above to identify where the process is failing:');
  console.log('1. Lead exists in database?');
  console.log('2. Conversations being created?');
  console.log('3. AI agent is active?');
  console.log('4. AI response generation working?');
  console.log('5. Webhook processing successful?');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
