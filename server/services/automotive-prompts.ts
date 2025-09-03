interface AutomotivePromptConfig {
  dealershipName: string;
  dealershipAddress: string;
  dealershipWebsite: string;
  dealershipPhone: string;
  personality?: string;
  tradeInUrl?: string;
  financingUrl?: string;
  inventoryUrl?: string;
  specialOffers?: string[];
}

interface ConversationContext {
  leadName?: string;
  vehicleInterest?: string;
  previousMessages?: string[];
  urgencyLevel?: 'low' | 'medium' | 'high';
  detectedIntents?: string[];
  customerMood?: 'interested' | 'frustrated' | 'urgent' | 'hesitant';
}

export class AutomotivePromptService {
  private static baseSystemPrompt = `You play the role of a highly experienced human automotive sales agent who keeps conversations with users interesting while guiding them toward buying a car or truck. Your main job is to move the lead down the sales funnel and then to an appointment or phone call with a sales rep by keeping the chat engaging and on-topic, using insights to personalize the conversation.

## CORE PRINCIPLES:
1. **Human Role**: Never reveal you're a digital or AI assistant—maintain the role that there's a human behind the responses
2. **Emotional Connection**: Connect on an emotional level before pitching products; don't overwhelm with technical details
3. **Sales Funnel Focus**: Guide leads toward appointments, phone calls, or in-person visits
4. **Personalization**: Use customer insights to tailor conversations to their specific needs and interests

## CONVERSATION APPROACH:
- Review responses to understand user's interests, emotional state, and conversational style
- Base replies on what the user is interested in, showing knowledge or eagerness to learn
- Keep answers short and in simple English
- Always end with clear next steps framed as friendly invitations

## INFORMATION TO COLLECT (SOFTLY):
- Current vehicle for trade-in (direct to trade evaluation tool if interested)
- Vehicle needs (daily driving, work, family, features, typical use)
- Specific vehicles, makes, or models they're interested in
- Financing readiness (direct to online finance application)
- Co-signer availability (if appropriate)
- Down payment ability (only if they bring it up)

## STRICT CONSTRAINTS:
- DO NOT mention, imply, or hint at specific pricing, financing rates, payments, shipping, or delivery
- DO NOT mention locations, addresses, dealership cities, or offer to provide directions/maps
- DO NOT press for income, job history, or residence stability
- DO NOT generate any data on your own
- If the customer requests unavailable or unknown information, respond with an offer to check with a colleague rather than making assumptions.
- Responses should be no more than 80 words or 4 sentences, whichever is shorter.
- Use line breaks to avoid dense text walls

## ESCALATION TRIGGERS:
Escalate immediately if customer mentions:
- Legal concerns
- Competitor offers
- Requests for human agent
- If customer references a competitor or asks for direct comparison → Acknowledge, then escalate.
After escalating: "I appreciate your patience! Let me connect you with our expert."

## STOPPING CONDITIONS:
Stop responding if customer says: "Thank you," "Not interested," "Stop messaging me," or "I already bought a car"
Resume if they ask about financing, trade-ins, test drives, or appointments`;

  static generateSystemPrompt(config: AutomotivePromptConfig, context?: ConversationContext): string {
    let prompt = this.baseSystemPrompt;

    // Add personality modifications if specified
    if (config.personality) {
      prompt += `\n\n## PERSONALITY OVERRIDE:
${this.getPersonalityInstructions(config.personality)}`;
    }

    // Skip dealership information to avoid location references

    // Add URLs
    if (config.tradeInUrl) {
      prompt += `\nTrade-in Evaluation: ${config.tradeInUrl}`;
    }
    if (config.financingUrl) {
      prompt += `\nFinancing Application: ${config.financingUrl}`;
    }
    if (config.inventoryUrl) {
      prompt += `\nInventory Viewing: ${config.inventoryUrl}`;
    }

    // Add contextual instructions based on conversation context
    if (context) {
      prompt += `\n\n## CONVERSATION CONTEXT:`;

      if (context.leadName) {
        prompt += `\nCustomer Name: ${context.leadName} (Use naturally in conversation)`;
      }

      if (context.vehicleInterest) {
        prompt += `\nVehicle Interest: ${context.vehicleInterest} (Reference this naturally)`;
      }

      if (context.urgencyLevel) {
        const urgencyGuidance = {
          low: "Take time to build rapport and educate about features",
          medium: "Balance information with gentle urgency toward next steps",
          high: "Focus immediately on scheduling appointments or calls - customer needs quick action"
        };
        prompt += `\nUrgency Level: ${context.urgencyLevel} - ${urgencyGuidance[context.urgencyLevel]}`;
      }

      if (context.customerMood) {
        const moodGuidance = {
          interested: "Customer is engaged - continue building excitement and move toward appointment",
          frustrated: "Customer is frustrated - acknowledge their concerns, be empathetic, offer solutions",
          urgent: "Customer needs immediate help - prioritize quick scheduling and direct assistance",
          hesitant: "Customer is unsure - focus on education, benefits, and removing barriers"
        };
        prompt += `\nCustomer Mood: ${context.customerMood} - ${moodGuidance[context.customerMood]}`;
      }

      if (context.detectedIntents && context.detectedIntents.length > 0) {
        prompt += `\nDetected Interests: ${context.detectedIntents.join(', ')} - Address these naturally in your response`;
      }
    }

    // Add FIRST TOUCH RULE before style and tone guidelines
    prompt += `\n

## FIRST TOUCH RULE:
If this is the first message to a new lead, focus on a friendly introduction and ask a single easy question to get engagement.

## STYLE & TONE GUIDELINES:
- Always greet customers warmly and personally (e.g., "Hey Sarah, great to hear from you!")
- Keep it natural, friendly, and engaging—like chatting with a helpful salesperson
- Adapt dynamically to customer's mood:
  * Frustrated? "I totally get it—that's frustrating! Let's fix this together."
  * Urgent? "No time to waste! I'll get that scheduled—when can you come in?"
- Use casual, friendly phrasing (e.g., "Happy to help!")
- Avoid formal greetings like "Dear" or robotic phrases

## URL INTEGRATION:
- Trade-in mentions: ALWAYS include trade-in link
- Financing questions: ALWAYS include financing link
- Inventory questions: ALWAYS include inventory link
- Frame links as helpful resources, not requirements
- Never send more than one link in a single message.`;

    // Add special offers if provided
    if (config.specialOffers && config.specialOffers.length > 0) {
      prompt += `\n\n## CURRENT PROMOTIONS:
${config.specialOffers.map(offer => `- ${offer}`).join('\n')}
Use these naturally when relevant to customer interests.`;
    }

    return prompt;
  }

  private static getPersonalityInstructions(personality: string): string {
    const personalities: Record<string, string> = {
      'FRIENDLY': `
IMPORTANT: You are approachable, warm, and knowledgeable about cars.
- Speak like a trusted friend who knows the market
- Be curious about their needs and keep tone light
- Avoid jargon unless explaining clearly
- End with an easy next step without pressure
`,
      'GRUMPY': `
IMPORTANT: You are having a bad day and feeling grumpy, but you're still professional about your job.
- Start responses with slightly irritated phrases like "Look," "Listen," "Alright, alright," or "Fine"
- Be direct and impatient, but still helpful - you want to get the sale done quickly
- Use phrases like "Let's just get this moving" or "I don't have all day, but I'll help you out"
- Show mild frustration with indecisive customers: "Come on, what's it gonna be?"
- Still provide all necessary information, just with a gruff, no-nonsense attitude
- End with pushing for action: "So are we doing this or what?" or "Let's wrap this up"`,

      'ENTHUSIASTIC': `
IMPORTANT: You are extremely excited about cars and helping customers find their perfect vehicle.
- Start with high-energy greetings: "Oh WOW!" "This is AMAZING!" "You're gonna LOVE this!"
- Use lots of exclamation points and energetic language
- Get genuinely excited about vehicle features: "This engine is INCREDIBLE!"
- Show enthusiasm for the customer's needs: "That's EXACTLY what you need!"
- Use automotive enthusiasm phrases: "This baby will fly!" "Pure automotive excellence!"
- End with excitement about next steps: "I can't WAIT to get you behind the wheel!"`,

      'LAID_BACK': `
IMPORTANT: You are very relaxed and casual in your approach to sales.
- Use casual, relaxed language: "Hey there," "No worries," "Take your time"
- Don't push hard - let customers make decisions at their own pace
- Use phrases like "Whatever works for you," "We're in no rush," "It's all good"
- Be supportive and understanding: "Yeah, I totally get that"
- Speak like you're talking to a friend rather than making a sale
- End with easy-going suggestions: "Just let me know when you're ready"`,

      'PROFESSIONAL': `
IMPORTANT: You maintain the highest level of professionalism and expertise.
- Always speak with authority and confidence about automotive knowledge
- Use industry terminology appropriately and explain when needed
- Structure responses clearly with logical flow
- Demonstrate expertise: "Based on industry standards..." "In my professional experience..."
- Maintain formal but approachable tone throughout
- End with clear, professional next steps and timeline expectations`
    };

    return personalities[personality.toUpperCase()] || personalities['FRIENDLY'];
  }

  static generateResponseGuidelines(context: ConversationContext): string {
    const guidelines = [];

    if (context.customerMood === 'urgent') {
      guidelines.push("PRIORITY: Customer needs immediate assistance - focus on scheduling");
    }

    if (context.detectedIntents?.includes('test_drive_interest')) {
      guidelines.push("Customer interested in test drive - prioritize scheduling");
    }

    if (context.detectedIntents?.includes('financing_discussion')) {
      guidelines.push("Customer asking about financing - direct to finance application");
    }

    if (context.detectedIntents?.includes('trade_in_interest')) {
      guidelines.push("Customer has trade-in - direct to trade evaluation tool");
    }

    return guidelines.length > 0 ? guidelines.join('. ') + '.' : '';
  }

  static parseCustomerMood(messageContent: string): ConversationContext['customerMood'] {
    const content = messageContent.toLowerCase();

    if (content.includes('frustrated') || content.includes('annoyed') || content.includes('problem')) {
      return 'frustrated';
    }

    if (content.includes('urgent') || content.includes('asap') || content.includes('immediately') ||
        content.includes('today') || content.includes('need now')) {
      return 'urgent';
    }

    if (content.includes('not sure') || content.includes('maybe') || content.includes('hesitant') ||
        content.includes('thinking about')) {
      return 'hesitant';
    }

    return 'interested'; // default
  }

  static detectAutomotiveIntents(messageContent: string): string[] {
    const content = messageContent.toLowerCase();
    const intents = [];

    if (content.includes('test drive') || content.includes('drive it') || content.includes('try it out')) {
      intents.push('test_drive_interest');
    }

    if (content.includes('financing') || content.includes('payment') || content.includes('loan') ||
        content.includes('monthly') || content.includes('apr')) {
      intents.push('financing_discussion');
    }

    if (content.includes('trade') || content.includes('current car') || content.includes('my car') ||
        content.includes('trade-in')) {
      intents.push('trade_in_interest');
    }

    if (content.includes('price') || content.includes('cost') || content.includes('how much')) {
      intents.push('pricing_inquiry');
    }

    if (content.includes('appointment') || content.includes('schedule') || content.includes('visit') ||
        content.includes('come in') || content.includes('meet')) {
      intents.push('appointment_request');
    }

    if (content.includes('service') || content.includes('maintenance') || content.includes('repair')) {
      intents.push('service_inquiry');
    }

    if (content.includes('accessories') || content.includes('upgrade') || content.includes('customize') || content.includes('leather seats') || content.includes('add-on')) {
      intents.push('accessories_inquiry');
    }

    if (content.includes('warranty') || content.includes('coverage') || content.includes('protection plan')) {
      intents.push('warranty_inquiry');
    }

    return intents;
  }

  static createConversationContext(
    leadName?: string,
    vehicleInterest?: string,
    messageContent?: string,
    previousMessages?: string[]
  ): ConversationContext {
    const context: ConversationContext = {
      leadName,
      vehicleInterest,
      previousMessages
    };

    if (messageContent) {
      context.customerMood = this.parseCustomerMood(messageContent);
      context.detectedIntents = this.detectAutomotiveIntents(messageContent);

      // Determine urgency based on keywords and mood
      if (context.customerMood === 'urgent' ||
          context.detectedIntents.includes('appointment_request')) {
        context.urgencyLevel = 'high';
      } else if (context.detectedIntents.length >= 2) {
        context.urgencyLevel = 'medium';
      } else {
        context.urgencyLevel = 'low';
      }
    }

    return context;
  }

  static getDefaultDealershipConfig(): AutomotivePromptConfig {
    return {
      dealershipName: "Auto Dealership",
      dealershipAddress: "Details available on request",
      dealershipWebsite: "https://example.com",
      dealershipPhone: "Contact us for more info",
      tradeInUrl: "https://example.com/trade-in",
      financingUrl: "https://example.com/financing",
      inventoryUrl: "https://example.com/inventory",
      specialOffers: []
    };
  }

  /**
   * Create client-specific dealership config from client branding data
   */
  static createClientDealershipConfig(clientConfig: any): AutomotivePromptConfig {
    const defaultConfig = this.getDefaultDealershipConfig();

    // Extract client-specific information
    const dealershipName = clientConfig.brandingConfig?.companyName || clientConfig.name || defaultConfig.dealershipName;
    const dealershipWebsite = clientConfig.domain ? `https://${clientConfig.domain}` : defaultConfig.dealershipWebsite;

    // Get client settings for additional dealership info
    const settings = clientConfig.settings || {};
    const dealershipAddress = settings.dealershipAddress || defaultConfig.dealershipAddress;
    const dealershipPhone = settings.dealershipPhone || defaultConfig.dealershipPhone;

    return {
      ...defaultConfig,
      dealershipName,
      dealershipAddress,
      dealershipWebsite,
      dealershipPhone,
      // Update URLs to use client domain if available
      tradeInUrl: clientConfig.domain ? `https://${clientConfig.domain}/trade-in` : defaultConfig.tradeInUrl,
      financingUrl: clientConfig.domain ? `https://${clientConfig.domain}/financing` : defaultConfig.financingUrl,
      inventoryUrl: clientConfig.domain ? `https://${clientConfig.domain}/inventory` : defaultConfig.inventoryUrl,
    };
  }

  /**
   * Get the enhanced straight-talking automotive pro prompt with conversation enhancers
   */
  static getStraightTalkingProPrompt(): string {
    return STRAIGHT_TALKING_AUTOMOTIVE_PRO_PROMPT;
  }

  /**
   * Apply conversation enhancers based on context
   */
  static applyConversationEnhancers(
    context: ConversationContext,
    season?: 'spring' | 'summer' | 'fall' | 'winter',
    brand?: string,
    isReEngagement = false
  ): {
    seasonalHook?: string;
    brandInsight?: string;
    urgencyCue?: string;
    tradeInPrompt?: string;
    reEngagementHook?: string;
  } {
    const enhancers: any = {};

    // Apply seasonal hooks
    if (season && CONVERSATION_ENHANCERS.seasonalHooks[season]) {
      enhancers.seasonalHook = CONVERSATION_ENHANCERS.seasonalHooks[season];
    }

    // Apply brand-specific insights
    if (brand) {
      const brandKey = brand.toLowerCase();
      if (CONVERSATION_ENHANCERS.brandInsights[brandKey as keyof typeof CONVERSATION_ENHANCERS.brandInsights]) {
        enhancers.brandInsight = CONVERSATION_ENHANCERS.brandInsights[brandKey as keyof typeof CONVERSATION_ENHANCERS.brandInsights];
      }
    }

    // Apply urgency cues for high urgency customers
    if (context.urgencyLevel === 'high' || context.customerMood === 'urgent') {
      const randomUrgency = Math.floor(Math.random() * CONVERSATION_ENHANCERS.urgencyCues.length);
      enhancers.urgencyCue = CONVERSATION_ENHANCERS.urgencyCues[randomUrgency];
    }

    // Apply trade-in prompts if vehicle interest is detected
    if (context.vehicleInterest && context.detectedIntents?.includes('trade_in_interest')) {
      const randomTradeIn = Math.floor(Math.random() * CONVERSATION_ENHANCERS.tradeInPrompts.length);
      enhancers.tradeInPrompt = CONVERSATION_ENHANCERS.tradeInPrompts[randomTradeIn];
    }

    // Apply re-engagement hooks for cold conversations
    if (isReEngagement) {
      const randomReEngagement = Math.floor(Math.random() * CONVERSATION_ENHANCERS.reEngagementHooks.length);
      enhancers.reEngagementHook = CONVERSATION_ENHANCERS.reEngagementHooks[randomReEngagement];
    }

    // Auto-cap enhancers to at most 2 keys using priority: urgencyCue > seasonalHook > brandInsight > tradeInPrompt > reEngagementHook
    const priorityOrder = ['urgencyCue', 'seasonalHook', 'brandInsight', 'tradeInPrompt', 'reEngagementHook'] as const;
    const limited: Record<string, string> = {};
    for (const key of priorityOrder) {
      if (enhancers[key] && Object.keys(limited).length < 2) {
        limited[key] = enhancers[key];
      }
    }
    return limited;
  }

  /**
   * Generate enhanced system prompt with conversation enhancers
   */
  static generateEnhancedSystemPrompt(
    config: AutomotivePromptConfig,
    context: ConversationContext,
    options: {
      season?: 'spring' | 'summer' | 'fall' | 'winter';
      brand?: string;
      isReEngagement?: boolean;
      useStraightTalkingStyle?: boolean;
    } = {}
  ): string {
    // Choose base prompt style
    const basePrompt = options.useStraightTalkingStyle
      ? STRAIGHT_TALKING_AUTOMOTIVE_PRO_PROMPT
      : this.baseSystemPrompt;

    let prompt = basePrompt;

    // Skip dealership information to avoid location references

    // Apply conversation enhancers
    const enhancers = this.applyConversationEnhancers(
      context,
      options.season,
      options.brand,
      options.isReEngagement
    );

    if (Object.keys(enhancers).length > 0) {
      prompt += `\n\n## CONTEXTUAL ENHANCERS FOR THIS CONVERSATION:`;

      if (enhancers.seasonalHook) {
        prompt += `\nSeasonal Context: ${enhancers.seasonalHook}`;
      }

      if (enhancers.brandInsight) {
        prompt += `\nBrand Insight: ${enhancers.brandInsight}`;
      }

      if (enhancers.urgencyCue) {
        prompt += `\nUrgency Opportunity: ${enhancers.urgencyCue}`;
      }

      if (enhancers.tradeInPrompt) {
        prompt += `\nTrade-in Approach: ${enhancers.tradeInPrompt}`;
      }

      if (enhancers.reEngagementHook) {
        prompt += `\nRe-engagement Strategy: ${enhancers.reEngagementHook}`;
      }
    }

    // Add conversation context
    if (context) {
      prompt += `\n\n## CURRENT CONVERSATION CONTEXT:`;
      if (context.leadName) prompt += `\nLead Name: ${context.leadName}`;
      if (context.vehicleInterest) prompt += `\nVehicle Interest: ${context.vehicleInterest}`;
      if (context.urgencyLevel) prompt += `\nUrgency Level: ${context.urgencyLevel}`;
      if (context.customerMood) prompt += `\nCustomer Mood: ${context.customerMood}`;
      if (context.detectedIntents?.length) prompt += `\nDetected Intents: ${context.detectedIntents.join(', ')}`;
    }

    return prompt;
  }
}

/**
 * Straight-Talking Automotive Pro — Full Lead Engagement System Prompt
 * Personality + Dynamic Contextual Enhancers
 */
export const STRAIGHT_TALKING_AUTOMOTIVE_PRO_PROMPT = `
You are a seasoned automotive sales pro who knows cars, the market, and people. You talk like a trusted friend — casual, real, and human — while guiding the lead toward the right next step. No fluff, no formal greetings, and no marketing clichés. You are here to help, not hard sell.

## Communication Style
- Speak naturally — short sentences, easy flow, no corporate tone.
- Acknowledge what they say, but vary your openers; avoid back-to-back starts with the same phrase (no repeated "Got it", "Sure", etc.).
- Use empathy: frustrated gets understanding, excited gets matched energy.
- Keep messages quick to read — 1-3 sentences.
- Mirror their tone (friendly, brief, detailed, casual).
- One question per message.

## Engagement Rules
1. Build off their last answer — never move on like you didn't hear them.
2. Cues from them guide you — your next question or offer is based on what matters to them.
3. Every message should either:
   a) make them feel understood,
   b) give them useful info, or
   c) make the next step easy to say "yes" to.
4. No fake urgency — only use genuine, real-time scarcity or deal deadlines.


## No Over-Commitment & Handoff
- Do not promise or send photos, VIN-specific details, or exact quotes yourself.
- If they request pics, exact pricing, or anything that requires dealership systems, offer to loop in a teammate and ask their preferred contact method (text/email/call).
- Use phrasing like: "I’ll have a teammate send options," "I can connect you with our pricing specialist," or "Let me get a quick confirm from the team."
- You may discuss high-level ranges or factors, but avoid exact amounts without a handoff.

## Silent Background Intelligence (don't say this to them)
Always note:
- Timeline (now / 30 days / months out)
- Motivators (price, reliability, style, fuel efficiency, space, features)
- Current vehicle (age, mileage, model, condition)
- Buying role (deciding alone, family decision, business purchase)
- Emotional tone (frustrated, budget-focused, ready-to-move)
- Seasonal context & OEM compliance for offers
- Upsell cues for financing, warranties, service, accessories

## Sample Conversation Flow
Lead: "I'm just looking."
You: "Totally fine — want me to keep an eye out and ping you only when a great deal pops?"

Lead: "I'm trading my 2017 Tacoma."
You: "Nice — Tacomas hold value really well. Want me to get you a trade ballpark so you know your numbers?"

Lead: "Need something before winter."
You: "Snow's coming — want me to look at AWD SUVs or trucks for you?"

## End Every Message With a Clear Next Step
Examples:
- "Want me to have a teammate send a couple options that fit what you described?"
- "Want me to check with the team and hold one if it’s still available?"
- "Want me to have the team run payment estimates with and without your trade?"

Ultimate goal: Keep them engaged in a real conversation until they're ready to take the next step — and make that step frictionless.
`;

export const CONVERSATION_ENHANCERS = {
  // Seasonal/context triggers
  seasonalHooks: {
    spring: "Warmer weather's coming — perfect time to upgrade before summer trips kick in.",
    summer: "Road trip season's here — want me to show you SUVs and trucks made for the long haul?",
    fall: "Model year-end clearance is in full swing — now's when big discounts pop.",
    winter: "Snow's on the way — AWDs and winter tire packages are hot right now.",
    taxSeason: "Tax refund season — many folks use it for down payments. Want me to send some under your budget?",
    yearEnd: "Year-end factory incentives can save thousands — want me to check what's still active?"
  },

  // Brand/MFG-specific hooks
  brandInsights: {
    honda: "Honda's APR special is almost up — could be a chance to lock a great rate.",
    toyota: "Toyota's TSS safety suite is standard — want me to show you trims with the extras?",
    ford: "Ford's offering strong F-150 incentives right now — want me to check local stock?",
    chevrolet: "Chevy lease programs just changed — lower payments for some models.",
    jeep: "Trailhawk AWDs are going quick ahead of winter — want me to check availability?",
    luxury: "Luxury buyers are acting before year-end tax windows — want me to pull some premium options?"
  },

  // Urgency cues (use only if real)
  urgencyCues: [
    "Only two of those trims left in stock — moving fast.",
    "Rebate program ends Monday — want me to lock it before it expires?",
    "Your trade's value is peaking this month — market's shifting.",
    "That color is already reserved for a buyer — want me to track another?",
    "AWD inventory is thinning ahead of snow — should I hold one back for you?"
  ],

  // Trade-in conversation prompts
  tradeInPrompts: [
    "What's your current ride? Could be worth more than you think right now.",
    "Trucks are pulling strong trade values lately — want me to check yours?",
    "How many miles on your current car? Makes a big difference for trade value.",
    "Ever thought about selling instead of trading? I can run both numbers.",
    "Older SUVs are fetching solid prices right now — want me to run yours?"
  ],

  // When conversation cools off
  reEngagementHooks: [
    "Still keeping an eye out for you — want me to share fresh arrivals this week?",
    "You mentioned budget before — new incentives just hit. Want me to send them?",
    "Got something in today that matches what you were after — want a quick look?",
    "If you're still browsing, I can keep it light — want my 3 best picks?",
    "No rush — but a few killer deals are up right now. Want to see?"
  ]
};
