// Test handover system with real conversation example
const API_BASE = 'http://localhost:5000/api';

async function testHandoverExample() {
  console.log('🎯 HANDOVER SYSTEM DEMONSTRATION\n');

  try {
    // First, let's get a real lead to work with
    console.log('📋 Getting leads...');
    const leadsResponse = await fetch(`${API_BASE}/leads`);
    const leads = await leadsResponse.json();
    
    if (!leads.length) {
      console.log('❌ No leads found for handover demo');
      return;
    }
    
    const testLead = leads[0];
    console.log(`✅ Using lead: ${testLead.name} (${testLead.email})`);
    
    // Get conversations for this lead
    const conversationsResponse = await fetch(`${API_BASE}/conversations`);
    const conversations = await conversationsResponse.json();
    const leadConversation = conversations.find(c => c.leadId === testLead.id);
    
    if (!leadConversation) {
      console.log('❌ No conversation found for this lead');
      return;
    }
    
    console.log(`✅ Found conversation: ${leadConversation.id}`);
    
    // Simulate customer messages that should trigger handover
    const handoverTriggerMessages = [
      // High-intent buying signals
      "I'm ready to purchase this vehicle. What's the best price you can offer?",
      
      // Immediate timeline signals  
      "I need to buy a car by next week. Can we schedule something today?",
      
      // Competitive comparison (shows serious consideration)
      "I'm comparing this with a BMW X5. Can someone explain the differences?",
      
      // Direct request for human interaction
      "Can I speak to a real person about financing options?",
      
      // Technical expertise request
      "I have specific questions about the engine specs that I need an expert to answer"
    ];
    
    console.log('\n🤖 Testing Handover Detection...\n');
    
    for (let i = 0; i < handoverTriggerMessages.length; i++) {
      const message = handoverTriggerMessages[i];
      console.log(`📤 Customer Message ${i + 1}:`);
      console.log(`"${message}"`);
      
      // Send message and check for handover
      const messageResponse = await fetch(`${API_BASE}/conversations/${leadConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          sender: 'customer',
          timestamp: new Date().toISOString()
        })
      });
      
      if (messageResponse.ok) {
        const result = await messageResponse.json();
        
        // Check if handover was triggered
        if (result.handoverTriggered) {
          console.log('🚨 HANDOVER TRIGGERED!');
          console.log(`📊 Score: ${result.handoverScore}/100`);
          console.log(`🎯 Reason: ${result.handoverReason}`);
          console.log(`⚡ Urgency: ${result.urgencyLevel}`);
          
          if (result.handoverEmailSent) {
            console.log('📧 Sales team notification sent');
          }
          
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
          console.log('✅ Message processed, no handover needed');
        }
        
        console.log('🤖 AI Response:', result.aiResponse?.substring(0, 100) + '...\n');
      }
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Show handover statistics
    console.log('\n📈 HANDOVER SYSTEM SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Get updated conversation to check handover status
    const updatedConversationResponse = await fetch(`${API_BASE}/conversations/${leadConversation.id}`);
    const updatedConversation = await updatedConversationResponse.json();
    
    console.log(`🎯 Conversation Status: ${updatedConversation.status || 'Active'}`);
    console.log(`📧 Lead Email: ${testLead.email}`);
    console.log(`🚗 Vehicle Interest: ${testLead.vehicleInterest || 'General'}`);
    console.log(`📞 Phone: ${testLead.phone || 'Not provided'}`);
    
    // Show handover criteria that would be used
    console.log('\n🧠 HANDOVER INTELLIGENCE CRITERIA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 HIGH PRIORITY (90-100): "ready to purchase", "what is the price", immediate timeline');
    console.log('⚡ PRIORITY (80-89): competitive comparisons, financing questions, specific appointments');
    console.log('📋 STANDARD (75-79): technical questions, feature comparisons, general interest');
    console.log('🌱 NURTURE (50-74): information gathering, early research phase');
    
    console.log('\n✅ HANDOVER DEMONSTRATION COMPLETE');
    
  } catch (error) {
    console.error('❌ Handover test error:', error.message);
  }
}

testHandoverExample();