// Simulate multi-turn lead conversations for each test campaign to observe real LLM replies and handover evaluations
// Run with: npx tsx test/test-campaign-conversations.ts

import { testCampaigns } from './campaign-test-data';
import { storage } from '../server/storage';
import { CampaignChatService } from '../server/services/campaign-chat';
import { HandoverService } from '../server/services/handover-service';
import { LLMClient } from '../server/services/llm-client';

interface SimTurn { role: 'lead' | 'agent'; content: string; note?: string }

// Conversation seed patterns per campaign type to trigger varied signals
const seedScripts: Record<string, SimTurn[]> = {
  'Dog Days Blowout': [
    { role: 'lead', content: 'Hi, saw you have leftover 2024 models—what kind of pricing drop are we talking about on an AWD SUV?' },
    { role: 'agent', content: 'We do have aggressive pricing on remaining 2024 AWD SUVs. Are you comparing specific trims or just exploring value options?' },
    { role: 'lead', content: 'Looking for something reliable, maybe RAV4 or CR-V equivalent. What would monthly payments look like with 5k down?' },
    { role: 'agent', content: 'Got it. I can outline typical payment ranges. Are you trying to finalize something this week or just gathering numbers?' },
    { role: 'lead', content: 'Ideally want to come in this weekend—can I lock in a test drive slot? Also have a trade, 2017 Rogue ~92k miles.' }
  ],
  'Truckpocalypse 2025': [
    { role: 'lead', content: 'Saw your truck inventory blast—need something that tows 8k lbs. What packages are left on the F-150s?' },
    { role: 'agent', content: 'We have several F-150 configurations. Are you prioritizing towing tech, payload, or price efficiency?' },
    { role: 'lead', content: 'Towing + durability. Also comparing Silverado. Do you do any fleet pricing? Might need two units.' },
    { role: 'agent', content: 'Yes, we can structure fleet / multi-unit pricing. Do you have a target acquisition timeline?' },
    { role: 'lead', content: 'Within 2 weeks if numbers work. Can someone spec out a package and call me today?' }
  ],
  "The Boss's Bad Bet Sale": [
    { role: 'lead', content: 'Heard you overbought sedans—looking for a cheap commuter. What MPG ranges are those older Civics/Corollas hitting?' },
    { role: 'agent', content: 'We have several fuel-efficient options. Are you prioritizing lowest payment, warranty coverage, or mileage?' },
    { role: 'lead', content: 'Lowest payment + reliable. First purchase. Any first-time buyer programs or flexible down payment help?' },
    { role: 'agent', content: 'Yes, there are a few starter-friendly financing programs. Are you hoping to drive one home this week?' },
    { role: 'lead', content: 'If approval works—I can come tomorrow after work. What would payment be on something around 15k with minimal down?' }
  ],
  'Labor Day Mega Savings': [
    { role: 'lead', content: 'Saw your Labor Day savings—are the extra trade credits real? I have a 2015 Accord I might swap.' },
    { role: 'agent', content: 'Yes, we are stacking bonus trade credit this weekend. Looking to upgrade into SUV, sedan, or something else?' },
    { role: 'lead', content: 'Small SUV ideally. Do those incentives end Monday? Need to know payment ballpark with a mid-tier credit score.' },
    { role: 'agent', content: 'They expire after the holiday window. Would booking a Saturday morning slot help you lock priority?' },
    { role: 'lead', content: 'Yes, can we book 10am Saturday? Want to run trade value and get pre-approved ahead of time.' }
  ],
  'Fresh Start Credit Event': [
    { role: 'lead', content: 'I was declined earlier this year elsewhere. Are you really doing second-chance approvals?' },
    { role: 'agent', content: 'We do have flexible programs. Have your credit circumstances changed or still rebuilding?' },
    { role: 'lead', content: 'Still rebuilding. Around mid 500s. What kind of down payment are you looking for on an economy sedan?' },
    { role: 'agent', content: 'Ranges vary. Do you have stable income verification ready? That helps approvals.' },
    { role: 'lead', content: 'Yes, can supply pay stubs. Want to know if I can drive something off this week if I bring 1500 down.' }
  ]
};

async function generateAgentReply(conversation: any, leadMessage: string): Promise<string> {
  // Use LLM to craft a dynamic agent reply referencing campaign context
  const campaign = conversation.campaignId ? await storage.getCampaign(conversation.campaignId) : null;
  const history = await storage.getConversationMessages(conversation.id);
  const lastFew = history.slice(-6).map(m => `${m.isFromAI ? 'Agent' : 'Lead'}: ${m.content}`).join('\n');
  const prompt = `You are an automotive AI agent continuing a campaign conversation. Campaign Name: ${campaign?.name}. Context: ${campaign?.context}. Goals: ${campaign?.handoverGoals}. Handover Criteria: ${campaign?.handoverCriteria}.\nRecent Transcript:\n${lastFew}\nLead just said: "${leadMessage}"\nRespond concisely (45-80 words), advance the sale, ask ONE focused question if appropriate. No markdown.`;
  try {
    const { content } = await LLMClient.generate({
      model: 'openai/gpt-5-chat',
      system: 'You are a sharp, ethical, conversion-focused automotive sales AI. Professional, concise, helpful.',
      user: prompt,
      temperature: 0.7,
      maxTokens: 260
    });
    return content.trim();
  } catch (e) {
    return 'Appreciate the details—can you clarify budget comfort so I can align the right options for you?';
  }
}

async function simulateCampaignConversation(campaignData: any) {
  console.log(`\n============================`);
  console.log(`🧪 Campaign Conversation: ${campaignData.name}`);
  console.log(`============================`);

  // 1. Drive campaign chat wizard to completion (if needed) using provided test data fields
  let data: any = {};
  const steps: Array<[string,string]> = [
    ['context', campaignData.context],
    ['goals', campaignData.handoverGoals.join('. ')],
    ['target_audience', campaignData.targetAudience],
    ['name', campaignData.name],
    ['handover_criteria', campaignData.handoverCriteria.join('. ')],
    ['handover_recipients', (campaignData.handoverRecipients||[]).join(', ')],
    ['email_templates', String(campaignData.numberOfTemplates)],
    ['email_cadence', String(campaignData.daysBetweenMessages)],
    ['content_generation', 'Yes generate now']
  ];

  let currentStep = 'context';
  for (const [step, message] of steps) {
    const result = await CampaignChatService.processCampaignChat(message, currentStep, data);
    if (result.data) data = result.data;
    currentStep = result.nextStep || currentStep;
    console.log(`Step ${step} -> AI: ${(result.message||'').slice(0,120)}${result.message && result.message.length>120?'…':''}`);
    if (result.completed) break;
  }

  // 2. Persist campaign (simplified) & create a conversation tied to a new lead
  const lead = await storage.createLead({
    email: `conv+${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'Lead',
    vehicleInterest: 'Mixed Inventory'
  } as any);
  const conversation = await storage.createConversation({
    leadId: lead.id,
    campaignId: data.id, // may be undefined in test mode; acceptable
    subject: `${campaignData.name} Test Conversation`,
    status: 'active',
    priority: 'normal'
  } as any);

  // 3. Run scripted multi-turn simulation + dynamic agent replies
  const script = seedScripts[campaignData.name] || [];
  let turn = 0;
  for (const entry of script) {
    turn++;
    await storage.createConversationMessage({
      conversationId: conversation.id,
      content: entry.content,
      isFromAI: entry.role === 'agent' ? 1 : 0,
      messageType: 'text',
      senderId: null as any
    } as any);
    console.log(`${entry.role === 'lead' ? '👤 Lead' : '🤖 Agent'}: ${entry.content}`);

    // If lead turn, have AI generate agent reply (unless script already provides one next)
    if (entry.role === 'lead') {
      const nextScriptTurn = script[turn];
      if (!nextScriptTurn || nextScriptTurn.role !== 'agent') {
        const aiReply = await generateAgentReply(conversation, entry.content);
        await storage.createConversationMessage({
          conversationId: conversation.id,
          content: aiReply,
          isFromAI: 1,
          messageType: 'text',
          senderId: null as any
        } as any);
        console.log(`🤖 Agent(AI): ${aiReply}`);
      }
    }

    // After each lead message, evaluate handover
    if (entry.role === 'lead') {
      const convoFull = await storage.getConversation(conversation.id);
      (convoFull as any).messages = await storage.getConversationMessages(conversation.id);
      const evaluation = await HandoverService.evaluateHandover(conversation.id, convoFull, { role: 'lead', content: entry.content });
      if (evaluation.shouldHandover) {
        console.log(`🚨 Handover Triggered: ${evaluation.reason}`);
        console.log(`   Triggered: ${evaluation.triggeredCriteria.join(', ')}`);
        break; // stop on first handover
      } else {
        console.log(`➡️  No handover yet (score ${evaluation.score}, criteria: ${evaluation.triggeredCriteria.join(', ') || 'none'})`);
      }
    }
  }

  // 4. Final transcript snippet
  const finalMessages = await storage.getConversationMessages(conversation.id);
  const snippet = finalMessages.slice(-6).map(m => `${m.isFromAI? 'Agent':'Lead'}: ${m.content}`).join('\n');
  console.log('\n🧵 Final Transcript Snippet (last 6 messages):');
  console.log(snippet);
}

(async () => {
  console.log('🚀 Simulating campaign conversations with live LLM replies & handover evaluation');
  for (const campaign of testCampaigns) {
    try {
      await simulateCampaignConversation(campaign);
    } catch (e) {
      console.error(`Failed simulation for ${campaign.name}:`, (e as Error).message);
    }
  }
  console.log('\n✅ Simulation complete');
})();
