/**
 * Test file for prompt schemas
 * This validates that all schemas work correctly and are backward compatible
 */
import {
  AiChatResponseSchema,
  CampaignOptimizationSchema,
  LeadScoringSchema,
  validateResponse,
  parseAndValidate,
  getSchemaPrompt,
  validateSchemaResponse,
  SCHEMA_REGISTRY,
  fixCommonIssues
} from '../prompt-schemas';

describe('Prompt Schemas', () => {
  describe('AiChatResponseSchema', () => {
    it('validates correct AI chat response', () => {
      const validResponse = {
        message: "Let's create your automotive email campaign!",
        nextStep: "campaign_type",
        campaignData: {
          name: "Test Campaign",
          context: "New vehicle launch",
          numberOfTemplates: 5,
          daysBetweenMessages: 3
        },
        isComplete: false
      };

      const result = validateResponse(AiChatResponseSchema, validResponse, 'AiChat');
      expect(result.message).toBe(validResponse.message);
      expect(result.nextStep).toBe('campaign_type');
      expect(result.isComplete).toBe(false);
    });

    it('provides defaults for missing optional fields', () => {
      const minimalResponse = {
        message: "Hello",
        nextStep: "goals",
        campaignData: {},
        isComplete: true
      };

      const result = validateResponse(AiChatResponseSchema, minimalResponse, 'AiChat');
      expect(result.campaignData.numberOfTemplates).toBe(5);
      expect(result.campaignData.daysBetweenMessages).toBe(3);
    });
  });

  describe('CampaignOptimizationSchema', () => {
    it('validates optimization response', () => {
      const validResponse = {
        sendTime: {
          dayOfWeek: "Tue",
          hour: 10,
          confidence: 85,
          reason: "Best engagement time"
        },
        sequence: [
          {
            step: 1,
            type: "introduction",
            dayOffset: 0,
            note: "Welcome email"
          }
        ],
        contentAngles: ["fuel economy", "safety features"],
        expectedLift: {
          metric: "open",
          percent: 15
        }
      };

      const result = validateResponse(CampaignOptimizationSchema, validResponse, 'Optimization');
      expect(result.sendTime.dayOfWeek).toBe('Tue');
      expect(result.sequence).toHaveLength(1);
    });
  });

  describe('LeadScoringSchema', () => {
    it('validates lead scoring response', () => {
      const validResponse = {
        qualification: 75,
        urgency: 60,
        handover: 80,
        signals: ["mentioned budget", "asked about financing"],
        reasoning: "Strong buying signals detected"
      };

      const result = validateResponse(LeadScoringSchema, validResponse, 'LeadScoring');
      expect(result.qualification).toBe(75);
      expect(result.signals).toHaveLength(2);
    });
  });

  describe('Schema Registry', () => {
    it('contains all expected schemas', () => {
      const expectedSchemas = [
        'aiChat',
        'campaignOptimization', 
        'leadScoring',
        'campaignGoals',
        'campaignNames',
        'enhancedTemplates',
        'subjectLines',
        'emailTemplates',
        'intentAnalysis'
      ];

      expectedSchemas.forEach(schemaName => {
        expect(SCHEMA_REGISTRY[schemaName as keyof typeof SCHEMA_REGISTRY]).toBeDefined();
      });
    });

    it('generates prompt templates for all schemas', () => {
      Object.keys(SCHEMA_REGISTRY).forEach(schemaType => {
        const prompt = getSchemaPrompt(schemaType as any);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Utility Functions', () => {
    it('parseAndValidate works correctly', () => {
      const jsonString = '{"message": "test", "nextStep": "goals", "campaignData": {}, "isComplete": false}';
      
      const result = parseAndValidate(jsonString, AiChatResponseSchema, 'Test');
      expect(result.message).toBe('test');
    });

    it('fixCommonIssues handles string arrays', () => {
      const problematicResponse = {
        signals: "budget mentioned\nfinancing asked",
        qualification: 75
      };

      const fixed = fixCommonIssues(problematicResponse, { urgency: 50 });
      expect(Array.isArray(fixed.signals)).toBe(true);
      expect(fixed.urgency).toBe(50); // fallback applied
    });

    it('validates through schema registry', () => {
      const response = {
        qualification: 80,
        urgency: 70, 
        handover: 85,
        signals: ["price inquiry"],
        reasoning: "Strong signals"
      };

      const result = validateSchemaResponse('leadScoring', response);
      expect(result.qualification).toBe(80);
    });
  });
});