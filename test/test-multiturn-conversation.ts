import { storage } from '../server/storage';
import { AutomotivePromptService } from '../server/services/automotive-prompts';
import { LLMClient } from '../server/services/llm-client';

async function runMultiTurn() {
  console.log('🧪 Multi-turn lead conversation test (4+ lead replies, real LLM)');

  // Create a fresh lead
  const lead = await storage.createLead({
    firstName: 'Jordan',
    lastName: 'Lee',
    email: `jordan.${Date.now()}@example.com`,
    phone: '+1-555-0201',
    vehicleInterest: '2024 Toyota RAV4 XLE',
    leadSource: 'web_chat'
  } as any);

  // Conversation
  const conversation = await storage.createConversation({
    leadId: lead.id,
    subject: 'Multi-turn Test – RAV4 Purchase Journey',
    status: 'active',
    priority: 'high'
  } as any);

  // Automotive system prompt
  const config = AutomotivePromptService.getDefaultDealershipConfig();

  const leadTurns = [
    'Hey! Looking at a 2024 RAV4 XLE. Do you have any in Lunar Rock? Need decent mileage.',
    'I’m trading a 2016 CR‑V, 98k miles. Ballpark trade value?',
    'Payment under $450 would be great. Can you show options?',
    'If I stop by Saturday morning, can we do a quick test drive?'
  ];

  // Seed system
  await storage.createConversationMessage({
    conversationId: conversation.id,
    senderId: null as any,
    content: 'Conversation started (multi-turn test)',
    messageType: 'system',
    isFromAI: 0
  } as any);

  const history: Array<{role: 'lead'|'agent'; content: string}> = [];

  for (const turn of leadTurns) {
    // Persist lead message
    await storage.createConversationMessage({
      conversationId: conversation.id,
      senderId: null as any,
      content: turn,
      messageType: 'text',
      isFromAI: 0
    } as any);
    history.push({ role: 'lead', content: turn });

    // Build system prompt per-turn with latest user message and short memory
    const ctx = AutomotivePromptService.createConversationContext(
      `${lead.firstName} ${lead.lastName}`,
      lead.vehicleInterest,
      turn,
      history.filter(h => h.role==='agent').slice(-3).map(h=>h.content)
    );
    const systemPrompt = AutomotivePromptService.generateEnhancedSystemPrompt(config, ctx, { season: 'fall', brand: 'Toyota', isReEngagement: false, useStraightTalkingStyle: true });

    const { content } = await LLMClient.generate({
      model: 'openai/gpt-5-chat',
      system: systemPrompt,
      user: turn,
      json: false,
      temperature: 0.5,
      maxTokens: 280,
    });

    // Persist AI reply
    await storage.createConversationMessage({
      conversationId: conversation.id,
      senderId: null as any,
      content,
      messageType: 'text',
      isFromAI: 1
    } as any);
    history.push({ role: 'agent', content });

    console.log('\nLead:', turn);
    console.log('AI  :', content.slice(0, 400) + (content.length>400 ? '…' : ''));
  }

  console.log(`\n✅ Multi-turn test complete. See conversation: "${conversation.subject}" in Conversations.`);
}

runMultiTurn().catch((e)=>{ console.error(e); process.exit(1); });

