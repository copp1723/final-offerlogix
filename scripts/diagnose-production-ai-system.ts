#!/usr/bin/env tsx

/**
 * Production AI Response System Diagnostic Tool
 * Tests each component of the AI response system to identify failures
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import crypto from 'crypto';

// Load production environment
dotenv.config({ path: '.env.prod' });

// Production configuration
const PROD_CONFIG = {
  WEBHOOK_URL: 'https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound',
  MAILGUN_SIGNING_KEY: process.env.MAILGUN_WEBHOOK_SIGNING_KEY || 'REDACTED',
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || 'REDACTED',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'mg.watchdogai.us',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'sk-or-v1-REDACTED',
  AI_MODEL: process.env.AI_MODEL || 'openai/gpt-5-chat',
  DATABASE_URL: process.env.DATABASE_URL
};

interface DiagnosticResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class ProductionAIDiagnostic {
  private results: DiagnosticResult[] = [];

  private log(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    const result: DiagnosticResult = { test, status, message, details };
    this.results.push(result);
    
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${test}: ${message}`);
    if (details) {
      console.log(`   Details:`, details);
    }
  }

  async testOpenRouterAPI(): Promise<void> {
    console.log('\n🔍 Testing OpenRouter API Connection...');
    
    try {
      if (!PROD_CONFIG.OPENROUTER_API_KEY) {
        this.log('OpenRouter API Key', 'FAIL', 'OPENROUTER_API_KEY not found in environment');
        return;
      }

      this.log('OpenRouter API Key', 'PASS', 'API key found in environment');

      // Test API connection with a simple request
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PROD_CONFIG.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const models = await response.json();
        this.log('OpenRouter API Connection', 'PASS', 'Successfully connected to OpenRouter API', {
          availableModels: models.data?.length || 0
        });
      } else {
        const errorText = await response.text();
        this.log('OpenRouter API Connection', 'FAIL', `API connection failed: ${response.status}`, {
          status: response.status,
          error: errorText
        });
      }
    } catch (error) {
      this.log('OpenRouter API Connection', 'FAIL', 'Failed to connect to OpenRouter API', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async testAIResponseGeneration(): Promise<void> {
    console.log('\n🤖 Testing AI Response Generation...');
    
    try {
      const testPrompt = `You are a helpful automotive sales assistant. A customer named Josh has inquired about a Honda Civic. They said: "Hi, I'm interested in learning more about the Honda Civic. What can you tell me about pricing and availability?"

Please respond professionally and helpfully.`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PROD_CONFIG.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'OneKeel Swarm - AI Diagnostic Test'
        },
        body: JSON.stringify({
          model: PROD_CONFIG.AI_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful automotive sales assistant.' },
            { role: 'user', content: testPrompt }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const result = await response.json();
        const aiResponse = result.choices?.[0]?.message?.content;

        if (aiResponse && aiResponse.trim().length > 0) {
          this.log('AI Response Generation', 'PASS', 'AI successfully generated response', {
            model: PROD_CONFIG.AI_MODEL,
            responseLength: aiResponse.length,
            responsePreview: aiResponse.substring(0, 100) + '...'
          });
        } else {
          this.log('AI Response Generation', 'FAIL', 'AI returned empty response', {
            fullResult: result,
            messageObject: result.choices?.[0]?.message,
            contentValue: aiResponse
          });
        }
      } else {
        const errorText = await response.text();
        this.log('AI Response Generation', 'FAIL', `AI API request failed: ${response.status}`, {
          status: response.status,
          error: errorText
        });
      }
    } catch (error) {
      this.log('AI Response Generation', 'FAIL', 'AI response generation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async testMailgunAPI(): Promise<void> {
    console.log('\n📧 Testing Mailgun API Connection...');
    
    try {
      if (!PROD_CONFIG.MAILGUN_API_KEY || !PROD_CONFIG.MAILGUN_DOMAIN) {
        this.log('Mailgun Configuration', 'FAIL', 'Mailgun API key or domain not configured');
        return;
      }

      this.log('Mailgun Configuration', 'PASS', 'Mailgun credentials found');

      // Test Mailgun API connection by getting domain info
      const response = await fetch(`https://api.mailgun.net/v3/domains/${PROD_CONFIG.MAILGUN_DOMAIN}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${PROD_CONFIG.MAILGUN_API_KEY}`).toString('base64')}`
        }
      });

      if (response.ok) {
        const domainInfo = await response.json();
        this.log('Mailgun API Connection', 'PASS', 'Successfully connected to Mailgun API', {
          domain: PROD_CONFIG.MAILGUN_DOMAIN,
          state: domainInfo.domain?.state
        });
      } else {
        const errorText = await response.text();
        this.log('Mailgun API Connection', 'FAIL', `Mailgun API connection failed: ${response.status}`, {
          status: response.status,
          error: errorText
        });
      }
    } catch (error) {
      this.log('Mailgun API Connection', 'FAIL', 'Failed to connect to Mailgun API', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async testWebhookSignature(): Promise<void> {
    console.log('\n🔐 Testing Webhook Signature Generation...');
    
    try {
      if (!PROD_CONFIG.MAILGUN_SIGNING_KEY) {
        this.log('Webhook Signing Key', 'FAIL', 'MAILGUN_WEBHOOK_SIGNING_KEY not found');
        return;
      }

      this.log('Webhook Signing Key', 'PASS', 'Webhook signing key found');

      // Test signature generation
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const token = 'test-token-' + Math.random().toString(36).substring(7);
      
      const signature = crypto
        .createHmac('sha256', PROD_CONFIG.MAILGUN_SIGNING_KEY)
        .update(timestamp + token)
        .digest('hex');

      if (signature && signature.length === 64) {
        this.log('Webhook Signature Generation', 'PASS', 'Signature generation working correctly', {
          signatureLength: signature.length,
          timestamp,
          token
        });
      } else {
        this.log('Webhook Signature Generation', 'FAIL', 'Invalid signature generated', {
          signature,
          signatureLength: signature?.length
        });
      }
    } catch (error) {
      this.log('Webhook Signature Generation', 'FAIL', 'Signature generation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async testDatabaseConnection(): Promise<void> {
    console.log('\n🗄️ Testing Database Connection...');
    
    try {
      if (!PROD_CONFIG.DATABASE_URL) {
        this.log('Database Configuration', 'FAIL', 'DATABASE_URL not found');
        return;
      }

      this.log('Database Configuration', 'PASS', 'Database URL found');

      // Import and test database connection
      const { db } = await import('../server/db.js');
      const { sql } = await import('drizzle-orm');
      
      const result = await db.execute(sql`SELECT 1 as test`);
      
      if (result) {
        this.log('Database Connection', 'PASS', 'Successfully connected to database');
      } else {
        this.log('Database Connection', 'FAIL', 'Database query returned no result');
      }
    } catch (error) {
      this.log('Database Connection', 'FAIL', 'Database connection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async testFullWebhookFlow(): Promise<void> {
    console.log('\n🔄 Testing Full Webhook Flow...');
    
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const token = 'diagnostic-test-' + Math.random().toString(36).substring(7);
      const signature = crypto
        .createHmac('sha256', PROD_CONFIG.MAILGUN_SIGNING_KEY)
        .update(timestamp + token)
        .digest('hex');

      const testWebhookData = {
        sender: 'josh@atsglobal.ai',
        recipient: 'campaigns@kunesmacomb.kunesauto.vip',
        subject: 'DIAGNOSTIC TEST - AI Response Check',
        'body-plain': 'This is a diagnostic test to check if AI responses are working. Please respond with information about Honda Civic pricing.',
        timestamp,
        token,
        signature,
        'message-id': `<diagnostic-test-${Date.now()}@mailgun.test>`,
        'Message-Id': `<diagnostic-test-${Date.now()}@mailgun.test>`
      };

      console.log('📤 Sending diagnostic webhook request...');
      
      const response = await fetch(PROD_CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mailgun/Diagnostic-Test'
        },
        body: new URLSearchParams(testWebhookData as any).toString()
      });

      const responseText = await response.text();
      
      if (response.status === 200) {
        this.log('Webhook Processing', 'PASS', 'Webhook processed successfully', {
          status: response.status,
          response: responseText
        });
      } else {
        this.log('Webhook Processing', 'FAIL', `Webhook processing failed: ${response.status}`, {
          status: response.status,
          response: responseText
        });
      }
    } catch (error) {
      this.log('Webhook Processing', 'FAIL', 'Webhook test failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 PRODUCTION AI SYSTEM DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    
    console.log(`\n📊 Results: ${passed} PASSED, ${failed} FAILED, ${warnings} WARNINGS`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   • ${result.test}: ${result.message}`);
      });
    }
    
    if (warnings > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.results.filter(r => r.status === 'WARN').forEach(result => {
        console.log(`   • ${result.test}: ${result.message}`);
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (failed === 0) {
      console.log('   • All core systems are functioning correctly');
      console.log('   • If AI responses are still not working, check application logs');
      console.log('   • Verify that leads exist in database for test emails');
    } else {
      console.log('   • Fix failed tests before proceeding');
      console.log('   • Check environment variables in production');
      console.log('   • Verify API keys and credentials');
    }
  }
}

async function main(): Promise<void> {
  console.log('🚀 PRODUCTION AI RESPONSE SYSTEM DIAGNOSTIC');
  console.log('============================================\n');
  
  console.log('🌐 Production Environment:');
  console.log(`   Webhook URL: ${PROD_CONFIG.WEBHOOK_URL}`);
  console.log(`   Mailgun Domain: ${PROD_CONFIG.MAILGUN_DOMAIN}`);
  console.log(`   AI Model: ${PROD_CONFIG.AI_MODEL}`);
  console.log(`   Database: ${PROD_CONFIG.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  
  const diagnostic = new ProductionAIDiagnostic();
  
  // Run all diagnostic tests
  await diagnostic.testOpenRouterAPI();
  await diagnostic.testAIResponseGeneration();
  await diagnostic.testMailgunAPI();
  await diagnostic.testWebhookSignature();
  await diagnostic.testDatabaseConnection();
  await diagnostic.testFullWebhookFlow();
  
  // Print summary
  diagnostic.printSummary();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
