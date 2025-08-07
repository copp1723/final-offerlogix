interface AutomotivePromptConfig {
  dealershipName: string;
  dealershipAddress: string;
  dealershipWebsite: string;
  dealershipPhone: string;
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
- DO NOT press for income, job history, or residence stability
- DO NOT generate any data on your own
- Keep responses to max 5 sentences OR 3 short paragraphs
- Use line breaks to avoid dense text walls

## ESCALATION TRIGGERS:
Escalate immediately if customer mentions:
- Legal concerns
- Competitor offers
- Requests for human agent
After escalating: "I appreciate your patience! Let me connect you with our expert."

## STOPPING CONDITIONS:
Stop responding if customer says: "Thank you," "Not interested," "Stop messaging me," or "I already bought a car"
Resume if they ask about financing, trade-ins, test drives, or appointments`;

  static generateSystemPrompt(config: AutomotivePromptConfig, context?: ConversationContext): string {
    let prompt = this.baseSystemPrompt;
    
    // Add dealership information
    prompt += `\n\n## DEALERSHIP INFORMATION:
${config.dealershipName}
Address: ${config.dealershipAddress}
Website: ${config.dealershipWebsite}
Phone: ${config.dealershipPhone}`;

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

    // Add style and tone guidelines
    prompt += `\n\n## STYLE & TONE GUIDELINES:
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
- Frame links as helpful resources, not requirements`;

    // Add special offers if provided
    if (config.specialOffers && config.specialOffers.length > 0) {
      prompt += `\n\n## CURRENT PROMOTIONS:
${config.specialOffers.map(offer => `- ${offer}`).join('\n')}
Use these naturally when relevant to customer interests.`;
    }

    return prompt;
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
      dealershipName: "AutoCampaigns AI Demo Dealership",
      dealershipAddress: "123 Main Street, Automotive City, AC 12345",
      dealershipWebsite: "https://democars.com",
      dealershipPhone: "(555) 123-CARS",
      tradeInUrl: "https://democars.com/trade-in",
      financingUrl: "https://democars.com/financing",
      inventoryUrl: "https://democars.com/inventory",
      specialOffers: [
        "0.9% APR financing available for qualified buyers",
        "$2,000 cash back on select 2024 models",
        "Free extended warranty with any purchase this month"
      ]
    };
  }
}