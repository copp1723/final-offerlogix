// Test the campaign creator agent with handover configuration
const API_BASE = 'http://localhost:5000/api';

async function testCampaignChatFlow() {
  console.log('🤖 TESTING CAMPAIGN CREATOR AGENT WITH HANDOVER CONFIGURATION\n');

  const steps = [
    {
      step: 'context',
      userMessage: 'I want to create a campaign for our new 2025 Honda CR-V launch. We want to generate test drives and showcase the new features.',
      description: 'Campaign context and type'
    },
    {
      step: 'name', 
      userMessage: '2025 Honda CR-V Launch Campaign',
      description: 'Campaign name'
    },
    {
      step: 'goals',
      userMessage: 'Generate test drive appointments, showcase safety features, and convert interested prospects into buyers',
      description: 'Campaign goals'
    },
    {
      step: 'handover_criteria',
      userMessage: 'Hand them over when they ask about pricing, want to schedule a test drive, ask about financing options, or seem urgent like they need to buy soon. Also if they want to speak to a human or sales person.',
      description: 'Handover criteria (the key part!)'
    },
    {
      step: 'email_templates',
      userMessage: '7',
      description: 'Number of email templates'
    }
  ];

  let campaignData = {};
  
  for (let i = 0; i < steps.length; i++) {
    const { step, userMessage, description } = steps[i];
    
    console.log(`📝 STEP ${i + 1}: ${description}`);
    console.log(`USER: "${userMessage}"`);
    
    try {
      const response = await fetch(`${API_BASE}/ai/chat-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          currentStep: step,
          campaignData: campaignData
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`🤖 AGENT: ${result.message}`);
        
        if (result.data) {
          campaignData = result.data;
        }
        
        if (result.completed) {
          console.log('\n🎉 CAMPAIGN CREATION COMPLETED!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`✅ Campaign Name: ${result.data.name}`);
          console.log(`✅ Context: ${result.data.context}`);
          console.log(`✅ Goals: ${result.data.handoverGoals}`);
          console.log(`✅ Email Templates: ${result.data.templateCount}`);
          console.log(`✅ Campaign ID: ${result.data.id}`);
          
          console.log('\n🎯 HANDOVER CONFIGURATION:');
          console.log('User said: "Hand them over when they ask about pricing, want to schedule a test drive..."');
          console.log('\n🤖 AI Generated Handover Prompt:');
          console.log(result.data.handoverPrompt || 'Not generated');
          
          console.log('\n🔄 THE COMPLETE FLOW:');
          console.log('1. ✅ User describes campaign context');
          console.log('2. ✅ User provides campaign name and goals');
          console.log('3. ✅ User describes handover criteria in natural language');
          console.log('4. ✅ AI converts "gibberish" into structured handover prompt');
          console.log('5. ✅ Campaign created with custom handover rules');
          console.log('6. ✅ Future conversations will use these custom handover criteria');
          
          break;
        }
        
        console.log(`➡️ Next Step: ${result.nextStep}\n`);
        
      } else {
        console.log(`❌ Failed step ${i + 1}`);
      }
      
    } catch (error) {
      console.error(`❌ Error in step ${i + 1}:`, error.message);
    }
  }
}

testCampaignChatFlow();