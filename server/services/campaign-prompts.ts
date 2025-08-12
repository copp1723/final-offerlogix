/**
 * Enhanced Automotive Email Marketing Campaign Expert Prompt
 * Combines deep automotive retail knowledge with high-converting email content strategy
 * Now includes Dynamic Prompt Context Truncation for token optimization
 */

import { encoding_for_model } from 'tiktoken';

export const ENHANCED_AUTOMOTIVE_EMAIL_MARKETING_PROMPT = `You are a seasoned automotive email marketing strategist with expertise in creating high-impact campaigns for car dealerships. You combine deep knowledge of automotive retail, buyer psychology, and dealership operations with the creativity and conversion skills needed to craft irresistible email campaigns that sell more vehicles and book more service appointments.

Your mission: Guide dealership teams—step by step—in creating **personalized, compelling, and visually engaging email campaigns** that keep shoppers engaged longer, strengthen loyalty, and generate measurable sales results.

## Your Expertise:
- Managed 1,000+ campaigns for 200+ dealerships spanning luxury, domestic, and import brands
- Skilled in automotive customer journey mapping from first touch to showroom visit
- Mastery of dealership email metrics: open rates, CTR, lead-to-appointment conversion, and service booking rates
- Deep understanding of manufacturer incentives, seasonal sales drivers, and local market competition
- Ability to integrate inventory feeds, service specials, and personalized offers into campaign templates for maximum relevance

## Core Expertise Areas:

### 1. Automotive Customer Psychology in Email
Car buyers:
- May be researching months before buying, but act fast when the right deal hits their inbox
- Care about price, availability, financing terms, and real photos—avoid stock imagery where possible
- Respond to urgency: "Only 3 left in stock" or "Ends Monday" drives clicks
- Engage more with emails tailored to their history (vehicle owned, last service date, favorite models)
- Value transparent, helpful tone over generic sales language

### 2. Campaign Types You've Perfected
- **New Inventory Alerts**: Spotlight hot arrivals or popular trims before competitors promote them
- **Model-Specific Feature Spotlights**: Educate while enticing—focus on what makes it worth a test drive
- **Owner Loyalty Offers**: Encourage trade-ins, lease pull-aheads, and upgrade opportunities
- **Seasonal Service Reminders**: Tie offers to climate and timing ("Get Winter-Ready Tires Installed This Week")
- **Event Invitations**: Launch parties, tent sales, VIP service clinics
- **Finance/Lease Specials**: Clearly display payments, terms, and incentive expirations

### 3. Email Quality Standards
- **Hook Fast**: Lead with what matters to them—specific savings, fresh arrivals, or "this weekend only"
- **Visual Impact**: Real car photos, personalized hero images, fresh inventory pulls
- **Clarity and Brevity**: Trim excess text—make "why they should care" instantly obvious
- **Compelling CTAs**: "Book My Test Drive" or "Claim My Service Discount"
- **Mobile-Friendly**: 75%+ of opens happen on mobile, so design for scroll and tap

### 4. Analytics & Continuous Improvement
You measure:
- Open rate lift from subject line changes
- Click-through increases from personalized inventory blocks
- Conversions (test drives booked, service appointments made) within 72 hours
- Impact by segment: new leads, current owners, past customers
- Seasonal content performance trends

You are obsessed with testing:
- A/B subject lines: urgency vs curiosity
- CTA button color, placement, and wording
- Personalization depth: "Hi Alex" + "3 New F-150s Just In"

### 5. Your Communication Style Inside the Platform
- Keep it natural, friendly, and engaging—like chatting with a helpful salesperson, not a bot
- Avoid formal or stiff openers; start with excitement or empathy
- Adapt to urgency:
   - **Frustrated user?** "I totally get it—that's frustrating. Let's fix it now. Want me to draft a new offer?"
   - **Urgent user?** "No time to waste—let's push this out today. Just need your OK on the preview."
- Every guidance step ends with a clear, friendly action invite
   - "Shall we add those Silverado pics to the hero image?"
   - "Want me to pull live inventory for that model line?"
- Naturally weave in campaign best practices without jargon
   - "Tax season buyers love seeing payment examples—should I add those?"

### 6. You Naturally Ask:
- "Are we promoting sales, service, or both in this email?"
- "Any specific models or trims you want to highlight?"
- "Do you want fresh arrival photos or just stock imagery?"
- "What's the urgency—event dates, incentive deadlines, or inventory scarcity?"
- "Who's this targeting: new prospects, current owners, or lapsed customers?"

### 7. Seasonal & Manufacturer Context
You bake in:
- Model year-end clearance urgency in fall
- Winter safety service push
- Summer road trip prep content
- OEM compliance ("Toyota lease specials must follow these ad copy rules…")
- Local market triggers—snow forecast, tax refund season, gas price spikes

### 8. Response Flow Inside the Email Builder
1. **Acknowledge & Relate**: "Great—spring promo for SUVs is a smart move, lots of families shop now."
2. **Diagnose**: "To get the best clicks, we'll want fresh lifestyle photos and a payment example."
3. **Prescribe**: "Let's run with a subject like: '3-Day SUV Sale – Family-Ready Deals Inside'."
4. **Prioritize Next Step**: "Should we make this a single-offer blast or a multi-offer inventory showcase?"
5. **Confirm & Launch**: "Once you approve, I'll schedule it for tomorrow morning—more opens before lunch."

Remember: You're not just creating an email—you're creating a compelling reason for a shopper to stay with *this dealership* instead of browsing competitors. Every email you guide should feel timely, relevant, personalized, and action-driven… while staying true to the dealership's voice and brand.

Ultimate goal: **Keep shoppers engaged. The longer they engage with us, the higher the likelihood they buy with us—not the other guy.**

## Output Rules (Hard)
- Keep responses concise: default ≤ 120 words unless explicitly asked to generate templates or long-form copy.
- When the user asks for subject lines or templates, return **valid JSON** only (no preamble, no markdown). Templates must be an array of objects: { "subject": string, "content": string }.
- One ask at a time: end with **one** targeted question or action.
- No emojis. No speculation or fake metrics. If a required input is missing, ask for it.
- Respect segmentation: if multiple segments are present, either propose shared copy or recommend **6–9** total templates for coverage.
- Avoid generic fluff; prefer concrete automotive language (model years, trims, incentives, inventory status).

## Handover Intelligence
If the user describes when to hand a lead to sales, convert it into a tight rule-of-thumb and a tiny JSON config:
- Triggers to watch: pricing pressure, test‑drive scheduling, financing readiness, trade‑in with VIN/miles, explicit urgency (“today”, “this weekend”).
- Example JSON you may suggest saving:
{"scoreThreshold":80,"urgentKeywords":["today","now","ASAP"],"tradeInTerms":["trade","value","appraisal"]}

## Segmentation Awareness
When the audience description contains named segments (e.g., **Dog Days Blowout**, **Truckpocalypse**, **Boss’s Bad Bet**), reflect them back and adapt subject lines/CTAs per segment. Flag under-coverage if templates &lt; segments * 2.

## Grounding &amp; Context Usage
If a **PAST CAMPAIGNS** section is present later in the prompt, treat it as retrieval context. Prefer its terminology and offers. Do not invent details that are not in either the user input or the context.
`;

export class CampaignPromptService {
  // Token optimization configuration
  private static readonly ENABLE_TOKEN_OPTIMIZATION = true;
  private static readonly DEFAULT_MAX_TOKENS = 3500;
  private static readonly CORE_PROMPT_PRIORITY = 1; // Highest priority
  private static readonly CONTEXT_PRIORITY = 2;
  private static readonly URGENCY_PRIORITY = 3;
  private static readonly SEGMENTS_PRIORITY = 4; // Lowest priority

  static getCampaignCreationPrompt(): string {
    return ENHANCED_AUTOMOTIVE_EMAIL_MARKETING_PROMPT;
  }

  /**
   * Counts tokens in text using tiktoken with fallback
   */
  private static countTokens(text: string): number {
    try {
      const encoding = encoding_for_model('gpt-4');
      const tokens = encoding.encode(text);
      encoding.free();
      return tokens.length;
    } catch (error) {
      // Fallback: rough estimate (1 token ≈ 4 characters)
      // This is conservative and should work for most cases
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Truncates sections based on priority to fit within token limit
   */
  private static truncateToTokenLimit(sections: Array<{
    content: string;
    priority: number;
    name: string;
    canTruncate: boolean;
  }>, maxTokens: number): string {
    // Sort sections by priority (lower number = higher priority)
    const sortedSections = [...sections].sort((a, b) => a.priority - b.priority);
    
    const result: string[] = [];
    let currentTokens = 0;

    for (const section of sortedSections) {
      const sectionTokens = this.countTokens(section.content);
      
      // If adding this section would exceed limit
      if (currentTokens + sectionTokens > maxTokens) {
        const remainingTokens = maxTokens - currentTokens;
        
        if (remainingTokens > 50 && section.canTruncate) {
          // Try to fit a truncated version
          const truncated = this.truncateText(section.content, remainingTokens);
          if (this.countTokens(truncated) <= remainingTokens) {
            result.push(truncated);
            currentTokens += this.countTokens(truncated);
          }
        }
        break; // No more room
      } else {
        result.push(section.content);
        currentTokens += sectionTokens;
      }
    }

    return result.join('');
  }

  /**
   * Truncates text to approximately fit within token count
   */
  private static truncateText(text: string, targetTokens: number): string {
    if (targetTokens <= 0) return '';
    
    // Rough character estimate: tokens * 3.5 (slightly conservative)
    const targetChars = Math.floor(targetTokens * 3.5);
    
    if (text.length <= targetChars) {
      return text;
    }

    // Find a good breaking point (end of sentence or paragraph)
    const truncated = text.substring(0, targetChars);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const breakPoint = Math.max(lastPeriod, lastNewline);
    
    if (breakPoint > targetChars * 0.7) {
      // Good breaking point found
      return text.substring(0, breakPoint + 1) + '\n[Content truncated for token optimization]';
    } else {
      // No good breaking point, just cut at character limit
      return truncated + '...\n[Content truncated for token optimization]';
    }
  }

  /**
   * Original implementation preserved for backward compatibility
   */
  private static generateContextualPromptOriginal(userInput?: string, campaignType?: string, urgency?: 'low' | 'medium' | 'high'): string {
    let prompt = ENHANCED_AUTOMOTIVE_EMAIL_MARKETING_PROMPT;

    // Add contextual guidance based on campaign type
    if (campaignType) {
      prompt += `\n\n## CURRENT CONTEXT:
Campaign Type Focus: ${campaignType}`;

      switch (campaignType) {
        case 'new_inventory':
          prompt += `\nPriority: Highlight fresh arrivals, specific model features, and availability urgency.
Key Questions to Ask: "Which new models just arrived?" "Any hot sellers we should feature?" "Want to include 'just arrived' messaging?"`;
          break;
        case 'seasonal_service':
          prompt += `\nPriority: Connect service needs to current season/weather, emphasize safety and convenience.
Key Questions to Ask: "What seasonal services are most needed now?" "Any service specials running?" "Want to tie this to weather conditions?"`;
          break;
        case 'finance_lease':
          prompt += `\nPriority: Clear payment examples, incentive deadlines, and qualification assistance.
Key Questions to Ask: "What are the current rates?" "Any manufacturer incentives ending soon?" "Want to include payment calculator?"`;
          break;
      }
    }

    // Add urgency-specific guidance
    if (urgency) {
      prompt += `\n\nUrgency Level: ${urgency}`;
      switch (urgency) {
        case 'high':
          prompt += `\nApproach: Act quickly, focus on immediate next steps, suggest urgent subject lines and time-sensitive offers.`;
          break;
        case 'medium':
          prompt += `\nApproach: Balance thoroughness with efficiency, ask key questions but move toward recommendations.`;
          break;
        case 'low':
          prompt += `\nApproach: Take time to explore options, educate on best practices, suggest A/B testing opportunities.`;
          break;
      }
    }

    // Surface detected audience segments from freeform input
    if (userInput) {
      const segs = CampaignPromptService.detectSegmentsFromText(userInput);
      if (segs.length) {
        prompt += `\n\nDetected Audience Segments: ${segs.map(s => s.name).join(', ')}
Guidance: Ensure per‑segment coverage (subject lines & CTAs). Recommend 6–9 templates if more than one segment is present.`;
      }
    }

    return prompt;
  }

  /**
   * Enhanced generateContextualPrompt with optional token optimization
   * Maintains exact same signature and behavior as original when maxTokens is not provided
   */
  static generateContextualPrompt(
    userInput?: string, 
    campaignType?: string, 
    urgency?: 'low' | 'medium' | 'high',
    maxTokens?: number
  ): string {
    // Use original behavior if token optimization is disabled or maxTokens not provided
    if (!this.ENABLE_TOKEN_OPTIMIZATION || !maxTokens) {
      return this.generateContextualPromptOriginal(userInput, campaignType, urgency);
    }

    // Token-optimized implementation
    const sections: Array<{
      content: string;
      priority: number;
      name: string;
      canTruncate: boolean;
    }> = [];

    // Core prompt (highest priority, never truncate)
    sections.push({
      content: ENHANCED_AUTOMOTIVE_EMAIL_MARKETING_PROMPT,
      priority: this.CORE_PROMPT_PRIORITY,
      name: 'core_prompt',
      canTruncate: false
    });

    // Campaign type context (medium priority, can truncate)
    if (campaignType) {
      let contextContent = `\n\n## CURRENT CONTEXT:
Campaign Type Focus: ${campaignType}`;

      switch (campaignType) {
        case 'new_inventory':
          contextContent += `\nPriority: Highlight fresh arrivals, specific model features, and availability urgency.
Key Questions to Ask: "Which new models just arrived?" "Any hot sellers we should feature?" "Want to include 'just arrived' messaging?"`;
          break;
        case 'seasonal_service':
          contextContent += `\nPriority: Connect service needs to current season/weather, emphasize safety and convenience.
Key Questions to Ask: "What seasonal services are most needed now?" "Any service specials running?" "Want to tie this to weather conditions?"`;
          break;
        case 'finance_lease':
          contextContent += `\nPriority: Clear payment examples, incentive deadlines, and qualification assistance.
Key Questions to Ask: "What are the current rates?" "Any manufacturer incentives ending soon?" "Want to include payment calculator?"`;
          break;
      }

      sections.push({
        content: contextContent,
        priority: this.CONTEXT_PRIORITY,
        name: 'campaign_context',
        canTruncate: true
      });
    }

    // Urgency guidance (lower priority, can truncate)
    if (urgency) {
      let urgencyContent = `\n\nUrgency Level: ${urgency}`;
      switch (urgency) {
        case 'high':
          urgencyContent += `\nApproach: Act quickly, focus on immediate next steps, suggest urgent subject lines and time-sensitive offers.`;
          break;
        case 'medium':
          urgencyContent += `\nApproach: Balance thoroughness with efficiency, ask key questions but move toward recommendations.`;
          break;
        case 'low':
          urgencyContent += `\nApproach: Take time to explore options, educate on best practices, suggest A/B testing opportunities.`;
          break;
      }

      sections.push({
        content: urgencyContent,
        priority: this.URGENCY_PRIORITY,
        name: 'urgency_guidance',
        canTruncate: true
      });
    }

    // Segment detection (lowest priority, can truncate)
    if (userInput) {
      const segs = this.detectSegmentsFromText(userInput);
      if (segs.length) {
        const segmentContent = `\n\nDetected Audience Segments: ${segs.map(s => s.name).join(', ')}
Guidance: Ensure per‑segment coverage (subject lines & CTAs). Recommend 6–9 templates if more than one segment is present.`;

        sections.push({
          content: segmentContent,
          priority: this.SEGMENTS_PRIORITY,
          name: 'segments',
          canTruncate: true
        });
      }
    }

    return this.truncateToTokenLimit(sections, maxTokens);
  }

  static parseUserIntent(message: string): { campaignType?: string; urgency: 'low' | 'medium' | 'high'; keywords: string[] } {
    const content = message.toLowerCase();
    let campaignType: string | undefined;
    let urgency: 'low' | 'medium' | 'high' = 'low';
    const keywords: string[] = [];

    // Detect campaign type
    if (content.includes('new inventory') || content.includes('new arrivals') || content.includes('just arrived')) {
      campaignType = 'new_inventory';
      keywords.push('new inventory');
    }
    if (content.includes('service') || content.includes('maintenance') || content.includes('oil change')) {
      campaignType = 'seasonal_service';
      keywords.push('service');
    }
    if (content.includes('financing') || content.includes('lease') || content.includes('payment')) {
      campaignType = 'finance_lease';
      keywords.push('financing');
    }
    if (content.includes('event') || content.includes('sale') || content.includes('promotion')) {
      campaignType = 'promotional_event';
      keywords.push('event');
    }
    // Add clearance/closeout/inventory reduction/year-end/blowout mapping to promotional_event
    if (content.includes('clearance') || content.includes('closeout') || content.includes('inventory reduction') || content.includes('year-end') || content.includes('blowout')) {
      campaignType = 'promotional_event';
      keywords.push('clearance');
    }

    // Detect urgency
    if (content.includes('urgent') || content.includes('asap') || content.includes('today') ||
        content.includes('immediately') || content.includes('rush') ||
        content.includes('last chance') || content.includes('final days') || content.includes('ends') ||
        content.includes('deadline') || content.includes('today only') || content.includes('this weekend') ||
        content.includes('48 hours') || content.includes('countdown')) {
      urgency = 'high';
    } else if (content.includes('soon') || content.includes('this week') ||
               content.includes('quickly') || content.includes('fast')) {
      urgency = 'medium';
    }

    // Extract other keywords
    const automotiveKeywords = [
      'suv', 'truck', 'sedan', 'coupe', 'convertible', 'hybrid', 'electric',
      'ford', 'toyota', 'honda', 'chevrolet', 'bmw', 'mercedes', 'audi',
      'test drive', 'trade-in', 'warranty', 'certified pre-owned',
      'clearance', 'closeout', 'rebate', 'inventory', 'year-end',
      'family', 'budget', 'contractor', 'work truck'
    ];

    automotiveKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        keywords.push(keyword);
      }
    });

    return { campaignType, urgency, keywords };
  }

  static generateResponseGuidance(userIntent: ReturnType<typeof CampaignPromptService.parseUserIntent>): string {
    const guidance = [];

    if (userIntent.campaignType) {
      guidance.push(`Focus on ${userIntent.campaignType.replace('_', ' ')} best practices`);
    }

    if (userIntent.urgency === 'high') {
      guidance.push("User needs quick turnaround - prioritize immediate next steps");
    }

    if (userIntent.keywords.length > 0) {
      guidance.push(`Key topics: ${userIntent.keywords.join(', ')}`);
    }

    return guidance.join('. ') + '.';
  }

  static detectSegmentsFromText(text?: string): { name: string; description?: string }[] {
    if (!text) return [];
    const out: { name: string; description?: string }[] = [];
    const boldRe = /\*\*(.+?)\*\*/g;
    let m: RegExpExecArray | null;
    while ((m = boldRe.exec(text)) !== null) {
      const name = m[1].trim();
      const after = text.slice(m.index + m[0].length).split(/\n|\*/)[0];
      out.push({ name, description: after.trim().replace(/^[:\-–]\s*/, '') });
    }
    if (out.length === 0) {
      const lines = text.split('\n');
      for (const line of lines) {
        const lm = line.match(/^\s*[\-\*\u2022]\s*([A-Z][A-Za-z0-9'\s]+):\s*(.+)$/);
        if (lm) out.push({ name: lm[1].trim(), description: lm[2].trim() });
      }
    }
    return out.slice(0, 6);
  }

  /**
   * Utility method to estimate token count for a given prompt configuration
   * Useful for debugging and monitoring
   */
  static estimatePromptTokens(userInput?: string, campaignType?: string, urgency?: 'low' | 'medium' | 'high'): number {
    const fullPrompt = this.generateContextualPromptOriginal(userInput, campaignType, urgency);
    return this.countTokens(fullPrompt);
  }

  /**
   * Get recommended max tokens based on model and use case
   */
  static getRecommendedMaxTokens(model: 'gpt-4' | 'gpt-3.5-turbo' = 'gpt-4'): number {
    switch (model) {
      case 'gpt-4':
        return this.DEFAULT_MAX_TOKENS; // 3500 tokens
      case 'gpt-3.5-turbo':
        return 3000; // More conservative for GPT-3.5
      default:
        return this.DEFAULT_MAX_TOKENS;
    }
  }

  /**
   * Debug method to show how prompt would be truncated
   */
  static debugTokenOptimization(
    userInput?: string, 
    campaignType?: string, 
    urgency?: 'low' | 'medium' | 'high',
    maxTokens: number = 3500
  ): {
    originalTokens: number;
    optimizedTokens: number;
    truncated: boolean;
    sectionsIncluded: string[];
  } {
    const originalPrompt = this.generateContextualPromptOriginal(userInput, campaignType, urgency);
    const optimizedPrompt = this.generateContextualPrompt(userInput, campaignType, urgency, maxTokens);
    
    return {
      originalTokens: this.countTokens(originalPrompt),
      optimizedTokens: this.countTokens(optimizedPrompt),
      truncated: optimizedPrompt.includes('[Content truncated for token optimization]'),
      sectionsIncluded: optimizedPrompt.includes('## CURRENT CONTEXT') ? 
        ['core', 'context'] : ['core']
    };
  }
}