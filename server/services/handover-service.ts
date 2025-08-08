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
  recommendedAgent?: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

interface ConversationAnalysis {
  qualificationScore: number;
  intentScore: number;
  engagementLevel: number;
  messageCount: number;
  timeSpent: number;
  detectedIntents: string[];
  automotiveContext: string[];
  urgencyIndicators: string[];
}

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
   * Evaluate if a conversation should trigger handover based on campaign criteria
   */
  static async evaluateHandover(
    conversationId: string,
    conversation: any,
    newMessage?: { role: 'agent' | 'lead'; content: string },
    customCriteria?: Partial<HandoverCriteria>
  ): Promise<HandoverEvaluation> {
    const criteria = { ...this.defaultCriteria, ...customCriteria };
    
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
      recommendedAgent: this.selectRecommendedAgent(analysis, criteria),
      urgencyLevel
    };
  }

  /**
   * Analyze conversation for handover evaluation
   */
  private static async analyzeConversation(
    conversation: any,
    newMessage?: { role: 'agent' | 'lead'; content: string }
  ): Promise<ConversationAnalysis> {
    const messages = conversation.messages || [];
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
      const msgTime = new Date(msg.createdAt || Date.now());
      const now = new Date();
      return (now.getTime() - msgTime.getTime()) < 10 * 60 * 1000; // 10 minutes
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
    criteria: HandoverCriteria
  ): Promise<boolean> {
    try {
      // Find appropriate recipients based on recommended agent type
      const recipients = criteria.handoverRecipients.filter(recipient => 
        recipient.role === evaluation.recommendedAgent || recipient.role === 'sales'
      );

      // Create handover notification
      const notification = {
        conversationId,
        urgencyLevel: evaluation.urgencyLevel,
        score: evaluation.score,
        triggeredCriteria: evaluation.triggeredCriteria,
        nextActions: evaluation.nextActions,
        recipients: recipients.map(r => r.email)
      };

      // In a real implementation, this would send notifications via email/SMS
      console.log('Handover processed:', notification);
      
      // Update conversation status to indicate handover
      // This would integrate with your conversation storage system
      
      return true;
    } catch (error) {
      console.error('Failed to process handover:', error);
      return false;
    }
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