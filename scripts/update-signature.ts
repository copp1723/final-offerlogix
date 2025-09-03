#!/usr/bin/env tsx

/**
 * Update Signature to Riley Donovan
 * Changes signature from "Kunes Auto Macomb Team" to "Riley Donovan, Client Success"
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function updateAgentSignature(): Promise<void> {
  console.log('✍️ UPDATING AGENT SIGNATURE');
  console.log('===========================\n');

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
    
    console.log(`🤖 Updating signature for: ${agent.name}`);
    
    // Update agent personality with new signature
    const updatedPersonality = `You are Riley Donovan, Client Success representative for Kunes Auto Macomb in Macomb, Illinois. 

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
Riley Donovan
Client Success
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455"

DEALERSHIP INFO:
- Location: Macomb, Illinois
- Phone: (309) 833-2000
- Address: 1501 E Jackson St, Macomb, IL 61455

Always end responses with:
"Best regards,
Riley Donovan
Client Success
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455"`;

    await db.update(aiAgentConfig)
      .set({
        personality: updatedPersonality,
        updatedAt: new Date()
      })
      .where(eq(aiAgentConfig.id, kunesMacombId));
    
    console.log('✅ Agent signature updated');
    console.log('   From: Kunes Auto Macomb Team');
    console.log('   To: Riley Donovan, Client Success');
    
  } catch (error) {
    console.error('❌ Failed to update agent signature:', error);
  }
}

async function testNewSignature(): Promise<void> {
  console.log('\n🤖 TESTING NEW SIGNATURE');
  console.log('========================\n');
  
  try {
    const testPrompt = `You are Riley Donovan, Client Success representative for Kunes Auto Macomb in Macomb, Illinois. 

RESPONSE STYLE:
- Professional, concise, and direct
- No emojis or casual language  
- Bullet points for key information
- Clear next steps
- Always include contact information

Always end responses with:
"Best regards,
Riley Donovan
Client Success
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455"

Customer message: "I'm interested in a Honda Civic. Can you tell me about pricing and availability?"

Respond in the professional style with the proper signature.`;

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
        console.log('✅ New signature test:');
        console.log('─'.repeat(60));
        console.log(aiResponse);
        console.log('─'.repeat(60));
      } else {
        console.log('❌ No AI response generated');
      }
    } else {
      console.log('❌ AI response test failed');
    }
    
  } catch (error) {
    console.error('❌ Signature test failed:', error);
  }
}

async function testEmailWithNewSignature(): Promise<void> {
  console.log('\n📧 TESTING EMAIL WITH NEW SIGNATURE');
  console.log('===================================\n');
  
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
Riley Donovan
Client Success
(309) 833-2000
1501 E Jackson St, Macomb, IL 61455`;

    const emailResponse = await fetch(`https://api.mailgun.net/v3/kunesmacomb.kunesauto.vip/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: 'Kunes Auto Macomb <sales@kunesmacomb.kunesauto.vip>',
        to: 'josh@atsglobal.ai',
        subject: 'Re: Honda Civic Inquiry - Riley Donovan',
        text: testEmailBody
      })
    });

    if (emailResponse.ok) {
      console.log('✅ Test email sent with new signature');
      console.log('   From: Kunes Auto Macomb <sales@kunesmacomb.kunesauto.vip>');
      console.log('   Signature: Riley Donovan, Client Success');
      console.log('📧 Check josh@atsglobal.ai inbox');
    } else {
      const error = await emailResponse.text();
      console.log('❌ Test email failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

async function testProductionWithNewSignature(): Promise<void> {
  console.log('\n🔄 TESTING PRODUCTION WITH NEW SIGNATURE');
  console.log('========================================\n');
  
  try {
    console.log('🚀 Sending production test with Riley Donovan signature...');
    
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'riley-test-' + Math.random().toString(36).substring(7);
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
        subject: 'Honda Civic - Riley Signature Test',
        'body-plain': 'Hi, I am interested in a Honda Civic. Can you provide pricing information and help me schedule a test drive?',
        timestamp,
        token,
        signature,
        'message-id': `<riley-test-${Date.now()}@test.com>`
      })
    });

    const responseText = await response.text();
    console.log(`📡 Production Response: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log('✅ Production webhook processed');
      console.log('⏱️  AI response should be signed by Riley Donovan');
      console.log('📧 From: Kunes Auto Macomb <sales@kunesmacomb.kunesauto.vip>');
      console.log('📧 Check josh@atsglobal.ai inbox in 30 seconds');
    } else {
      console.log('❌ Production webhook failed');
    }
    
  } catch (error) {
    console.error('❌ Production test failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('✍️ UPDATING SIGNATURE TO RILEY DONOVAN');
  console.log('======================================\n');
  
  console.log('Signature change:');
  console.log('   ❌ Kunes Auto Macomb Team');
  console.log('   ✅ Riley Donovan');
  console.log('      Client Success');
  console.log('      (309) 833-2000');
  console.log('      1501 E Jackson St, Macomb, IL 61455');
  console.log('');
  
  await updateAgentSignature();
  await testNewSignature();
  await testEmailWithNewSignature();
  await testProductionWithNewSignature();
  
  console.log('\n🎉 SIGNATURE UPDATED TO RILEY DONOVAN');
  console.log('====================================');
  console.log('AI responses should now be signed by Riley Donovan, Client Success');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
