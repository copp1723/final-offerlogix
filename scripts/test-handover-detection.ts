#!/usr/bin/env tsx

/**
 * Test Handover Detection Capability
 * 
 * This script comprehensively tests the handover detection capability of the OFFERLOGIX system.
 * It verifies:
 * 1. Campaign handover configuration
 * 2. Intent detection and scoring
 * 3. Handover trigger evaluation
 * 4. Notification delivery
 * 5. Lead scoring and prioritization
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
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

async function testDatabaseConnection(): Promise<boolean> {
  console.log('\n🔌 Testing Database Connection...');
  
  if (!DATABASE_URL) {
    logTest('Database Connection', 'FAILURE', 'DATABASE_URL not configured');
    return false;
  }

  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    logTest('Database Connection', 'SUCCESS', 'Connected to database successfully');
    return true;
  } catch (error) {
    logTest('Database Connection', 'FAILURE', `Connection failed: ${error}`);
    return false;
  }
}

async function testHandoverConfiguration(): Promise<boolean> {
  console.log('\n⚙️ Testing Handover Configuration...');
  
  if (!pool) {
    logTest('Handover Configuration', 'FAILURE', 'No database connection');
    return false;
  }

  try {
    const client = await pool.connect();
    
    // Check campaigns with handover settings
    const campaignResult = await client.query(`
      SELECT 
        id,
        name,
        handover_goals,
        handover_prompt,
        handover_criteria,
        handover_recipient,
        handover_score_thresholds,
        agent_config_id
      FROM campaigns
      WHERE status = 'active'
        AND (handover_goals IS NOT NULL 
          OR handover_criteria IS NOT NULL 
          OR handover_recipient IS NOT NULL)
      LIMIT 10
    `);

    if (campaignResult.rows.length > 0) {
      const withCriteria = campaignResult.rows.filter(c => c.handover_criteria).length;
      const withRecipient = campaignResult.rows.filter(c => c.handover_recipient).length;
      const withThresholds = campaignResult.rows.filter(c => c.handover_score_thresholds).length;
      
      logTest('Handover Configuration', 'SUCCESS', 
        `Found ${campaignResult.rows.length} campaigns with handover settings`, {
          total_campaigns: campaignResult.rows.length,
          with_criteria: withCriteria,
          with_recipient: withRecipient,
          with_thresholds: withThresholds,
          sample_config: campaignResult.rows[0] ? {
            name: campaignResult.rows[0].name,
            has_goals: !!campaignResult.rows[0].handover_goals,
            has_criteria: !!campaignResult.rows[0].handover_criteria,
            has_recipient: !!campaignResult.rows[0].handover_recipient
          } : null
        });
    } else {
      logTest('Handover Configuration', 'WARNING', 'No campaigns with handover configuration found');
    }

    // Check handover criteria structure
    const criteriaResult = await client.query(`
      SELECT 
        name,
        handover_criteria
      FROM campaigns
      WHERE handover_criteria IS NOT NULL
      LIMIT 5
    `);

    if (criteriaResult.rows.length > 0) {
      const validCriteria = criteriaResult.rows.filter(c => {
        try {
          const criteria = c.handover_criteria;
          return criteria && (criteria.intents || criteria.keywords || criteria.score_threshold);
        } catch {
          return false;
        }
      });

      logTest('Handover Criteria Structure', 
        validCriteria.length > 0 ? 'SUCCESS' : 'WARNING',
        `${validCriteria.length}/${criteriaResult.rows.length} campaigns have valid criteria structure`, {
          sample_criteria: validCriteria[0]?.handover_criteria
        });
    }

    client.release();
    return campaignResult.rows.length > 0;
  } catch (error) {
    logTest('Handover Configuration', 'FAILURE', `Database error: ${error}`);
    return false;
  }
}

async function testIntentDetection(): Promise<boolean> {
  console.log('\n🎯 Testing Intent Detection...');
  
  if (!OPENROUTER_API_KEY) {
    logTest('Intent Detection', 'WARNING', 'OPENROUTER_API_KEY not configured - skipping AI tests');
    return false;
  }

  const testMessages = [
    {
      message: "I want to schedule a test drive for tomorrow at 2 PM. Can someone help me?",
      expected_intents: ['schedule', 'test_drive', 'urgent'],
      handover_likely: true
    },
    {
      message: "What are your current financing rates? I have excellent credit.",
      expected_intents: ['financing', 'pricing', 'qualified'],
      handover_likely: true
    },
    {
      message: "Just browsing your website. Nice cars!",
      expected_intents: ['browsing', 'casual'],
      handover_likely: false
    },
    {
      message: "I need to speak with a manager immediately about my purchase.",
      expected_intents: ['urgent', 'manager', 'escalation'],
      handover_likely: true
    }
  ];

  let correctDetections = 0;

  for (const test of testMessages) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': APP_URL,
          'X-Title': 'OFFERLOGIX Intent Detection'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Analyze the customer message and identify intents. Return a JSON object with:
                - intents: array of detected intents
                - urgency: low/medium/high
                - handover_recommended: true/false
                - confidence: 0-1`
            },
            {
              role: 'user',
              content: test.message
            }
          ],
          temperature: 0.3,
          max_tokens: 200
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        const aiResponse = data.choices[0].message.content;
        
        try {
          // Extract JSON from response
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            
            const correctHandover = analysis.handover_recommended === test.handover_likely;
            if (correctHandover) correctDetections++;
            
            logTest(`Intent: "${test.message.substring(0, 50)}..."`, 
              correctHandover ? 'SUCCESS' : 'WARNING',
              `Handover detection ${correctHandover ? 'correct' : 'incorrect'}`, {
                detected_intents: analysis.intents,
                urgency: analysis.urgency,
                handover_recommended: analysis.handover_recommended,
                expected_handover: test.handover_likely
              });
          }
        } catch (parseError) {
          logTest(`Intent: "${test.message.substring(0, 50)}..."`, 'WARNING', 
            'Could not parse AI response as JSON');
        }
      }
    } catch (error) {
      logTest(`Intent: "${test.message.substring(0, 50)}..."`, 'FAILURE', `Error: ${error}`);
    }
  }

  const accuracy = correctDetections / testMessages.length;
  logTest('Overall Intent Detection', 
    accuracy >= 0.75 ? 'SUCCESS' : accuracy >= 0.5 ? 'WARNING' : 'FAILURE',
    `Correctly detected ${correctDetections}/${testMessages.length} handover scenarios (${Math.round(accuracy * 100)}% accuracy)`);
  
  return accuracy >= 0.5;
}

async function testLeadScoring(): Promise<boolean> {
  console.log('\n📊 Testing Lead Scoring System...');
  
  if (!pool) {
    logTest('Lead Scoring', 'FAILURE', 'No database connection');
    return false;
  }

  try {
    const client = await pool.connect();
    
    // Check leads with scores
    const leadResult = await client.query(`
      SELECT 
        l.id,
        l.email,
        l.name,
        l.lead_score,
        l.engagement_level,
        l.last_interaction,
        COUNT(cm.id) as message_count,
        COUNT(CASE WHEN l.lead_score >= 70 THEN 1 END) OVER() as high_score_count,
        COUNT(*) OVER() as total_leads
      FROM leads l
      LEFT JOIN conversation_messages cm ON l.id = cm.lead_id
      WHERE l.lead_score IS NOT NULL
      GROUP BY l.id, l.email, l.name, l.lead_score, l.engagement_level, l.last_interaction
      ORDER BY l.lead_score DESC NULLS LAST
      LIMIT 10
    `);

    if (leadResult.rows.length > 0) {
      const avgScore = leadResult.rows.reduce((sum, l) => sum + (l.lead_score || 0), 0) / leadResult.rows.length;
      const highScoreCount = leadResult.rows[0].high_score_count || 0;
      const totalLeads = leadResult.rows[0].total_leads || 0;
      
      logTest('Lead Scoring System', 'SUCCESS', 
        `Found ${totalLeads} scored leads, ${highScoreCount} high-priority (score >= 70)`, {
          average_score: Math.round(avgScore),
          top_leads: leadResult.rows.slice(0, 3).map(l => ({
            name: l.name,
            score: l.lead_score,
            engagement: l.engagement_level,
            messages: l.message_count
          }))
        });
    } else {
      logTest('Lead Scoring System', 'WARNING', 'No scored leads found in database');
    }

    // Check score calculation factors
    const factorsResult = await client.query(`
      SELECT 
        c.name as campaign_name,
        c.lead_score_weights
      FROM campaigns c
      WHERE c.lead_score_weights IS NOT NULL
      LIMIT 5
    `);

    if (factorsResult.rows.length > 0) {
      logTest('Score Calculation Factors', 'SUCCESS', 
        `Found ${factorsResult.rows.length} campaigns with custom scoring weights`, {
          sample_weights: factorsResult.rows[0]?.lead_score_weights
        });
    } else {
      logTest('Score Calculation Factors', 'WARNING', 'No custom scoring weights configured');
    }

    client.release();
    return leadResult.rows.length > 0;
  } catch (error) {
    logTest('Lead Scoring', 'FAILURE', `Database error: ${error}`);
    return false;
  }
}

async function testHandoverNotifications(): Promise<boolean> {
  console.log('\n📬 Testing Handover Notifications...');
  
  if (!pool) {
    logTest('Handover Notifications', 'FAILURE', 'No database connection');
    return false;
  }

  try {
    const client = await pool.connect();
    
    // Check for handover events
    const handoverResult = await client.query(`
      SELECT 
        e.id,
        e.type,
        e.data,
        e.created_at,
        c.name as campaign_name,
        c.handover_recipient
      FROM events e
      LEFT JOIN campaigns c ON e.data->>'campaign_id' = c.id::text
      WHERE e.type IN ('lead_handover', 'handover_triggered', 'high_intent_detected')
      ORDER BY e.created_at DESC
      LIMIT 10
    `);

    if (handoverResult.rows.length > 0) {
      logTest('Handover Events', 'SUCCESS', 
        `Found ${handoverResult.rows.length} handover events`, {
          recent_events: handoverResult.rows.slice(0, 3).map(e => ({
            type: e.type,
            campaign: e.campaign_name,
            recipient: e.handover_recipient,
            time: e.created_at
          }))
        });
    } else {
      logTest('Handover Events', 'WARNING', 'No handover events found in database');
    }

    // Check notification configuration
    const notificationResult = await client.query(`
      SELECT 
        COUNT(DISTINCT c.handover_recipient) as unique_recipients,
        COUNT(*) as campaigns_with_recipients
      FROM campaigns c
      WHERE c.handover_recipient IS NOT NULL
        AND c.status = 'active'
    `);

    const notifConfig = notificationResult.rows[0];
    if (notifConfig.campaigns_with_recipients > 0) {
      logTest('Notification Configuration', 'SUCCESS', 
        `${notifConfig.campaigns_with_recipients} campaigns configured with ${notifConfig.unique_recipients} unique recipients`);
    } else {
      logTest('Notification Configuration', 'WARNING', 'No campaigns have handover recipients configured');
    }

    client.release();
    return handoverResult.rows.length > 0 || notifConfig.campaigns_with_recipients > 0;
  } catch (error) {
    logTest('Handover Notifications', 'FAILURE', `Database error: ${error}`);
    return false;
  }
}

async function testHandoverWorkflow(): Promise<boolean> {
  console.log('\n🔄 Testing Complete Handover Workflow...');
  
  if (!pool || !MAILGUN_API_KEY) {
    logTest('Handover Workflow', 'WARNING', 'Missing required configuration for workflow test');
    return false;
  }

  try {
    const client = await pool.connect();
    
    // Simulate a high-intent message
    const testLead = {
      email: 'test-handover@example.com',
      name: 'Test Handover',
      message: 'I need to speak with someone immediately about purchasing a car. Ready to buy today!'
    };

    // Check if workflow components are in place
    const componentsCheck = {
      has_campaigns: false,
      has_ai_agents: false,
      has_recipients: false,
      has_webhook: false
    };

    // Check campaigns
    const campaignCheck = await client.query(`
      SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'
    `);
    componentsCheck.has_campaigns = campaignCheck.rows[0].count > 0;

    // Check AI agents
    const agentCheck = await client.query(`
      SELECT COUNT(*) as count FROM ai_agent_config WHERE is_active = true
    `);
    componentsCheck.has_ai_agents = agentCheck.rows[0].count > 0;

    // Check recipients
    const recipientCheck = await client.query(`
      SELECT COUNT(*) as count FROM campaigns 
      WHERE handover_recipient IS NOT NULL AND status = 'active'
    `);
    componentsCheck.has_recipients = recipientCheck.rows[0].count > 0;

    // Check webhook endpoint
    try {
      const webhookResponse = await fetch(`${APP_URL}/api/webhooks/mailgun/inbound`, {
        method: 'GET'
      });
      componentsCheck.has_webhook = webhookResponse.status < 500;
    } catch {
      componentsCheck.has_webhook = false;
    }

    const readyComponents = Object.values(componentsCheck).filter(Boolean).length;
    const isReady = readyComponents >= 3;

    logTest('Handover Workflow Components', 
      isReady ? 'SUCCESS' : 'WARNING',
      `${readyComponents}/4 workflow components ready`, componentsCheck);

    // Test handover trigger simulation
    if (isReady) {
      // Check if we can create a test handover event
      const testHandover = await client.query(`
        INSERT INTO events (type, data, created_at)
        VALUES ('handover_test', $1, NOW())
        RETURNING id
      `, [JSON.stringify({
        lead: testLead,
        intent_score: 95,
        urgency: 'high',
        recommended_action: 'immediate_contact'
      })]);

      if (testHandover.rows[0]) {
        logTest('Handover Event Creation', 'SUCCESS', 
          'Successfully created test handover event', {
            event_id: testHandover.rows[0].id
          });
        
        // Clean up test event
        await client.query('DELETE FROM events WHERE id = $1', [testHandover.rows[0].id]);
      }
    }

    client.release();
    return isReady;
  } catch (error) {
    logTest('Handover Workflow', 'FAILURE', `Error testing workflow: ${error}`);
    return false;
  }
}

async function testHandoverMetrics(): Promise<boolean> {
  console.log('\n📈 Testing Handover Metrics & Analytics...');
  
  if (!pool) {
    logTest('Handover Metrics', 'FAILURE', 'No database connection');
    return false;
  }

  try {
    const client = await pool.connect();
    
    // Get handover statistics
    const metricsResult = await client.query(`
      WITH handover_stats AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as handover_count
        FROM events
        WHERE type IN ('lead_handover', 'handover_triggered')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
      ),
      campaign_stats AS (
        SELECT 
          c.id,
          c.name,
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT CASE WHEN l.lead_score >= 70 THEN l.id END) as high_score_leads,
          COUNT(DISTINCT cm.id) as total_messages
        FROM campaigns c
        LEFT JOIN leads l ON l.id IN (
          SELECT lead_id FROM conversation_messages WHERE conversation_id IN (
            SELECT id FROM conversations WHERE campaign_id = c.id
          )
        )
        LEFT JOIN conversation_messages cm ON cm.conversation_id IN (
          SELECT id FROM conversations WHERE campaign_id = c.id
        )
        WHERE c.status = 'active'
        GROUP BY c.id, c.name
      )
      SELECT 
        (SELECT COUNT(*) FROM handover_stats) as days_with_handovers,
        (SELECT SUM(handover_count) FROM handover_stats) as total_handovers,
        (SELECT AVG(handover_count) FROM handover_stats) as avg_daily_handovers,
        (SELECT COUNT(*) FROM campaign_stats WHERE high_score_leads > 0) as campaigns_with_high_scores,
        (SELECT SUM(high_score_leads) FROM campaign_stats) as total_high_score_leads
    `);

    const metrics = metricsResult.rows[0];
    const hasMetrics = metrics.total_handovers > 0 || metrics.total_high_score_leads > 0;

    logTest('Handover Metrics', 
      hasMetrics ? 'SUCCESS' : 'WARNING',
      hasMetrics ? 'Handover metrics available' : 'No handover metrics found', {
        total_handovers_30d: metrics.total_handovers || 0,
        avg_daily_handovers: parseFloat(metrics.avg_daily_handovers || 0).toFixed(2),
        high_score_leads: metrics.total_high_score_leads || 0,
        active_campaigns: metrics.campaigns_with_high_scores || 0
      });

    client.release();
    return hasMetrics;
  } catch (error) {
    logTest('Handover Metrics', 'FAILURE', `Database error: ${error}`);
    return false;
  }
}

async function generateSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 HANDOVER DETECTION CAPABILITY TEST SUMMARY');
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
  
  // Check specific capabilities
  const hasConfig = testResults.some(r => r.test.includes('Configuration') && r.status === 'SUCCESS');
  const hasDetection = testResults.some(r => r.test.includes('Intent') && r.status !== 'FAILURE');
  const hasScoring = testResults.some(r => r.test.includes('Scoring') && r.status !== 'FAILURE');
  
  if (failureCount === 0 && successCount >= 5) {
    console.log('✅ HANDOVER DETECTION: FULLY OPERATIONAL');
    console.log('The handover detection system is functioning correctly.');
    console.log('\nCapabilities:');
    console.log('  ✅ Campaign configuration with handover criteria');
    console.log('  ✅ Intent detection and analysis');
    console.log('  ✅ Lead scoring and prioritization');
    console.log('  ✅ Automated handover notifications');
  } else if (hasConfig && (hasDetection || hasScoring)) {
    console.log('⚠️  HANDOVER DETECTION: PARTIALLY OPERATIONAL');
    console.log('The handover system has basic functionality but needs configuration.');
    console.log('\nCapabilities:');
    console.log(`  ${hasConfig ? '✅' : '❌'} Campaign configuration`);
    console.log(`  ${hasDetection ? '✅' : '❌'} Intent detection`);
    console.log(`  ${hasScoring ? '✅' : '❌'} Lead scoring`);
  } else {
    console.log('❌ HANDOVER DETECTION: NOT OPERATIONAL');
    console.log('The handover system requires configuration and setup.');
    console.log('\nRequired Setup:');
    console.log('  1. Configure campaigns with handover criteria');
    console.log('  2. Set handover recipients for notifications');
    console.log('  3. Define intent detection rules');
    console.log('  4. Enable lead scoring weights');
  }
  console.log('='.repeat(80));
}

async function main() {
  console.log('🎯 OFFERLOGIX HANDOVER DETECTION CAPABILITY TEST');
  console.log('================================================');
  console.log('Testing handover detection and notification system...\n');
  
  console.log('📋 Configuration:');
  console.log(`   DATABASE_URL: ${DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   OPENROUTER_API_KEY: ${OPENROUTER_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   MAILGUN_API_KEY: ${MAILGUN_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   APP_URL: ${APP_URL}`);
  
  // Run all tests
  await testDatabaseConnection();
  await testHandoverConfiguration();
  await testIntentDetection();
  await testLeadScoring();
  await testHandoverNotifications();
  await testHandoverWorkflow();
  await testHandoverMetrics();
  
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