import { z } from 'zod';

// Streamlined Sales Brief Schema - Bullet-Action Format
export const SalesBriefSchema = z.object({
  name: z.string(),
  modified_name: z.string(),
  user_query: z.string(),
  quick_insights: z.array(z.string()).max(4), // Keep ≤ 4 bullets for 5-second scan
  actions: z.array(z.string()).max(6), // Clear action checklist for rep
  sales_readiness: z.enum(['low', 'medium', 'high']),
  priority: z.enum(['standard', 'immediate']),
  rep_message: z.string(), // Copy-paste ready response
  research_queries: z.array(z.string()),
  reply_required: z.boolean()
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