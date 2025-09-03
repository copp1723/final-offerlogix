#!/usr/bin/env tsx

/**
 * Nuclear Fix - Strip down and rebuild AI response system
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

async function step1_CreateAIUser(): Promise<boolean> {
  console.log('STEP 1: Creating AI user');
  try {
    const { db } = await import('../server/db.js');
    const { users } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');

    // Check if ai-agent user exists
    const [existingUser] = await db.select().from(users).where(eq(users.id, 'ai-agent'));

    if (existingUser) {
      console.log('✅ AI user already exists');
      return true;
    }

    // Create new ai-agent user
    await db.insert(users).values({
      id: 'ai-agent',
      username: 'ai-agent',
      password: 'system-user',
      role: 'admin',
      email: 'ai-agent@system.local'
    });

    console.log('✅ AI user created');
    return true;
  } catch (error) {
    console.log('❌ AI user creation failed:', error);
    return false;
  }
}

async function step2_FixAgentConfig(): Promise<boolean> {
  console.log('STEP 2: Fixing agent config');
  try {
    const { db } = await import('../server/db.js');
    const { aiAgentConfig } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get active agent
    const [agent] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.isActive, true));
    if (!agent) {
      console.log('❌ No active agent found');
      return false;
    }
    
    // Update with minimal working config
    await db.update(aiAgentConfig)
      .set({
        agentEmailDomain: 'mg.watchdogai.us',
        settings: {
          autoRespond: true,
          responseDelay: 2000
        }
      })
      .where(eq(aiAgentConfig.id, agent.id));
    
    console.log('✅ Agent config updated');
    return true;
  } catch (error) {
    console.log('❌ Agent config update failed:', error);
    return false;
  }
}

async function step3_TestAIGeneration(): Promise<boolean> {
  console.log('STEP 3: Testing AI generation');
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-chat',
        messages: [
          { role: 'system', content: 'You are a helpful automotive sales assistant.' },
          { role: 'user', content: 'I am interested in a Honda Civic. Can you help?' }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      if (aiResponse) {
        console.log('✅ AI generation works');
        return true;
      }
    }
    
    console.log('❌ AI generation failed');
    return false;
  } catch (error) {
    console.log('❌ AI generation error:', error);
    return false;
  }
}

async function step4_TestEmailSending(): Promise<boolean> {
  console.log('STEP 4: Testing email sending');
  try {
    const response = await fetch(`https://api.mailgun.net/v3/mg.watchdogai.us/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        from: 'AI Assistant <noreply@mg.watchdogai.us>',
        to: 'josh@atsglobal.ai',
        subject: 'Nuclear Fix Test',
        text: 'This is a test email from the nuclear fix script.'
      })
    });

    if (response.ok) {
      console.log('✅ Email sending works');
      return true;
    } else {
      const error = await response.text();
      console.log('❌ Email sending failed:', error);
      return false;
    }
  } catch (error) {
    console.log('❌ Email sending error:', error);
    return false;
  }
}

async function step5_TestCompleteFlow(): Promise<boolean> {
  console.log('STEP 5: Testing complete flow');
  try {
    // Create a simple auto-response function
    const testAutoResponse = async (leadEmail: string, message: string): Promise<boolean> => {
      // Generate AI response
      const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-chat',
          messages: [
            { role: 'system', content: 'You are a helpful automotive sales assistant for a Honda dealership.' },
            { role: 'user', content: message }
          ],
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (!aiResponse.ok) return false;
      
      const aiData = await aiResponse.json();
      const responseText = aiData.choices?.[0]?.message?.content;
      
      if (!responseText) return false;

      // Send email
      const emailResponse = await fetch(`https://api.mailgun.net/v3/mg.watchdogai.us/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          from: 'AI Assistant <noreply@mg.watchdogai.us>',
          to: leadEmail,
          subject: 'Re: Honda Civic Inquiry',
          text: responseText
        })
      });

      return emailResponse.ok;
    };

    const success = await testAutoResponse('josh@atsglobal.ai', 'I am interested in a Honda Civic. What can you tell me about pricing?');
    
    if (success) {
      console.log('✅ Complete flow works');
      return true;
    } else {
      console.log('❌ Complete flow failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Complete flow error:', error);
    return false;
  }
}

async function step6_TestProductionWebhook(): Promise<boolean> {
  console.log('STEP 6: Testing production webhook');
  try {
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'nuclear-test-' + Math.random().toString(36).substring(7);
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
        recipient: 'campaigns@mg.watchdogai.us',
        subject: 'Nuclear Test - Honda Civic Inquiry',
        'body-plain': 'Hi, I am very interested in the Honda Civic. Can you provide pricing and schedule a test drive?',
        timestamp,
        token,
        signature,
        'message-id': `<nuclear-test-${Date.now()}@test.com>`
      })
    });

    if (response.status === 200) {
      console.log('✅ Production webhook works');
      console.log('⏱️  Check josh@atsglobal.ai for AI response in 30 seconds');
      return true;
    } else {
      console.log('❌ Production webhook failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Production webhook error:', error);
    return false;
  }
}

async function main(): Promise<void> {
  console.log('🚀 NUCLEAR FIX - REBUILDING AI RESPONSE SYSTEM');
  console.log('==============================================\n');

  const steps = [
    step1_CreateAIUser,
    step2_FixAgentConfig,
    step3_TestAIGeneration,
    step4_TestEmailSending,
    step5_TestCompleteFlow,
    step6_TestProductionWebhook
  ];

  let allPassed = true;
  
  for (let i = 0; i < steps.length; i++) {
    const passed = await steps[i]();
    if (!passed) {
      allPassed = false;
      console.log(`\n❌ FAILED AT STEP ${i + 1}`);
      break;
    }
    console.log('');
  }

  if (allPassed) {
    console.log('🎉 ALL STEPS PASSED - AI RESPONSE SYSTEM SHOULD BE WORKING');
  } else {
    console.log('❌ NUCLEAR FIX FAILED - SYSTEM STILL BROKEN');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
