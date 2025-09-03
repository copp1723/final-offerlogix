import { storage } from '../../storage';
import { ConversationState, ConversationEvent } from './ConversationStateManager';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  fromState: ConversationState;
  toState: ConversationState;
  event: ConversationEvent;
  validator: (context: ValidationContext) => Promise<ValidationResult>;
  required: boolean;
}

export interface ValidationContext {
  conversationId: string;
  leadId?: string;
  fromState: ConversationState;
  toState: ConversationState;
  event: ConversationEvent;
  metadata?: Record<string, any>;
  conversation?: any;
  lead?: any;
  messages?: any[];
  triggeredBy: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  warnings?: string[];
  requirements?: string[];
  canProceed: boolean;
}

/**
 * Conversation Validator - Validates state transitions and business logic
 */
export class ConversationValidator {
  private validationRules: ValidationRule[] = [];

  constructor() {
    this.initializeValidationRules();
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      // New to Active transition validation
      {
        id: 'new_to_active_email_sent',
        name: 'First Email Sent',
        description: 'Conversation can only become active after first email is sent',
        fromState: ConversationState.NEW,
        toState: ConversationState.ACTIVE,
        event: ConversationEvent.FIRST_EMAIL_SENT,
        validator: this.validateFirstEmailSent.bind(this),
        required: true
      },

      // Active to Engaged transition validation
      {
        id: 'active_to_engaged_lead_reply',
        name: 'Lead Replied',
        description: 'Lead must reply before conversation becomes engaged',
        fromState: ConversationState.ACTIVE,
        toState: ConversationState.ENGAGED,
        event: ConversationEvent.LEAD_REPLIED,
        validator: this.validateLeadReply.bind(this),
        required: true
      },

      // Engaged to Qualified transition validation
      {
        id: 'engaged_to_qualified_criteria',
        name: 'Qualification Criteria Met',
        description: 'Lead must meet qualification criteria before being marked as qualified',
        fromState: ConversationState.ENGAGED,
        toState: ConversationState.QUALIFIED,
        event: ConversationEvent.QUALIFICATION_CRITERIA_MET,
        validator: this.validateQualificationCriteria.bind(this),
        required: true
      },

      // Qualified to Ready for Handover validation
      {
        id: 'qualified_to_handover_ready',
        name: 'Handover Readiness',
        description: 'Lead must meet handover criteria before being ready for handover',
        fromState: ConversationState.QUALIFIED,
        toState: ConversationState.READY_FOR_HANDOVER,
        event: ConversationEvent.HANDOVER_REQUESTED,
        validator: this.validateHandoverReadiness.bind(this),
        required: true
      },

      // Ready for Handover to Handed Over validation
      {
        id: 'handover_ready_to_handed_over',
        name: 'Human Agent Assignment',
        description: 'Human agent must be assigned before handover is complete',
        fromState: ConversationState.READY_FOR_HANDOVER,
        toState: ConversationState.HANDED_OVER,
        event: ConversationEvent.HUMAN_AGENT_ASSIGNED,
        validator: this.validateAgentAssignment.bind(this),
        required: true
      },

      // Business hours validation for automatic transitions
      {
        id: 'business_hours_check',
        name: 'Business Hours Check',
        description: 'Certain transitions should only happen during business hours',
        fromState: ConversationState.QUALIFIED,
        toState: ConversationState.READY_FOR_HANDOVER,
        event: ConversationEvent.HANDOVER_REQUESTED,
        validator: this.validateBusinessHours.bind(this),
        required: false
      },

      // Lead engagement validation
      {
        id: 'engagement_threshold',
        name: 'Engagement Threshold',
        description: 'Lead must maintain minimum engagement level',
        fromState: ConversationState.ACTIVE,
        toState: ConversationState.ENGAGED,
        event: ConversationEvent.ENGAGEMENT_INCREASED,
        validator: this.validateEngagementThreshold.bind(this),
        required: true
      }
    ];
  }

  /**
   * Validate a state transition
   */
  async validateTransition(context: ValidationContext): Promise<ValidationResult> {
    try {
      // Get applicable validation rules
      const applicableRules = this.getApplicableRules(context);
      
      if (applicableRules.length === 0) {
        return {
          isValid: true,
          canProceed: true,
          warnings: ['No specific validation rules found for this transition']
        };
      }

      // Enhance context with additional data
      const enhancedContext = await this.enhanceContext(context);

      // Run all validation rules
      const validationResults = await Promise.all(
        applicableRules.map(rule => this.runValidationRule(rule, enhancedContext))
      );

      // Aggregate results
      return this.aggregateValidationResults(validationResults, applicableRules);
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        canProceed: false,
        reason: 'Validation process failed due to system error'
      };
    }
  }

  /**
   * Get applicable validation rules for the transition
   */
  private getApplicableRules(context: ValidationContext): ValidationRule[] {
    return this.validationRules.filter(rule => 
      rule.fromState === context.fromState && 
      rule.toState === context.toState &&
      rule.event === context.event
    );
  }

  /**
   * Enhance context with additional data needed for validation
   */
  private async enhanceContext(context: ValidationContext): Promise<ValidationContext> {
    try {
      const conversation = await storage.getConversation(context.conversationId);
      const lead = context.leadId ? await storage.getLead(context.leadId) : null;
      const messages = await storage.getConversationMessages(context.conversationId);

      return {
        ...context,
        conversation,
        lead,
        messages
      };
    } catch (error) {
      console.error('Failed to enhance validation context:', error);
      return context;
    }
  }

  /**
   * Run individual validation rule
   */
  private async runValidationRule(
    rule: ValidationRule, 
    context: ValidationContext
  ): Promise<ValidationResult & { ruleId: string; required: boolean }> {
    try {
      const result = await rule.validator(context);
      return {
        ...result,
        ruleId: rule.id,
        required: rule.required
      };
    } catch (error) {
      console.error(`Validation rule ${rule.id} failed:`, error);
      return {
        isValid: false,
        canProceed: false,
        reason: `Validation rule ${rule.name} failed to execute`,
        ruleId: rule.id,
        required: rule.required
      };
    }
  }

  /**
   * Aggregate validation results
   */
  private aggregateValidationResults(
    results: Array<ValidationResult & { ruleId: string; required: boolean }>,
    rules: ValidationRule[]
  ): ValidationResult {
    const requiredResults = results.filter(r => r.required);
    const optionalResults = results.filter(r => !r.required);

    // All required rules must pass
    const requiredValid = requiredResults.every(r => r.isValid);
    const canProceed = requiredResults.every(r => r.canProceed);

    // Collect all warnings and requirements
    const warnings: string[] = [];
    const requirements: string[] = [];
    let reason = '';

    results.forEach((result, index) => {
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
      if (result.requirements) {
        requirements.push(...result.requirements);
      }
      if (!result.isValid && result.required) {
        reason = result.reason || `Required validation failed: ${rules[index]?.name}`;
      }
    });

    // Add warnings for failed optional rules
    optionalResults.forEach((result, index) => {
      if (!result.isValid) {
        const rule = rules.find(r => r.id === result.ruleId);
        warnings.push(`Optional validation failed: ${rule?.name} - ${result.reason}`);
      }
    });

    return {
      isValid: requiredValid,
      canProceed,
      reason: reason || undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      requirements: requirements.length > 0 ? requirements : undefined
    };
  }

  // Validation rule implementations

  /**
   * Validate first email sent
   */
  private async validateFirstEmailSent(context: ValidationContext): Promise<ValidationResult> {
    const messages = context.messages || [];
    const aiMessages = messages.filter(m => m.isFromAI === 1);

    if (aiMessages.length === 0) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'No outbound messages found. First email must be sent before conversation can become active.',
        requirements: ['Send initial email to lead']
      };
    }

    return {
      isValid: true,
      canProceed: true
    };
  }

  /**
   * Validate lead reply
   */
  private async validateLeadReply(context: ValidationContext): Promise<ValidationResult> {
    const messages = context.messages || [];
    const humanMessages = messages.filter(m => m.isFromAI === 0);

    if (humanMessages.length === 0) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'No response from lead. Lead must reply before conversation becomes engaged.',
        requirements: ['Wait for lead response']
      };
    }

    // Check response quality
    const lastResponse = humanMessages[humanMessages.length - 1];
    if (lastResponse.content.length < 10) {
      return {
        isValid: true,
        canProceed: true,
        warnings: ['Lead response is very brief. Consider encouraging more detailed responses.']
      };
    }

    return {
      isValid: true,
      canProceed: true
    };
  }

  /**
   * Validate qualification criteria
   */
  private async validateQualificationCriteria(context: ValidationContext): Promise<ValidationResult> {
    const messages = context.messages || [];
    const humanMessages = messages.filter(m => m.isFromAI === 0);

    if (humanMessages.length < 2) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'Insufficient engagement. At least 2 lead responses required for qualification.',
        requirements: ['Continue conversation to gather more responses']
      };
    }

    // Check for qualification signals
    const allContent = humanMessages.map(m => m.content.toLowerCase()).join(' ');
    const qualificationKeywords = [
      'interested', 'buy', 'purchase', 'appointment', 'schedule',
      'test drive', 'financing', 'price', 'cost', 'when'
    ];

    const hasQualificationSignals = qualificationKeywords.some(keyword => 
      allContent.includes(keyword)
    );

    if (!hasQualificationSignals) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'No qualification signals detected in conversation.',
        requirements: [
          'Lead should express interest in purchasing',
          'Lead should ask about pricing or scheduling',
          'Lead should show intent to move forward'
        ]
      };
    }

    // Check engagement level
    const engagementScore = this.calculateEngagementScore(messages);
    if (engagementScore < 40) {
      return {
        isValid: false,
        canProceed: false,
        reason: `Engagement score too low: ${engagementScore}%. Minimum 40% required.`,
        requirements: ['Increase lead engagement through better conversation flow']
      };
    }

    return {
      isValid: true,
      canProceed: true,
      warnings: engagementScore < 60 ? ['Engagement could be higher for better qualification'] : undefined
    };
  }

  /**
   * Validate handover readiness
   */
  private async validateHandoverReadiness(context: ValidationContext): Promise<ValidationResult> {
    const messages = context.messages || [];
    const lead = context.lead;

    if (!lead) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'Lead information not found'
      };
    }

    // Check minimum conversation length
    if (messages.length < 6) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'Insufficient conversation depth. Minimum 6 messages required for handover.',
        requirements: ['Continue conversation to build rapport and gather more information']
      };
    }

    // Check for contact information
    if (!lead.phone && !lead.email) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'No contact information available for lead',
        requirements: ['Collect lead contact information before handover']
      };
    }

    // Check handover readiness score
    const handoverScore = this.calculateHandoverReadiness(messages, lead);
    if (handoverScore < 70) {
      return {
        isValid: false,
        canProceed: false,
        reason: `Handover readiness score too low: ${handoverScore}%. Minimum 70% required.`,
        requirements: [
          'Increase engagement quality',
          'Gather more qualification information',
          'Ensure lead shows clear purchase intent'
        ]
      };
    }

    return {
      isValid: true,
      canProceed: true
    };
  }

  /**
   * Validate agent assignment
   */
  private async validateAgentAssignment(context: ValidationContext): Promise<ValidationResult> {
    const conversation = context.conversation;
    const metadata = context.metadata;

    // Check if agent is assigned
    const agentId = conversation?.userId || metadata?.agentId;
    
    if (!agentId) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'No human agent assigned to conversation',
        requirements: ['Assign a human agent before completing handover']
      };
    }

    // Verify agent exists and is available
    try {
      const agent = await storage.getUser(agentId);
      if (!agent) {
        return {
          isValid: false,
          canProceed: false,
          reason: 'Assigned agent not found in system',
          requirements: ['Assign a valid human agent']
        };
      }

      return {
        isValid: true,
        canProceed: true
      };
    } catch (error) {
      return {
        isValid: false,
        canProceed: false,
        reason: 'Unable to verify agent assignment',
        requirements: ['Verify agent exists and is available']
      };
    }
  }

  /**
   * Validate business hours
   */
  private async validateBusinessHours(context: ValidationContext): Promise<ValidationResult> {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Business hours: Monday-Friday, 8 AM - 6 PM
    const isWeekday = day >= 1 && day <= 5;
    const isBusinessHours = hour >= 8 && hour <= 18;

    if (!isWeekday || !isBusinessHours) {
      return {
        isValid: true, // Still valid, but with warning
        canProceed: true,
        warnings: [
          'Handover initiated outside business hours. Consider scheduling for next business day.',
          `Current time: ${now.toLocaleString()}`
        ]
      };
    }

    return {
      isValid: true,
      canProceed: true
    };
  }

  /**
   * Validate engagement threshold
   */
  private async validateEngagementThreshold(context: ValidationContext): Promise<ValidationResult> {
    const messages = context.messages || [];
    const engagementScore = this.calculateEngagementScore(messages);

    if (engagementScore < 30) {
      return {
        isValid: false,
        canProceed: false,
        reason: `Engagement score too low: ${engagementScore}%. Minimum 30% required.`,
        requirements: ['Improve conversation engagement before marking as engaged']
      };
    }

    if (engagementScore < 50) {
      return {
        isValid: true,
        canProceed: true,
        warnings: [`Engagement score is moderate: ${engagementScore}%. Consider improving engagement.`]
      };
    }

    return {
      isValid: true,
      canProceed: true
    };
  }

  // Helper methods

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(messages: any[]): number {
    if (messages.length === 0) return 0;
    
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const responseRate = (humanMessages.length / Math.max(1, messages.length)) * 100;
    
    // Factor in response timing
    let timeScore = 0;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].isFromAI === 0) {
        const timeDiff = new Date(messages[i].createdAt).getTime() - 
                        new Date(messages[i-1].createdAt).getTime();
        const hours = timeDiff / (1000 * 60 * 60);
        
        if (hours < 1) timeScore += 20;
        else if (hours < 4) timeScore += 10;
        else if (hours < 24) timeScore += 5;
      }
    }
    
    const avgTimeScore = messages.length > 1 ? timeScore / (messages.length - 1) : 0;
    
    return Math.min(100, Math.round((responseRate * 0.6) + (avgTimeScore * 0.4)));
  }

  /**
   * Calculate handover readiness score
   */
  private calculateHandoverReadiness(messages: any[], lead: any): number {
    let score = 0;
    
    // Message count factor (max 25 points)
    score += Math.min(25, messages.length * 2);
    
    // Engagement factor (max 30 points)
    const engagementScore = this.calculateEngagementScore(messages);
    score += (engagementScore * 0.3);
    
    // Qualification signals factor (max 25 points)
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const allContent = humanMessages.map(m => m.content.toLowerCase()).join(' ');
    
    const qualificationKeywords = ['buy', 'purchase', 'appointment', 'test drive', 'financing'];
    const qualificationSignals = qualificationKeywords.filter(keyword => 
      allContent.includes(keyword)
    ).length;
    
    score += Math.min(25, qualificationSignals * 8);
    
    // Lead information completeness (max 20 points)
    let infoCompleteness = 0;
    if (lead.firstName) infoCompleteness += 5;
    if (lead.lastName) infoCompleteness += 5;
    if (lead.phone) infoCompleteness += 5;
    if (lead.vehicleInterest) infoCompleteness += 5;
    
    score += infoCompleteness;
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Get validation rules for display/debugging
   */
  getValidationRules(): ValidationRule[] {
    return [...this.validationRules];
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    this.validationRules.push(rule);
  }

  /**
   * Remove validation rule
   */
  removeValidationRule(ruleId: string): boolean {
    const index = this.validationRules.findIndex(rule => rule.id === ruleId);
    if (index >= 0) {
      this.validationRules.splice(index, 1);
      return true;
    }
    return false;
  }
}

export const conversationValidator = new ConversationValidator();