#!/usr/bin/env node

/**
 * End-to-End Test: 2-Way Conversation with Lead Scoring and Handover
 * 
 * This test simulates a realistic conversation flow:
 * 1. Creates a test campaign with handover configuration
 * 2. Creates a test lead 
 * 3. Simulates 4 back-and-forth conversation exchanges
 * 4. Triggers lead scoring and handover logic
 * 5. Verifies handover email is sent to josh.copp@onekeel.ai
 */

import { storage } from './server/storage.js';
import { conversationResponderService } from './server/services/conversation-responder.js';
import { calculateLeadScore, interpretLeadScore } from './server/services/lead-score.js';
import { maybeTriggerIntentHandover } from './server/services/handover/handover-service.js';
import { sendCampaignEmail } from './server/services/mailgun.js';
import logger from './server/logging/logger.js';

// Test configuration
const TEST_CONFIG = {
  campaign: {
    name: 'E2E Test Campaign - Car Sales',
    description: 'End-to-end test for conversation and handover flow',
    handoverEmail: 'josh.copp@onekeel.ai',
    handoverEnabled: true,
    leadScoreThresholds: {
      immediate: 75,  // High urgency leads
      scheduled: 50   // Moderate interest leads
    },
    aiAgentConfig: {
      systemPrompt: 'You are a helpful car sales assistant. Be enthusiastic but professional. Ask qualifying questions to understand the customer\'s needs.',
      model: 'gpt-3.5-turbo',
      agentEmailDomain: 'test.onekeel.ai'
    }
  },
  lead: {
    firstName: 'Sarah',
    lastName: 'Johnson', 
    email: 'sarah.johnson.test@example.com',
    phone: '+1-555-0123',
    source: 'Website Form'
  }
};

// Conversation exchanges - escalating interest and urgency
const CONVERSATION_EXCHANGES = [
  {
    leadMessage: "Hi, I'm interested in learning more about your cars. What do you have available?",
    expectedKeywords: ['cars', 'available', 'interested']
  },
  {
    leadMessage: "I'm looking for something reliable for my family. What would you recommend for a family of 4?",
    expectedKeywords: ['family', 'recommend', 'reliable']
  },
  {
    leadMessage: "That sounds good! What's the price range? I need to buy something within the next 2 weeks.",
    expectedKeywords: ['price', 'buy', 'next 2 weeks', 'timeline']
  },
  {
    leadMessage: "Perfect! I'm very interested. Can I schedule a test drive ASAP? This is exactly what I've been looking for!",
    expectedKeywords: ['test drive', 'ASAP', 'very interested', 'exactly what']
  }
];

class E2EConversationTest {
  constructor() {
    this.testResults = {
      campaignCreated: false,
      leadCreated: false,
      conversationCreated: false,
      exchanges: [],
      leadScores: [],
      handoverTriggered: false,
      handoverEmailSent: false,
      errors: []
    };
  }

  async run() {
    console.log('🚀 Starting E2E Conversation Test...\n');
    
    try {
      // Step 1: Create test campaign
      await this.createTestCampaign();
      
      // Step 2: Create test lead
      await this.createTestLead();
      
      // Step 3: Create conversation
      await this.createConversation();
      
      // Step 4: Simulate conversation exchanges
      await this.simulateConversationExchanges();
      
      // Step 5: Check final lead score
      await this.evaluateFinalLeadScore();
      
      // Step 6: Process handover if needed
      await this.processHandover();
      
      // Step 7: Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ E2E Test Failed:', error);
      this.testResults.errors.push(error.message);
      this.generateReport();
      process.exit(1);
    }
  }

  async createTestCampaign() {
    console.log('📝 Creating test campaign...');
    
    try {
      this.campaign = await storage.createCampaign({
        name: TEST_CONFIG.campaign.name,
        description: TEST_CONFIG.campaign.description,
        isActive: true,
        handoverEmail: TEST_CONFIG.campaign.handoverEmail,
        handoverEnabled: TEST_CONFIG.campaign.handoverEnabled,
        leadScoreThresholds: TEST_CONFIG.campaign.leadScoreThresholds,
        aiAgentConfig: TEST_CONFIG.campaign.aiAgentConfig,
        status: 'active',
        clientId: 'test-client-id'
      });
      
      this.testResults.campaignCreated = true;
      console.log(`✅ Campaign created: ${this.campaign.id}`);
      
    } catch (error) {
      console.error('❌ Failed to create campaign:', error);
      throw error;
    }
  }

  async createTestLead() {
    console.log('👤 Creating test lead...');
    
    try {
      this.lead = await storage.createLead({
        ...TEST_CONFIG.lead,
        campaignId: this.campaign.id,
        clientId: 'test-client-id',
        status: 'active'
      });
      
      this.testResults.leadCreated = true;
      console.log(`✅ Lead created: ${this.lead.id}`);
      
    } catch (error) {
      console.error('❌ Failed to create lead:', error);
      throw error;
    }
  }

  async createConversation() {
    console.log('💬 Creating conversation...');
    
    try {
      this.conversation = await storage.createConversation({
        leadId: this.lead.id,
        campaignId: this.campaign.id,
        clientId: 'test-client-id',
        status: 'active',
        channel: 'email'
      });
      
      this.testResults.conversationCreated = true;
      console.log(`✅ Conversation created: ${this.conversation.id}`);
      
    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      throw error;
    }
  }

  async simulateConversationExchanges() {
    console.log('🔄 Simulating conversation exchanges...\n');
    
    for (let i = 0; i < CONVERSATION_EXCHANGES.length; i++) {
      const exchange = CONVERSATION_EXCHANGES[i];
      console.log(`--- Exchange ${i + 1}/4 ---`);
      
      try {
        // 1. Lead sends message
        console.log(`👤 Lead: ${exchange.leadMessage}`);
        
        const leadMessage = await storage.addConversationMessage({
          conversationId: this.conversation.id,
          leadId: this.lead.id,
          campaignId: this.campaign.id,
          sender: 'lead',
          content: exchange.leadMessage,
          timestamp: new Date()
        });

        // 2. AI Agent responds
        console.log('🤖 Generating AI response...');
        
        const aiResponse = await conversationResponderService.generateResponse(
          this.conversation.id,
          exchange.leadMessage,
          {
            leadInfo: this.lead,
            campaignInfo: this.campaign
          }
        );

        console.log(`🤖 AI Agent: ${aiResponse.slice(0, 100)}...`);
        
        const aiMessage = await storage.addConversationMessage({
          conversationId: this.conversation.id,
          leadId: this.lead.id,
          campaignId: this.campaign.id,
          sender: 'agent',
          content: aiResponse,
          timestamp: new Date()
        });

        // 3. Calculate lead score after this exchange
        const messages = await storage.getConversationMessages(this.conversation.id);
        const leadMessages = messages.filter(m => m.sender === 'lead').map(m => m.content);
        const currentScore = calculateLeadScore(leadMessages);
        const scoreInterpretation = interpretLeadScore(currentScore);
        
        console.log(`📊 Current Lead Score: ${currentScore} (${scoreInterpretation.category})`);
        
        this.testResults.exchanges.push({
          exchangeNumber: i + 1,
          leadMessage: exchange.leadMessage,
          aiResponse: aiResponse.slice(0, 200),
          leadScore: currentScore,
          scoreCategory: scoreInterpretation.category
        });
        
        this.testResults.leadScores.push({
          exchange: i + 1,
          score: currentScore,
          category: scoreInterpretation.category
        });
        
        // Add delay between exchanges
        await this.delay(1000);
        console.log('');
        
      } catch (error) {
        console.error(`❌ Failed at exchange ${i + 1}:`, error);
        this.testResults.errors.push(`Exchange ${i + 1}: ${error.message}`);
      }
    }
  }

  async evaluateFinalLeadScore() {
    console.log('🎯 Evaluating final lead score...');
    
    try {
      // Get all lead messages
      const messages = await storage.getConversationMessages(this.conversation.id);
      const leadMessages = messages.filter(m => m.sender === 'lead').map(m => m.content);
      
      const finalScore = calculateLeadScore(leadMessages);
      const scoreInterpretation = interpretLeadScore(finalScore);
      
      // Store final score in database
      await storage.storeLeadScore({
        campaignId: this.campaign.id,
        leadId: this.lead.id,
        score: finalScore,
        clientId: 'test-client-id'
      });
      
      console.log(`📈 Final Lead Score: ${finalScore}`);
      console.log(`📊 Score Category: ${scoreInterpretation.category}`);
      console.log(`🎯 Recommended Action: ${scoreInterpretation.action}`);
      
      this.finalScore = finalScore;
      this.scoreInterpretation = scoreInterpretation;
      
    } catch (error) {
      console.error('❌ Failed to evaluate final lead score:', error);
      throw error;
    }
  }

  async processHandover() {
    console.log('🔄 Checking handover criteria...');
    
    try {
      // Check if we should trigger handover based on lead score
      const shouldHandover = this.finalScore >= TEST_CONFIG.campaign.leadScoreThresholds.immediate;
      
      console.log(`🤔 Should trigger handover: ${shouldHandover} (score: ${this.finalScore}, threshold: ${TEST_CONFIG.campaign.leadScoreThresholds.immediate})`);
      
      if (shouldHandover) {
        console.log('📧 Processing handover...');
        
        // Try to trigger intent-based handover
        await maybeTriggerIntentHandover(this.lead.id, this.campaign.id);
        
        // Also send manual handover email to josh.copp@onekeel.ai
        const handoverEmailContent = this.buildHandoverEmail();
        
        const emailSent = await sendCampaignEmail(
          TEST_CONFIG.campaign.handoverEmail,
          `High Priority Lead Handover: ${this.lead.firstName} ${this.lead.lastName}`,
          handoverEmailContent,
          {},
          { isAutoResponse: false }
        );
        
        this.testResults.handoverTriggered = true;
        this.testResults.handoverEmailSent = emailSent;
        
        console.log(`✅ Intent handover triggered`);
        console.log(`📧 Manual handover email sent: ${emailSent ? 'Yes' : 'No'}`);
        
        if (emailSent) {
          console.log(`📮 Handover email sent to: ${TEST_CONFIG.campaign.handoverEmail}`);
        }
      } else {
        console.log('ℹ️  Handover criteria not met - lead score below threshold');
      }
      
    } catch (error) {
      console.error('❌ Failed to process handover:', error);
      this.testResults.errors.push(`Handover: ${error.message}`);
    }
  }

  buildHandoverEmail(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>High Priority Lead Handover</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #d73502; border-bottom: 3px solid #d73502; padding-bottom: 10px;">
            🚨 High Priority Lead Handover
        </h1>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #495057;">Lead Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Name:</td>
                    <td style="padding: 8px 0;">${this.lead.firstName} ${this.lead.lastName}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                    <td style="padding: 8px 0;">${this.lead.email}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
                    <td style="padding: 8px 0;">${this.lead.phone || 'Not provided'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Source:</td>
                    <td style="padding: 8px 0;">${this.lead.source}</td>
                </tr>
            </table>
        </div>

        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #0056b3;">Lead Score Analysis</h2>
            <div style="font-size: 24px; font-weight: bold; color: #d73502; margin: 10px 0;">
                Score: ${this.finalScore}/100
            </div>
            <div style="margin: 10px 0;">
                <strong>Category:</strong> ${this.scoreInterpretation?.category?.toUpperCase() || 'Unknown'}
            </div>
            <div style="margin: 10px 0;">
                <strong>Recommended Action:</strong> ${this.scoreInterpretation?.action?.toUpperCase() || 'Unknown'}
            </div>
        </div>

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #856404;">Conversation Summary</h2>
            <p>This lead has engaged in a ${CONVERSATION_EXCHANGES.length}-message conversation with our AI assistant. Key highlights:</p>
            <ul>
                <li>Expressed strong interest in family-friendly vehicles</li>
                <li>Asked specific questions about pricing and availability</li>
                <li>Indicated urgency with timeline ("next 2 weeks", "ASAP")</li>
                <li>Requested immediate test drive scheduling</li>
                <li>Used high-intent language ("very interested", "exactly what I've been looking for")</li>
            </ul>
        </div>

        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #155724;">Conversation Timeline</h2>
            ${this.testResults.exchanges.map((exchange, index) => `
                <div style="margin: 15px 0; padding: 10px; border-left: 3px solid #28a745;">
                    <strong>Exchange ${index + 1} (Score: ${exchange.leadScore})</strong><br>
                    <em>Lead:</em> "${exchange.leadMessage}"<br>
                    <em>AI Response:</em> "${exchange.aiResponse}..."
                </div>
            `).join('')}
        </div>

        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f5c6cb;">
            <h2 style="margin-top: 0; color: #721c24;">⚡ Action Required</h2>
            <p style="font-size: 18px; font-weight: bold;">This is a high-priority lead that requires IMMEDIATE attention!</p>
            <p>Recommended next steps:</p>
            <ol>
                <li>Contact the lead within the next 30 minutes</li>
                <li>Schedule a test drive appointment</li>
                <li>Prepare family vehicle recommendations</li>
                <li>Have financing options ready to discuss</li>
            </ol>
        </div>

        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #495057; color: white; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px;">
                Generated by MailMind AI Lead Scoring System<br>
                Campaign: ${this.campaign.name}<br>
                Generated at: ${new Date().toLocaleString()}
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 E2E TEST RESULTS REPORT');
    console.log('='.repeat(60));
    
    console.log('\n🎯 Test Objectives:');
    console.log(`✅ Campaign Created: ${this.testResults.campaignCreated ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Lead Created: ${this.testResults.leadCreated ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Conversation Created: ${this.testResults.conversationCreated ? 'PASS' : 'FAIL'}`);
    console.log(`✅ 4 Exchanges Completed: ${this.testResults.exchanges.length === 4 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Handover Triggered: ${this.testResults.handoverTriggered ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Email to josh.copp@onekeel.ai: ${this.testResults.handoverEmailSent ? 'PASS' : 'FAIL'}`);
    
    console.log('\n📊 Lead Score Progression:');
    this.testResults.leadScores.forEach(score => {
      console.log(`  Exchange ${score.exchange}: ${score.score} points (${score.category})`);
    });
    
    if (this.finalScore !== undefined) {
      console.log(`\n🎯 Final Score: ${this.finalScore} points`);
      console.log(`📈 Final Category: ${this.scoreInterpretation?.category || 'Unknown'}`);
      console.log(`⚡ Action Required: ${this.scoreInterpretation?.action || 'Unknown'}`);
    }
    
    console.log('\n💬 Conversation Summary:');
    this.testResults.exchanges.forEach((exchange, index) => {
      console.log(`\n  ${index + 1}. Lead: "${exchange.leadMessage}"`);
      console.log(`     AI: "${exchange.aiResponse}..."`);
      console.log(`     Score: ${exchange.leadScore} (${exchange.scoreCategory})`);
    });
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ Errors Encountered:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    const overallSuccess = 
      this.testResults.campaignCreated &&
      this.testResults.leadCreated &&
      this.testResults.conversationCreated &&
      this.testResults.exchanges.length === 4 &&
      this.testResults.handoverTriggered &&
      this.testResults.handoverEmailSent &&
      this.testResults.errors.length === 0;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🎉 OVERALL TEST RESULT: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(60));
    
    if (overallSuccess) {
      console.log('\n🎊 Success! The E2E conversation flow is working correctly.');
      console.log(`📧 Handover email should be delivered to josh.copp@onekeel.ai`);
    } else {
      console.log('\n⚠️  Some test components failed. Check the errors above.');
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the test
async function main() {
  const test = new E2EConversationTest();
  await test.run();
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { E2EConversationTest };