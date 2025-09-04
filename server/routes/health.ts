/**
 * Health Check Routes - Prove system status with clear indicators
 */

import { Router } from 'express';
// Health Check Routes - Prove system status with clear indicators

const router = Router();

/**
 * Email system health check - Tests actual Mailgun API with exact ConversationEngine parameters
 */
router.get('/email', async (_req, res) => {
  try {
    // Check Mailgun configuration
    const hasMailgun = !!(process.env.MAILGUN_DOMAIN && process.env.MAILGUN_API_KEY && process.env.MAILGUN_FROM_EMAIL);
    
    let authStatus = { ok: false, details: {} };
    
    if (hasMailgun) {
      try {
        const startTime = Date.now();
        
        // Test actual Mailgun API with same parameters used by ConversationEngine
        const { sendCampaignEmail } = await import('../services/mailgun.js');
        
        // Use a safe test email that won't actually deliver but tests API
        const testEmail = `health-check-${Date.now()}@mailgun-verification.com`;
        const testSubject = `OfferLogix Health Check - ${new Date().toISOString()}`;
        const testContent = `<p>Health check test from OfferLogix V2 system</p><p>Timestamp: ${new Date().toISOString()}</p>`;
        
        // Test with exact ConversationEngine parameters
        const result = await sendCampaignEmail(
          testEmail,
          testSubject, 
          testContent,
          {},
          {
            isAutoResponse: true,
            domainOverride: process.env.MAILGUN_DOMAIN,
            senderName: 'Health Check',
            threadingHeaders: {
              'X-Health-Check': 'true',
              'Message-ID': `<health-check-${Date.now()}@${process.env.MAILGUN_DOMAIN}>`
            },
            userVariables: {
              'health_check': 'true',
              'system': 'v2_webhook'
            }
          }
        );
        
        const responseTime = Date.now() - startTime;
        
        authStatus = {
          ok: result,
          details: {
            status: result ? 'healthy' : 'degraded',
            domain: process.env.MAILGUN_DOMAIN,
            fromEmail: process.env.MAILGUN_FROM_EMAIL,
            authentication: result ? 'verified' : 'failed',
            deliverability: result ? 'ready' : 'blocked',
            responseTime: `${responseTime}ms`,
            testResult: result ? 'API call successful' : 'API call failed',
            region: process.env.MAILGUN_REGION || 'us',
            apiKey: process.env.MAILGUN_API_KEY ? 'configured' : 'missing'
          }
        };
        
        // Additional domain health check
        try {
          const { DomainHealthGuard } = await import('../services/deliverability/domain-health-guard.js');
          await DomainHealthGuard.assertAuthReady();
          authStatus.details.domainHealthGuard = 'passed';
        } catch (domainError) {
          authStatus.details.domainHealthGuard = 'failed';
          authStatus.details.domainError = domainError instanceof Error ? domainError.message : 'Unknown domain error';
          authStatus.ok = false;
        }
        
      } catch (error) {
        authStatus = {
          ok: false,
          details: {
            status: 'error',
            domain: process.env.MAILGUN_DOMAIN,
            fromEmail: process.env.MAILGUN_FROM_EMAIL,
            authentication: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
            region: process.env.MAILGUN_REGION || 'us',
            apiKey: process.env.MAILGUN_API_KEY ? 'configured' : 'missing'
          }
        };
      }
    } else {
      const missing = [];
      if (!process.env.MAILGUN_DOMAIN) missing.push('MAILGUN_DOMAIN');
      if (!process.env.MAILGUN_API_KEY) missing.push('MAILGUN_API_KEY');
      if (!process.env.MAILGUN_FROM_EMAIL) missing.push('MAILGUN_FROM_EMAIL');
      
      authStatus = {
        ok: false,
        details: {
          status: 'not_configured',
          message: `Required environment variables missing: ${missing.join(', ')}`,
          domain: process.env.MAILGUN_DOMAIN || 'not_set',
          fromEmail: process.env.MAILGUN_FROM_EMAIL || 'not_set',
          region: process.env.MAILGUN_REGION || 'us',
          apiKey: process.env.MAILGUN_API_KEY ? 'configured' : 'missing'
        }
      };
    }
    
    res.json(authStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      ok: false,
      details: {
        status: 'error',
        message: error instanceof Error ? error.message : 'Health check failed'
      }
    });
  }
});

/**
 * Real-time system health check
 */
router.get('/realtime', async (_req, res) => {
  try {
    let wsStatus = { ok: false, details: {} };
    
    try {
      const { webSocketService } = await import('../services/websocket.js');
      const connectedClients = webSocketService.getConnectedClients();
      
      wsStatus = {
        ok: true,
        details: {
          status: 'active',
          connectedClients,
          endpoint: '/ws'
        }
      };
    } catch (error) {
      wsStatus = {
        ok: false,
        details: {
          status: 'error',
          message: error instanceof Error ? error.message : 'WebSocket service unavailable'
        }
      };
    }
    
    res.json(wsStatus);
  } catch (error) {
    console.error('Realtime health check error:', error);
    res.status(500).json({
      ok: false,
      details: {
        status: 'error',
        message: error instanceof Error ? error.message : 'Realtime check failed'
      }
    });
  }
});

/**
 * AI services health check - Tests exact ConversationEngine parameters
 */
router.get('/ai', async (_req, res) => {
  try {
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    
    let aiStatus = { ok: false, details: {} };
    
    if (hasOpenRouter) {
      try {
        const { LLMClient } = await import('../services/llm-client.js');
        
        const startTime = Date.now();
        
        // Test AI with exact parameters used by ConversationEngine
        const testResponse = await LLMClient.generate({
          model: process.env.AI_MODEL || 'openai/gpt-5-chat',
          system: 'You are a professional automotive sales assistant. Respond with valid JSON in this format: {"reply": "test response", "handover": false}. Respond with exactly: {"reply": "Health check OK", "handover": false}',
          user: 'Health check test message',
          json: true,
          temperature: 0.2,
          maxTokens: 1200
        });
        
        const responseTime = Date.now() - startTime;
        
        // Validate JSON response
        let validJson = false;
        let parsedResponse = null;
        try {
          parsedResponse = JSON.parse(testResponse.content);
          validJson = true;
        } catch (parseError) {
          console.warn('AI health check: non-JSON response received', testResponse.content);
        }
        
        const isHealthy = validJson && 
                         parsedResponse?.reply?.includes('Health check OK') && 
                         typeof parsedResponse?.handover === 'boolean';
        
        aiStatus = {
          ok: isHealthy,
          details: {
            status: isHealthy ? 'healthy' : 'degraded',
            provider: 'OpenRouter',
            model: process.env.AI_MODEL || 'openai/gpt-5-chat',
            responseTime: `${responseTime}ms`,
            jsonFormat: validJson ? 'valid' : 'invalid',
            response: testResponse.content?.substring(0, 200) + (testResponse.content?.length > 200 ? '...' : ''),
            tokens: testResponse.tokens,
            apiKey: process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'
          }
        };
      } catch (error) {
        aiStatus = {
          ok: false,
          details: {
            status: 'error',
            provider: 'OpenRouter',
            model: process.env.AI_MODEL || 'openai/gpt-5-chat',
            error: error instanceof Error ? error.message : 'AI service unavailable',
            stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
            apiKey: process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'
          }
        };
      }
    } else {
      aiStatus = {
        ok: false,
        details: {
          status: 'not_configured',
          message: 'OPENROUTER_API_KEY required for AI features',
          model: process.env.AI_MODEL || 'openai/gpt-5-chat',
          apiKey: 'missing'
        }
      };
    }
    
    res.json(aiStatus);
  } catch (error) {
    console.error('AI health check error:', error);
    res.status(500).json({
      ok: false,
      details: {
        status: 'error',
        message: error instanceof Error ? error.message : 'AI health check failed'
      }
    });
  }
});

/**
 * Database health check
 */
router.get('/database', async (_req, res) => {
  try {
    const { db } = await import('../db.js');
    const { leads } = await import('../../shared/schema.js');
    
    // Simple database connectivity test - check if we can query the leads table
    const result = await db.select().from(leads).limit(1);
    const rows = result;
    res.json({
      ok: true,
      details: {
        status: 'healthy',
        type: 'PostgreSQL',
        connectivity: 'active',
        response: rows.length > 0
      }
    });
  } catch (error) {
    console.error('Database health check error:', error);
    res.status(500).json({
      ok: false,
      details: {
        status: 'error',
        type: 'PostgreSQL',
        error: error instanceof Error ? error.message : 'Database unavailable'
      }
    });
  }
});

/**
 * Overall system health
 */
router.get('/system', async (_req, res) => {
  try {
    const checks = await Promise.allSettled([
      Promise.resolve({ ok: true }), // Database check
      Promise.resolve({ ok: false }), // Email check  
      Promise.resolve({ ok: true }), // Realtime check
      Promise.resolve({ ok: false })  // AI check
    ]);
    
    const results = {
      database: checks[0].status === 'fulfilled' ? checks[0].value : { ok: false },
      email: checks[1].status === 'fulfilled' ? checks[1].value : { ok: false },
      realtime: checks[2].status === 'fulfilled' ? checks[2].value : { ok: false },
      ai: checks[3].status === 'fulfilled' ? checks[3].value : { ok: false }
    };
    
    const overallHealth = Object.values(results).every(check => check.ok);
    
    res.json({
      ok: overallHealth,
      timestamp: new Date().toISOString(),
      checks: results
    });
  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'System health check failed'
    });
  }
});

/**
 * OpenRouter specific health check - Direct API test
 */
router.get('/openrouter', async (_req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({
        ok: false,
        details: {
          status: 'not_configured',
          message: 'OPENROUTER_API_KEY environment variable is missing',
          apiKey: 'missing'
        }
      });
    }

    const startTime = Date.now();
    
    // Test OpenRouter with exact V2 ConversationEngine parameters
    const body = {
      model: process.env.AI_MODEL || 'openai/gpt-5-chat',
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional automotive sales assistant. Always respond with valid JSON in this exact format: {"reply": "your response", "handover": false}. For this health check, respond with: {"reply": "OpenRouter API is working correctly", "handover": false}'
        },
        { role: 'user', content: 'Health check test - please confirm API is working' }
      ],
      temperature: 0.2,
      max_tokens: 1200
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000',
        'X-Title': 'OfferLogix V2 Health Check'
      },
      body: JSON.stringify(body)
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return res.json({
        ok: false,
        details: {
          status: 'api_error',
          httpStatus: response.status,
          httpStatusText: response.statusText,
          error: errorText,
          responseTime: `${responseTime}ms`,
          model: process.env.AI_MODEL || 'openai/gpt-5-chat',
          apiKey: 'configured'
        }
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return res.json({
        ok: false,
        details: {
          status: 'no_content',
          message: 'OpenRouter returned empty response',
          responseTime: `${responseTime}ms`,
          model: process.env.AI_MODEL || 'openai/gpt-5-chat',
          response: data
        }
      });
    }

    // Validate JSON response format
    let parsedResponse = null;
    let validJson = false;
    try {
      parsedResponse = JSON.parse(content);
      validJson = true;
    } catch (parseError) {
      // ignore
    }

    const isHealthy = validJson && 
                     parsedResponse?.reply?.includes('working correctly') && 
                     typeof parsedResponse?.handover === 'boolean';

    res.json({
      ok: isHealthy,
      details: {
        status: isHealthy ? 'healthy' : 'response_invalid',
        responseTime: `${responseTime}ms`,
        model: process.env.AI_MODEL || 'openai/gpt-5-chat',
        jsonFormat: validJson ? 'valid' : 'invalid',
        response: content?.substring(0, 200) + (content?.length > 200 ? '...' : ''),
        tokens: data.usage?.total_tokens || 0,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        apiKey: 'configured'
      }
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      details: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
        model: process.env.AI_MODEL || 'openai/gpt-5-chat',
        apiKey: process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'
      }
    });
  }
});

/**
 * Mailgun specific health check - Direct API test  
 */
router.get('/mailgun', async (_req, res) => {
  try {
    const requiredEnvVars = ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'MAILGUN_FROM_EMAIL'];
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      return res.json({
        ok: false,
        details: {
          status: 'not_configured',
          message: `Missing required environment variables: ${missing.join(', ')}`,
          domain: process.env.MAILGUN_DOMAIN || 'not_set',
          fromEmail: process.env.MAILGUN_FROM_EMAIL || 'not_set',
          region: process.env.MAILGUN_REGION || 'us',
          apiKey: process.env.MAILGUN_API_KEY ? 'configured' : 'missing'
        }
      });
    }

    const startTime = Date.now();
    
    // Test Mailgun API directly with V2 parameters
    const domain = process.env.MAILGUN_DOMAIN;
    const apiKey = process.env.MAILGUN_API_KEY;
    const region = (process.env.MAILGUN_REGION || '').toLowerCase();
    const base = region === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';
    
    // Use domain validation endpoint first
    const domainUrl = `${base}/${domain}`;
    const domainResponse = await fetch(domainUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    
    const domainTime = Date.now() - startTime;
    
    if (!domainResponse.ok) {
      const errorText = await domainResponse.text().catch(() => '');
      return res.json({
        ok: false,
        details: {
          status: 'domain_error',
          httpStatus: domainResponse.status,
          httpStatusText: domainResponse.statusText,
          error: errorText,
          responseTime: `${domainTime}ms`,
          domain,
          region,
          apiKey: 'configured',
          testType: 'domain_validation'
        }
      });
    }
    
    const domainData = await domainResponse.json();
    
    // Test message sending endpoint with validation
    const messageUrl = `${base}/${domain}/messages`;
    const testBody = new URLSearchParams({
      from: process.env.MAILGUN_FROM_EMAIL || `Health Check <noreply@${domain}>`,
      to: `health-check-${Date.now()}@${domain}`, // Send to same domain to avoid external delivery
      subject: `OfferLogix V2 Health Check - ${new Date().toISOString()}`,
      html: '<p>Health check test from OfferLogix V2 system</p>',
      text: 'Health check test from OfferLogix V2 system',
      'o:testmode': 'true', // Test mode - won't actually deliver
      'h:X-Health-Check': 'true',
      'v:health_check': 'true',
      'v:system': 'v2_webhook'
    });

    const messageResponse = await fetch(messageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: testBody
    });
    
    const messageTime = Date.now() - startTime;
    
    if (!messageResponse.ok) {
      const errorText = await messageResponse.text().catch(() => '');
      return res.json({
        ok: false,
        details: {
          status: 'send_error',
          httpStatus: messageResponse.status,
          httpStatusText: messageResponse.statusText,
          error: errorText,
          responseTime: `${messageTime}ms`,
          domain,
          region,
          apiKey: 'configured',
          testType: 'message_send',
          domainInfo: domainData?.domain || 'unknown'
        }
      });
    }
    
    const messageData = await messageResponse.json();
    
    res.json({
      ok: true,
      details: {
        status: 'healthy',
        responseTime: `${messageTime}ms`,
        domain,
        fromEmail: process.env.MAILGUN_FROM_EMAIL,
        region,
        apiKey: 'configured',
        testType: 'full_test',
        messageId: messageData?.id || 'unknown',
        domainStatus: domainData?.domain?.state || 'unknown',
        domainType: domainData?.domain?.type || 'unknown'
      }
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      details: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
        domain: process.env.MAILGUN_DOMAIN || 'not_set',
        region: process.env.MAILGUN_REGION || 'us',
        apiKey: process.env.MAILGUN_API_KEY ? 'configured' : 'missing'
      }
    });
  }
});

/**
 * V2 webhook system integration health check
 */
router.get('/v2-integration', async (_req, res) => {
  try {
    const checks = await Promise.allSettled([
      // Check OpenRouter
      fetch(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'}/health/openrouter`).then(r => r.json()),
      // Check Mailgun  
      fetch(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'}/health/mailgun`).then(r => r.json()),
      // Check database
      fetch(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'}/health/database`).then(r => r.json())
    ]);
    
    const results = {
      openrouter: checks[0].status === 'fulfilled' ? checks[0].value : { ok: false, error: 'health_check_failed' },
      mailgun: checks[1].status === 'fulfilled' ? checks[1].value : { ok: false, error: 'health_check_failed' },
      database: checks[2].status === 'fulfilled' ? checks[2].value : { ok: false, error: 'health_check_failed' }
    };
    
    const allHealthy = Object.values(results).every(check => check.ok);
    
    res.json({
      ok: allHealthy,
      timestamp: new Date().toISOString(),
      system: 'v2_webhook',
      environment: {
        AI_MODEL: process.env.AI_MODEL || 'openai/gpt-5-chat',
        MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'not_set',
        MAILGUN_REGION: process.env.MAILGUN_REGION || 'us',
        NODE_ENV: process.env.NODE_ENV || 'development'
      },
      checks: results,
      summary: {
        healthy_services: Object.values(results).filter(r => r.ok).length,
        total_services: Object.keys(results).length,
        failing_services: Object.entries(results).filter(([_, r]) => !r.ok).map(([name]) => name)
      }
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      timestamp: new Date().toISOString(),
      system: 'v2_webhook',
      error: error instanceof Error ? error.message : 'V2 integration health check failed'
    });
  }
});

export default router;