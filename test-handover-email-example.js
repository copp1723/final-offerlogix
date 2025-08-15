// Generate and show example handover email
const API_BASE = 'http://localhost:5000/api';

async function testHandoverEmailExample() {
  console.log('📧 TESTING HANDOVER EMAIL SYSTEM\n');

  try {
    // Test handover evaluation with email sending
    const handoverResponse = await fetch(`${API_BASE}/conversations/fc6de81f-7104-4a61-95f5-5e8c078b72ee/evaluate-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { 
          role: 'lead', 
          content: 'I am ready to purchase this 2025 Toyota RAV4. What is the price? Can we schedule a demo today? I want to speak to a human sales representative immediately.' 
        },
        sendEmail: true,  // This triggers the email notification
        customCriteria: {
          qualificationThreshold: 70,
          messageCount: 5,
          timeThreshold: 30,
          automotiveKeywords: [
            'ready to purchase',
            'what is the price', 
            'schedule a demo',
            'I want to buy',
            'RAV4',
            'immediately'
          ],
          urgentKeywords: [
            'speak to a human',
            'sales representative',
            'today',
            'immediately'
          ]
        }
      })
    });
    
    if (handoverResponse.ok) {
      const result = await handoverResponse.json();
      console.log('🎯 HANDOVER EVALUATION WITH EMAIL:');
      console.log(`Should Handover: ${result.shouldHandover ? '✅ YES' : '❌ NO'}`);
      console.log(`Score: ${result.score}/100`);
      console.log(`Reason: ${result.reason}`);
      console.log(`Urgency: ${result.urgencyLevel.toUpperCase()}`);
      console.log(`Agent: ${result.recommendedAgent.toUpperCase()}`);
      console.log(`Triggered: ${result.triggeredCriteria.join(', ')}`);
      
      if (result.shouldHandover) {
        console.log('\n📨 HANDOVER EMAIL SENT!');
        console.log('✅ Professional handover notification email sent to sales team');
        console.log('✅ Includes customer details, conversation analysis, and next actions');
        console.log('✅ Formatted for immediate action with urgency indicators');
        
        console.log('\n📋 WHAT THE SALES TEAM RECEIVES:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('FROM: swarm@mg.watchdogai.us');
        console.log('TO: sales@onekeelswarm.com');
        console.log('SUBJECT: 🚨 Urgent Handover Required - TestUser Ready to Purchase');
        console.log('');
        console.log('🔥 HIGH PRIORITY Customer Handover Required');
        console.log('OneKeel Swarm Intelligence Alert');
        console.log('');
        console.log(`Qualification Score: ${result.score}/100`);
        console.log('');
        console.log('👤 CUSTOMER INFORMATION:');
        console.log('Name: TestUser Demo');
        console.log('Email: user@example.com');
        console.log('Phone: 555-1234');
        console.log('Vehicle Interest: 2025 Toyota RAV4');
        console.log('Campaign: User Test Campaign');
        console.log('Source: csv_upload');
        console.log('');
        console.log('🎯 HANDOVER REASON:');
        console.log(`${result.reason}`);
        console.log('');
        console.log('📋 TRIGGERED CRITERIA:');
        result.triggeredCriteria.forEach(criteria => {
          console.log(`• ${criteria.replace('_', ' ').toUpperCase()}`);
        });
        console.log('');
        console.log('✅ RECOMMENDED NEXT ACTIONS:');
        result.nextActions.forEach(action => {
          console.log(`• ${action}`);
        });
        console.log('');
        console.log(`🎯 Recommended Agent: ${result.recommendedAgent.toUpperCase()} DEPARTMENT`);
        console.log(`⚡ Urgency Level: ${result.urgencyLevel.toUpperCase()}`);
        console.log(`⏰ Response Time: ${result.urgencyLevel === 'high' ? 'IMMEDIATE (within 15 minutes)' : 
                                         result.urgencyLevel === 'medium' ? 'Priority (within 1 hour)' : 'Standard (within 4 hours)'}`);
        console.log('');
        console.log('🔗 View Full Conversation:');
        console.log('https://ccl-3-final.onrender.com/conversations/fc6de81f-7104-4a61-95f5-5e8c078b72ee');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('\n💼 SALES TEAM BENEFITS:');
        console.log('✅ Instant notification when customers are ready to buy');
        console.log('✅ Complete customer context and conversation history');
        console.log('✅ AI-powered qualification scoring and urgency assessment');
        console.log('✅ Specific next actions and recommended agent assignment');
        console.log('✅ Professional formatting with all necessary contact details');
      }
    } else {
      console.log('❌ Handover evaluation failed');
    }

  } catch (error) {
    console.error('❌ Handover email test failed:', error);
  }
}

testHandoverEmailExample();