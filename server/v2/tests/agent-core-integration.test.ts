/**
 * AgentCore Integration Tests
 * 
 * Tests the LLM response generation and handover logic.
 */

import { AgentCore } from '../services/agent/AgentCore';

describe('AgentCore Integration', () => {
  let agentCore: AgentCore;

  beforeEach(() => {
    agentCore = new AgentCore();
  });

  describe('variable injection', () => {
    it('should inject variables into system prompts', () => {
      const template = 'You are {{role}} at {{dealership}}.';
      const variables = { role: 'Sales Associate', dealership: 'Kunes Macomb' };
      
      const result = agentCore.injectVariables(template, variables);
      
      expect(result).toBe('You are Sales Associate at Kunes Macomb.');
    });

    it('should leave unmatched variables unchanged', () => {
      const template = 'You are {{role}} at {{dealership}}. Call {{missing}}.';
      const variables = { role: 'Sales Associate', dealership: 'Kunes Macomb' };
      
      const result = agentCore.injectVariables(template, variables);
      
      expect(result).toBe('You are Sales Associate at Kunes Macomb. Call {{missing}}.');
    });

    it('should handle empty variables', () => {
      const template = 'You are {{role}} at {{dealership}}.';
      const variables = {};
      
      const result = agentCore.injectVariables(template, variables);
      
      expect(result).toBe('You are {{role}} at {{dealership}}.');
    });
  });

  describe('handover trigger detection', () => {
    it('should detect default financing triggers', () => {
      const testCases = [
        'I need financing options',
        'Can you help with FINANCING?',
        'What are my financing options?',
        'Need financing help'
      ];

      testCases.forEach(content => {
        const shouldHandover = agentCore.detectHandoverTriggers(content);
        expect(shouldHandover).toBe(true);
      });
    });

    it('should detect trade-in triggers', () => {
      const testCases = [
        'What is my trade-in value?',
        'I want to TRADE-IN my car',
        'Can you give me a trade in estimate?'
      ];

      testCases.forEach(content => {
        const shouldHandover = agentCore.detectHandoverTriggers(content);
        expect(shouldHandover).toBe(true);
      });
    });

    it('should detect test drive triggers', () => {
      const testCases = [
        'I want to schedule test drive',
        'Can I schedule a TEST DRIVE?',
        'When can I test drive the car?'
      ];

      testCases.forEach(content => {
        const shouldHandover = agentCore.detectHandoverTriggers(content);
        expect(shouldHandover).toBe(true);
      });
    });

    it('should detect custom triggers from variables', () => {
      const content = 'I need warranty information';
      const variables = { handoverTriggers: 'warranty,service,parts' };
      
      const shouldHandover = agentCore.detectHandoverTriggers(content, variables);
      
      expect(shouldHandover).toBe(true);
    });

    it('should not trigger for general inquiries', () => {
      const testCases = [
        'What vehicles do you have in stock?',
        'Tell me about your dealership',
        'What are your hours?',
        'Where are you located?'
      ];

      testCases.forEach(content => {
        const shouldHandover = agentCore.detectHandoverTriggers(content);
        expect(shouldHandover).toBe(false);
      });
    });

    it('should be case insensitive', () => {
      const content = 'I NEED FINANCING OPTIONS NOW!';
      
      const shouldHandover = agentCore.detectHandoverTriggers(content);
      
      expect(shouldHandover).toBe(true);
    });
  });

  describe('response generation', () => {
    it('should generate normal response for general inquiry', async () => {
      const response = await agentCore.generate({
        systemPrompt: 'You are a helpful assistant.',
        history: [{ role: 'user', content: 'What cars do you have?' }]
      });

      expect(response.handover).toBe(false);
      expect(response.reply).toBeTruthy();
      expect(response.reason).toBeUndefined();
    });

    it('should generate handover response for financing inquiry', async () => {
      const response = await agentCore.generate({
        systemPrompt: 'You are a sales associate.',
        history: [{ role: 'user', content: 'I need financing options' }]
      });

      expect(response.handover).toBe(true);
      expect(response.reply).toBeTruthy();
      expect(response.reason).toBeTruthy();
    });

    it('should use variable injection in prompts', async () => {
      const response = await agentCore.generate({
        systemPrompt: 'You are {{role}} at {{dealership}}.',
        history: [{ role: 'user', content: 'Hello' }],
        variables: { role: 'Sales Manager', dealership: 'Auto World' }
      });

      expect(response.reply).toBeTruthy();
      // In a real implementation, the injected prompt would affect the response
    });
  });

  describe('conversation context handling', () => {
    it('should handle empty conversation history', async () => {
      const response = await agentCore.generate({
        systemPrompt: 'You are a helpful assistant.',
        history: []
      });

      expect(response.reply).toBeTruthy();
      expect(response.handover).toBe(false);
    });

    it('should handle multi-turn conversations', async () => {
      const response = await agentCore.generate({
        systemPrompt: 'You are a sales associate.',
        history: [
          { role: 'user', content: 'Hi there' },
          { role: 'assistant', content: 'Hello! How can I help?' },
          { role: 'user', content: 'I need financing options' }
        ]
      });

      expect(response.handover).toBe(true);
      expect(response.reason).toBeTruthy();
    });
  });
});