interface HandoverCriteria {
  qualificationThreshold: number;
  intentScore: number;
  engagementThreshold: number;
  messageCount: number;
  timeSpentMinutes: number;
  goalCompletionRequired: string[];
  handoverRecipients: Array<{
    name: string;
    email: string;
    role: string;
  }>;
  automotiveKeywords: string[];
  urgentKeywords: string[];
}

interface HandoverEvaluation {
  shouldHandover: boolean;
  reason: string;
  score: number;
  triggeredCriteria: string[];
  nextActions: string[];
  recommendedAgent: string;
  urgencyLevel: 'low' | 'medium' | 'high';
  salesBrief?: any; // Will hold the conversion-ready sales brief
}

export interface ConversationAnalysis {
  qualificationScore: number;
  intentScore: number;
  engagementLevel: number;
  messageCount: number;
  timeSpent: number;
  detectedIntents: string[];
  automotiveContext: string[];
  urgencyIndicators: string[];
  urgencyLevel?: 'low' | 'medium' | 'high';
}

import { storage } from '../storage';

export class HandoverService {
  private static defaultCriteria: HandoverCriteria = {
    qualificationThreshold: 75,
    intentScore: 70,
    engagementThreshold: 60,
    messageCount: 5,
    timeSpentMinutes: 10,
    goalCompletionRequired: ['test_drive_interest', 'pricing_inquiry', 'financing_discussion'],
    handoverRecipients: [
      { name: 'Sales Manager', email: 'sales@dealership.com', role: 'sales' },
      { name: 'Service Manager', email: 'service@dealership.com', role: 'service' },
      { name: 'Finance Manager', email: 'finance@dealership.com', role: 'finance' }
    ],
    automotiveKeywords: [
      'test drive', 'financing', 'trade-in', 'lease', 'warranty',
      'maintenance', 'service appointment', 'parts', 'insurance',
      'down payment', 'monthly payment', 'APR', 'credit score'
    ],
    urgentKeywords: [
      'urgent', 'ASAP', 'today', 'immediately', 'emergency',
      'breakdown', 'accident', 'towing', 'repair needed'
    ]
  };

  /**
   * Get default handover criteria
   */
  static getDefaultCriteria(): HandoverCriteria {
    return { ...this.defaultCriteria };
  }

  /**
   * Evaluate if a conversation should trigger handover based on campaign criteria
   */
  static async evaluateHandover(
    conversationId: string,
    conversation: any,
    newMessage?: { role: 'agent' | 'lead'; content: string },
    customCriteria?: Partial<HandoverCriteria>
  ): Promise<HandoverEvaluation> {
    const criteria = { ...this.defaultCriteria, ...customCriteria };

    // Lightweight dynamic adaptation if campaign provides structured spec
    try {
      const campaign = conversation.campaignId ? (await (await import('../storage')).storage.getCampaign(conversation.campaignId)) : null;
      const spec = campaign?.handoverPromptSpec as any;
      if (spec && typeof spec === 'object') {
        // Adjust thresholds based on spec.scoringThresholds if present
        if (spec.scoringThresholds) {
          if (typeof spec.scoringThresholds.instant === 'number') criteria.intentScore = spec.scoringThresholds.instant;
          if (typeof spec.scoringThresholds.standard === 'number') criteria.qualificationThreshold = spec.scoringThresholds.standard;
        }
        // Merge urgency indicators
        if (Array.isArray(spec.urgencyIndicators)) {
          const merged = new Set([...(criteria.urgentKeywords||[]), ...spec.urgencyIndicators.map((u: string)=>String(u).toLowerCase())]);
          criteria.urgentKeywords = Array.from(merged);
        }
        // Merge automotive-like keywords from signalCategories examples
        if (Array.isArray(spec.signalCategories)) {
          const exampleTerms: string[] = [];
            for (const cat of spec.signalCategories) {
              if (Array.isArray(cat.examples)) {
                for (const ex of cat.examples) {
                  const tokens = String(ex).toLowerCase().split(/[,;/]| and | or |\s+/).map(t=>t.trim()).filter(t=>t.length>3 && !exampleTerms.includes(t));
                  exampleTerms.push(...tokens.slice(0,5));
                }
              }
              if (cat.escalateIfAny && Array.isArray(cat.examples) && cat.examples.length) {
                // Fast-path escalate: treat presence of any example as automotive keyword
                cat.examples.forEach((ex: string)=>{
                  const term = ex.toLowerCase();
                  if (!criteria.automotiveKeywords.includes(term)) criteria.automotiveKeywords.push(term);
                });
              }
            }
        }
      }
    } catch (e) {
      // Non-fatal; continue with defaults
      console.warn('HandoverService dynamic spec adaptation failed:', (e as Error).message);
    }
    
    // Analyze conversation and apply handover criteria
    const analysis = await this.analyzeConversation(conversation, newMessage);
    
    let shouldHandover = false;
    let reason = '';
    let triggeredCriteria: string[] = [];
    let urgencyLevel: 'low' | 'medium' | 'high' = 'low';
    
    // Check qualification score threshold
    if (analysis.qualificationScore >= criteria.qualificationThreshold) {
      shouldHandover = true;
      reason += `High qualification score (${analysis.qualificationScore}/${criteria.qualificationThreshold}). `;
      triggeredCriteria.push('qualification_score');
    }
    
    // Check message count threshold
    if (analysis.messageCount >= criteria.messageCount) {
      shouldHandover = true;
      reason += `Sufficient conversation depth (${analysis.messageCount} messages). `;
      triggeredCriteria.push('message_count');
    }
    
    // Check automotive keywords
    const hasAutomotiveKeywords = analysis.automotiveContext.some(keyword =>
      criteria.automotiveKeywords.includes(keyword)
    );
    if (hasAutomotiveKeywords) {
      shouldHandover = true;
      reason += `Automotive intent detected: ${analysis.automotiveContext.join(', ')}. `;
      triggeredCriteria.push('automotive_keywords');
    }

    // If spec-driven escalateIfAny detected in new message content (quick check)
    try {
      if (conversation?.campaignId) {
        const campaign = await (await import('../storage')).storage.getCampaign(conversation.campaignId);
        const spec = campaign?.handoverPromptSpec as any;
        if (spec?.signalCategories && newMessage?.content) {
          const lowerMsg = newMessage.content.toLowerCase();
          for (const cat of spec.signalCategories) {
            if (cat?.escalateIfAny && Array.isArray(cat.examples)) {
              if (cat.examples.some((ex: string)=> lowerMsg.includes(String(ex).toLowerCase()))) {
                shouldHandover = true;
                reason += `Escalate-if-any signal (${cat.name}) matched. `;
                triggeredCriteria.push(`signal_${cat.name}`);
                break;
              }
            }
          }
        }
      }
    } catch {}
    
    // Check urgent keywords for priority escalation
    const hasUrgentKeywords = analysis.urgencyIndicators.some(keyword =>
      criteria.urgentKeywords.includes(keyword)
    );
    if (hasUrgentKeywords) {
      shouldHandover = true;
      urgencyLevel = 'high';
      reason += `Urgent keywords detected: ${analysis.urgencyIndicators.join(', ')}. `;
      triggeredCriteria.push('urgent_keywords');
    }
    
    // Generate conversion-ready sales brief if handover triggered
    let salesBrief = null;
    if (shouldHandover) {
      try {
        const { SalesBriefGenerator } = await import('./sales-brief-generator');
        
        // Create context from conversation data
        const context = SalesBriefGenerator.createConversationContext(
          conversation.lead?.name || 'Customer',
          conversation.lead?.vehicleInterest,
          newMessage?.content || '',
          conversation.messages || [],
          { ...analysis, urgencyLevel }
        );
        
        salesBrief = await SalesBriefGenerator.generateSalesBrief(context);
      } catch (error) {
        console.error('Sales brief generation failed:', error);
      }
    }

    return {
      shouldHandover,
      reason: reason.trim(),
      score: analysis.qualificationScore,
      triggeredCriteria,
      nextActions: shouldHandover ? [
        'Create handover notification',
        'Assign to appropriate agent',
        'Send summary to sales team'
      ] : ['Continue automated conversation'],
      recommendedAgent: this.selectRecommendedAgent(analysis, criteria) || 'sales',
      urgencyLevel,
      salesBrief
    };
  }

  /**
   * Analyze conversation for handover evaluation
   */
  private static async analyzeConversation(
    conversation: any,
    newMessage?: { role: 'agent' | 'lead'; content: string }
  ): Promise<ConversationAnalysis> {
    const messages = [...(conversation.messages || [])];
    if (newMessage) messages.push(newMessage);

    const messageCount = messages.length;
    const timeSpent = this.calculateTimeSpent(messages);
    
    // Combine all message content for analysis
    const fullContent = messages
      .map((msg: any) => msg.content || '')
      .join(' ')
      .toLowerCase();

    // Analyze qualification score
    const qualificationScore = this.calculateQualificationScore(fullContent, messages);
    
    // Analyze intent score
    const intentScore = this.calculateIntentScore(fullContent);
    
    // Analyze engagement level
    const engagementLevel = this.calculateEngagementLevel(messages);
    
    // Detect intents
    const detectedIntents = this.detectIntents(fullContent);
    
    // Detect automotive context
    const automotiveContext = this.detectAutomotiveContext(fullContent);
    
    // Detect urgency indicators
    const urgencyIndicators = this.detectUrgencyIndicators(fullContent);

    return {
      qualificationScore,
      intentScore,
      engagementLevel,
      messageCount,
      timeSpent,
      detectedIntents,
      automotiveContext,
      urgencyIndicators
    };
  }

  private static calculateQualificationScore(content: string, messages: any[]): number {
    let score = 0;
    
    // Contact information provided
    if (/\b[\w.-]+@[\w.-]+\.\w+\b/.test(content)) score += 25; // Email
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(content)) score += 20; // Phone
    
    // Purchase intent indicators
    if (/\b(buy|purchase|looking for|interested in|need|want)\b/.test(content)) score += 15;
    if (/\b(budget|price|cost|afford|financing|payment)\b/.test(content)) score += 20;
    if (/\b(test drive|schedule|appointment|visit|come in)\b/.test(content)) score += 25;
    
    // Specific vehicle interest
    if (/\b(model|year|trim|features|options|color)\b/.test(content)) score += 10;
    
    // Timeline indicators
    if (/\b(soon|this week|this month|urgently|quickly)\b/.test(content)) score += 15;
    
    return Math.min(score, 100);
  }

  private static calculateIntentScore(content: string): number {
    let score = 0;
    
    const highIntentKeywords = [
      'test drive', 'schedule appointment', 'financing options',
      'trade in value', 'monthly payment', 'down payment',
      'lease options', 'warranty information', 'service appointment'
    ];
    
    const mediumIntentKeywords = [
      'price', 'cost', 'features', 'specifications', 'availability',
      'colors', 'options', 'comparison', 'reviews'
    ];
    
    highIntentKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 15;
    });
    
    mediumIntentKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 8;
    });
    
    return Math.min(score, 100);
  }

  private static calculateEngagementLevel(messages: any[]): number {
    if (messages.length === 0) return 0;
    
    let score = 0;
    
    // Message length indicates engagement
    const avgLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / messages.length;
    if (avgLength > 50) score += 20;
    if (avgLength > 100) score += 20;
    
    // Question asking indicates engagement
    const questionsAsked = messages.filter(msg => msg.content?.includes('?')).length;
    score += Math.min(questionsAsked * 10, 30);
    
    // Recent activity
    const recentMessages = messages.filter(msg => {
      const ts = msg.createdAt ? new Date(msg.createdAt) : null;
      if (!ts) return false;
      return (Date.now() - ts.getTime()) < 10 * 60 * 1000;
    });
    
    if (recentMessages.length > 0) score += 20;
    
    return Math.min(score, 100);
  }

  private static calculateTimeSpent(messages: any[]): number {
    if (messages.length < 2) return 0;
    
    const firstMessage = new Date(messages[0]?.createdAt || Date.now());
    const lastMessage = new Date(messages[messages.length - 1]?.createdAt || Date.now());
    
    return Math.floor((lastMessage.getTime() - firstMessage.getTime()) / (1000 * 60)); // minutes
  }

  private static detectIntents(content: string): string[] {
    const intents: string[] = [];
    
    if (/\b(test drive|test driving)\b/.test(content)) intents.push('test_drive_interest');
    if (/\b(price|pricing|cost|how much)\b/.test(content)) intents.push('pricing_inquiry');
    if (/\b(financing|finance|loan|lease)\b/.test(content)) intents.push('financing_discussion');
    if (/\b(trade|trade-in|current car)\b/.test(content)) intents.push('trade_in_interest');
    if (/\b(service|maintenance|repair)\b/.test(content)) intents.push('service_inquiry');
    if (/\b(warranty|extended warranty|protection)\b/.test(content)) intents.push('warranty_interest');
    if (/\b(appointment|schedule|visit|come in)\b/.test(content)) intents.push('appointment_request');
    
    return intents;
  }

  private static detectAutomotiveContext(content: string): string[] {
    const contexts: string[] = [];
    
    this.defaultCriteria.automotiveKeywords.forEach(keyword => {
      if (content.includes(keyword.toLowerCase())) {
        contexts.push(keyword);
      }
    });
    
    return contexts;
  }

  private static detectUrgencyIndicators(content: string): string[] {
    const indicators: string[] = [];
    
    this.defaultCriteria.urgentKeywords.forEach(keyword => {
      if (content.includes(keyword.toLowerCase())) {
        indicators.push(keyword);
      }
    });
    
    return indicators;
  }

  private static generateNextActions(analysis: ConversationAnalysis, criteria: HandoverCriteria): string[] {
    const actions = ['Notify human agent'];
    
    if (analysis.detectedIntents.includes('test_drive_interest')) {
      actions.push('Schedule test drive appointment');
    }
    
    if (analysis.detectedIntents.includes('financing_discussion')) {
      actions.push('Connect with finance manager');
    }
    
    if (analysis.detectedIntents.includes('service_inquiry')) {
      actions.push('Schedule service appointment');
    }
    
    if (analysis.urgencyIndicators.length > 0) {
      actions.push('Priority escalation - immediate response required');
    }
    
    actions.push('Send follow-up email with relevant information');
    
    return actions;
  }

  private static selectRecommendedAgent(analysis: ConversationAnalysis, criteria: HandoverCriteria): string {
    if (analysis.detectedIntents.includes('financing_discussion')) {
      return 'finance';
    }
    
    if (analysis.detectedIntents.includes('service_inquiry')) {
      return 'service';
    }
    
    if (analysis.detectedIntents.includes('test_drive_interest') || 
        analysis.detectedIntents.includes('pricing_inquiry')) {
      return 'sales';
    }
    
    return 'sales'; // Default to sales
  }

  /**
   * Process handover and notify appropriate recipients
   */
  static async processHandover(
    conversationId: string,
    evaluation: HandoverEvaluation,
    criteria: HandoverCriteria,
    additionalData?: {
      lead?: any;
      conversation?: any;
      campaignName?: string;
      // optional campaign object (if available) to source overrides like webhook URL
      campaign?: any;
    }
  ): Promise<boolean> {
    try {
      // Determine delivery mode: email | webhook | both (default email for backward compatibility)
      const deliveryMode = (process.env.HANDOVER_DELIVERY_MODE || 'email').toLowerCase();

      // Source webhook configuration (env or campaign override)
      const campaign = additionalData?.campaign || (additionalData?.conversation?.campaignId ? await (await import('../storage')).storage.getCampaign(additionalData?.conversation?.campaignId).catch(()=>null) : null);
      const webhookUrl = campaign?.handoverWebhookUrl || process.env.HANDOVER_WEBHOOK_URL;
      const webhookSecret = campaign?.handoverWebhookSecret || process.env.HANDOVER_WEBHOOK_SECRET;

      let emailSent: boolean | undefined;
      let webhookSent: boolean | undefined;

      // Always compute recipients (used in payload + email channel)
      const recipients = criteria.handoverRecipients.filter(recipient => 
        recipient.role === evaluation.recommendedAgent || recipient.role === 'sales'
      );

      // Build common payload for webhook channel (only if needed)
      const nowIso = new Date().toISOString();
      const conversation = additionalData?.conversation;
      const messagesSample = Array.isArray(conversation?.messages) ? conversation.messages.slice(-5).map((m: any) => ({
        role: m.role,
        content: (m.content || '').slice(0, 500),
        ts: m.createdAt || null
      })) : [];
      const idempotencyKey = `${conversationId}-${evaluation.score}-${Date.now()}`;
      const webhookPayload = {
        event: 'handover.triggered',
        version: '1.0',
        idempotencyKey,
        timestamp: nowIso,
        conversationId,
        campaignId: conversation?.campaignId || campaign?.id || null,
        campaignName: additionalData?.campaignName || campaign?.name || null,
        recommendedAgent: evaluation.recommendedAgent,
        urgencyLevel: evaluation.urgencyLevel,
        triggeredCriteria: evaluation.triggeredCriteria,
        reason: evaluation.reason,
        scores: {
          qualification: evaluation.score,
          // intent & engagement not directly exposed from evaluation; attempt to include if present on conversation analysis artifact
          intent: conversation?.analysis?.intentScore,
            engagement: conversation?.analysis?.engagementLevel
        },
        nextActions: evaluation.nextActions,
        salesBrief: evaluation.salesBrief || null,
        lead: additionalData?.lead ? {
          id: additionalData?.lead.id,
          name: [additionalData?.lead.firstName, additionalData?.lead.lastName].filter(Boolean).join(' ') || additionalData?.lead.name,
          email: additionalData?.lead.email,
          phone: additionalData?.lead.phone,
          vehicleInterest: additionalData?.lead.vehicleInterest,
          meta: {
            source: additionalData?.lead.leadSource,
            tags: additionalData?.lead.tags
          }
        } : null,
        messagesSample,
        recipients: recipients.map(r => ({ name: r.name, email: r.email, role: r.role })),
        metadata: {
          system: 'mailmind',
          schema: 'handover.v1'
        }
      };

      // Send email channel if mode includes email
      if (deliveryMode === 'email' || deliveryMode === 'both') {
        try {
          const { HandoverEmailService } = await import('./handover-email');
          emailSent = await HandoverEmailService.sendHandoverNotification({
            conversationId,
            evaluation,
            lead: additionalData?.lead,
            conversation: additionalData?.conversation,
            campaignName: additionalData?.campaignName
          });
        } catch (e) {
          console.error('Handover email channel failed:', (e as Error).message);
          emailSent = false;
        }
      }

      // Send webhook channel if mode includes webhook and URL available
      if ((deliveryMode === 'webhook' || deliveryMode === 'both') && webhookUrl) {
        try {
          const { sendHandoverWebhook } = await import('./handover-webhook');
          const result = await sendHandoverWebhook(webhookPayload, {
            url: webhookUrl,
            secret: webhookSecret,
            timeoutMs: Number(process.env.HANDOVER_WEBHOOK_TIMEOUT_MS || 4000),
            maxAttempts: Number(process.env.HANDOVER_WEBHOOK_RETRY_ATTEMPTS || 3)
          });
          webhookSent = result.delivered;
          if (!result.delivered) {
            console.warn('Handover webhook delivery failed', result);
          }
        } catch (e) {
          console.error('Handover webhook channel error:', (e as Error).message);
          webhookSent = false;
        }
      }

      const notification = {
        conversationId,
        urgencyLevel: evaluation.urgencyLevel,
        score: evaluation.score,
        triggeredCriteria: evaluation.triggeredCriteria,
        nextActions: evaluation.nextActions,
        recipients: recipients.map(r => r.email),
        emailSent,
        webhookSent,
        deliveryMode
      };
      console.log('Handover processed:', notification);

      // Return success if at least one configured channel succeeded
      const success = [emailSent, webhookSent]
        .filter(v => typeof v !== 'undefined')
        .some(v => v === true);
      return success;
    } catch (error) {
      console.error('Failed to process handover:', error);
      return false;
    }
  }

  /**
   * Get filtered recipients based on recommended agent for dynamic routing
   */
  static getFilteredRecipients(
    recommendedAgent: string,
    criteria: HandoverCriteria
  ): Array<{ name: string; email: string; role: string }> {
    return criteria.handoverRecipients.filter(r =>
      r.role === recommendedAgent || r.role === 'sales' // default fan-out
    );
  }

  /**
   * Get handover statistics for monitoring
   */
  static getHandoverStats(): any {
    return {
      criteriaCount: Object.keys(this.defaultCriteria).length,
      automotiveKeywords: this.defaultCriteria.automotiveKeywords.length,
      urgentKeywords: this.defaultCriteria.urgentKeywords.length,
      defaultRecipients: this.defaultCriteria.handoverRecipients.length
    };
  }
}