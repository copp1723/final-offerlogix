import { storage } from '../../storage';
import { conversationStateManager, ConversationEvent } from './ConversationStateManager';

export interface MessageThread {
  id: string;
  conversationId: string;
  rootMessageId?: string; // For reply chains
  parentMessageId?: string; // Direct parent message
  threadDepth: number;
  subject: string;
  messageIds: string[];
  lastActivityAt: Date;
  isActive: boolean;
}

export interface ThreadedMessage {
  id: string;
  conversationId: string;
  threadId?: string;
  parentMessageId?: string;
  senderId?: string; // Optional - for user messages
  leadId?: string; // Optional - for lead messages
  content: string;
  messageType: string;
  isFromAI: number;
  sequenceNumber: number;
  emailHeaders?: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
  createdAt: Date;
}

export interface ConversationContext {
  conversationId: string;
  leadId: string;
  currentThread: MessageThread | null;
  messageHistory: ThreadedMessage[];
  contextSummary: string;
  keyTopics: string[];
  currentIntent: string;
  lastEngagementAt: Date;
}

/**
 * Message Threading Service - Handles email conversation threading and context preservation
 */
export class MessageThreadingService {
  /**
   * Process new message and handle threading
   */
  async processMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: string,
    isFromAI: number,
    emailHeaders?: Record<string, string>,
    additionalOptions?: { providerMessageId?: string; leadId?: string }
  ): Promise<ThreadedMessage> {
    try {
      // Create base message - use leadId if provided, otherwise senderId
      const messageData: any = {
        conversationId,
        content,
        messageType,
        isFromAI
      };
      
      if (additionalOptions?.leadId) {
        messageData.leadId = additionalOptions.leadId;
      } else {
        messageData.senderId = senderId;
      }
      
      if (additionalOptions?.providerMessageId) {
        messageData.providerMessageId = additionalOptions.providerMessageId;
      }
      
      const baseMessage = await storage.createConversationMessage(messageData);

      // Convert to threaded message
      const threadedMessage = await this.createThreadedMessage(baseMessage, emailHeaders);

      // Update conversation threading
      await this.updateConversationThreading(conversationId, threadedMessage);

      // Update conversation state if needed
      await this.handleMessageStateUpdates(conversationId, threadedMessage);

      return threadedMessage;
    } catch (error) {
      console.error('Failed to process threaded message:', error);
      throw error;
    }
  }

  /**
   * Create threaded message with proper relationships
   */
  private async createThreadedMessage(
    baseMessage: any,
    emailHeaders?: Record<string, string>
  ): Promise<ThreadedMessage> {
    const messages = await storage.getConversationMessages(baseMessage.conversationId);
    
    // Find parent message based on email headers or sequence
    const parentMessage = await this.findParentMessage(
      baseMessage.conversationId,
      emailHeaders,
      messages
    );

    // Determine thread ID
    const threadId = await this.determineThreadId(
      baseMessage.conversationId,
      parentMessage
    );

    const threadedMessage: ThreadedMessage = {
      id: baseMessage.id,
      conversationId: baseMessage.conversationId,
      threadId,
      parentMessageId: parentMessage?.id,
      senderId: baseMessage.senderId,
      content: baseMessage.content,
      messageType: baseMessage.messageType,
      isFromAI: baseMessage.isFromAI,
      sequenceNumber: messages.length,
      emailHeaders,
      inReplyTo: emailHeaders?.['In-Reply-To'],
      references: this.parseReferences(emailHeaders?.['References']),
      createdAt: baseMessage.createdAt
    };

    return threadedMessage;
  }

  /**
   * Find parent message based on email headers or conversation flow
   */
  private async findParentMessage(
    conversationId: string,
    emailHeaders?: Record<string, string>,
    existingMessages?: any[]
  ): Promise<any | null> {
    const messages = existingMessages || await storage.getConversationMessages(conversationId);
    
    if (!emailHeaders || messages.length === 0) {
      // Return last message as parent for simple threading
      return messages.length > 0 ? messages[messages.length - 1] : null;
    }

    const inReplyTo = emailHeaders['In-Reply-To'];
    const references = this.parseReferences(emailHeaders['References']);

    // Try to find message by Message-ID in references
    if (references.length > 0) {
      for (const ref of references.reverse()) {
        const parentMessage = messages.find(m => 
          m.emailHeaders?.['Message-ID'] === ref
        );
        if (parentMessage) return parentMessage;
      }
    }

    // Try to find by In-Reply-To
    if (inReplyTo) {
      const parentMessage = messages.find(m => 
        m.emailHeaders?.['Message-ID'] === inReplyTo
      );
      if (parentMessage) return parentMessage;
    }

    // Fall back to most recent message
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  /**
   * Determine thread ID for message
   */
  private async determineThreadId(
    conversationId: string,
    parentMessage?: any
  ): Promise<string> {
    if (parentMessage?.threadId) {
      return parentMessage.threadId;
    }

    // Create new thread ID
    return `thread_${conversationId}_${Date.now()}`;
  }

  /**
   * Parse References header into array
   */
  private parseReferences(references?: string): string[] {
    if (!references) return [];
    
    // Split by whitespace and clean up message IDs
    return references
      .split(/\s+/)
      .map(ref => ref.trim())
      .filter(ref => ref.length > 0 && ref.includes('@'));
  }

  /**
   * Update conversation threading metadata
   */
  private async updateConversationThreading(
    conversationId: string,
    message: ThreadedMessage
  ): Promise<void> {
    try {
      // Get or create thread
      const thread = await this.getOrCreateThread(conversationId, message);
      
      // Update thread with new message
      await this.updateThread(thread, message);

      // Update conversation context
      await this.updateConversationContext(conversationId, message);
    } catch (error) {
      console.error('Failed to update conversation threading:', error);
    }
  }

  /**
   * Get or create message thread
   */
  private async getOrCreateThread(
    conversationId: string,
    message: ThreadedMessage
  ): Promise<MessageThread> {
    // In production, this would query a threads table
    // For now, we'll create a simple thread structure
    
    const thread: MessageThread = {
      id: message.threadId || `thread_${conversationId}_${Date.now()}`,
      conversationId,
      rootMessageId: message.parentMessageId,
      threadDepth: this.calculateThreadDepth(message),
      subject: await this.extractSubject(conversationId),
      messageIds: [message.id],
      lastActivityAt: new Date(),
      isActive: true
    };

    return thread;
  }

  /**
   * Calculate thread depth
   */
  private calculateThreadDepth(message: ThreadedMessage): number {
    // Simple depth calculation - could be enhanced with proper threading
    return message.sequenceNumber > 0 ? Math.floor(message.sequenceNumber / 2) : 0;
  }

  /**
   * Extract subject from conversation
   */
  private async extractSubject(conversationId: string): Promise<string> {
    const conversation = await storage.getConversation(conversationId);
    return conversation?.subject || 'Email Conversation';
  }

  /**
   * Update thread with new message
   */
  private async updateThread(thread: MessageThread, message: ThreadedMessage): Promise<void> {
    // Add message to thread
    if (!thread.messageIds.includes(message.id)) {
      thread.messageIds.push(message.id);
    }
    
    thread.lastActivityAt = new Date();
    
    // Store thread update (would be in database in production)
    console.log('Thread updated:', thread.id, 'with message:', message.id);
  }

  /**
   * Update conversation context with new message
   */
  private async updateConversationContext(
    conversationId: string,
    message: ThreadedMessage
  ): Promise<void> {
    try {
      const context = await this.getConversationContext(conversationId);
      
      // Add message to history
      context.messageHistory.push(message);
      
      // Update context summary and topics
      await this.updateContextSummary(context, message);
      
      // Update intent detection
      await this.updateCurrentIntent(context, message);
      
      context.lastEngagementAt = new Date();
      
      // Store context (would be in database in production)
      console.log('Conversation context updated for:', conversationId);
    } catch (error) {
      console.error('Failed to update conversation context:', error);
    }
  }

  /**
   * Get conversation context
   */
  async getConversationContext(conversationId: string): Promise<ConversationContext> {
    try {
      const conversation = await storage.getConversation(conversationId);
      const messages = await storage.getConversationMessages(conversationId);
      
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const threadedMessages = messages.map(m => this.messageToThreadedMessage(m));
      
      const context: ConversationContext = {
        conversationId,
        leadId: conversation.leadId || '',
        currentThread: null, // Would be loaded from threads table
        messageHistory: threadedMessages,
        contextSummary: await this.generateContextSummary(threadedMessages),
        keyTopics: await this.extractKeyTopics(threadedMessages),
        currentIntent: await this.detectCurrentIntent(threadedMessages),
        lastEngagementAt: messages.length > 0 ? 
          messages[messages.length - 1].createdAt : new Date()
      };

      return context;
    } catch (error) {
      console.error('Failed to get conversation context:', error);
      throw error;
    }
  }

  /**
   * Convert storage message to threaded message
   */
  private messageToThreadedMessage(message: any): ThreadedMessage {
    return {
      id: message.id,
      conversationId: message.conversationId,
      threadId: undefined, // Would be populated from threading data
      parentMessageId: undefined,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType,
      isFromAI: message.isFromAI,
      sequenceNumber: 0, // Would be calculated
      emailHeaders: undefined,
      inReplyTo: undefined,
      references: [],
      createdAt: message.createdAt
    };
  }

  /**
   * Generate context summary from messages
   */
  private async generateContextSummary(messages: ThreadedMessage[]): Promise<string> {
    if (messages.length === 0) return 'No conversation history';
    
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const aiMessages = messages.filter(m => m.isFromAI === 1);
    
    return `Conversation with ${humanMessages.length} customer messages and ${aiMessages.length} AI responses. ` +
           `Last activity: ${messages[messages.length - 1]?.createdAt.toISOString()}`;
  }

  /**
   * Extract key topics from conversation
   */
  private async extractKeyTopics(messages: ThreadedMessage[]): Promise<string[]> {
    const topics: string[] = [];
    const topicKeywords = {
      'vehicle': ['car', 'vehicle', 'auto', 'truck', 'suv', 'sedan'],
      'pricing': ['price', 'cost', 'payment', 'financing', 'lease'],
      'scheduling': ['appointment', 'schedule', 'visit', 'test drive'],
      'features': ['features', 'options', 'specs', 'mpg', 'safety']
    };

    const allContent = messages.map(m => m.content.toLowerCase()).join(' ');
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => allContent.includes(keyword))) {
        topics.push(topic);
      }
    });

    return topics;
  }

  /**
   * Detect current intent from recent messages
   */
  private async detectCurrentIntent(messages: ThreadedMessage[]): Promise<string> {
    if (messages.length === 0) return 'unknown';
    
    const recentMessages = messages.slice(-3);
    const recentContent = recentMessages.map(m => m.content.toLowerCase()).join(' ');
    
    if (recentContent.includes('appointment') || recentContent.includes('schedule')) {
      return 'scheduling';
    }
    if (recentContent.includes('price') || recentContent.includes('cost')) {
      return 'pricing_inquiry';
    }
    if (recentContent.includes('test drive')) {
      return 'test_drive_request';
    }
    if (recentContent.includes('buy') || recentContent.includes('purchase')) {
      return 'purchase_intent';
    }
    
    return 'information_seeking';
  }

  /**
   * Update context summary with new message
   */
  private async updateContextSummary(
    context: ConversationContext,
    message: ThreadedMessage
  ): Promise<void> {
    // Regenerate summary with new message
    context.contextSummary = await this.generateContextSummary(context.messageHistory);
    context.keyTopics = await this.extractKeyTopics(context.messageHistory);
  }

  /**
   * Update current intent based on new message
   */
  private async updateCurrentIntent(
    context: ConversationContext,
    message: ThreadedMessage
  ): Promise<void> {
    context.currentIntent = await this.detectCurrentIntent(context.messageHistory);
  }

  /**
   * Handle message-based state updates
   */
  private async handleMessageStateUpdates(
    conversationId: string,
    message: ThreadedMessage
  ): Promise<void> {
    try {
      // Trigger state transitions based on message content and patterns
      if (message.isFromAI === 0) {
        // Human message - lead replied
        await conversationStateManager.transitionState(
          conversationId,
          ConversationEvent.LEAD_REPLIED,
          'system',
          { messageId: message.id, content: message.content }
        );

        // Check for engagement increase
        const context = await this.getConversationContext(conversationId);
        if (this.isEngagementIncreasing(context)) {
          await conversationStateManager.transitionState(
            conversationId,
            ConversationEvent.ENGAGEMENT_INCREASED,
            'system',
            { messageId: message.id, engagementScore: this.calculateEngagementScore(context) }
          );
        }

        // Check for qualification criteria
        if (this.meetsQualificationCriteria(message, context)) {
          await conversationStateManager.transitionState(
            conversationId,
            ConversationEvent.QUALIFICATION_CRITERIA_MET,
            'system',
            { messageId: message.id, qualificationReason: this.getQualificationReason(message) }
          );
        }
      }
    } catch (error) {
      console.error('Failed to handle message state updates:', error);
    }
  }

  /**
   * Check if engagement is increasing
   */
  private isEngagementIncreasing(context: ConversationContext): boolean {
    const recentMessages = context.messageHistory.slice(-5);
    const humanMessages = recentMessages.filter(m => m.isFromAI === 0);
    
    // Engagement increases if we have multiple human responses in recent messages
    return humanMessages.length >= 2;
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(context: ConversationContext): number {
    const totalMessages = context.messageHistory.length;
    const humanMessages = context.messageHistory.filter(m => m.isFromAI === 0).length;
    
    if (totalMessages === 0) return 0;
    
    const responseRate = humanMessages / totalMessages;
    return Math.round(responseRate * 100);
  }

  /**
   * Check if message meets qualification criteria
   */
  private meetsQualificationCriteria(message: ThreadedMessage, context: ConversationContext): boolean {
    const content = message.content.toLowerCase();
    const qualificationSignals = [
      'interested in buying',
      'want to purchase',
      'ready to buy',
      'when can i',
      'schedule appointment',
      'test drive',
      'financing options',
      'trade in value'
    ];

    return qualificationSignals.some(signal => content.includes(signal));
  }

  /**
   * Get qualification reason
   */
  private getQualificationReason(message: ThreadedMessage): string {
    const content = message.content.toLowerCase();
    
    if (content.includes('buy') || content.includes('purchase')) {
      return 'purchase_intent_expressed';
    }
    if (content.includes('appointment') || content.includes('schedule')) {
      return 'appointment_request';
    }
    if (content.includes('test drive')) {
      return 'test_drive_request';
    }
    if (content.includes('financing')) {
      return 'financing_inquiry';
    }
    
    return 'general_qualification_signals';
  }

  /**
   * Get conversation thread tree
   */
  async getConversationThreadTree(conversationId: string): Promise<any> {
    try {
      const context = await this.getConversationContext(conversationId);
      
      // Build thread tree structure
      const threadTree = this.buildThreadTree(context.messageHistory);
      
      return {
        conversationId,
        threadTree,
        totalMessages: context.messageHistory.length,
        lastActivity: context.lastEngagementAt,
        keyTopics: context.keyTopics,
        currentIntent: context.currentIntent
      };
    } catch (error) {
      console.error('Failed to get conversation thread tree:', error);
      return null;
    }
  }

  /**
   * Build thread tree from messages
   */
  private buildThreadTree(messages: ThreadedMessage[]): any {
    const messageMap = new Map();
    const rootMessages: any[] = [];

    // Create message nodes
    messages.forEach(message => {
      messageMap.set(message.id, {
        ...message,
        children: []
      });
    });

    // Build tree structure
    messages.forEach(message => {
      const messageNode = messageMap.get(message.id);
      
      if (message.parentMessageId) {
        const parentNode = messageMap.get(message.parentMessageId);
        if (parentNode) {
          parentNode.children.push(messageNode);
        } else {
          rootMessages.push(messageNode);
        }
      } else {
        rootMessages.push(messageNode);
      }
    });

    return rootMessages;
  }
}

export const messageThreadingService = new MessageThreadingService();