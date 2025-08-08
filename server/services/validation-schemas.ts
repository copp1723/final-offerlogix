/**
 * Validation schemas for LLM-generated JSON responses
 * Implements consistent validation across all automotive content generation functions
 */

import { z } from 'zod';

// Schema for automotive email templates
export const AutomobileTemplatesSchema = z.object({
  templates: z.array(z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(10).max(5000),
    cta: z.string().min(1).max(200)
  })).min(1).max(5)
});

// Schema for subject lines generation
export const SubjectLinesSchema = z.object({
  subjectLines: z.array(z.string().min(1).max(200)).min(1).max(10)
});

// Schema for campaign goals generation
export const CampaignGoalsSchema = z.object({
  goals: z.array(z.string().min(5).max(500)).min(1).max(5)
});

// Schema for enhanced email templates
export const EnhancedTemplatesSchema = z.object({
  templates: z.array(z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(10).max(5000),
    cta: z.string().min(1).max(200),
    purpose: z.string().optional(),
    audienceType: z.string().optional()
  })).min(1).max(10)
});

// Schema for campaign name suggestions
export const CampaignNamesSchema = z.object({
  names: z.array(z.string().min(3).max(100)).min(1).max(10)
});

/**
 * Validation helper that retries with strict JSON mode on failure
 */
export async function validateWithRetry<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  retryFn?: () => Promise<unknown>
): Promise<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('Initial validation failed:', error);
    
    if (retryFn) {
      try {
        const retryData = await retryFn();
        return schema.parse(retryData);
      } catch (retryError) {
        console.error('Retry validation failed:', retryError);
        throw new Error(`Validation failed after retry: ${retryError}`);
      }
    }
    
    throw new Error(`Validation failed: ${error}`);
  }
}

/**
 * Safe JSON parser with retry logic
 */
export function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    // Try to clean common JSON formatting issues
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^\s*```.*?\n/gm, '')
      .replace(/\n```\s*$/gm, '')
      .trim();
    
    try {
      return JSON.parse(cleaned);
    } catch (cleanError) {
      throw new Error(`JSON parsing failed: ${error}`);
    }
  }
}