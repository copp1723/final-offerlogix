import { sendCampaignEmail } from './mailgun';

export interface HandoverEvaluation {
  shouldHandover: boolean;
  reason: string;
  score: number;
  triggeredCriteria: string[];
  nextActions: string[];
  recommendedAgent: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface HandoverEmailData {
  conversationId: string;
  evaluation: HandoverEvaluation;
  lead?: any;
  conversation?: any;
  campaignName?: string;
}

export class HandoverEmailService {
  /**
   * Send handover notification email to sales team
   */
  static async sendHandoverNotification(data: HandoverEmailData): Promise<boolean> {
    try {
      const { evaluation, lead, conversation, campaignName } = data;
      
      // Get recipient email (in production, this would come from user settings)
      const recipientEmail = process.env.HANDOVER_EMAIL || 'sales@onekeelswarm.com';
      const fromEmail = process.env.EMAIL_FROM || 'swarm@mg.watchdogai.us';
      
      // Generate handover email content
      const emailContent = this.generateHandoverEmail(data);
      
      // Send email via Mailgun
      const { storage } = await import('../storage');
      const activeCfg = await storage.getActiveAiAgentConfig().catch(() => undefined as any);
      const success = await sendCampaignEmail(
        recipientEmail,
        `🚨 Urgent Handover Required - ${lead?.firstName || 'Customer'} Ready to Purchase`,
        emailContent,
        {},
        { domainOverride: (activeCfg as any)?.agentEmailDomain }
      );
      
      console.log(`Handover email sent: ${success ? 'SUCCESS' : 'FAILED'}`);
      return success;
      
    } catch (error) {
      console.error('Failed to send handover email:', error);
      return false;
    }
  }

  /**
   * Generate context-heavy handover email content for sales success
   */
  private static generateHandoverEmail(data: HandoverEmailData): string {
    const { evaluation, lead, conversation, campaignName } = data;
    
    // Extract comprehensive context
    const context = this.extractHandoverContext(data);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Customer Handover - ${context.leadName}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; line-height: 1.5; }
        .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 25px; text-align: center; }
        .section { background: #ffffff; margin: 20px; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .section-title { color: #1f2937; font-size: 18px; font-weight: 700; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        .field { margin-bottom: 12px; }
        .label { font-weight: 600; color: #374151; margin-bottom: 4px; }
        .value { color: #6b7280; background: #f9fafb; padding: 8px 12px; border-radius: 4px; }
        .quote { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 10px 0; font-style: italic; }
        .strategy { background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; padding: 16px; margin: 15px 0; }
        .closing-angle { background: #dbeafe; border: 1px solid #3b82f6; border-radius: 6px; padding: 16px; margin: 15px 0; font-weight: 600; }
        .urgent { background: #fef2f2; border: 1px solid #ef4444; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        ul { margin: 8px 0; padding-left: 20px; }
        li { margin-bottom: 6px; }
        .mood-${context.mood.toLowerCase()} { color: ${context.mood === 'frustrated' ? '#dc2626' : context.mood === 'motivated' ? '#16a34a' : '#6b7280'}; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🎯 Customer Handover</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${context.leadName} • ${evaluation.urgencyLevel.toUpperCase()} Priority</p>
        </div>
        
        <div class="section">
            <h2 class="section-title">👤 Who You're Talking To</h2>
            <div class="field">
                <div class="label">Name:</div>
                <div class="value">${context.leadName}</div>
            </div>
            <div class="field">
                <div class="label">Best Contact:</div>
                <div class="value">${context.bestContact}</div>
            </div>
            <div class="field">
                <div class="label">Mood:</div>
                <div class="value mood-${context.mood.toLowerCase()}">${context.mood}</div>
            </div>
            <div class="field">
                <div class="label">Personal Insights:</div>
                <div class="value">${context.personalInsights}</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📧 Campaign / Message Type</h2>
            <div class="value" style="font-size: 16px; font-weight: 600; color: #1f2937;">
                ${context.campaignType}
            </div>
            <p style="margin-top: 10px; color: #6b7280; font-style: italic;">
                ${context.campaignContext}
            </p>
        </div>

        <div class="section">
            <h2 class="section-title">💬 What They Said</h2>
            ${context.keyQuotes.map((quote: string) => `<div class="quote">"${quote}"</div>`).join('')}
            <div class="field">
                <div class="label">Key Frustrations/Motivations:</div>
                <div class="value">${context.motivations}</div>
            </div>
            <div class="field">
                <div class="label">Buying Signals:</div>
                <div class="value">${context.buyingSignals}</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📊 Lead Journey Snapshot</h2>
            <div class="field">
                <div class="label">Lead Created:</div>
                <div class="value">${context.leadAge}</div>
            </div>
            <div class="field">
                <div class="label">Engagement:</div>
                <div class="value">${context.engagementPattern}</div>
            </div>
            <div class="field">
                <div class="label">Activity:</div>
                <div class="value">${context.activitySummary}</div>
            </div>
            <div class="field">
                <div class="label">Current Status:</div>
                <div class="value">${context.currentStatus}</div>
            </div>
        </div>

        <div class="section strategy">
            <h2 class="section-title">🎯 How to Win Them</h2>
            <div class="field">
                <div class="label">Approach:</div>
                <div class="value">${context.strategy.approach}</div>
            </div>
            <div class="field">
                <div class="label">Tone to Use:</div>
                <div class="value">${context.strategy.tone}</div>
            </div>
            <div class="field">
                <div class="label">Positioning Angle:</div>
                <div class="value">${context.strategy.positioning}</div>
            </div>
        </div>

        <div class="section closing-angle ${evaluation.urgencyLevel === 'high' ? 'urgent' : ''}">
            <h2 class="section-title">🚀 Closing Angle</h2>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">
                "${context.suggestedOpener}"
            </div>
            <p style="margin-top: 10px; color: #6b7280; font-size: 14px;">
                Personalized opener based on conversation analysis and customer intent.
            </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="https://ccl-3-final.onrender.com/conversations/${data.conversationId}" class="cta-button">
                View Full Conversation
            </a>
        </div>

        <div style="background: #fffbeb; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px;">
            <strong>Qualification Score:</strong> ${evaluation.score}/100<br>
            <strong>Recommended Agent:</strong> ${evaluation.recommendedAgent.toUpperCase()}<br>
            <strong>Response Time:</strong> ${evaluation.urgencyLevel === 'high' ? 'IMMEDIATE (within 15 minutes)' : 
                                             evaluation.urgencyLevel === 'medium' ? 'Priority (within 1 hour)' : 'Standard (within 4 hours)'}
        </div>
        
        <div style="background: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb;">
            <p>OneKeel Swarm AI Intelligence • Conversation ID: ${data.conversationId}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Extract comprehensive handover context from conversation and lead data
   */
  private static extractHandoverContext(data: HandoverEmailData) {
    const { evaluation, lead, conversation, campaignName } = data;
    
    // Basic lead info
    const leadName = lead ? `${lead.firstName} ${lead.lastName}`.trim() || lead.email : 'Unknown Customer';
    
    // Determine best contact method
    const bestContact = this.determineBestContact(lead);
    
    // Analyze conversation for mood and insights
    const conversationAnalysis = this.analyzeConversation(conversation);
    
    // Calculate lead journey metrics
    const journeyMetrics = this.calculateLeadJourney(lead, conversation, evaluation);
    
    // Generate strategic recommendations
    const strategy = this.generateStrategy(conversationAnalysis, evaluation, lead);
    
    // Create personalized opener
    const suggestedOpener = this.generatePersonalizedOpener(conversationAnalysis, strategy, campaignName, leadName);
    
    return {
      leadName,
      bestContact,
      mood: conversationAnalysis.mood,
      personalInsights: conversationAnalysis.personalInsights,
      campaignType: this.determineCampaignType(campaignName, lead),
      campaignContext: this.generateCampaignContext(campaignName, evaluation),
      keyQuotes: conversationAnalysis.keyQuotes,
      motivations: conversationAnalysis.motivations,
      buyingSignals: conversationAnalysis.buyingSignals,
      leadAge: journeyMetrics.leadAge,
      engagementPattern: journeyMetrics.engagementPattern,
      activitySummary: journeyMetrics.activitySummary,
      currentStatus: journeyMetrics.currentStatus,
      strategy,
      suggestedOpener
    };
  }

  private static determineBestContact(lead: any) {
    if (!lead) return 'Contact info not available';
    
    const methods = [];
    if (lead.phone) methods.push(`Phone ${lead.phone}`);
    if (lead.email) methods.push(`Email ${lead.email}`);
    
    // Determine preference based on lead source or activity
    if (lead.leadSource?.includes('text') || lead.notes?.includes('prefers text')) {
      return methods.find(m => m.includes('Phone'))?.replace('Phone', 'Text') || methods[0] || 'Contact info pending';
    }
    
    return methods.join(' | ') || 'Contact info pending';
  }

  private static analyzeConversation(conversation: any) {
    // Default analysis if no conversation data
    if (!conversation?.messages || conversation.messages.length === 0) {
      return {
        mood: 'neutral',
        personalInsights: 'Limited conversation data available',
        keyQuotes: ['Initial inquiry received'],
        motivations: 'Exploring vehicle options',
        buyingSignals: 'Early stage inquiry'
      };
    }

    const messages = conversation.messages || [];
    const leadMessages = messages.filter((m: any) => !m.isFromAI);
    
    // Analyze mood from keywords
    const allText = leadMessages.map((m: any) => m.content).join(' ').toLowerCase();
    let mood = 'neutral';
    
    if (allText.includes('frustrated') || allText.includes('confused') || allText.includes('complicated')) {
      mood = 'frustrated';
    } else if (allText.includes('excited') || allText.includes('ready') || allText.includes('perfect')) {
      mood = 'motivated';
    } else if (allText.includes('interested') || allText.includes('looking')) {
      mood = 'curious';
    }

    // Extract key quotes (most relevant messages)
    const keyQuotes = leadMessages
      .slice(-3) // Last 3 messages
      .map((m: any) => m.content)
      .filter((content: string) => content.length > 10 && content.length < 100);

    // Detect motivations and buying signals
    const motivations = this.extractMotivations(allText);
    const buyingSignals = this.extractBuyingSignals(allText);
    const personalInsights = this.extractPersonalInsights(allText, leadMessages.length);

    return {
      mood,
      personalInsights,
      keyQuotes: keyQuotes.length > 0 ? keyQuotes : ['Customer engaged with inquiry'],
      motivations,
      buyingSignals
    };
  }

  private static extractMotivations(text: string): string {
    const motivationKeywords = {
      'family': ['family', 'kids', 'children', 'wife', 'husband', 'spouse'],
      'work': ['work', 'commute', 'business', 'job', 'driving for work'],
      'reliability': ['reliable', 'dependable', 'breaking down', 'maintenance'],
      'financial': ['payment', 'budget', 'financing', 'afford', 'price'],
      'timeline': ['soon', 'quickly', 'this week', 'urgent', 'need by']
    };

    const detected = [];
    for (const [motivation, keywords] of Object.entries(motivationKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        detected.push(motivation);
      }
    }

    return detected.length > 0 ? 
      `Customer motivated by: ${detected.join(', ')}` : 
      'General vehicle interest';
  }

  private static extractBuyingSignals(text: string): string {
    const signals = [];
    
    if (text.includes('price') || text.includes('cost') || text.includes('payment')) {
      signals.push('Pricing inquiry');
    }
    if (text.includes('test drive') || text.includes('demo') || text.includes('see it')) {
      signals.push('Wants to test drive');
    }
    if (text.includes('trade') || text.includes('current car') || text.includes('trade-in')) {
      signals.push('Has trade-in vehicle');
    }
    if (text.includes('financing') || text.includes('approve') || text.includes('credit')) {
      signals.push('Financing discussion');
    }
    if (text.includes('ready') || text.includes('when can') || text.includes('available')) {
      signals.push('Ready to purchase');
    }

    return signals.length > 0 ? signals.join(', ') : 'Early stage inquiry';
  }

  private static extractPersonalInsights(text: string, messageCount: number): string {
    const insights = [];
    
    // Communication style
    if (messageCount >= 3) {
      insights.push('Engaged communicator');
    }
    
    // Extract any job/lifestyle mentions
    if (text.includes('work') || text.includes('job')) {
      insights.push('Mentioned work/employment');
    }
    
    if (text.includes('family') || text.includes('kids')) {
      insights.push('Family-focused');
    }
    
    if (text.includes('weekend') || text.includes('evening')) {
      insights.push('Prefers off-hours contact');
    }

    return insights.length > 0 ? insights.join(', ') : 'Professional inquiry, standard approach recommended';
  }

  private static calculateLeadJourney(lead: any, conversation: any, evaluation: any) {
    const createdDate = new Date(lead?.createdAt || Date.now());
    const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const leadAge = daysSinceCreated === 0 ? 'Today' : 
                   daysSinceCreated === 1 ? '1 day ago' : 
                   daysSinceCreated < 7 ? `${daysSinceCreated} days ago` :
                   daysSinceCreated < 30 ? `${Math.floor(daysSinceCreated / 7)} weeks ago` :
                   `${Math.floor(daysSinceCreated / 30)} months ago`;

    const messageCount = conversation?.messages?.length || 0;
    const engagementPattern = messageCount === 0 ? 'No conversation yet' :
                             messageCount === 1 ? '1 message exchange' :
                             messageCount < 5 ? `${messageCount} message exchanges, good responsiveness` :
                             `${messageCount} message exchanges, highly engaged`;

    const activitySummary = this.generateActivitySummary(lead, conversation);
    const currentStatus = evaluation.triggeredCriteria.includes('PRICING') ? 'Asked for pricing information' :
                         evaluation.triggeredCriteria.includes('TEST_DRIVE') ? 'Requested test drive' :
                         evaluation.triggeredCriteria.includes('FINANCING') ? 'Inquired about financing' :
                         'Ready for sales rep engagement';

    return {
      leadAge,
      engagementPattern,
      activitySummary,
      currentStatus
    };
  }

  private static generateActivitySummary(lead: any, conversation: any): string {
    const activities = [];
    
    if (lead?.email) activities.push('Provided contact information');
    if (lead?.vehicleInterest) activities.push(`Showed interest in ${lead.vehicleInterest}`);
    if (conversation?.messages?.some((m: any) => m.content.includes('price'))) {
      activities.push('Asked about pricing');
    }
    if (conversation?.messages?.some((m: any) => m.content.includes('financing'))) {
      activities.push('Inquired about financing');
    }
    if (conversation?.messages?.some((m: any) => m.content.includes('test drive'))) {
      activities.push('Requested test drive');
    }

    return activities.length > 0 ? activities.join(', ') : 'Initial contact established';
  }

  private static determineCampaignType(campaignName?: string, lead?: any): string {
    if (!campaignName) return 'Direct Inquiry';
    
    if (campaignName.toLowerCase().includes('lost lead') || campaignName.toLowerCase().includes('re-engagement')) {
      return 'Lost Lead Re-Engagement';
    }
    if (campaignName.toLowerCase().includes('holiday') || campaignName.toLowerCase().includes('sale')) {
      return `Holiday Promotion - ${campaignName}`;
    }
    if (campaignName.toLowerCase().includes('service') || campaignName.toLowerCase().includes('maintenance')) {
      return 'Service Follow-up Campaign';
    }
    
    return campaignName;
  }

  private static generateCampaignContext(campaignName?: string, evaluation?: any): string {
    if (!campaignName) {
      return 'Customer reached out directly through website or referral.';
    }
    
    if (campaignName.toLowerCase().includes('lost lead')) {
      return 'Customer previously submitted information but never connected with a rep. This campaign brought them back into the funnel.';
    }
    if (campaignName.toLowerCase().includes('holiday') || campaignName.toLowerCase().includes('sale')) {
      return 'Customer engaged with promotional campaign targeting holiday buyers with special offers.';
    }
    
    return `Customer engaged through ${campaignName} campaign. Use campaign context to maintain continuity.`;
  }

  private static generateStrategy(analysis: any, evaluation: any, lead: any) {
    let approach = 'Professional consultation approach';
    let tone = 'Professional and helpful';
    let positioning = 'Solution-focused guidance';

    // Customize based on mood and buying signals
    if (analysis.mood === 'frustrated') {
      approach = 'Acknowledge previous frustrations, emphasize simplicity';
      tone = 'Empathetic and reassuring';
      positioning = 'One person, one streamlined process';
    } else if (analysis.mood === 'motivated') {
      approach = 'Match their enthusiasm, move quickly';
      tone = 'Enthusiastic and confident';
      positioning = 'Help them secure their ideal vehicle';
    }

    // Adjust for urgency
    if (evaluation.urgencyLevel === 'high') {
      tone = 'Direct and action-oriented';
      positioning = 'Immediate solutions, time-sensitive opportunities';
    }

    return { approach, tone, positioning };
  }

  private static generatePersonalizedOpener(analysis: any, strategy: any, campaignName?: string, leadName?: string): string {
    const name = leadName?.split(' ')[0] || 'there';
    
    if (analysis.mood === 'frustrated') {
      return `Hi ${name} — I saw you started the process earlier but never got clear answers. Let's keep it simple this time — I'll walk you through everything in one go.`;
    }
    
    if (analysis.buyingSignals.includes('Pricing inquiry')) {
      return `Hi ${name} — Thanks for your interest in pricing. Let me get you exact numbers and see what financing options work best for your situation.`;
    }
    
    if (analysis.buyingSignals.includes('Wants to test drive')) {
      return `Hi ${name} — I see you're ready to take a look at the vehicle. Let's get you scheduled for a test drive and make sure it's exactly what you need.`;
    }
    
    if (campaignName?.toLowerCase().includes('holiday') || campaignName?.toLowerCase().includes('sale')) {
      return `Hi ${name} — Thanks for checking out our ${campaignName?.toLowerCase().includes('holiday') ? 'holiday' : 'sale'} offers. Let's make sure we find the right fit while the specials are active.`;
    }

    return `Hi ${name} — I see you've been looking at vehicles and have some questions. Let me help you find exactly what you need.`;
  }

  /**
   * Generate text version for email clients that don't support HTML
   */
  private static generateTextHandover(data: HandoverEmailData): string {
    const context = this.extractHandoverContext(data);
    const { evaluation } = data;

    return `
🎯 CUSTOMER HANDOVER - ${context.leadName}
${evaluation.urgencyLevel.toUpperCase()} PRIORITY

👤 WHO YOU'RE TALKING TO
Name: ${context.leadName}
Best Contact: ${context.bestContact}
Mood: ${context.mood}
Personal Insights: ${context.personalInsights}

📧 CAMPAIGN / MESSAGE TYPE
${context.campaignType}
${context.campaignContext}

💬 WHAT THEY SAID
Key Quotes:
${(context.keyQuotes as string[]).map((quote: string) => `- "${quote}"`).join('\n')}

Frustrations/Motivations: ${context.motivations}
Buying Signals: ${context.buyingSignals}

📊 LEAD JOURNEY SNAPSHOT
Lead Created: ${context.leadAge}
Engagement: ${context.engagementPattern}
Activity: ${context.activitySummary}
Current Status: ${context.currentStatus}

🎯 HOW TO WIN THEM
Approach: ${context.strategy.approach}
Tone to Use: ${context.strategy.tone}
Positioning Angle: ${context.strategy.positioning}

🚀 CLOSING ANGLE
"${context.suggestedOpener}"

QUALIFICATION INFO:
- Score: ${evaluation.score}/100
- Recommended Agent: ${evaluation.recommendedAgent.toUpperCase()}
- Response Time: ${evaluation.urgencyLevel === 'high' ? 'IMMEDIATE (15 min)' : 
                  evaluation.urgencyLevel === 'medium' ? 'Priority (1 hour)' : 'Standard (4 hours)'}

View Full Conversation: https://ccl-3-final.onrender.com/conversations/${data.conversationId}

OneKeel Swarm AI Intelligence
Conversation ID: ${data.conversationId}
Generated: ${new Date().toLocaleString()}
`;
  }
}