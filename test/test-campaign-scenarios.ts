import { testCampaigns } from './campaign-test-data';
import { CampaignChatService } from '../server/services/campaign-chat';

// Test each campaign scenario through the chat flow
async function testCampaignChatScenarios() {
  console.log('🚀 Testing Campaign Chat Scenarios\n');

  for (const campaign of testCampaigns) {
    console.log(`\n📋 Testing Campaign: ${campaign.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const steps = [
      {
        step: 'context',
        message: campaign.context,
      },
      {
        step: 'goals',
        message: campaign.handoverGoals.join('. '),
      },
      {
        step: 'target_audience',
        message: campaign.targetAudience,
      },
      {
        step: 'name',
        message: campaign.name,
      },
      {
        step: 'handover_criteria',
        message: campaign.handoverCriteria.join('. '),
      },
      {
        step: 'email_templates',
        message: campaign.numberOfTemplates.toString(),
      },
      {
        step: 'email_cadence',
        message: campaign.daysBetweenMessages.toString(),
      },
    ];

    let campaignData = {} as any;

    // Create a transcript conversation to persist each step
    const { storage } = await import('../server/storage');
    const lead = await storage.createLead({
      email: `test+${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'Buyer',
      vehicleInterest: 'Mixed Inventory',
    } as any);
    const conversation = await storage.createConversation({
      leadId: lead.id,
      subject: `${campaign.name} - Campaign Chat Transcript`,
      status: 'active',
      priority: 'normal'
    } as any);

    // helper to persist messages
    const persist = async (content: string, isFromAI: 0|1) => {
      await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: null as any,
        content,
        messageType: 'text',
        isFromAI
      } as any);
    };

    for (const { step, message } of steps) {
      try {
        console.log(`\n🔄 Step: ${step}`);
        console.log(`📝 Input: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`);

        await persist(message, 0);
        const result = await CampaignChatService.processCampaignChat(message, step, campaignData);

        if (result) {
          // Show the assistant's conversational reply for this step
          if (result.message) {
            const preview = result.message.length > 220 ? result.message.slice(0, 220) + '…' : result.message;
            console.log('🤖 Assistant:', preview);
            await persist(result.message, 1);
          }
        }

        if (result.data) {
          campaignData = result.data;
          console.log('✅ Step completed successfully');
        }

        if (result.completed) {
          console.log('\n🎉 Campaign Creation Complete!');
          console.log('Final Campaign Data:');
          console.log(JSON.stringify(campaignData, null, 2));
          break;
        }

      } catch (error) {
        console.error(`❌ Error in step ${step}:`, error.message);
        break;
      }
    }
  }
}

// Run the tests
testCampaignChatScenarios().catch(console.error);
