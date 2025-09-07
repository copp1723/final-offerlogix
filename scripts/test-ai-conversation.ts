#!/usr/bin/env tsx

/**
 * Test AI Two-Way Conversation Capability
 * 
 * This script comprehensively tests the AI conversation capability of the OFFERLOGIX system.
 * It verifies:
 * 1. OpenRouter API connectivity
 * 2. AI model availability and configuration
 * 3. Context understanding and memory
 * 4. Response generation quality
 * 5. Two-way conversation flow
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mail.offerlogix.me';
const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const APP_URL = process.env.APP_URL || 'https://final-offerlogix.onrender.com';

// Test results tracking
interface TestResult {
  test: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  message: string;
  details?: any;
  responseTime?: number;
}

const testResults: TestResult[] = [];
let pool: Pool | null = null;

function logTest(test: string, status: 'SUCCESS' | 'FAILURE' | 'WARNING', message: string, details?: any) {
  const icon = status === 'SUCCESS' ? '✅' : status === 'FAILURE' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
  testResults.push({ test, status, message, details });
}

async function testOpenRouterConnection(): Promise<boolean> {
  console.log('\n🤖 Testing OpenRouter API Connection...');
  
  if (!OPENROUTER_API_KEY) {
    logTest('OpenRouter API Key', 'FAILURE', 'OPENROUTER_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': APP_URL,
        'X-Title': 'OFFERLOGIX AI Test'
      }
    });

    if (response.ok) {
      const data = await response.json() as { data: any[] };
      const availableModels = data.data.filter((m: any) => 
        m.id.includes('gpt') || m.id.includes('claude') || m.id.includes('mixtral')
      );
      
      logTest('OpenRouter Connection', 'SUCCESS', 
        `Connected successfully. Found ${availableModels.length} AI models available`, {
          sample_models: availableModels.slice(0, 5).map((m: any) => m.id)
        });
      return true;
    } else {
      logTest('OpenRouter Connection', 'FAILURE', `API returned ${response.status}: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    logTest('OpenRouter Connection', 'FAILURE', `Connection failed: ${error}`);
    return false;
  }
}

async function testAIModelConfiguration(): Promise<boolean> {
  console.log('\n⚙️ Testing AI Model Configuration...');
  
  if (!DATABASE_URL) {
    logTest('AI Model Config', 'WARNING', 'DATABASE_URL not configured - skipping database tests');
    return false;
  }

  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    
    // Check AI agent configurations
    const agentResult = await client.query(`
      SELECT id, name, model, tonality, personality, is_active, use_v2
      FROM ai_agent_config
      WHERE is_active = true
      LIMIT 5
    `);

    if (agentResult.rows.length > 0) {
      logTest('AI Agent Configurations', 'SUCCESS', 
        `Found ${agentResult.rows.length} active AI agent configurations`, {
          agents: agentResult.rows.map(a => ({
            name: a.name,
            model: a.model,
            tonality: a.tonality,
            v2_enabled: a.use_v2
          }))
        });
    } else {
      logTest('AI Agent Configurations', 'WARNING', 'No active AI agent configurations found');
    }

    // Check for campaigns with AI agents
    const campaignResult = await client.query(`
      SELECT c.id, c.name, c.context, a.name as agent_name, a.model
      FROM campaigns c
      LEFT JOIN ai_agent_config a ON c.agent_config_id = a.id
      WHERE c.status = 'active'
      LIMIT 5
    `);

    if (campaignResult.rows.length > 0) {
      const withAgents = campaignResult.rows.filter(c => c.agent_name).length;
      logTest('Campaign AI Integration', 'SUCCESS', 
        `Found ${campaignResult.rows.length} active campaigns (${withAgents} with AI agents)`, {
          campaigns: campaignResult.rows.map(c => ({
            name: c.name,
            agent: c.agent_name || 'none',
            model: c.model || 'default'
          }))
        });
    } else {
      logTest('Campaign AI Integration', 'WARNING', 'No active campaigns found');
    }

    client.release();
    return true;
  } catch (error) {
    logTest('AI Model Configuration', 'FAILURE', `Database error: ${error}`);
    return false;
  }
}

async function testSimpleAIResponse(): Promise<boolean> {
  console.log('\n💬 Testing Simple AI Response Generation...');
  
  if (!OPENROUTER_API_KEY) {
    logTest('Simple AI Response', 'FAILURE', 'Cannot test without OpenRouter API key');
    return false;
  }

  const testPrompt = {
    model: 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful automotive sales assistant for OFFERLOGIX. Be professional and concise.'
      },
      {
        role: 'user',
        content: 'I am interested in learning about financing options for a new car. What information do you need from me?'
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  };

  try {
    const startTime = Date.now();
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-Title': 'OFFERLOGIX AI Test'
      },
      body: JSON.stringify(testPrompt)
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json() as any;
      const aiResponse = data.choices[0].message.content;
      
      logTest('Simple AI Response', 'SUCCESS', 
        `AI generated response in ${responseTime}ms`, {
          model_used: data.model || testPrompt.model,
          response_preview: aiResponse.substring(0, 200) + '...',
          tokens_used: data.usage?.total_tokens || 'unknown'
        });
      
      // Validate response quality
      if (aiResponse.toLowerCase().includes('financ') && aiResponse.length > 50) {
        logTest('Response Relevance', 'SUCCESS', 'AI response is relevant to the query');
      } else {
        logTest('Response Relevance', 'WARNING', 'AI response may not be fully relevant');
      }
      
      return true;
    } else {
      const error = await response.text();
      logTest('Simple AI Response', 'FAILURE', `API returned ${response.status}`, { error });
      return false;
    }
  } catch (error) {
    logTest('Simple AI Response', 'FAILURE', `Error generating response: ${error}`);
    return false;
  }
}

async function testConversationContext(): Promise<boolean> {
  console.log('\n🧠 Testing AI Conversation Context & Memory...');
  
  if (!OPENROUTER_API_KEY) {
    logTest('Conversation Context', 'FAILURE', 'Cannot test without OpenRouter API key');
    return false;
  }

  const conversation = [
    {
      role: 'system',
      content: 'You are a helpful automotive sales assistant. Remember details from the conversation and reference them appropriately.'
    },
    {
      role: 'user',
      content: 'Hi, my name is Sarah and I am looking for a blue SUV with good fuel economy.'
    },
    {
      role: 'assistant',
      content: 'Hello Sarah! I would be happy to help you find a blue SUV with excellent fuel economy. We have several great options that might interest you.'
    },
    {
      role: 'user',
      content: 'What do you remember about what I am looking for?'
    }
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-Title': 'OFFERLOGIX Context Test'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: conversation,
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (response.ok) {
      const data = await response.json() as any;
      const aiResponse = data.choices[0].message.content.toLowerCase();
      
      // Check if AI remembers the key details
      const remembersName = aiResponse.includes('sarah');
      const remembersColor = aiResponse.includes('blue');
      const remembersType = aiResponse.includes('suv');
      const remembersFuel = aiResponse.includes('fuel') || aiResponse.includes('economy');
      
      const contextScore = [remembersName, remembersColor, remembersType, remembersFuel].filter(Boolean).length;
      
      if (contextScore >= 3) {
        logTest('Conversation Context', 'SUCCESS', 
          `AI successfully retained ${contextScore}/4 key conversation details`, {
            remembered: {
              name: remembersName,
              color: remembersColor,
              vehicle_type: remembersType,
              fuel_economy: remembersFuel
            }
          });
        return true;
      } else {
        logTest('Conversation Context', 'WARNING', 
          `AI only retained ${contextScore}/4 key details`, {
            remembered: {
              name: remembersName,
              color: remembersColor,
              vehicle_type: remembersType,
              fuel_economy: remembersFuel
            }
          });
        return false;
      }
    } else {
      logTest('Conversation Context', 'FAILURE', `API error: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Conversation Context', 'FAILURE', `Error testing context: ${error}`);
    return false;
  }
}

async function testTwoWayConversationFlow(): Promise<boolean> {
  console.log('\n🔄 Testing Two-Way Conversation Flow...');
  
  if (!DATABASE_URL) {
    logTest('Two-Way Flow', 'WARNING', 'DATABASE_URL not configured - skipping database tests');
    return false;
  }

  try {
    const client = await pool!.connect();
    
    // Check for existing conversations
    const convResult = await client.query(`
      SELECT 
        c.id,
        c.subject,
        c.status,
        COUNT(cm.id) as message_count,
        SUM(CASE WHEN cm.is_from_ai = 1 THEN 1 ELSE 0 END) as ai_messages,
        SUM(CASE WHEN cm.is_from_ai = 0 THEN 1 ELSE 0 END) as human_messages
      FROM conversations c
      LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
      WHERE c.status = 'active'
      GROUP BY c.id, c.subject, c.status
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    if (convResult.rows.length > 0) {
      const twoWayConvs = convResult.rows.filter(c => 
        c.ai_messages > 0 && c.human_messages > 0
      );
      
      logTest('Two-Way Conversations', 
        twoWayConvs.length > 0 ? 'SUCCESS' : 'WARNING',
        `Found ${twoWayConvs.length}/${convResult.rows.length} conversations with two-way interaction`, {
          conversations: convResult.rows.slice(0, 3).map(c => ({
            subject: c.subject.substring(0, 50),
            total_messages: c.message_count,
            ai_messages: c.ai_messages,
            human_messages: c.human_messages
          }))
        });
      
      return twoWayConvs.length > 0;
    } else {
      logTest('Two-Way Conversations', 'WARNING', 'No active conversations found');
    }

    // Check V2 conversation engine status
    const v2Result = await client.query(`
      SELECT COUNT(*) as v2_count
      FROM ai_agent_config
      WHERE use_v2 = true AND is_active = true
    `);

    if (v2Result.rows[0].v2_count > 0) {
      logTest('V2 Conversation Engine', 'SUCCESS', 
        `${v2Result.rows[0].v2_count} agents using V2 conversation engine`);
    } else {
      logTest('V2 Conversation Engine', 'WARNING', 'No agents configured for V2 engine');
    }

    client.release();
    return true;
  } catch (error) {
    logTest('Two-Way Conversation Flow', 'FAILURE', `Database error: ${error}`);
    return false;
  }
}

async function testAIResponseQuality(): Promise<boolean> {
  console.log('\n✨ Testing AI Response Quality...');
  
  if (!OPENROUTER_API_KEY) {
    logTest('Response Quality', 'FAILURE', 'Cannot test without OpenRouter API key');
    return false;
  }

  const qualityTests = [
    {
      name: 'Professional Tone',
      prompt: 'A customer says: "Your prices are too high!" Respond professionally.',
      checks: ['understand', 'help', 'value', 'options']
    },
    {
      name: 'Technical Knowledge',
      prompt: 'What is the difference between AWD and 4WD?',
      checks: ['all-wheel', 'four-wheel', 'traction', 'terrain']
    },
    {
      name: 'Sales Conversion',
      prompt: 'I am just browsing, not ready to buy yet.',
      checks: ['help', 'information', 'question', 'assist']
    }
  ];

  let passedTests = 0;

  for (const test of qualityTests) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': APP_URL,
          'X-Title': 'OFFERLOGIX Quality Test'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional automotive sales assistant. Be helpful, knowledgeable, and maintain a positive tone.'
            },
            {
              role: 'user',
              content: test.prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        const aiResponse = data.choices[0].message.content.toLowerCase();
        
        const matchedChecks = test.checks.filter(check => aiResponse.includes(check));
        const passed = matchedChecks.length >= test.checks.length / 2;
        
        if (passed) {
          passedTests++;
          logTest(`Quality: ${test.name}`, 'SUCCESS', 
            `Response meets quality standards (${matchedChecks.length}/${test.checks.length} criteria)`);
        } else {
          logTest(`Quality: ${test.name}`, 'WARNING', 
            `Response below quality threshold (${matchedChecks.length}/${test.checks.length} criteria)`);
        }
      }
    } catch (error) {
      logTest(`Quality: ${test.name}`, 'FAILURE', `Error: ${error}`);
    }
  }

  const overallQuality = passedTests >= qualityTests.length * 0.7;
  logTest('Overall Response Quality', 
    overallQuality ? 'SUCCESS' : 'WARNING',
    `Passed ${passedTests}/${qualityTests.length} quality tests`);
  
  return overallQuality;
}

async function testWebhookIntegration(): Promise<boolean> {
  console.log('\n🔗 Testing Webhook Integration for AI Responses...');
  
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    logTest('Webhook Integration', 'WARNING', 'MAILGUN_WEBHOOK_SIGNING_KEY not configured');
    return false;
  }

  // Simulate webhook payload
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'test-' + Math.random().toString(36).substring(7);
  const signature = crypto
    .createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');

  const webhookPayload = {
    sender: 'test@example.com',
    recipient: 'campaigns@mail.offerlogix.me',
    subject: 'Test AI Response',
    'body-plain': 'I need information about your latest offers.',
    timestamp,
    token,
    signature
  };

  try {
    const response = await fetch(`${APP_URL}/api/webhooks/mailgun/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(webhookPayload as any)
    });

    if (response.ok || response.status === 401) {
      logTest('Webhook Endpoint', 'SUCCESS', 
        `Webhook endpoint is accessible (status: ${response.status})`);
      return true;
    } else {
      logTest('Webhook Endpoint', 'WARNING', 
        `Webhook returned unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Webhook Integration', 'FAILURE', `Cannot reach webhook: ${error}`);
    return false;
  }
}

async function generateSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 AI CONVERSATION CAPABILITY TEST SUMMARY');
  console.log('='.repeat(80));
  
  const successCount = testResults.filter(r => r.status === 'SUCCESS').length;
  const failureCount = testResults.filter(r => r.status === 'FAILURE').length;
  const warningCount = testResults.filter(r => r.status === 'WARNING').length;
  
  console.log(`\n📊 Results: ${successCount} SUCCESS, ${failureCount} FAILURE, ${warningCount} WARNING\n`);
  
  // Group results by status
  const failures = testResults.filter(r => r.status === 'FAILURE');
  const warnings = testResults.filter(r => r.status === 'WARNING');
  const successes = testResults.filter(r => r.status === 'SUCCESS');
  
  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    failures.forEach(r => console.log(`   - ${r.test}: ${r.message}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(r => console.log(`   - ${r.test}: ${r.message}`));
  }
  
  if (successes.length > 0) {
    console.log('\n✅ SUCCESSES:');
    successes.forEach(r => console.log(`   - ${r.test}: ${r.message}`));
  }
  
  // Overall assessment
  console.log('\n' + '='.repeat(80));
  if (failureCount === 0 && successCount >= 5) {
    console.log('✅ AI CONVERSATION CAPABILITY: FULLY OPERATIONAL');
    console.log('The AI system is functioning correctly and ready for two-way conversations.');
  } else if (failureCount <= 2 && successCount >= 3) {
    console.log('⚠️  AI CONVERSATION CAPABILITY: PARTIALLY OPERATIONAL');
    console.log('The AI system has some limitations but can handle basic conversations.');
  } else {
    console.log('❌ AI CONVERSATION CAPABILITY: NOT OPERATIONAL');
    console.log('The AI system has critical issues that prevent proper conversation handling.');
  }
  console.log('='.repeat(80));
}

async function main() {
  console.log('🤖 OFFERLOGIX AI CONVERSATION CAPABILITY TEST');
  console.log('=============================================');
  console.log('Testing AI two-way conversation capabilities...\n');
  
  console.log('📋 Configuration:');
  console.log(`   OPENROUTER_API_KEY: ${OPENROUTER_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   DATABASE_URL: ${DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   MAILGUN_WEBHOOK_KEY: ${MAILGUN_WEBHOOK_SIGNING_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   APP_URL: ${APP_URL}`);
  
  // Run all tests
  await testOpenRouterConnection();
  await testAIModelConfiguration();
  await testSimpleAIResponse();
  await testConversationContext();
  await testTwoWayConversationFlow();
  await testAIResponseQuality();
  await testWebhookIntegration();
  
  // Generate summary
  await generateSummary();
  
  // Cleanup
  if (pool) {
    await pool.end();
  }
  
  // Exit with appropriate code
  const failureCount = testResults.filter(r => r.status === 'FAILURE').length;
  process.exit(failureCount > 0 ? 1 : 0);
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});