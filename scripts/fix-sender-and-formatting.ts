#!/usr/bin/env tsx

/**
 * Fix Sender Name and Response Formatting
 * Updates sender name and AI response style to be professional and concise
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function updateAgentConfiguration(): Promise<void> {
  console.log('🔧 UPDATING AGENT CONFIGURATION');
  console.log('===============================\n');

  try {
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get the Kunes Macomb agent
    const kunesMacombId = '2e7bbd27-f1a0-44e6-95c6-4b2cea8a2360';
    const [agent] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.id, kunesMacombId));
    
    if (!agent) {
      console.log('❌ Kunes Macomb agent not found');
      return;
    }
    
    console.log(`🤖 Updating agent: ${agent.name}`);
    
    // Update agent with professional configuration
    const updatedSettings = {
      autoRespond: true,
      responseDelay: 2000,
      enableHandover: true,
      handoverKeywords: ["speak to human", "talk to salesperson", "manager", "urgent"],
      businessHours: {
        enabled: true,
        timezone: "America/Chicago",
        schedule: {
          monday: { start: "09:00", end: "18:00" },
          tuesday: { start: "09:00", end: "18:00" },
          wednesday: { start: "09:00", end: "18:00" },
          thursday: { start: "09:00", end: "18:00" },
          friday: { start: "09:00", end: "18:00" },
          saturday: { start: "10:00", end: "16:00" },
          sunday: { start: "12:00", end: "17:00" }
        }
      },
      senderName: "Kunes Auto Macomb",
      responseStyle: "professional_concise",
      dealershipInfo: {
        name: "Kunes Auto Macomb",
        location: "Macomb, Illinois",
        phone: "(309) 833-2000",
        address: "1501 E Jackson St, Macomb, IL 61455"
      }
    };
    
    await db.update(aiAgentConfig)
      .set({
        name: 'Kunes Auto Macomb AI Assistant',
        agentEmailDomain: 'kunesmacomb.kunesauto.vip',
        settings: updatedSettings,
        personality: `You are a professional automotive sales assistant for Kunes Auto Macomb in Macomb, Illinois. 

RESPONSE STYLE:
- Professional, concise, and direct
- No emojis or casual language
- Bullet points for key information
- Clear next steps
- Always include contact information

TONE EXAMPLES:
"Hope you're doing well! I wanted to reach out about your Honda Civic inquiry.

We're helping customers like you with:
• Competitive pricing and financing options
• Comprehensive vehicle inspections
• Trade-in evaluations
• Extended warranty options

Our customers typically experience:
• Fast, no-pressure sales process
• Transparent pricing
• Expert service and support

Would you be interested in scheduling a quick test drive to see how the Civic fits your needs?

I'd love to show you why Kunes Auto Macomb has been serving the Macomb community for years.

Best regards,
Kunes Auto Macomb Team"

DEALERSHIP INFO:
- Location: Macomb, Illinois
- Phone: (309) 833-2000
- Address: 1501 E Jackson St, Macomb, IL 61455

Always end responses with professional signature and contact information.`,
        updatedAt: new Date()
      })
      .where(eq(aiAgentConfig.id, kunesMacombId));
    
    console.log('✅ Agent configuration updated');
    console.log('   Sender Name: Kunes Auto Macomb');
    console.log('   Response Style: Professional & Concise');
    console.log('   Domain: kunesmacomb.kunesauto.vip');
    
  } catch (error) {
    console.error('❌ Failed to update agent configuration:', error);
  }
}

async function testNewResponseStyle(): Promise<void> {
  console.log('\n🤖 TESTING NEW RESPONSE STYLE');
  console.log('=============================\n');
  
  try {
    const testPrompt = `You are a professional automotive sales assistant for Kunes Auto Macomb in Macomb, Illinois. 

RESPONSE STYLE:
- Professional, concise, and direct
- No emojis or casual language  
- Bullet points for key information
- Clear next steps
- Always include contact information

TONE EXAMPLE:
"Hope you're doing well! I wanted to reach out about your Honda Civic inquiry.

We're helping customers like you with:
• Competitive pricing and financing options
• Comprehensive vehicle inspections  
• Trade-in evaluations
• Extended warranty options

Would you be interested in scheduling a quick test drive?

Best regards,
Kunes Auto Macomb Team
(309) 833-2000"

Customer message: "I'm interested in a Honda Civic. Can you tell me about pricing and availability?"

Respond in the professional style shown above.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-chat',
        messages: [
          { role: 'system', content: testPrompt },
          { role: 'user', content: "I'm interested in a Honda Civic. Can you tell me about pricing and availability?" }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    });

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      
      if (aiResponse) {
        console.log('✅ New response style test:');
        console.log('─'.repeat(50));
        console.log(aiResponse);
        console.log('─'.repeat(50));
      } else {
        console.log('❌ No AI response generated');
      }
    } else {
      console.log('❌ AI response test failed');
    }
    
  } catch (error) {
    console.error('❌ Response style test failed:', error);
  }
}

async function testEmailWithNewSender(): Promise<void> {
  console.log('\n📧 TESTING EMAIL WITH NEW SENDER');
  console.log('================================\n');
  
  try {
    const testEmailBody = `Hope you're doing well! I wanted to reach out about your Honda Civic inquiry.

We're helping customers like you with:
• Competitive pricing and financing options
• Comprehensive vehicle inspections
• Trade-in evaluations
• Extended warranty options

Our customers typically experience:
• Fast, no-pressure sales process
• Transparent pricing
• Expert service and support

Would you be interested in scheduling a quick test drive to see how the Civic fits your needs?

I'd love to show you why Kunes Auto Macomb has been serving the Macomb community for years.

Best regards,
Kunes Auto Macomb Team
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455`;

    const emailResponse = await fetch(`https://api.mailgun.net/v3/kunesmacomb.kunesauto.vip/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: 'Kunes Auto Macomb <noreply@kunesmacomb.kunesauto.vip>',
        to: 'josh@atsglobal.ai',
        subject: 'Re: Honda Civic Inquiry',
        text: testEmailBody
      })
    });

    if (emailResponse.ok) {
      console.log('✅ Test email sent with new formatting');
      console.log('   From: Kunes Auto Macomb <noreply@kunesmacomb.kunesauto.vip>');
      console.log('   Style: Professional & Concise');
      console.log('📧 Check josh@atsglobal.ai inbox');
    } else {
      const error = await emailResponse.text();
      console.log('❌ Test email failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

async function testProductionFlow(): Promise<void> {
  console.log('\n🔄 TESTING PRODUCTION FLOW WITH NEW STYLE');
  console.log('=========================================\n');
  
  try {
    console.log('🚀 Sending production test...');
    
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'style-test-' + Math.random().toString(36).substring(7);
    const signature = crypto.createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '')
      .update(timestamp + token)
      .digest('hex');

    const response = await fetch('https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        sender: 'josh@atsglobal.ai',
        recipient: 'campaigns@kunesmacomb.kunesauto.vip',
        subject: 'Honda Civic - Professional Style Test',
        'body-plain': 'Hi, I am interested in a Honda Civic. Can you provide pricing information and help me schedule a test drive? I need to make a decision soon.',
        timestamp,
        token,
        signature,
        'message-id': `<style-test-${Date.now()}@test.com>`
      })
    });

    const responseText = await response.text();
    console.log(`📡 Production Response: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log('✅ Production webhook processed');
      console.log('⏱️  AI response should use new professional style');
      console.log('📧 From: Kunes Auto Macomb <noreply@kunesmacomb.kunesauto.vip>');
      console.log('📧 Check josh@atsglobal.ai inbox in 30 seconds');
    } else {
      console.log('❌ Production webhook failed');
    }
    
  } catch (error) {
    console.error('❌ Production flow test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('🎨 FIXING SENDER NAME AND FORMATTING');
  console.log('====================================\n');
  
  console.log('Changes being made:');
  console.log('   ❌ OneKeel Swarm → ✅ Kunes Auto Macomb');
  console.log('   ❌ Casual tone with emojis → ✅ Professional & concise');
  console.log('   ❌ Long explanations → ✅ Bullet points & clear next steps');
  console.log('   ❌ Generic signature → ✅ Dealership contact info');
  console.log('');
  
  await updateAgentConfiguration();
  await testNewResponseStyle();
  await testEmailWithNewSender();
  await testProductionFlow();
  
  console.log('\n🎉 SENDER AND FORMATTING UPDATED');
  console.log('================================');
  console.log('AI responses should now be professional and concise');
  console.log('with proper Kunes Auto Macomb branding.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
