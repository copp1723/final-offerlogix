/**
 * Handover Decision Logic Tests
 * 
 * Tests the deterministic handover control system.
 */

import { decideHandover, extractHandoverConfig, generateHandoverBrief, type HandoverDecisionInput, type HandoverTriggers } from '../services/handover/handover-decision.js';

describe('Business Handover Decision Logic', () => {
  describe('decideHandover', () => {
    it('should handover when pricing questions trigger is enabled and detected', () => {
      const input: HandoverDecisionInput = {
        config: {
          triggers: {
            pricingQuestions: true,
            testDriveDemo: false,
            tradeInValue: false,
            financing: false,
            vehicleAvailability: false,
            urgency: false,
            customTriggers: []
          },
          recipient: 'sales@test.com',
          recipientName: 'Sales Team'
        },
        lastUserMessage: 'What is the price of this car?',
        modelHandoverFlag: false
      };

      const result = decideHandover(input);

      expect(result.shouldHandover).toBe(true);
      expect(result.triggeredBy).toBe('keyword');
      expect(result.reason).toContain('pricingQuestions');
      expect(result.reason).toContain('price');
    });

    it('should handover when test drive trigger is enabled and detected', () => {
      const input: HandoverDecisionInput = {
        config: {
          triggers: {
            pricingQuestions: false,
            testDriveDemo: true,
            tradeInValue: false,
            financing: false,
            vehicleAvailability: false,
            urgency: false,
            customTriggers: []
          },
          recipient: 'sales@test.com'
        },
        lastUserMessage: 'Can I schedule a test drive?',
        modelHandoverFlag: false
      };

      const result = decideHandover(input);

      expect(result.shouldHandover).toBe(true);
      expect(result.triggeredBy).toBe('keyword');
      expect(result.reason).toContain('testDriveDemo');
      expect(result.reason).toContain('test drive');
    });

    it('should use model decision when mode is "model"', () => {
      const input: HandoverDecisionInput = {
        config: { mode: 'model' },
        lastUserMessage: 'What colors are available?',
        modelHandoverFlag: false
      };

      const result = decideHandover(input);

      expect(result.shouldHandover).toBe(false);
      expect(result.triggeredBy).toBe('model');
    });

    it('should handover on keyword match in "rule" mode', () => {
      const input: HandoverDecisionInput = {
        config: { 
          mode: 'rule', 
          keywords: ['price', 'payment', 'finance'],
          note: 'Connect to F&I specialist'
        },
        lastUserMessage: 'What is the price for this vehicle?',
        modelHandoverFlag: false
      };

      const result = decideHandover(input);

      expect(result.shouldHandover).toBe(true);
      expect(result.triggeredBy).toBe('keyword');
      expect(result.reason).toBe('Connect to F&I specialist');
    });

    it('should be case-insensitive for keyword matching', () => {
      const input: HandoverDecisionInput = {
        config: { 
          mode: 'rule', 
          keywords: ['appointment', 'schedule']
        },
        lastUserMessage: 'Can I SCHEDULE an APPOINTMENT?',
        modelHandoverFlag: false
      };

      const result = decideHandover(input);

      expect(result.shouldHandover).toBe(true);
      expect(result.triggeredBy).toBe('keyword');
      expect(result.reason).toContain('appointment');
    });

    it('should fall back to model in "rule" mode when no keyword matches', () => {
      const input: HandoverDecisionInput = {
        config: { 
          mode: 'rule', 
          keywords: ['price', 'payment']
        },
        lastUserMessage: 'I need help with something complex',
        modelHandoverFlag: true,
        modelHandoverReason: 'Complex request detected'
      };

      const result = decideHandover(input);

      expect(result.shouldHandover).toBe(true);
      expect(result.triggeredBy).toBe('rule_fallback');
      expect(result.reason).toBe('Complex request detected');
    });

    it('should not handover in "rule" mode when no keyword and model says no', () => {
      const input: HandoverDecisionInput = {
        config: { 
          mode: 'rule', 
          keywords: ['price', 'payment']
        },
        lastUserMessage: 'What colors are available?',
        modelHandoverFlag: false
      };

      const result = decideHandover(input);

      expect(result.shouldHandover).toBe(false);
      expect(result.triggeredBy).toBe('rule_fallback');
    });
  });

  describe('extractHandoverConfig', () => {
    it('should extract config from campaign data', () => {
      const campaign = {
        handoverMode: 'rule',
        handoverKeywords: ['price', 'finance'],
        handoverNote: 'Connect to sales team'
      };

      const config = extractHandoverConfig(campaign);

      expect(config.mode).toBe('rule');
      expect(config.keywords).toEqual(['price', 'finance']);
      expect(config.note).toBe('Connect to sales team');
    });

    it('should handle snake_case field names', () => {
      const campaign = {
        handover_mode: 'always',
        handover_keywords: ['appointment'],
        handover_note: 'Always connect'
      };

      const config = extractHandoverConfig(campaign);

      expect(config.mode).toBe('always');
      expect(config.keywords).toEqual(['appointment']);
      expect(config.note).toBe('Always connect');
    });

    it('should default to "model" mode when not specified', () => {
      const campaign = {};

      const config = extractHandoverConfig(campaign);

      expect(config.mode).toBe('model');
      expect(config.keywords).toBeNull();
      expect(config.note).toBeNull();
    });
  });

  describe('generateHandoverBrief', () => {
    it('should generate comprehensive handover brief from conversation', () => {
      const conversationHistory = [
        { role: 'user', content: 'Hi, I have a 2019 Toyota Prius and need a battery health check' },
        { role: 'assistant', content: 'I can help you with that! Our hybrid specialists can perform a comprehensive battery diagnostic.' },
        { role: 'user', content: 'What would that cost and when can I schedule it? I need this done soon.' },
        { role: 'assistant', content: 'Our battery health check is $89 and includes a full diagnostic report.' },
        { role: 'user', content: 'That sounds reasonable. Can I get an appointment this week?' }
      ];

      const brief = generateHandoverBrief({
        conversationHistory,
        leadEmail: 'josh@atsglobal.ai',
        campaignName: 'Prius 2019 Test Campaign',
        handoverReason: 'Customer asked for pricing and scheduling',
        triggeredBy: 'keyword',
        lastUserMessage: 'Can I get an appointment this week?'
      });

      expect(brief.leadEmail).toBe('josh@atsglobal.ai');
      expect(brief.campaignSource).toBe('Prius 2019 Test Campaign');
      expect(brief.vehicleInfo).toContain('2019 Toyota Prius');
      expect(brief.keyIntents).toContain('pricing');
      expect(brief.keyIntents).toContain('scheduling');
      expect(brief.urgencyLevel).toBe('medium'); // "this week" indicates medium urgency
      expect(brief.conversationSummary).toContain('pricing');
      expect(brief.salesStrategy.length).toBeGreaterThan(0);
      expect(brief.closingStrategies.length).toBeGreaterThan(0);
    });

    it('should extract lead name from conversation', () => {
      const conversationHistory = [
        { role: 'user', content: 'Hi, I\'m Josh and I need help with my car' },
        { role: 'assistant', content: 'Hi Josh! I\'d be happy to help.' }
      ];

      const brief = generateHandoverBrief({
        conversationHistory,
        leadEmail: 'test@example.com',
        handoverReason: 'Test',
        triggeredBy: 'model',
        lastUserMessage: 'I need help'
      });

      expect(brief.leadName).toBe('Josh');
    });

    it('should detect high urgency from conversation', () => {
      const conversationHistory = [
        { role: 'user', content: 'I need help ASAP! My car broke down and I need it fixed today!' }
      ];

      const brief = generateHandoverBrief({
        conversationHistory,
        leadEmail: 'urgent@example.com',
        handoverReason: 'Urgent request',
        triggeredBy: 'keyword',
        lastUserMessage: 'I need it fixed today!'
      });

      expect(brief.urgencyLevel).toBe('high');
      expect(brief.closingStrategies).toContain('Speed matters: reach out same day - don\'t leave this on the table');
    });
  });
});
