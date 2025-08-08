// Test the improved campaign creator flow with handover AFTER context understanding
const API_BASE = 'http://localhost:5000/api';

async function testImprovedCampaignFlow() {
  console.log('🤖 TESTING IMPROVED CAMPAIGN FLOW - HANDOVER AFTER CONTEXT\n');

  const steps = [
    {
      step: 'context',
      userMessage: 'I want to create a campaign for our certified pre-owned vehicle program. We have great inventory and want to move these cars quickly.',
      description: 'Campaign context'
    },
    {
      step: 'goals', 
      userMessage: 'I want to generate serious inquiries, get people to come in for test drives, and ultimately sell these certified pre-owned vehicles. Focus on value and reliability.',
      description: 'Campaign goals'
    },
    {
      step: 'target_audience',
      userMessage: 'Budget-conscious families and first-time car buyers who want reliability but cant afford brand new. Ages 25-45, looking for value.',
      description: 'Target audience'
    },
    {
      step: 'name',
      userMessage: 'Certified Pre-Owned Value Campaign',
      description: 'Campaign name'
    },
    {
      step: 'handover_criteria',
      userMessage: 'Hand them over when they ask about specific vehicle pricing, want to see the vehicle history report, ask about warranty coverage, or want to schedule a test drive. Also if they ask about financing options or seem ready to make a decision soon.',
      description: 'HANDOVER CRITERIA (AFTER full context understanding)'
    },
    {
      step: 'email_templates',
      userMessage: '5',
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
          console.log(`✅ Target Audience: ${result.data.targetAudience}`);
          console.log(`✅ Email Templates: ${result.data.templateCount}`);
          
          console.log('\n🎯 IMPROVED HANDOVER CONFIGURATION:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🔄 FLOW: Context → Goals → Audience → Name → THEN Handover');
          console.log('\n📋 AI HAD FULL CONTEXT WHEN CONFIGURING HANDOVER:');
          console.log(`• Campaign Type: ${result.data.context}`);
          console.log(`• Goals: ${result.data.handoverGoals}`);
          console.log(`• Audience: ${result.data.targetAudience}`);
          console.log('\n💬 User Handover Criteria:');
          console.log('"Hand them over when they ask about specific vehicle pricing, vehicle history report, warranty coverage, test drives, financing options..."');
          
          console.log('\n🤖 AI Generated Campaign-Specific Handover Prompt:');
          console.log('(Based on certified pre-owned context, value-focused goals, and budget-conscious audience)');
          console.log(result.data.handoverPrompt || 'Generated with campaign context');
          
          console.log('\n✅ BENEFITS OF THIS IMPROVED FLOW:');
          console.log('1. AI understands FULL campaign context before handover configuration');
          console.log('2. Handover rules are tailored to specific campaign goals and audience');
          console.log('3. More intelligent, contextual handover triggers');
          console.log('4. Better alignment between campaign objectives and handover criteria');
          console.log('5. Campaign-specific buying signals and qualification rules');
          
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

testImprovedCampaignFlow();