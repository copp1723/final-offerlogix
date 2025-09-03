/**
 * Retrieval-Augmented Reply Planner
 * Uses Supermemory to fetch lead-specific context + past campaign winners before every AI turn
 */

import { LLMClient } from '../llm-client';
import { searchMemories } from '../../integrations/supermemory';

export interface ReplyPlannerInput {
  lead: {
    id: string;
    email: string;
    firstName?: string;
    vehicleInterest?: string;
    clientId: string;
  };
  lastUserMsg: string;
  campaign?: {
    id: string;
    name: string;
    context?: string;
  };
}

export async function planReply(input: ReplyPlannerInput): Promise<string> {
  try {
    // 1) Retrieve needles from Supermemory
    const searchQuery = [
      `lead ${input.lead.email} recent emails opens clicks`,
      `successful replies same vehicle ${input.lead.vehicleInterest || ''}`,
      `top converting subject lines for ${input.campaign?.context || 'automotive'}`
    ].join(' | ');

    let contextBlocks = '';
    try {
      const searchResults = await searchMemories({
        q: searchQuery,
        clientId: input.lead.clientId,
        leadEmailHash: Buffer.from(input.lead.email).toString('hex').slice(0, 8),
        limit: 8
      });

      if (searchResults && searchResults.results) {
        contextBlocks = searchResults.results
          .map((r: any) => `• ${r.content}`)
          .join('\n');
      }
    } catch (error) {
      console.warn('Failed to retrieve context from Supermemory:', error);
      // Continue with graceful fallback
    }

    // 2) Build grounded prompt
    const systemPrompt = [
      "You're an automotive sales assistant. Be concise, helpful, human, and easy to skim.",
      "Never invent facts. If uncertain, ask one clarifying question.",
      "Reference relevant prior interactions naturally (no citations in the message).",
      "Formatting rules: 1) Start with a single warm sentence. 2) Provide 2–3 bullet lines (start each with '-' no numbering) highlighting value or answers. 3) End with ONE clear CTA on its own line starting with 'Next:' or a question inviting action. 4) Keep total ≤ 120 words. 5) Avoid repeating the customer's message verbatim. 6) No markdown headers, no asterisks beyond bullets."
    ].join('\n');

  const userPrompt = `
Customer said: "${input.lastUserMsg}"

Lead profile:
- Name: ${input.lead.firstName || 'Customer'}
- Vehicle interest: ${input.lead.vehicleInterest || 'unknown'}

Grounding (do NOT quote verbatim, just use to personalize):
${contextBlocks || '(no extra context found)'}

Return ONLY the reply text following the formatting rules. Do not add labels like Opening/Bullets/CTA.
If price asked: offer ballpark range, invite budget context, suggest a test drive.
`;

  const response = await LLMClient.generate({
      model: 'openai/gpt-5-chat',
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 350
    });
  return formatReply(response.content.trim());

  } catch (error) {
    console.error('Reply planner failed:', error);
    
    // Graceful fallback without memory context
    const fallbackPrompt = `
Customer said: "${input.lastUserMsg}"
Customer name: ${input.lead.firstName || 'Customer'}
Vehicle interest: ${input.lead.vehicleInterest || 'unknown'}

Respond helpfully and professionally. Keep to 2-3 sentences with one clear next step.
`;

    const response = await LLMClient.generate({
      model: 'openai/gpt-5-chat',
      system: 'You are a helpful automotive sales assistant.',
      user: fallbackPrompt,
      maxTokens: 200
    });
    return formatReply(response.content);
  }
}

/**
 * Post-process / normalize formatting for readability & skimmability.
 * Ensures: opening line, 2–3 bullets, standalone CTA line.
 */
function formatReply(raw: string): string {
  let text = raw.trim();

  // Strip accidental leading labels or markdown artifacts
  text = text.replace(/^\s*(Opening:|Bullets?:|CTA:)/gi, '');

  // Split into lines; if it's a single paragraph, create soft splits
  const hasBullets = /\n-\s|^-\s/m.test(text);
  if (!hasBullets) {
    // Try to identify sentences and convert middle ones to bullets
    const sentences = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .filter(s => s.trim().length > 0);
    if (sentences.length >= 3) {
      const opening = sentences.shift()!;
      const last = sentences.pop()!;
      const bulletCandidates = sentences.slice(0, 3);
      text = [
        opening,
        ...bulletCandidates.map(s => '- ' + s.replace(/^-\s*/, '').trim()),
        last
      ].join('\n');
    }
  }

  // Ensure bullets are single-line and trimmed
  text = text
    .split('\n')
    .map(l => l.startsWith('-') ? ('- ' + l.replace(/^[-*]\s*/, '').trim()) : l.trim())
    .join('\n');

  // Extract or create CTA: last non-bullet line becomes CTA if not already formatted
  const lines = text.split('\n').filter(l => l.trim().length);
  let ctaIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('-')) { ctaIndex = i; break; }
  }
  if (ctaIndex !== -1) {
    let cta = lines[ctaIndex];
    if (!/^Next:|Would you|Can we|Shall we|Ready to|Interested in/i.test(cta)) {
      cta = 'Next: ' + cta.replace(/^(So|Great|Okay|Alright)[,\s-]*/i, '').trim();
    }
    // Move CTA to end and ensure blank line separation
    lines.splice(ctaIndex, 1);
    // Keep only first 3 bullet lines max for brevity
    const bulletLines = lines.filter(l => l.startsWith('-')).slice(0, 3);
    const opening = lines.find(l => !l.startsWith('-')) || '';
    const rest = lines.filter(l => l !== opening && !bulletLines.includes(l) && !l.startsWith('-'));
    const rebuilt = [
      opening,
      ...bulletLines,
      ...rest.filter(Boolean),
      '',
      cta
    ].filter(Boolean);
    text = rebuilt.join('\n');
  }

  // Word cap safeguard
  const words = text.split(/\s+/);
  if (words.length > 130) {
    text = words.slice(0, 130).join(' ');
  }

  return text.trim();
}

/**
 * Tone controller for contextual messaging
 */
export function toneWrap(message: string, opts?: { 
  style?: 'professional' | 'friendly' | 'enthusiastic' 
}): string {
  const pre = opts?.style === 'enthusiastic'
    ? 'Be upbeat, but not salesy. Avoid exclamation spam.'
    : opts?.style === 'friendly'
    ? 'Warm and clear. Avoid jargon.'
    : 'Professional and concise.';
  
  return `${pre}\n\n${message}\n\nKeep to 3–6 sentences.`;
}

/**
 * Don't guess guardrail - determine if clarification is needed
 */
export function needsClarification(lastUserMsg: string, memoryHitCount: number): boolean {
  const vague = /how much|price\?|details\?|tell me more/i.test(lastUserMsg);
  return memoryHitCount < 2 && vague;
}

export function clarificationPrompt(lastUserMsg: string): string {
  return `Ask *one* concise clarifying question to proceed. User: "${lastUserMsg}"`;
}

/**
 * Quick replies API - generate 3 clickable suggestions per turn
 */
export async function quickReplies(input: { 
  lastUserMsg: string; 
  vehicle?: string 
}): Promise<string[]> {
  try {
    const prompt = `
Create 3 short reply suggestions for an automotive sales chat.
Focus: ${input.vehicle || 'vehicle selection'}.
Each ≤ 7 words. No punctuation unless needed.
Return JSON: {"replies": ["...","...","..."]}`;

    const response = await LLMClient.generate({
      model: 'openai/gpt-5-chat',
      system: 'Return valid JSON only.',
      user: prompt,
      json: true,
      maxTokens: 200
    });

    const parsed = JSON.parse(response.content);
    return parsed.replies as string[];

  } catch (error) {
    console.warn('Quick replies generation failed:', error);
    // Fallback suggestions
    return [
      'Tell me more',
      'Schedule test drive',
      'Get pricing info'
    ];
  }
}

/**
 * Conversation quality scorer using heuristics
 */
export function scoreReplyQuality(msg: string): number {
  let score = 0;
  
  if (msg.length <= 700) score += 10;
  if (/\b(test drive|book|schedule|call|quote|visit)\b/i.test(msg)) score += 15; // clear CTA
  if (!/(lorem|ipsum|placeholder)/i.test(msg)) score += 5;
  if (!/\n\n\n/.test(msg)) score += 5; // formatting sanity
  if (!/(sorry|apolog)/i.test(msg)) score += 5; // avoid needless apologies
  if (/\byou\b/i.test(msg) && /\bwe\b/i.test(msg)) score += 5; // relational tone
  
  return Math.min(40, score); // 0–40
}