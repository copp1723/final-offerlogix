import { storage } from '../server/storage';
import { AutomotivePromptService } from '../server/services/automotive-prompts';
import { LLMClient } from '../server/services/llm-client';

// Helper to infer brand from vehicleInterest string
function inferBrand(vehicleInterest: string): string | undefined {
  const brands = ['Toyota','Honda','Ford','Chevrolet','Jeep','Subaru','Hyundai','Kia','Nissan','BMW','Mercedes','Audi','Volkswagen','GMC','Ram','Dodge','Lexus'];
  const lower = vehicleInterest.toLowerCase();
  const found = brands.find(b => lower.includes(b.toLowerCase()));
  return found;
}

async function createFourTurnConversation(
  firstName: string,
  lastName: string,
  vehicleInterest: string,
  leadTurns: string[],
) {
  // Create lead
  const lead = await storage.createLead({
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}@example.com`,
    phone: `+1-555-${Math.floor(1000+Math.random()*8999)}`,
    vehicleInterest,
    leadSource: 'web_chat',
  } as any);

  // Create conversation
  const conversation = await storage.createConversation({
    leadId: lead.id,
    subject: `Batch Demo – ${firstName} ${lastName} – ${vehicleInterest}`,
    status: 'active',
    priority: 'normal',
  } as any);

  // Seed system message
  await storage.createConversationMessage({
    conversationId: conversation.id,
    senderId: null as any,
    content: 'Conversation started (batch multi-turn test)',
    messageType: 'system',
    isFromAI: 0,
  } as any);

  const history: Array<{role: 'lead'|'agent'; content: string}> = [];
  const config = AutomotivePromptService.getDefaultDealershipConfig();
  const brand = inferBrand(vehicleInterest) || 'Toyota';

  for (const turn of leadTurns) {
    // Persist lead message
    await storage.createConversationMessage({
      conversationId: conversation.id,
      senderId: null as any,
      content: turn,
      messageType: 'text',
      isFromAI: 0,
    } as any);
    history.push({ role: 'lead', content: turn });

    // Build per-turn system prompt with context
    const ctx = AutomotivePromptService.createConversationContext(
      `${lead.firstName} ${lead.lastName}`,
      lead.vehicleInterest,
      turn,
      history.filter(h => h.role==='agent').slice(-3).map(h=>h.content)
    );
    const systemPrompt = AutomotivePromptService.generateEnhancedSystemPrompt(
      config,
      ctx,
      { season: 'fall', brand, isReEngagement: false, useStraightTalkingStyle: true }
    );

    const { content } = await LLMClient.generate({
      model: 'openai/gpt-5-chat',
      system: systemPrompt,
      user: turn,
      json: false,
      temperature: 0.5,
      maxTokens: 280,
    });

    await storage.createConversationMessage({
      conversationId: conversation.id,
      senderId: null as any,
      content,
      messageType: 'text',
      isFromAI: 1,
    } as any);
    history.push({ role: 'agent', content });

    console.log(`\nLead (${firstName}):`, turn);
    console.log('AI  :', content.slice(0, 400) + (content.length>400 ? '…' : ''));
  }

  console.log(`\n✅ Created conversation in UI: "${conversation.subject}"`);
}

async function runBatch() {
  console.log('🧪 Generating multiple 4-turn conversations (real LLM)');

  const scenarios: Array<{
    firstName: string; lastName: string; vehicle: string; turns: string[];
  }> = [
    {
      firstName: 'Ava', lastName: 'Martinez', vehicle: '2024 Toyota RAV4 XLE',
      turns: [
        'Hi! Looking at a 2024 RAV4 XLE. Prefer white or Lunar Rock. Any around?',
        'Current car is a 2015 Rogue, 110k miles. What could it be worth?',
        'If I aim for under $420/mo, is that realistic?',
        'Could I swing by Friday afternoon for a test drive?'
      ]
    },
    {
      firstName: 'Noah', lastName: 'Kim', vehicle: '2023 Honda Accord EX-L',
      turns: [
        'Thinking about a 2023 Accord EX-L. Want something comfortable for commuting.',
        'I have a 2018 Civic, 72k miles—trade or sell?',
        'Payment target is around $500 with some money down.',
        'What’s Saturday morning look like for a quick drive?'
      ]
    },
    {
      firstName: 'Mia', lastName: 'Thompson', vehicle: '2024 Subaru Outback Premium',
      turns: [
        'Outback Premium caught my eye—need AWD for winter.',
        'I’m not picky on color, just want heated seats and safety tech.',
        'Under $475 a month would be ideal. Can we explore that?',
        'Could we set something up for Sunday afternoon?'
      ]
    },
    {
      firstName: 'Liam', lastName: 'Nguyen', vehicle: '2024 Ford F-150 XLT',
      turns: [
        'Looking for a 2024 F-150 XLT—need decent tow capacity.',
        'Trading a 2014 Silverado, 140k miles. Ballpark?',
        'Trying to stay close to $650/mo depending on term.',
        'If I pop in Thursday evening, could you line up a drive?'
      ]
    }
  ];

  for (const s of scenarios) {
    await createFourTurnConversation(s.firstName, s.lastName, s.vehicle, s.turns);
  }

  console.log('\n🎉 Batch complete. Check the Conversations page for the new threads.');
}

runBatch().catch((e)=>{ console.error(e); process.exit(1); });

