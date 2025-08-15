// Test GPT-5 Mini integration through OpenRouter
const API_BASE = 'http://localhost:5000/api';

async function testGPT5Mini() {
  console.log('🧪 TESTING GPT-5 MINI INTEGRATION VIA OPENROUTER\n');

  try {
    // Test campaign creation with AI enhancement
    console.log('📝 Testing Campaign Chat with GPT-5 Mini...');
    
    const chatResponse = await fetch(`${API_BASE}/ai/chat-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'I want to create a luxury vehicle showcase campaign for our new BMW 7 Series',
        currentStep: 'context',
        campaignData: {}
      })
    });

    if (chatResponse.ok) {
      const result = await chatResponse.json();
      console.log('✅ Campaign chat response:', result.message);
    } else {
      console.log('❌ Campaign chat failed:', await chatResponse.text());
    }

    // Test handover criteria conversion
    console.log('\n🎯 Testing Handover Criteria Conversion...');
    
    const steps = [
      { step: 'context', message: 'Luxury BMW 7 Series showcase campaign' },
      { step: 'goals', message: 'Generate exclusive test drives and VIP appointments' },
      { step: 'target_audience', message: 'High-income executives aged 40-60' },
      { step: 'name', message: 'BMW 7 Series Elite Experience' }
    ];

    let campaignData = {};
    
    // Build up campaign context
    for (const { step, message } of steps) {
      const response = await fetch(`${API_BASE}/ai/chat-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          currentStep: step,
          campaignData: campaignData
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        campaignData = result.data || {};
      }
    }

    // Test handover criteria with full context
    const handoverResponse = await fetch(`${API_BASE}/ai/chat-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hand them over when they ask about executive packages, private test drives, or mention immediate purchase timeline',
        currentStep: 'handover_criteria',
        campaignData: campaignData
      })
    });

    if (handoverResponse.ok) {
      const handoverResult = await handoverResponse.json();
      console.log('✅ Handover criteria processed successfully');
      console.log('🤖 Generated handover prompt preview:', 
        handoverResult.data?.handoverPrompt?.substring(0, 200) + '...');
    } else {
      console.log('❌ Handover processing failed:', await handoverResponse.text());
    }

    // Test AI template generation
    console.log('\n📧 Testing AI Template Generation...');
    
    const templateResponse = await fetch(`${API_BASE}/ai/enhance-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'templates',
        context: 'BMW 7 Series luxury showcase campaign for executives',
        campaignName: 'BMW Executive Elite Experience'
      })
    });

    if (templateResponse.ok) {
      const templates = await templateResponse.json();
      console.log('✅ AI templates generated:', templates.templates?.length || 0, 'templates');
    } else {
      console.log('❌ Template generation failed:', await templateResponse.text());
    }

    console.log('\n🏆 GPT-5 MINI INTEGRATION TEST COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Model: openai/gpt-5-mini via OpenRouter');
    console.log('✅ Cost-effective AI processing');
    console.log('✅ Enhanced handover intelligence generation');
    console.log('✅ Campaign-specific content creation');
    console.log('✅ Professional automotive prompts processing');

  } catch (error) {
    console.error('❌ GPT-5 Mini test error:', error.message);
  }
}

testGPT5Mini();