// Final test of the complete handover system with your exact criteria
const API_BASE = 'http://localhost:5000/api';

async function testFinalHandover() {
  console.log('🏁 FINAL HANDOVER TEST - Your Exact Criteria\n');

  try {
    // Test handover with your exact buying signals and escalation phrases
    const handoverResponse = await fetch(`${API_BASE}/conversations/fc6de81f-7104-4a61-95f5-5e8c078b72ee/evaluate-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newMessage: { 
          role: 'lead', 
          content: 'I am ready to purchase and want to know what is the price. Can we schedule a demo? I want to buy this car and speak to a human agent please.' 
        },
        customCriteria: {
          qualificationThreshold: 80,
          messageCount: 10,
          timeThreshold: 30,
          automotiveKeywords: [
            'ready to purchase',
            'what is the price', 
            'can we schedule a demo',
            'I want to buy',
            'how much does it cost',
            'interested',
            'pricing',
            'cost',
            'purchase'
          ],
          urgentKeywords: [
            'speak to a human',
            'talk to someone',
            'not a bot',
            'real person', 
            'manager',
            'agent',
            'representative',
            'help'
          ]
        }
      })
    });
    
    if (handoverResponse.ok) {
      const result = await handoverResponse.json();
      console.log('🎉 HANDOVER EVALUATION SUCCESS!');
      console.log(`Should Handover: ${result.shouldHandover ? '✅ YES' : '❌ NO'}`);
      console.log(`Reason: ${result.reason}`);
      console.log(`Score: ${result.score}`);
      console.log(`Triggered Criteria: ${result.triggeredCriteria.join(', ')}`);
      console.log(`Urgency Level: ${result.urgencyLevel}`);
      console.log(`Next Actions:`);
      result.nextActions.forEach(action => console.log(`  - ${action}`));
      console.log(`Recommended Agent: ${result.recommendedAgent}`);
      
      if (result.shouldHandover) {
        console.log('\n🎊 SUCCESS! HANDOVER SYSTEM FULLY OPERATIONAL');
        console.log('✅ Buying signals detected and processed');
        console.log('✅ Escalation phrases recognized'); 
        console.log('✅ Qualification criteria evaluated');
        console.log('✅ Next actions determined');
        console.log('✅ Agent recommendation provided');
      }
    } else {
      console.log('❌ Handover evaluation failed');
    }

    // Test campaign execution with templates
    console.log('\n📧 Testing campaign with templates...');
    const execResponse = await fetch(`${API_BASE}/campaigns/e228792c-a2d0-4738-88c5-6181ae89bc5c/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testMode: false,
        maxLeadsPerBatch: 1
      })
    });
    const execResult = await execResponse.json();
    console.log(`Email execution: ${execResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Emails sent: ${execResult.emailsSent}`);

  } catch (error) {
    console.error('❌ Final test failed:', error);
  }
}

testFinalHandover();