#!/usr/bin/env tsx

/**
 * Test GPT-5-Chat Model Script
 * Tests the specific gpt-5-chat model to see if it's working
 */

import fetch from 'node-fetch';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function testGPT5ChatModel(): Promise<void> {
  console.log('🧪 Testing GPT-5-Chat Model');
  console.log('============================\n');

  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    return;
  }

  console.log('📋 Configuration:');
  console.log(`   API Key: ${OPENROUTER_API_KEY.substring(0, 20)}...`);
  console.log(`   Model: openai/gpt-5-chat`);
  console.log(`   Site URL: ${process.env.OPENROUTER_SITE_URL || 'Not set'}`);

  try {
    console.log('\n🔍 Testing GPT-5-Chat model...');
    
    const testPayload = {
      model: 'openai/gpt-5-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful automotive sales assistant at Kunes Honda of Macomb. Be friendly and professional.'
        },
        {
          role: 'user',
          content: 'I\'m interested in scheduling a test drive for a Honda Accord. Can you help me?'
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    };

    console.log('📤 Sending request to OpenRouter...');
    console.log(`   Model: ${testPayload.model}`);
    console.log(`   Messages: ${testPayload.messages.length}`);
    console.log(`   Max tokens: ${testPayload.max_tokens}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://ccl-3-final.onrender.com',
        'X-Title': 'MailMind AI Assistant'
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`\n📡 Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${errorText}`);
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          console.error(`   Error Type: ${errorData.error.type || 'Unknown'}`);
          console.error(`   Error Message: ${errorData.error.message || 'No message'}`);
          console.error(`   Error Code: ${errorData.error.code || 'No code'}`);
        }
      } catch (e) {
        console.error(`   Raw Error: ${errorText}`);
      }
      return;
    }

    const data = await response.json();
    console.log('✅ API call successful!');
    
    console.log('\n📄 Response Data:');
    console.log(`   ID: ${data.id || 'N/A'}`);
    console.log(`   Model: ${data.model || 'N/A'}`);
    console.log(`   Usage: ${JSON.stringify(data.usage || {})}`);
    
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      console.log(`   Finish Reason: ${choice.finish_reason || 'N/A'}`);
      
      if (choice.message && choice.message.content) {
        console.log('\n🤖 AI Response:');
        console.log('   ' + choice.message.content.replace(/\n/g, '\n   '));
        console.log('\n✅ GPT-5-Chat model is working correctly!');
      } else {
        console.log('❌ No content in response');
        console.log('   Choice structure:', JSON.stringify(choice, null, 2));
      }
    } else {
      console.log('❌ No choices in response');
      console.log('   Response structure:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function testAlternativeModels(): Promise<void> {
  console.log('\n🔄 Testing Alternative Models');
  console.log('==============================\n');

  const modelsToTest = [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/gpt-4-turbo'
  ];

  for (const model of modelsToTest) {
    console.log(`\n🧪 Testing ${model}...`);
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://ccl-3-final.onrender.com',
          'X-Title': 'MailMind AI Assistant'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: 'Say "Hello from ' + model + '"'
            }
          ],
          max_tokens: 50
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`   ✅ ${model}: ${content.trim()}`);
        } else {
          console.log(`   ❌ ${model}: No content returned`);
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ ${model}: ${response.status} - ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`   ❌ ${model}: Request failed - ${error}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('🔍 GPT-5-Chat Model Testing');
  console.log('===========================\n');

  await testGPT5ChatModel();
  await testAlternativeModels();

  console.log('\n📋 Summary:');
  console.log('   • If GPT-5-Chat works: The model is available and functional');
  console.log('   • If GPT-5-Chat fails: Try alternative models or check model availability');
  console.log('   • If all models fail: Check API key or OpenRouter service status');
}

// Run the main function
main().catch(console.error);
