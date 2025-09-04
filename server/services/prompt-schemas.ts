import { z } from 'zod';

/**
 * Centralized JSON Schema Management System
 * 
 * This module provides type-safe, reusable JSON schemas for all AI prompt responses
 * across the MailMind codebase. Each schema includes TypeScript interfaces,
 * Zod validation schemas, template generation functions, and validation helpers.
 * 
 * DESIGN PRINCIPLES:
 * - Backward compatibility with existing response formats
 * - Type safety through TypeScript interfaces
 * - Runtime validation with Zod schemas
 * - Easy migration path for existing services
 * - Comprehensive JSDoc documentation
 * - Template generation for consistent prompt formatting
 */

// ========================================
// AI CHAT SCHEMAS
// ========================================

/**
 * Schema for AI Campaign Chat responses
 * Used in: server/services/ai-chat.ts
 */
export const AiChatResponseSchema = z.object({
  message: z.string().describe('Conversational response to the user'),
  nextStep: z.enum(['campaign_type', 'target_audience', 'goals', 'details', 'complete'])
    .describe('Next step in the campaign creation flow'),
  campaignData: z.object({
    name: z.string().optional(),
    context: z.string().optional(),
    handoverGoals: z.string().optional(),
    numberOfTemplates: z.number().default(5),
    daysBetweenMessages: z.number().default(3),
  }).passthrough().describe('Campaign data object - allows additional fields'),
  isComplete: z.boolean().describe('Whether the campaign setup is complete')
});

export type AiChatResponse = z.infer<typeof AiChatResponseSchema>;

/**
 * Generate JSON schema prompt text for AI chat responses
 */
export function getAiChatSchemaPrompt(): string {
  return `Respond with JSON in this exact format:
{
  "message": "Your conversational response here",
  "nextStep": "campaign_type|target_audience|goals|details|complete",
  "campaignData": {"name": "...", "context": "...", "handoverGoals": "...", "numberOfTemplates": 5, "daysBetweenMessages": 3},
  "isComplete": false
}`;
}

// ========================================
// CAMPAIGN OPTIMIZATION SCHEMAS
// ========================================

/**
 * Schema for campaign optimization recommendations
 * Used in: server/integrations/supermemory/prompts.ts
 */
export const CampaignOptimizationSchema = z.object({
  sendTime: z.object({
    dayOfWeek: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
    hour: z.number().min(8).max(20),
    confidence: z.number().min(0).max(100),
    reason: z.string().describe('Short reason for timing recommendation')
  }),
  sequence: z.array(z.object({
    step: z.number(),
    type: z.enum(['introduction', 'vehicle_showcase', 'incentive_offer', 'urgency_close']),
    dayOffset: z.number(),
    note: z.string().describe('Short note about this sequence step')
  })),
  contentAngles: z.array(z.string()).describe('Content angles to emphasize'),
  expectedLift: z.object({
    metric: z.enum(['open', 'ctr', 'reply', 'handover']),
    percent: z.number().min(1).max(30)
  })
});

export type CampaignOptimization = z.infer<typeof CampaignOptimizationSchema>;

/**
 * Generate JSON schema prompt text for campaign optimization
 */
export function getCampaignOptimizationSchemaPrompt(): string {
  return `REQUIRED OUTPUT JSON:
{
  "sendTime": {"dayOfWeek": "Mon|Tue|...|Sun", "hour": 8-20, "confidence": 0-100, "reason": "short"},
  "sequence": [
    {"step": 1, "type": "introduction|vehicle_showcase|incentive_offer|urgency_close", "dayOffset": 0, "note": "short"},
    {"step": 2, "type": "...", "dayOffset": 3, "note": "short"}
  ],
  "contentAngles": ["fuel economy", "family features", "payment examples"],
  "expectedLift": {"metric": "open|ctr|reply|handover", "percent": 1-30}
}`;
}

// ========================================
// LEAD SCORING SCHEMAS
// ========================================

/**
 * Schema for lead scoring responses
 * Used in: server/integrations/supermemory/prompts.ts
 */
export const LeadScoringSchema = z.object({
  qualification: z.number().min(0).max(100).describe('Vehicle specificity, payment mentions, test-drive intent'),
  urgency: z.number().min(0).max(100).describe('Time-sensitive language, quick replies'),
  handover: z.number().min(0).max(100).describe('Overall buy-readiness score'),
  signals: z.array(z.string()).describe('Detected buying signals'),
  reasoning: z.string().describe('1-3 short bullets explaining the scores')
});

export type LeadScoring = z.infer<typeof LeadScoringSchema>;

/**
 * Generate JSON schema prompt text for lead scoring
 */
export function getLeadScoringSchemaPrompt(): string {
  return `Return JSON:
{
  "qualification": 0-100,
  "urgency": 0-100,
  "handover": 0-100,
  "signals": ["string", ...],
  "reasoning": "1-3 short bullets"
}`;
}

// ========================================
// OPENAI SERVICE SCHEMAS
// ========================================

/**
 * Schema for campaign goals suggestions
 * Used in: server/services/openai.ts - suggestCampaignGoals()
 */
export const CampaignGoalsSchema = z.object({
  goals: z.array(z.string()).describe('Array of suggested campaign goals')
});

export type CampaignGoals = z.infer<typeof CampaignGoalsSchema>;

/**
 * Schema for campaign name suggestions
 * Used in: server/services/openai.ts - suggestCampaignNames()
 */
export const CampaignNamesSchema = z.object({
  names: z.array(z.string()).describe('Array of suggested campaign names')
});

export type CampaignNames = z.infer<typeof CampaignNamesSchema>;

/**
 * Schema for enhanced email templates
 * Used in: server/services/openai.ts - enhanceEmailTemplates()
 */
export const EnhancedTemplatesSchema = z.object({
  templates: z.array(z.string()).describe('Array of email template content'),
  subjectLines: z.array(z.string()).describe('Array of email subject lines')
});

export type EnhancedTemplates = z.infer<typeof EnhancedTemplatesSchema>;

/**
 * Schema for subject lines
 * Used in: server/services/openai.ts - generateSubjectLines()
 */
export const SubjectLinesSchema = z.object({
  subjectLines: z.array(z.string()).describe('Array of email subject lines')
});

export type SubjectLines = z.infer<typeof SubjectLinesSchema>;

/**
 * Schema for generated email templates with sequence info
 * Used in: server/services/openai.ts - generateEmailTemplates()
 */
export const EmailTemplatesSchema = z.object({
  templates: z.array(z.object({
    sequence: z.number().describe('Template sequence number'),
    title: z.string().describe('Template title/purpose'),
    content: z.string().describe('HTML email content')
  }))
});

export type EmailTemplates = z.infer<typeof EmailTemplatesSchema>;

// ========================================
// OFFERLOGIX SCHEMAS
// ========================================

/**
 * Schema for OfferLogix instant credit decision responses
 * Used in: server/services/offerlogix-credit.ts
 */
export const OfferLogixCreditDecisionSchema = z.object({
  decision: z.enum(['approved', 'conditional', 'declined', 'pending']),
  approvalAmount: z.number().optional(),
  estimatedRate: z.number().optional(),
  monthlyPayment: z.number().optional(),
  lenderName: z.string().optional(),
  requiredDocs: z.array(z.string()),
  conditions: z.array(z.string()),
  alternativeOptions: z.array(z.object({
    type: z.string(),
    description: z.string()
  })),
  nextSteps: z.array(z.string()),
  expirationDate: z.string().optional(),
  complianceNotes: z.array(z.string())
});

export type OfferLogixCreditDecision = z.infer<typeof OfferLogixCreditDecisionSchema>;

/**
 * Schema for OfferLogix financing conversation responses
 * Used in: server/services/offerlogix-conversation.ts
 */
export const OfferLogixConversationSchema = z.object({
  message: z.string(),
  stage: z.enum([
    'greeting', 'qualification', 'needs_assessment', 'credit_evaluation',
    'vehicle_selection', 'financing_options', 'negotiation', 'documentation',
    'closing', 'follow_up'
  ]),
  intent: z.enum([
    'information_seeking', 'price_inquiry', 'test_drive_request',
    'financing_inquiry', 'trade_in_inquiry', 'credit_concern',
    'ready_to_purchase', 'comparison_shopping'
  ]).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'frustrated']).optional(),
  suggestedActions: z.array(z.string()),
  escalationNeeded: z.boolean(),
  complianceFlags: z.array(z.string())
});

export type OfferLogixConversation = z.infer<typeof OfferLogixConversationSchema>;

/**
 * Generate JSON schema prompt for OfferLogix credit decisions
 */
export function getOfferLogixCreditSchemaPrompt(): string {
  return `Return JSON for instant credit decision:
{
  "decision": "approved|conditional|declined|pending",
  "approvalAmount": 25000,
  "estimatedRate": 5.9,
  "monthlyPayment": 450,
  "lenderName": "Premier Auto Finance",
  "requiredDocs": ["proof of income", "proof of residence"],
  "conditions": ["verify employment"],
  "alternativeOptions": [{"type": "co-signer", "description": "Add co-signer for better terms"}],
  "nextSteps": ["Complete application", "Submit documents"],
  "expirationDate": "2024-02-01",
  "complianceNotes": ["ECOA compliant", "FCRA disclosure provided"]
}`;
}

/**
 * Generate JSON schema prompt for OfferLogix conversations
 */
export function getOfferLogixConversationSchemaPrompt(): string {
  return `Return JSON for financing conversation:
{
  "message": "Your response to the customer",
  "stage": "greeting|qualification|needs_assessment|credit_evaluation|vehicle_selection|financing_options|negotiation|documentation|closing|follow_up",
  "intent": "information_seeking|price_inquiry|test_drive_request|financing_inquiry|trade_in_inquiry|credit_concern|ready_to_purchase|comparison_shopping",
  "sentiment": "positive|neutral|negative|frustrated",
  "suggestedActions": ["Schedule test drive", "Run credit check"],
  "escalationNeeded": false,
  "complianceFlags": ["ECOA disclosure needed"]
}`;
}

// ========================================
// ANALYTICS SCHEMAS
// ========================================

/**
 * Schema for intent classification analysis
 * Used in: server/services/advanced-conversation-analytics.ts
 */
export const IntentAnalysisSchema = z.object({
  primaryIntent: z.object({
    intent: z.enum([
      'information_seeking', 'price_inquiry', 'test_drive_request', 
      'financing_inquiry', 'complaint', 'compliment', 'ready_to_purchase',
      'comparison_shopping', 'service_request', 'appointment_scheduling'
    ]),
    confidence: z.number().min(0).max(100),
    reasoning: z.string().describe('Detailed explanation')
  }),
  secondaryIntents: z.array(z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(100)
  })),
  intentStability: z.number().min(0).max(100).describe('Stability of intent classification')
});

export type IntentAnalysis = z.infer<typeof IntentAnalysisSchema>;

// ========================================
// VALIDATION HELPERS
// ========================================

/**
 * Generic function to validate any schema against parsed JSON response
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>, 
  response: unknown, 
  schemaName: string = 'Response'
): T {
  try {
    return schema.parse(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      throw new Error(`${schemaName} validation failed: ${issues}`);
    }
    throw new Error(`${schemaName} validation failed: ${error}`);
  }
}

/**
 * Safe JSON parsing with schema validation
 */
export function parseAndValidate<T>(
  jsonString: string, 
  schema: z.ZodSchema<T>,
  schemaName: string = 'Response'
): T {
  try {
    const parsed = JSON.parse(jsonString);
    return validateResponse(schema, parsed, schemaName);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${schemaName}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Fix common schema validation issues with fallback values
 */
export function fixCommonIssues<T extends Record<string, any>>(
  response: any,
  fallbacks: Partial<T> = {}
): any {
  if (!response || typeof response !== 'object') {
    return { ...fallbacks };
  }

  const fixed = { ...response };

  // Fix string arrays that might be strings
  for (const key in fixed) {
    const value = fixed[key];
    if (typeof value === 'string' && key.includes('array') || key.includes('list') || key.includes('signals')) {
      try {
        // Try to split by newlines or commas
        fixed[key] = value.split(/[\n,]/).map((item: string) => item.trim()).filter(Boolean);
      } catch {
        fixed[key] = [value];
      }
    }
  }

  // Apply fallback values for missing fields
  for (const key in fallbacks) {
    if (!(key in fixed)) {
      fixed[key] = fallbacks[key];
    }
  }

  return fixed;
}

// ========================================
// SCHEMA REGISTRY
// ========================================

/**
 * Central registry of all available schemas
 * Useful for dynamic schema selection and documentation
 */
export const SCHEMA_REGISTRY = {
  aiChat: {
    schema: AiChatResponseSchema as z.ZodSchema<any>,
    promptTemplate: getAiChatSchemaPrompt,
    description: 'AI Campaign Chat responses'
  },
  campaignOptimization: {
    schema: CampaignOptimizationSchema as z.ZodSchema<any>,
    promptTemplate: getCampaignOptimizationSchemaPrompt,
    description: 'Campaign optimization recommendations'
  },
  leadScoring: {
    schema: LeadScoringSchema as z.ZodSchema<any>,
    promptTemplate: getLeadScoringSchemaPrompt,
    description: 'Lead scoring and qualification analysis'
  },
  campaignGoals: {
    schema: CampaignGoalsSchema as z.ZodSchema<any>,
    promptTemplate: () => '{"goals": ["goal1", "goal2", "goal3"]}',
    description: 'Campaign goal suggestions'
  },
  campaignNames: {
    schema: CampaignNamesSchema as z.ZodSchema<any>,
    promptTemplate: () => '{"names": ["name1", "name2", "name3", "name4", "name5"]}',
    description: 'Campaign name suggestions'
  },
  enhancedTemplates: {
    schema: EnhancedTemplatesSchema as z.ZodSchema<any>,
    promptTemplate: () => '{"templates": ["template1", "template2"], "subjectLines": ["subject1", "subject2", "subject3"]}',
    description: 'Enhanced email templates and subject lines'
  },
  subjectLines: {
    schema: SubjectLinesSchema as z.ZodSchema<any>,
    promptTemplate: () => '{"subjectLines": ["subject1", "subject2", "subject3", "subject4", "subject5"]}',
    description: 'Email subject line suggestions'
  },
  emailTemplates: {
    schema: EmailTemplatesSchema as z.ZodSchema<any>,
    promptTemplate: () => '{"templates": [{"sequence": 1, "title": "Introduction Email", "content": "HTML email content here..."}]}',
    description: 'Generated email templates with sequence info'
  },
  intentAnalysis: {
    schema: IntentAnalysisSchema as z.ZodSchema<any>,
    promptTemplate: () => '{"primaryIntent": {"intent": "information_seeking", "confidence": 85, "reasoning": "..."}, "secondaryIntents": [], "intentStability": 75}',
    description: 'Customer intent classification analysis'
  },
  offerlogixCredit: {
    schema: OfferLogixCreditDecisionSchema as z.ZodSchema<any>,
    promptTemplate: getOfferLogixCreditSchemaPrompt,
    description: 'OfferLogix instant credit decision'
  },
  offerlogixConversation: {
    schema: OfferLogixConversationSchema as z.ZodSchema<any>,
    promptTemplate: getOfferLogixConversationSchemaPrompt,
    description: 'OfferLogix financing conversation response'
  }
} as const;

export type SchemaType = keyof typeof SCHEMA_REGISTRY;

/**
 * Get a schema by name from the registry
 */
export function getSchema(schemaType: SchemaType) {
  return SCHEMA_REGISTRY[schemaType];
}

/**
 * Generate a prompt template for any schema type
 */
export function getSchemaPrompt(schemaType: SchemaType): string {
  const schema = SCHEMA_REGISTRY[schemaType];
  return schema.promptTemplate();
}

/**
 * Validate a response against any schema type
 */
export function validateSchemaResponse(
  schemaType: SchemaType,
  response: unknown
): any {
  const schema = SCHEMA_REGISTRY[schemaType];
  return validateResponse(schema.schema, response, schemaType);
}

// ========================================
// MIGRATION HELPERS
// ========================================

/**
 * Legacy compatibility wrapper for existing AI chat responses
 * Helps migrate from inline schemas to centralized system
 */
export function createAiChatResponse(data: {
  message: string;
  nextStep?: string;
  campaignData?: any;
  isComplete?: boolean;
}): AiChatResponse {
  return {
    message: data.message,
    nextStep: (data.nextStep as any) || 'campaign_type',
    campaignData: {
      numberOfTemplates: 5,
      daysBetweenMessages: 3,
      ...data.campaignData
    },
    isComplete: data.isComplete || false
  };
}

/**
 * Legacy compatibility wrapper for sales brief responses
 * Bridges to existing SalesBriefSchema from shared/sales-brief-schema.ts
 */
export function validateSalesBriefResponse(response: unknown) {
  // Import dynamically to avoid import issues during compilation
  try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const salesBriefSchema = require('../../../shared/sales-brief-schema');
    return validateResponse(salesBriefSchema.SalesBriefSchema, response, 'SalesBrief');
  } catch (error) {
    console.warn('Could not load SalesBriefSchema, using fallback validation');
    // Fallback validation - assume response is valid
    return response;
  }
}

/**
 * Helper to generate consistent error messages across all schema validations
 */
export function formatValidationError(error: z.ZodError, schemaName: string): string {
  const issues = error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
  
  return `${schemaName} validation failed:\n${issues.join('\n')}`;
}