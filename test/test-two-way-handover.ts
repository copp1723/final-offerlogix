import { conversationIntelligenceHub } from '../server/services/conversation-intelligence-hub';
import { HandoverService } from '../server/services/handover-service';
import { storage } from '../server/storage';

async function runTwoWayHandoverTest() {
  console.log('🚦 Two-way conversation + handover verification\n');

  // 1) Create a synthetic conversation in storage
  const lead = await storage.createLead({
    name: 'Test Buyer',
    email: 'test.buyer@example.com',
    phone: '+1-555-0100',
    vehicleInterest: '2024 Ford F-150 XLT',
    source: 'two-way-test'
  } as any);

  const conversation = await storage.createConversation({
    leadId: lead.id,
    subject: 'F-150 Inventory and Pricing',
    status: 'active',
    priority: 'medium'
  } as any);

  let messages: { role: 'lead' | 'agent'; content: string }[] = [];

  // Seed the transcript in DB so analytics can find messages
  await storage.createConversationMessage({
    conversationId: conversation.id,
    senderId: null as any,
    content: 'Conversation started',
    messageType: 'system',
    isFromAI: 0
  } as any);

  // 2) Simulate back-and-forth turns
  const turns = [
    { role: 'lead' as const, content: 'Hi, I saw your truck sale. Do you have any 2024 F-150 XLTs with tow package?' },
    { role: 'agent' as const, content: '' }, // to be filled by AI
    { role: 'lead' as const, content: 'What does pricing look like if I can come in this weekend? Also curious about trade-in.' },
    { role: 'agent' as const, content: '' },
    { role: 'lead' as const, content: 'Can we schedule a test drive for Saturday? I can bring my current truck for a trade-in appraisal.' }
  ];

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role === 'lead') {
      console.log(`🧑‍💼 Lead: ${t.content}`);
      messages.push({ role: 'lead', content: t.content });

      // Persist lead message
      await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: null as any,
        content: t.content,
        messageType: 'text',
        isFromAI: 0
      } as any);

      // 3) Evaluate handover progressively after each lead message
      const convRecord = await storage.getConversation(conversation.id);
      const evaluation = await HandoverService.evaluateHandover(conversation.id, { ...convRecord, messages }, { role: 'lead', content: t.content });
      console.log('📊 Handover status:', evaluation.shouldHandover ? 'TRIGGERED' : 'not yet', `| score=${evaluation.score} | reason=${evaluation.reason}`);

      if (evaluation.shouldHandover) {
        console.log('🚨 Handover triggered. Recommended agent:', evaluation.recommendedAgent, '| urgency:', evaluation.urgencyLevel);
        break;
      }
    } else {
      // Ask AI for a response
      const ai = await conversationIntelligenceHub.processConversation(conversation.id, messages[messages.length-1].content, 'lead');
      const reply = ai.response?.content || '(no reply)';
      console.log('🤖 AI:', reply);
      messages.push({ role: 'agent', content: reply });

      // Persist AI reply
      await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: null as any,
        content: reply,
        messageType: 'text',
        isFromAI: 1
      } as any);
    }
  }

  console.log('\n✅ Two-way handover test complete');
}

runTwoWayHandoverTest().catch((e) => {
  console.error('Two-way test failed:', e);
  process.exit(1);
});

