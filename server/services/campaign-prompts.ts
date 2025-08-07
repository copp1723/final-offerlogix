/**
 * Enhanced Automotive Email Marketing Campaign Expert Prompt
 * Combines deep automotive retail knowledge with high-converting email content strategy
 */

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

Ultimate goal: **Keep shoppers engaged. The longer they engage with us, the higher the likelihood they buy with us—not the other guy.**`;

export class CampaignPromptService {
  static getCampaignCreationPrompt(): string {
    return ENHANCED_AUTOMOTIVE_EMAIL_MARKETING_PROMPT;
  }

  static generateContextualPrompt(userInput?: string, campaignType?: string, urgency?: 'low' | 'medium' | 'high'): string {
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
    
    return prompt;
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
    
    // Detect urgency
    if (content.includes('urgent') || content.includes('asap') || content.includes('today') || 
        content.includes('immediately') || content.includes('rush')) {
      urgency = 'high';
    } else if (content.includes('soon') || content.includes('this week') || 
               content.includes('quickly') || content.includes('fast')) {
      urgency = 'medium';
    }
    
    // Extract other keywords
    const automotiveKeywords = [
      'suv', 'truck', 'sedan', 'coupe', 'convertible', 'hybrid', 'electric',
      'ford', 'toyota', 'honda', 'chevrolet', 'bmw', 'mercedes', 'audi',
      'test drive', 'trade-in', 'warranty', 'certified pre-owned'
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
}