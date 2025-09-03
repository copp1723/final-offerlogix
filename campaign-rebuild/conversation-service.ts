/**
 * Conversation Service - Manage conversation state
 * Handles conversation creation, threading, and metrics
 */

import { db } from './db';
import { 
  conversations, 
  messages,
  Conversation,
  Message 
} from './schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

interface CreateConversationParams {
  agentId: string;
  leadId: string;
  campaignId?: string;
  threadId?: string;
  initialMessageId?: string;
}

export class ConversationService {
  /**
   * Find or create a conversation
   */
  async findOrCreateConversation(params: CreateConversationParams): Promise<Conversation> {
    const { agentId, leadId, campaignId, threadId, initialMessageId } = params;
    
    // Try to find existing conversation
    let existingConversation: Conversation[] = [];
    
    // First try by thread ID if provided
    if (threadId) {
      existingConversation = await db
        .select()
        .from(conversations)
        .where(eq(conversations.threadId, threadId))
        .limit(1);
    }
    
    // If not found, try by agent + lead + campaign combination
    if (existingConversation.length === 0) {
      const conditions = [
        eq(conversations.agentId, agentId),
        eq(conversations.leadId, leadId),
        eq(conversations.status, 'active')
      ];
      
      if (campaignId) {
        conditions.push(eq(conversations.campaignId, campaignId));
      }
      
      existingConversation = await db
        .select()
        .from(conversations)
        .where(and(...conditions))
        .limit(1);
    }
    
    if (existingConversation.length > 0) {
      return existingConversation[0];
    }
    
    // Create new conversation
    const newThreadId = threadId || this.generateThreadId();
    
    const newConversation = await db
      .insert(conversations)
      .values({
        agentId,
        leadId,
        campaignId,
        threadId: newThreadId,
        initialMessageId,
        status: 'active',
        messageCount: 0,
        aiMessageCount: 0,
      })
      .returning();
    
    return newConversation[0];
  }

  /**
   * Generate a unique thread ID
   */
  private generateThreadId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `thread-${timestamp}-${random}`;
  }

  /**
   * Get recent messages from a conversation
   */
  async getRecentMessages(
    conversationId: string, 
    limit: number = 10
  ): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  /**
   * Update conversation metrics after a new message
   */
  async updateConversationMetrics(conversationId: string): Promise<void> {
    // Get message counts
    const messageStats = await db
      .select({
        totalCount: sql<number>`COUNT(*)`,
        aiCount: sql<number>`COUNT(*) FILTER (WHERE sender_type = 'agent')`,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    
    const stats = messageStats[0] || { totalCount: 0, aiCount: 0 };
    
    // Update conversation
    await db
      .update(conversations)
      .set({
        messageCount: stats.totalCount,
        aiMessageCount: stats.aiCount,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const result = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get all messages in a conversation
   */
  async getAllMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  /**
   * Mark conversation as completed
   */
  async completeConversation(conversationId: string): Promise<void> {
    await db
      .update(conversations)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  }

  /**
   * Get active conversations for an agent
   */
  async getActiveConversations(agentId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.agentId, agentId),
        eq(conversations.status, 'active')
      ))
      .orderBy(desc(conversations.lastMessageAt));
  }

  /**
   * Get conversations needing handover
   */
  async getHandoverConversations(): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.status, 'handed_over'))
      .orderBy(desc(conversations.handedOverAt));
  }

  /**
   * Get conversation statistics for an agent
   */
  async getAgentStatistics(agentId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    handedOverConversations: number;
    averageMessagesPerConversation: number;
  }> {
    const stats = await db
      .select({
        totalConversations: sql<number>`COUNT(*)`,
        activeConversations: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
        handedOverConversations: sql<number>`COUNT(*) FILTER (WHERE status = 'handed_over')`,
        totalMessages: sql<number>`SUM(message_count)`,
      })
      .from(conversations)
      .where(eq(conversations.agentId, agentId));
    
    const result = stats[0] || {
      totalConversations: 0,
      activeConversations: 0,
      handedOverConversations: 0,
      totalMessages: 0,
    };
    
    return {
      totalConversations: result.totalConversations,
      activeConversations: result.activeConversations,
      handedOverConversations: result.handedOverConversations,
      averageMessagesPerConversation: result.totalConversations > 0 
        ? Math.round(result.totalMessages / result.totalConversations)
        : 0,
    };
  }
}
