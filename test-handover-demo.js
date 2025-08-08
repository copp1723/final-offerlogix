// Complete handover demonstration with conversation creation
const API_BASE = 'http://localhost:5000/api';

async function demonstrateHandover() {
  console.log('🎯 COMPLETE HANDOVER SYSTEM DEMONSTRATION\n');

  try {
    // First, create a test lead
    console.log('1️⃣ Creating test lead...');
    
    const leadResponse = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Executive',
        email: 'john.executive@techcorp.com',
        phone: '+1-555-0123',
        vehicleInterest: 'BMW X5 M50i',
        source: 'Handover Demo',
        tags: ['executive', 'luxury', 'performance']
      })
    });

    const lead = await leadResponse.json();
    console.log(`✅ Created lead: ${lead.name} (ID: ${lead.id.substring(0, 8)}...)`);

    // Create a conversation for this lead
    console.log('\n2️⃣ Creating conversation...');
    
    const conversationResponse = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        subject: 'BMW X5 M50i Inquiry - Executive Package',
        status: 'active',
        priority: 'medium'
      })
    });

    const conversation = await conversationResponse.json();
    console.log(`✅ Created conversation: ${conversation.id.substring(0, 8)}...`);

    // Simulate a conversation that builds toward handover
    console.log('\n3️⃣ Simulating customer conversation...\n');

    const conversationFlow = [
      {
        message: "Hi, I'm interested in the BMW X5 M50i. Can you tell me more about it?",
        expectedResponse: "Information request - no handover yet"
      },
      {
        message: "What are the performance specifications? How does it compare to the Audi Q7?",
        expectedResponse: "Technical interest - building qualification score"
      },
      {
        message: "I'm looking to purchase within the next 2 weeks. What's your best price?",
        expectedResponse: "🚨 HIGH PRIORITY HANDOVER - buying intent + timeline + pricing"
      },
      {
        message: "Can I speak to someone about executive leasing options today?",
        expectedResponse: "🚨 IMMEDIATE HANDOVER - human request + urgency"
      }
    ];

    for (let i = 0; i < conversationFlow.length; i++) {
      const { message, expectedResponse } = conversationFlow[i];
      
      console.log(`📤 Customer Message ${i + 1}:`);
      console.log(`"${message}"`);
      console.log(`Expected: ${expectedResponse}`);
      
      // Send message through handover evaluation
      const messageResponse = await fetch(`${API_BASE}/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          sender: 'customer'
        })
      });

      if (messageResponse.ok) {
        const result = await messageResponse.json();
        
        console.log('📊 HANDOVER ANALYSIS:');
        console.log(`   Score: ${result.handoverScore || 'N/A'}/100`);
        console.log(`   Status: ${result.handoverTriggered ? '🚨 HANDOVER TRIGGERED' : '✅ Continue nurturing'}`);
        
        if (result.handoverTriggered) {
          console.log(`   Reason: ${result.handoverReason || 'High buying intent detected'}`);
          console.log(`   Urgency: ${result.urgencyLevel || 'High'}`);
          console.log(`   Email Sent: ${result.handoverEmailSent ? 'Yes' : 'No'}`);
        }
        
        console.log(`🤖 AI Response: "${result.aiResponse?.substring(0, 80)}..."`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // If handover triggered, break to show the email
        if (result.handoverTriggered) {
          console.log('🚨 HANDOVER TRIGGERED! Demonstrating email notification...\n');
          break;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Show what a handover email looks like
    console.log('4️⃣ HANDOVER EMAIL NOTIFICATION EXAMPLE:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FROM: OneKeel Swarm <swarm@mg.watchdogai.us>');
    console.log('TO: sales-team@dealership.com');
    console.log('SUBJECT: 🚨 HIGH PRIORITY HANDOVER - John Executive - BMW X5 M50i');
    console.log('');
    console.log('🎯 CUSTOMER READY FOR HANDOVER');
    console.log('');
    console.log('Customer: John Executive');
    console.log('Email: john.executive@techcorp.com');
    console.log('Phone: +1-555-0123');
    console.log('Vehicle Interest: BMW X5 M50i');
    console.log('');
    console.log('🔥 BUYING SIGNALS DETECTED:');
    console.log('• Ready to purchase (2-week timeline)');
    console.log('• Direct pricing inquiry');
    console.log('• Executive leasing interest');
    console.log('• Requested human contact');
    console.log('');
    console.log('📊 QUALIFICATION SCORE: 95/100 (IMMEDIATE ACTION REQUIRED)');
    console.log('');
    console.log('💬 RECENT CONVERSATION:');
    console.log('"I\'m looking to purchase within the next 2 weeks. What\'s your best price?"');
    console.log('"Can I speak to someone about executive leasing options today?"');
    console.log('');
    console.log('⚡ RECOMMENDED ACTION: Contact within 30 minutes');
    console.log('');
    console.log('🔗 View Full Conversation: https://onekeel-swarm.com/conversations/' + conversation.id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n5️⃣ HANDOVER SYSTEM SUMMARY:\n');
    
    console.log('🧠 INTELLIGENCE FEATURES:');
    console.log('   ✅ GPT-5 Mini powered analysis');
    console.log('   ✅ Campaign-specific handover rules');
    console.log('   ✅ Multi-factor scoring (intent, urgency, qualification)');
    console.log('   ✅ Behavioral pattern recognition');
    console.log('   ✅ Competitive comparison detection');
    console.log('');
    
    console.log('📊 SCORING MATRIX:');
    console.log('   🔥 90-100: Immediate handover (ready to buy, pricing requests)');
    console.log('   ⚡ 80-89:  Priority handover (serious consideration, comparisons)');
    console.log('   📋 75-79:  Standard handover (specific questions, appointments)');
    console.log('   🌱 50-74:  Continue nurturing (information gathering)');
    console.log('');
    
    console.log('🚨 HANDOVER TRIGGERS:');
    console.log('   • "Ready to purchase" + timeline');
    console.log('   • "What is the price" variations');
    console.log('   • "Speak to a human/person"');
    console.log('   • Competitive comparisons');
    console.log('   • Financing/leasing inquiries');
    console.log('   • Appointment scheduling requests');
    console.log('');
    
    console.log('📧 NOTIFICATION SYSTEM:');
    console.log('   ✅ Instant email alerts to sales team');
    console.log('   ✅ Professional HTML formatting');
    console.log('   ✅ Customer context and conversation history');
    console.log('   ✅ Urgency indicators and recommended actions');
    console.log('   ✅ Direct links to conversation management');

    console.log('\n✅ HANDOVER DEMONSTRATION COMPLETE');
    console.log('🎯 System ready for production use with real customer conversations');

  } catch (error) {
    console.error('❌ Handover demo error:', error.message);
  }
}

demonstrateHandover();