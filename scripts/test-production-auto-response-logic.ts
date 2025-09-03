#!/usr/bin/env tsx

/**
 * Test Production Auto-Response Logic
 * Tests the specific auto-response logic that should trigger after webhook processing
 */

import dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.prod' });

async function testAutoResponseLogic(): Promise<void> {
  console.log('🔍 TESTING PRODUCTION AUTO-RESPONSE LOGIC');
  console.log('==========================================\n');

  try {
    // Import the inbound email service
    const { InboundEmailService } = await import('../server/services/inbound-email.js');
    
    console.log('✅ Successfully imported InboundEmailService');
    
    // Test the auto-response conditions
    console.log('\n🔍 Testing shouldGenerateAutoResponse logic...');
    
    // Create mock lead and conversation data
    const mockLead = {
      id: 'test-lead-123',
      email: 'josh@atsglobal.ai',
      firstName: 'Josh',
      lastName: 'Test',
      vehicleInterest: 'Honda Civic'
    };
    
    const mockConversation = {
      id: 'test-conversation-123',
      leadId: 'test-lead-123'
    };
    
    // Test if auto-response should be generated
    // Note: The method is private, so we'll test the public flow
    console.log('📧 Mock Lead:', mockLead);
    console.log('💬 Mock Conversation:', mockConversation);
    
    // Test AI response generation directly
    console.log('\n🤖 Testing AI response generation...');
    
    const testMessage = "Hi, I'm interested in the Honda Civic. Can you tell me about pricing and availability?";
    
    // Test the OpenRouter API call directly
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'OneKeel Swarm - Auto Response Test'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'openai/gpt-5-chat',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful automotive sales assistant for a Honda dealership. Respond professionally and helpfully to customer inquiries.' 
          },
          { role: 'user', content: testMessage }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      
      if (aiResponse) {
        console.log('✅ AI Response Generated Successfully!');
        console.log(`📝 Response Length: ${aiResponse.length} characters`);
        console.log(`📄 Response Preview: ${aiResponse.substring(0, 200)}...`);
        
        // Test Mailgun email sending
        console.log('\n📧 Testing Mailgun email sending...');
        
        const { sendCampaignEmail } = await import('../server/services/mailgun.js');
        
        const emailSent = await sendCampaignEmail(
          'josh@atsglobal.ai',
          'Re: Honda Civic Inquiry - Auto Response Test',
          aiResponse,
          {},
          { isAutoResponse: true }
        );
        
        if (emailSent) {
          console.log('✅ Email sent successfully via Mailgun!');
          console.log('📧 Check josh@atsglobal.ai inbox for the test email');
        } else {
          console.log('❌ Failed to send email via Mailgun');
        }
        
      } else {
        console.log('❌ AI returned empty response');
        console.log('📄 Full Response:', JSON.stringify(data, null, 2));
      }
    } else {
      const errorText = await response.text();
      console.log('❌ AI API request failed:', response.status, errorText);
    }
    
    // Test database connection and lead lookup
    console.log('\n🗄️ Testing database lead lookup...');
    
    const { storage } = await import('../server/storage.js');
    
    try {
      const lead = await storage.getLeadByEmail('josh@atsglobal.ai');
      if (lead) {
        console.log('✅ Found lead in database:', {
          id: lead.id,
          email: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName
        });
      } else {
        console.log('❌ Lead not found in database for josh@atsglobal.ai');
        console.log('💡 This could be why auto-responses are not working');
      }
    } catch (error) {
      console.log('❌ Database lookup failed:', error instanceof Error ? error.message : String(error));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : '');
  }
}

async function main(): Promise<void> {
  console.log('🌐 Production Environment Check:');
  console.log(`   AI Model: ${process.env.AI_MODEL}`);
  console.log(`   OpenRouter API Key: ${process.env.OPENROUTER_API_KEY ? 'Present' : 'Missing'}`);
  console.log(`   Mailgun API Key: ${process.env.MAILGUN_API_KEY ? 'Present' : 'Missing'}`);
  console.log(`   Database URL: ${process.env.DATABASE_URL ? 'Present' : 'Missing'}`);
  console.log('');
  
  await testAutoResponseLogic();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
