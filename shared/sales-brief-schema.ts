import { z } from 'zod';

// Sales Brief Schema for conversion-ready handover
export const SalesBriefSchema = z.object({
  name: z.string(),
  modified_name: z.string(),
  user_query: z.string(),
  Analysis: z.string(),
  type: z.enum(['email', 'text']),
  quick_insights: z.array(z.string()).max(6), // Keep ≤ 6 items for better readability
  empathetic_response: z.string(),
  engagement_check: z.string(),
  sales_readiness: z.enum(['low', 'medium', 'high']),
  Answer: z.string(),
  retrieve_inventory_data: z.boolean(),
  research_queries: z.array(z.string()),
  reply_required: z.boolean(),
  priority: z.enum(['standard', 'immediate'])
});

export type SalesBrief = z.infer<typeof SalesBriefSchema>;

// Enhanced Handover Evaluation with sales brief
export const HandoverEvaluationSchema = z.object({
  shouldHandover: z.boolean(),
  reason: z.string(),
  score: z.number().min(0).max(100),
  triggeredCriteria: z.array(z.string()),
  nextActions: z.array(z.string()),
  recommendedAgent: z.string().optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']),
  salesBrief: SalesBriefSchema.optional()
});

export type EnhancedHandoverEvaluation = z.infer<typeof HandoverEvaluationSchema>;