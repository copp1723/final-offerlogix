/**
 * Helper to sanitize text: strips emojis, collapses spaces, clamps length.
 */
function sanitizeText(text: string, maxLen = 500): string {
  // Remove emojis (surrogate pairs, pictographs, symbols)
  // Covers most emoji unicode blocks (incl. surrogate pairs)
  // https://stackoverflow.com/a/58331663/218196
  const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF]+|[\uFE00-\uFE0F]|\u200D|[\u2011-\u26FF])/gu;
  let cleaned = text.replace(emojiRegex, '');
  // Remove remaining surrogate pairs (sometimes missed)
  cleaned = cleaned.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Trim and clamp to maxLen
  cleaned = cleaned.trim().slice(0, maxLen);
  return cleaned;
}

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
  // Retry loop with jittered backoff
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await LLMClient.generate({
        model: 'openai/gpt-5-chat',
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
      // Validate quickReplies: if present, must be array of strings, each ≤ 6 words
      if (
        parsed.quickReplies !== undefined &&
        (!Array.isArray(parsed.quickReplies) ||
          !parsed.quickReplies.every(
            (r: any) =>
              typeof r === 'string' &&
              r.trim().split(/\s+/).length <= 6
          ))
      ) {
        throw new Error('Invalid quickReplies structure');
      }

      // Sanitize outputs
      const sanitizedMessage = sanitizeText(parsed.message, 500);
      let sanitizedQuickReplies: string[] | undefined = undefined;
      if (Array.isArray(parsed.quickReplies)) {
        sanitizedQuickReplies = parsed.quickReplies
          .map((r: string) => sanitizeText(r, 80))
          .map((r: string) => r.split(/\s+/).slice(0, 6).join(' '))
          .filter((r: string) => !!r);
      }

      return {
        message: sanitizedMessage,
        quickReplies: sanitizedQuickReplies,
        confidence: 0.9,
        aiGenerated: true
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        const jitter = 150 + Math.floor(Math.random() * 250); // 150–400ms
        console.warn(`[planReply] LLM attempt ${attempt} failed:`, error);
        await new Promise(res => setTimeout(res, jitter));
      }
    }
  }
  console.warn('AI reply generation failed, using fallback:', lastError);
  // Fallback
  const fallbackMessage = generateFallbackReply(prompt);
  // Sanitize fallback
  const sanitizedMessage = sanitizeText(fallbackMessage.message, 500);
  const sanitizedQuickReplies = fallbackMessage.quickReplies
    .map((r: string) => sanitizeText(r, 80))
    .map((r: string) => r.split(/\s+/).slice(0, 6).join(' '))
    .filter((r: string) => !!r);
  return {
    message: sanitizedMessage,
    quickReplies: sanitizedQuickReplies,
    confidence: 0.7,
    aiGenerated: false
  };
}

/**
 * Generate contextual fallback replies
 */
function generateFallbackReply(prompt: string): { message: string; quickReplies: string[] } {
  const lowerPrompt = prompt.toLowerCase();

  // Warranty/coverage branch
  if (lowerPrompt.includes('warranty') || lowerPrompt.includes('coverage')) {
    return {
      message: "We offer a range of warranty options and coverage plans to protect your vehicle. Would you like to learn more about these options?",
      quickReplies: ['See warranty plans', 'Extended coverage', 'Schedule visit']
    };
  }

  // VIN/vehicle ID branch
  if (lowerPrompt.includes('vin') || lowerPrompt.includes('vehicle id')) {
    return {
      message: "I can help you locate a vehicle by its VIN or vehicle ID. Please share the VIN and I'll check availability for you.",
      quickReplies: ['Share VIN', 'Check availability', 'Schedule call']
    };
  }

  // Appointment/visit branch
  if (lowerPrompt.includes('appointment') || lowerPrompt.includes('visit')) {
    return {
      message: "Would you like to book an appointment or schedule a visit? I can help you find a convenient time.",
      quickReplies: ['Book appointment', 'View calendar', 'Call now']
    };
  }

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
      model: 'openai/gpt-5-chat',
      system: 'Return only valid JSON with reply suggestions.',
      user: prompt,
      json: true,
      temperature: 0.4,
      maxTokens: 200,
    });

    const parsed = JSON.parse(response.content);
    let replies: string[] = [];
    if (Array.isArray(parsed.replies)) {
      // Sanitize, clamp, dedupe, ≤6 words
      const seen = new Set<string>();
      for (let raw of parsed.replies) {
        if (typeof raw === 'string') {
          let r = sanitizeText(raw, 80);
          r = r.split(/\s+/).slice(0, 6).join(' ');
          const key = r.toLowerCase();
          if (r && !seen.has(key)) {
            seen.add(key);
            replies.push(r);
          }
        }
      }
    }
    // Fill with fallback if <3
    if (replies.length < 3) {
      for (const fallback of getFallbackQuickReplies(context)) {
        let r = sanitizeText(fallback, 80);
        r = r.split(/\s+/).slice(0, 6).join(' ');
        const key = r.toLowerCase();
        if (r && !replies.map(x=>x.toLowerCase()).includes(key)) {
          replies.push(r);
        }
        if (replies.length >= 3) break;
      }
    }
    return replies;
  } catch (error) {
    console.warn('Quick reply generation failed, using fallback:', error);
    // Fallback: sanitize and clamp
    return getFallbackQuickReplies(context).map(r => sanitizeText(r, 80).split(/\s+/).slice(0,6).join(' '));
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