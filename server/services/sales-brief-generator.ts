import { generateContent } from './openrouter';
import { SalesBriefSchema, type SalesBrief } from '@shared/sales-brief-schema';
import type { ConversationAnalysis } from './handover/handover-service';

export interface ConversationContext {
  leadName: string;
  vehicleInterest?: string;
  latestMessage: string;
  conversationHistory: Array<{ role: string; content: string; timestamp: string }>;
  analysis: ConversationAnalysis;
}

export class SalesBriefGenerator {
  /**
  * Generate conversion-ready sales brief using GPT-5 Chat with strict JSON validation
   */
  static async generateSalesBrief(context: ConversationContext): Promise<SalesBrief | null> {
    try {
      const prompt = this.createSalesBriefPrompt(context);
      
  // Call GPT-5 Chat with strict JSON formatting
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
   * Create streamlined bullet-action prompt using existing conversation analysis
   */
  private static createSalesBriefPrompt(context: ConversationContext): string {
    const { leadName, vehicleInterest, latestMessage, conversationHistory, analysis } = context;
    
    // Use pre-computed analysis data instead of re-deriving
    const recentMessages = conversationHistory
      .slice(-3)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `# AUTOMOTIVE HANDOVER - BULLET-ACTION FORMAT

## ANALYSIS DATA (PRE-COMPUTED):
- Qualification Score: ${analysis.qualificationScore}/100
- Intent Score: ${analysis.intentScore}/100
- Urgency Level: ${analysis.urgencyLevel || 'medium'}
- Detected Intents: ${analysis.detectedIntents.join(', ')}
- Automotive Context: ${analysis.automotiveContext ? `${analysis.automotiveContext.vehicleType || 'N/A'} | ${analysis.automotiveContext.priceRange || 'N/A'} | ${analysis.automotiveContext.timeframe || 'N/A'}` : 'Not specified'}

## CUSTOMER CONTEXT:
- Name: ${leadName}
- Vehicle Interest: ${vehicleInterest || 'Not specified'}
- Latest Message: "${latestMessage}"

## RECENT CONVERSATION:
${recentMessages}

## TASK:
Generate a streamlined handover brief that a sales rep can scan in 5 seconds and know exactly what to do.

## REQUIRED JSON OUTPUT (EXACT FORMAT):
{
  "name": "${leadName}",
  "modified_name": "Preferred/shortened name",
  "user_query": "${latestMessage}",
  "quick_insights": [
    "Vehicle: make/model/trim",
    "Motivator: price/features/trade/financing",
    "Timeline: now/30 days/later",
    "Any blockers or constraints"
  ],
  "actions": [
    "Confirm inventory match",
    "Offer similar options if OOS", 
    "Schedule test drive or call",
    "Send trade-in link if relevant",
    "Direct to finance if requested"
  ],
  "sales_readiness": "${analysis.qualificationScore >= 80 ? 'high' : analysis.qualificationScore >= 60 ? 'medium' : 'low'}",
  "priority": "${analysis.urgencyLevel === 'high' ? 'immediate' : 'standard'}",
  "rep_message": "Short, copy-paste ready follow-up message to send now",
  "research_queries": ["Exact inventory or offer lookups"],
  "reply_required": true
}

CRITICAL REQUIREMENTS:
- quick_insights: ≤4 bullets maximum for 5-second scan
- actions: Clear checklist items the rep can check off
- rep_message: One line, natural, no editing needed
- Use pre-computed scores - don't recalculate
- Return ONLY valid JSON - no explanations`;
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
          model: 'openai/gpt-5-chat',
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
    const { LLMClient } = await import('./llm-client.js');
    
    const strictPrompt = `${prompt}

CRITICAL RETRY: The previous response was not valid JSON. 
You MUST respond with ONLY the JSON object - no explanations, no markdown, no additional text.
Start with { and end with } - nothing else.`;

    const response = await LLMClient.generateContent(strictPrompt, { 
      json: true, 
      temperature: 0.2 
    });
    
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
   * Fix common schema validation issues for streamlined format
   */
  private static fixCommonSchemaIssues(response: any): any {
    const fixed = { ...response };
    
    // Ensure quick_insights is an array (max 4 items)
    if (typeof fixed.quick_insights === 'string') {
      fixed.quick_insights = fixed.quick_insights.split('\n').filter((item: string) => item.trim());
    }
    if (Array.isArray(fixed.quick_insights) && fixed.quick_insights.length > 4) {
      fixed.quick_insights = fixed.quick_insights.slice(0, 4);
    }
    
    // Ensure actions is an array (max 6 items)
    if (typeof fixed.actions === 'string') {
      fixed.actions = fixed.actions.split('\n').filter((item: string) => item.trim());
    }
    if (Array.isArray(fixed.actions) && fixed.actions.length > 6) {
      fixed.actions = fixed.actions.slice(0, 6);
    }
    
    // Ensure research_queries is an array  
    if (typeof fixed.research_queries === 'string') {
      fixed.research_queries = [fixed.research_queries];
    }
    
    // Set default values for missing fields
    fixed.reply_required = fixed.reply_required ?? true;
    fixed.priority = fixed.priority || 'standard';
    fixed.sales_readiness = fixed.sales_readiness || 'medium';
    fixed.rep_message = fixed.rep_message || 'I can help you with that. Let me check our current options.';
    
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