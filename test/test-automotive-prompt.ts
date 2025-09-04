import { storage } from '../server/storage';
import { HandoverService } from '../server/services/handover-service';
import { LLMClient } from '../server/services/llm-client';
import { AutomotivePromptService } from '../server/services/automotive-prompts';

async function runAutomotivePromptTest() {
  console.log('🚗 AutomotivePromptService live test (real LLM, UI-persisted)\n');

  // 1) Create a lead + conversation so messages show in Conversations UI
  const lead = await storage.createLead({
    firstName: 'Ava',
    lastName: 'Sanchez',
    email: `ava.${Date.now()}@example.com`,
    phone: '+1-555-0142',
    vehicleInterest: '2024 Ford F-150 XLT',
    leadSource: 'web_chat'
  } as any);

  const conversation = await storage.createConversation({
    leadId: lead.id,
    subject: 'Automotive Prompt Live Test – F-150 Inquiry',
    status: 'active',
    priority: 'high'
  } as any);

  // Seed a system message
  await storage.createConversationMessage({
    conversationId: conversation.id,
    senderId: null as any,
    content: 'Conversation started (AutomotivePromptService test)',
    messageType: 'system',
    isFromAI: 0
  } as any);

  // 2) Generate the automotive system prompt
  const config = AutomotivePromptService.getDefaultDealershipConfig();
  const leadMessage = 'Do you have any F-150 XLTs with tow package? What would payments look like if I come in this weekend? I might trade my Tacoma.';
  const convCtx = AutomotivePromptService.createConversationContext(
    `${lead.firstName} ${lead.lastName}`,
    lead.vehicleInterest,
    leadMessage,
    []
  );
  const systemPrompt = AutomotivePromptService.generateEnhancedSystemPrompt(config, convCtx, {
    season: 'fall',
    brand: 'Ford',
    isReEngagement: false,
    useStraightTalkingStyle: true,
  });

  console.log('🧩 System prompt generated via AutomotivePromptService (truncated preview):');
  console.log(systemPrompt.slice(0, 240) + (systemPrompt.length > 240 ? '…' : ''));

  // 3) Persist the lead's message
  await storage.createConversationMessage({
    conversationId: conversation.id,
    senderId: null as any,
    content: leadMessage,
    messageType: 'text',
    isFromAI: 0
  } as any);

  // 4) Call LLM with the automotive system prompt for a real reply
  const { content: aiReply } = await LLMClient.generate({
    model: 'openai/gpt-5-chat',
    system: systemPrompt,
    user: leadMessage,
    json: false,
    temperature: 0.5,
    maxTokens: 320,
  });

  console.log('\n🤖 AI Reply (preview):');
  console.log(aiReply.slice(0, 600) + (aiReply.length > 600 ? '\n…' : ''));

  // 5) Persist AI reply so it appears in UI
  await storage.createConversationMessage({
    conversationId: conversation.id,
    senderId: null as any,
    content: aiReply,
    messageType: 'text',
    isFromAI: 1
  } as any);

  // 6) Evaluate handover on the latest lead message
  const evaluation = await HandoverService.evaluateHandover(
    conversation.id,
    { ...conversation, lead, messages: [
      { role: 'lead', content: leadMessage },
      { role: 'agent', content: aiReply }
    ] },
    { role: 'lead', content: leadMessage }
  );

  console.log('\n📊 Handover Evaluation:');
  console.log('shouldHandover:', evaluation.shouldHandover,
              '| score:', evaluation.score,
              '| urgency:', evaluation.urgencyLevel);
  console.log('reason:', evaluation.reason || '(none)');
  if (evaluation.triggeredCriteria?.length) {
    console.log('triggers:', evaluation.triggeredCriteria.join(', '));
  }

  console.log(`\n✅ Test complete. Open Conversations and select: "${conversation.subject}" to review messages.`);
}

runAutomotivePromptTest().catch((e) => {
  console.error('AutomotivePromptService test failed:', e);
  process.exit(1);
});

