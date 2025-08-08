/**
 * Enhanced Reply Planner - Boringly reliable AI response generation
 * Always returns valid responses with deterministic fallbacks
 */

import { LLMClient } from './llm-client';

export interface ReplyPlanResponse {
  message: string;
  quickReplies?: string[];
  confidence?: number;
  aiGenerated: boolean;
}

/**
 * Plan a reply with reliable fallbacks
 * Never throws - always returns a usable response
 */
export async function planReply(prompt: string): Promise<ReplyPlanResponse> {
  try {
    const response = await LLMClient.generate({
      model: 'openai/gpt-4o-mini',
      system: 'Always return valid JSON with {message, quickReplies?: string[]}. Be helpful, professional, and automotive-focused.',
      user: prompt,
      json: true,
      temperature: 0.3,
      maxTokens: 800,
    });

    const parsed = JSON.parse(response.content);
    
    // Validate response structure
    if (!parsed.message || typeof parsed.message !== 'string') {
      throw new Error('Invalid response structure');
    }

    return {
      message: parsed.message,
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies : undefined,
      confidence: 0.9,
      aiGenerated: true
    };

  } catch (error) {
    console.warn('AI reply generation failed, using fallback:', error);
    
    // Intelligent fallback based on prompt content
    const fallbackMessage = generateFallbackReply(prompt);
    
    return {
      message: fallbackMessage.message,
      quickReplies: fallbackMessage.quickReplies,
      confidence: 0.7,
      aiGenerated: false
    };
  }
}

/**
 * Generate contextual fallback replies
 */
function generateFallbackReply(prompt: string): { message: string; quickReplies: string[] } {
  const lowerPrompt = prompt.toLowerCase();
  
  // Price-related inquiries
  if (lowerPrompt.includes('price') || lowerPrompt.includes('cost') || lowerPrompt.includes('payment')) {
    return {
      message: "I'd be happy to discuss pricing options with you. Let's schedule a time to go over current incentives and financing options that work best for your budget.",
      quickReplies: ['Schedule test drive', 'See current incentives', 'Financing options']
    };
  }
  
  // Vehicle features
  if (lowerPrompt.includes('feature') || lowerPrompt.includes('spec') || lowerPrompt.includes('capability')) {
    return {
      message: "Great question! I can provide detailed specifications and arrange a demonstration so you can experience the features firsthand. Would you like to schedule a test drive?",
      quickReplies: ['Schedule test drive', 'Get detailed specs', 'Compare models']
    };
  }
  
  // Availability and timeline
  if (lowerPrompt.includes('available') || lowerPrompt.includes('when') || lowerPrompt.includes('timeline')) {
    return {
      message: "Let me check current availability for you. I can also help you reserve a vehicle if you'd like to secure your preferred options and timing.",
      quickReplies: ['Check availability', 'Reserve vehicle', 'Schedule visit']
    };
  }
  
  // Trade-in related
  if (lowerPrompt.includes('trade') || lowerPrompt.includes('current vehicle')) {
    return {
      message: "I can help you get an accurate trade-in estimate for your current vehicle. We often have excellent trade-in values that can significantly reduce your new vehicle cost.",
      quickReplies: ['Get trade value', 'Schedule appraisal', 'See total savings']
    };
  }
  
  // Generic helpful fallback
  return {
    message: "Got it. Would you like to schedule a test drive or see pricing options? I'm here to help you find the perfect vehicle for your needs.",
    quickReplies: ['Schedule test drive', 'See pricing', 'Compare trims']
  };
}

/**
 * Generate quick reply suggestions for any context
 */
export async function generateQuickReplies(context: {
  lastMessage: string;
  vehicleInterest?: string;
  leadStage?: string;
}): Promise<string[]> {
  try {
    const prompt = `Generate 3 short automotive sales reply suggestions for: "${context.lastMessage}"
    Vehicle: ${context.vehicleInterest || 'any'}
    Stage: ${context.leadStage || 'consideration'}
    
    Return JSON: {"replies": ["...", "...", "..."]}
    Each reply should be ≤ 6 words and actionable.`;

    const response = await LLMClient.generate({
      model: 'openai/gpt-4o-mini',
      system: 'Return only valid JSON with reply suggestions.',
      user: prompt,
      json: true,
      temperature: 0.4,
      maxTokens: 200,
    });

    const parsed = JSON.parse(response.content);
    return Array.isArray(parsed.replies) ? parsed.replies : getFallbackQuickReplies(context);

  } catch (error) {
    console.warn('Quick reply generation failed, using fallback:', error);
    return getFallbackQuickReplies(context);
  }
}

function getFallbackQuickReplies(context: { lastMessage: string; vehicleInterest?: string }): string[] {
  const message = context.lastMessage.toLowerCase();
  
  if (message.includes('price')) {
    return ['Get pricing', 'See incentives', 'Schedule visit'];
  }
  
  if (message.includes('test') || message.includes('drive')) {
    return ['Schedule test drive', 'Book appointment', 'Visit today'];
  }
  
  if (context.vehicleInterest) {
    return [`See ${context.vehicleInterest}`, 'Compare models', 'Schedule drive'];
  }
  
  return ['Tell me more', 'Schedule test drive', 'Get pricing info'];
}