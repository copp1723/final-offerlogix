#!/usr/bin/env node

/**
 * Send V2 Campaign Email Test
 * Tests the complete V2 system with dealer-to-dealer prompt
 */

import { makeConversationEngine } from './server/v2/services/conversation/factory.js';
import { dbV2, v2schema } from './server/v2/db.js';
import { eq } from 'drizzle-orm';

async function sendCampaignEmail() {
  console.log('🚀 Sending V2 Campaign Email Test');

  try {
    // Get Riley agent
    const [agent] = await dbV2
      .select({ 
        id: v2schema.agents.id, 
        name: v2schema.agents.name, 
        domain: v2schema.agents.domain, 
        localPart: v2schema.agents.localPart 
      })
      .from(v2schema.agents)
      .where(eq(v2schema.agents.localPart, 'riley'));

    if (!agent) {
      throw new Error('Riley agent not found');
    }

    console.log(`✅ Found agent: ${agent.name} at ${agent.localPart}@${agent.domain}`);

    // Create conversation engine
    const engine = makeConversationEngine();

    // Send campaign email
    const result = await engine.sendManualEmail({
      agent: {
        id: agent.id,
        name: agent.name,
        domain: agent.domain,
        localPart: agent.localPart
      },
      to: 'vee.otto.autotab@gmail.com',
      subject: 'V2 System Final Test - Complete End-to-End',
      html: `
        <p>Hi there,</p>
        <p>This is the final test of our complete V2 conversation system with:</p>
        <ul>
          <li>✅ Real OpenRouter AI integration</li>
          <li>✅ Security hardened webhook processing</li>
          <li>✅ Dealer-to-dealer communication prompt</li>
          <li>✅ Complete email threading</li>
        </ul>
        <p><strong>Please reply to this email</strong> to test the full AI-powered conversation flow.</p>
        <p>Best regards,<br>Riley Donovan<br>Kunes Macomb</p>
      `
    });

    console.log('✅ Campaign email sent successfully!');
    console.log(`📧 Message ID: ${result.messageId}`);
    console.log(`💬 Conversation ID: ${result.conversationId}`);
    console.log(`📨 From: Riley Donovan <riley@kunesmacomb.kunesauto.vip>`);
    console.log('');
    console.log('🎯 Ready for reply! The V2 system will:');
    console.log('   1. Receive your reply via Mailgun webhook');
    console.log('   2. Load Riley\'s dealer-to-dealer system prompt');
    console.log('   3. Generate intelligent AI response using OpenRouter');
    console.log('   4. Send you a professional reply');

  } catch (error) {
    console.error('❌ Error sending campaign email:', error);
    process.exit(1);
  }
}

sendCampaignEmail().catch(console.error);