import { generateContent } from './openrouter';
import { SalesBriefSchema, type SalesBrief } from '@shared/sales-brief-schema';
import type { ConversationAnalysis } from './handover-service';

export interface ConversationContext {
  leadName: string;
  vehicleInterest?: string;
  latestMessage: string;
  conversationHistory: Array<{ role: string; content: string; timestamp: string }>;
  analysis: ConversationAnalysis;
}

export class SalesBriefGenerator {
  /**
   * Generate conversion-ready sales brief using GPT-5 Mini with strict JSON validation
   */
  static async generateSalesBrief(context: ConversationContext): Promise<SalesBrief | null> {
    try {
      const prompt = this.createSalesBriefPrompt(context);
      
      // Call GPT-5 Mini with strict JSON formatting
      const response = await this.callLLMWithJsonGuardrails(prompt);
      
      // Validate against schema
      const validatedBrief = this.validateSalesBrief(response);
      
      return validatedBrief;
    } catch (error) {
      console.error('Sales brief generation failed:', error);
      return null;
    }
  }

  /**
   * Create context-aware prompt using existing conversation analysis
   */
  private static createSalesBriefPrompt(context: ConversationContext): string {
    const { leadName, vehicleInterest, latestMessage, conversationHistory, analysis } = context;
    
    // Use pre-computed analysis data instead of re-deriving
    const recentMessages = conversationHistory
      .slice(-3)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `# AUTOMOTIVE SALES BRIEF GENERATOR

## ANALYSIS DATA (PRE-COMPUTED):
- Qualification Score: ${analysis.qualificationScore}/100
- Intent Score: ${analysis.intentScore}/100
- Urgency Level: ${analysis.urgencyLevel || 'medium'}
- Detected Intents: ${analysis.detectedIntents.join(', ')}
- Automotive Context: ${analysis.automotiveContext.join(', ')}
- Message Count: ${analysis.messageCount}
- Engagement Level: ${analysis.engagementLevel}/100

## CUSTOMER CONTEXT:
- Name: ${leadName}
- Vehicle Interest: ${vehicleInterest || 'Not specified'}
- Latest Message: "${latestMessage}"

## RECENT CONVERSATION:
${recentMessages}

## TASK:
Generate a conversion-ready sales brief in EXACT JSON format. Use the pre-computed analysis data above - DO NOT guess or recalculate these values.

## REQUIRED JSON OUTPUT:
{
  "name": "${leadName}",
  "modified_name": "Preferred/shortened name for personal touch",
  "user_query": "${latestMessage}",
  "Analysis": "Brief analytical summary focusing on buying readiness and next steps",
  "type": "email",
  "quick_insights": [
    "Key vehicle interest point",
    "Primary buying motivator", 
    "Timeline indicator",
    "Any identified blockers",
    "Qualification level",
    "Recommended approach"
  ],
  "empathetic_response": "One-line bridge statement acknowledging their specific need",
  "engagement_check": "Short tactic for maintaining momentum without being pushy",
  "sales_readiness": "${analysis.qualificationScore >= 80 ? 'high' : analysis.qualificationScore >= 60 ? 'medium' : 'low'}",
  "Answer": "Rep-ready response that directly addresses their query with automotive expertise",
  "retrieve_inventory_data": ${vehicleInterest ? 'true' : 'false'},
  "research_queries": ["Specific search terms for inventory/pricing lookup"],
  "reply_required": true,
  "priority": "${analysis.urgencyLevel === 'high' ? 'immediate' : 'standard'}"
}

CRITICAL: 
- Use EXACT field names as shown
- Keep quick_insights to 6 items maximum
- Make Answer specific and actionable for the sales rep
- Base sales_readiness and priority on the provided analysis scores
- Return ONLY valid JSON - no explanations or markdown`;
  }

  /**
   * Call LLM with JSON guardrails for reliable output
   */
  private static async callLLMWithJsonGuardrails(prompt: string): Promise<any> {
    try {
      // First attempt with strict JSON mode
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'OneKeel Swarm Sales Brief',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert automotive sales intelligence system. Always respond with valid JSON only.'
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2, // Lower temperature for more consistent output
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from LLM');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('LLM JSON call failed:', error);
      // Retry with explicit JSON-only instruction
      return this.retryWithStrictMode(prompt);
    }
  }

  /**
   * Retry with strict JSON-only system prompt injection
   */
  private static async retryWithStrictMode(prompt: string): Promise<any> {
    const strictPrompt = `${prompt}

CRITICAL RETRY: The previous response was not valid JSON. 
You MUST respond with ONLY the JSON object - no explanations, no markdown, no additional text.
Start with { and end with } - nothing else.`;

    const response = await generateContent(strictPrompt);
    
    // Clean any potential markdown or extra text
    const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleanResponse);
  }

  /**
   * Validate sales brief against schema with error recovery
   */
  private static validateSalesBrief(rawResponse: any): SalesBrief {
    try {
      // First validation attempt
      return SalesBriefSchema.parse(rawResponse);
    } catch (error) {
      console.error('Sales brief validation failed:', error);
      
      // Attempt to fix common issues
      const fixedResponse = this.fixCommonSchemaIssues(rawResponse);
      
      try {
        return SalesBriefSchema.parse(fixedResponse);
      } catch (secondError) {
        console.error('Sales brief fix attempt failed:', secondError);
        throw new Error('Unable to generate valid sales brief');
      }
    }
  }

  /**
   * Fix common schema validation issues
   */
  private static fixCommonSchemaIssues(response: any): any {
    const fixed = { ...response };
    
    // Ensure quick_insights is an array
    if (typeof fixed.quick_insights === 'string') {
      fixed.quick_insights = fixed.quick_insights.split('\n').filter(item => item.trim());
    }
    
    // Ensure research_queries is an array  
    if (typeof fixed.research_queries === 'string') {
      fixed.research_queries = [fixed.research_queries];
    }
    
    // Truncate quick_insights to 6 items
    if (Array.isArray(fixed.quick_insights) && fixed.quick_insights.length > 6) {
      fixed.quick_insights = fixed.quick_insights.slice(0, 6);
    }
    
    // Set default values for missing fields
    fixed.type = fixed.type || 'email';
    fixed.retrieve_inventory_data = fixed.retrieve_inventory_data ?? true;
    fixed.reply_required = fixed.reply_required ?? true;
    fixed.priority = fixed.priority || 'standard';
    fixed.sales_readiness = fixed.sales_readiness || 'medium';
    
    return fixed;
  }

  /**
   * Create conversation context from existing analysis
   */
  static createConversationContext(
    leadName: string,
    vehicleInterest: string | undefined,
    latestMessage: string,
    conversationHistory: Array<{ role: string; content: string; timestamp: string }>,
    analysis: ConversationAnalysis
  ): ConversationContext {
    return {
      leadName,
      vehicleInterest,
      latestMessage,
      conversationHistory,
      analysis
    };
  }
}