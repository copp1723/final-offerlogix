/**
 * MailgunThreading - Deterministic Email Threading Core
 * 
 * Provides perfect email thread continuity with agent identity enforcement.
 * All Message-IDs are deterministic, all threading headers are managed.
 */

import { randomUUID } from 'crypto';
import crypto from 'crypto';
import { dbV2 as db } from '../../db.js';
import { 
  agents, 
  conversations, 
  messages, 
  type Agent,
  type Conversation,
  type NewConversation,
  type NewMessage 
} from '../../schema';
import { eq, and, sql } from 'drizzle-orm';
import type {
  AgentIdentity,
  OutboundArgs,
  OutboundResult,
  EmailTransport,
  EmailTransportPayload,
  ConversationLookup,
  ConversationResult,
  ThreadDiagnostic
} from './types';
import { ThreadingError } from './ThreadingError';
import { buildAgentEmailIdentity } from './identity';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_REFERENCES_COUNT = 10;
const MAX_REFERENCES_BYTES = 900; // RFC 2822 line limit safety margin
const DETERMINISTIC_SEED_LENGTH = 16;

// ============================================================================
// MAILGUN THREADING CORE
// ============================================================================

export class MailgunThreading {
  
  constructor(private transport: EmailTransport) {}

  // ==========================================================================
  // MESSAGE-ID GENERATION (DETERMINISTIC)
  // ==========================================================================

  /**
   * Compute deterministic Message-ID from database row ID seed
   * Format: <{hash16}@{domain}> where hash is derived from DB UUID
   */
  static computeMessageId(seed: string, domain: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(seed)
      .digest('hex')
      .substring(0, DETERMINISTIC_SEED_LENGTH);
    
    return `<${hash}@${domain}>`;
  }

  /**
   * Validate agent domain configuration
   */
  static validateAgentDomain(agent: AgentIdentity): void {
    if (!agent.domain || !agent.domain.includes('.')) {
      throw new ThreadingError(
        'Invalid agent domain', 
        'INVALID_AGENT',
        { domain: agent.domain, agentId: agent.id }
      );
    }

    if (!agent.localPart || !/^[a-zA-Z0-9._-]+$/.test(agent.localPart)) {
      throw new ThreadingError(
        'Invalid agent local part',
        'INVALID_AGENT', 
        { localPart: agent.localPart, agentId: agent.id }
      );
    }
  }

  // ==========================================================================
  // AGENT EMAIL ADDRESS FORMATTING
  // ==========================================================================

  /**
   * Get agent's consistent email address for From/Reply-To headers
   */
  static getAgentEmailAddress(agent: AgentIdentity): string {
    this.validateAgentDomain(agent);
    return `${agent.name} <${agent.localPart}@${agent.domain}>`;
  }

  /**
   * Get agent's email address only (without display name)
   */
  static getAgentEmailOnly(agent: AgentIdentity): string {
    this.validateAgentDomain(agent);
    return `${agent.localPart}@${agent.domain}`;
  }

  // ==========================================================================
  // THREADING HEADERS GENERATION
  // ==========================================================================

  /**
   * Cap References to last 10 items and ~900 bytes per RFC 2822
   */
  private static capReferences(refs: string[]): string {
    const last10 = refs.slice(-10);
    let out: string[] = [];
    let totalBytes = 0;
    
    for (const ref of last10) {
      const token = ref.includes('<') ? ref : `<${ref}>`;
      if (totalBytes + token.length > MAX_REFERENCES_BYTES) break;
      out.push(token);
      totalBytes += token.length;
    }
    
    return out.join(' ');
  }

  /**
   * Build References header chain with length management
   */
  static buildReferences(existingReferences: string[] = [], inReplyTo?: string): string[] {
    let references = [...existingReferences];
    
    // Add inReplyTo to references if not already present
    if (inReplyTo && !references.includes(inReplyTo)) {
      references.push(inReplyTo);
    }

    // Cap by count first
    if (references.length > MAX_REFERENCES_COUNT) {
      references = references.slice(-MAX_REFERENCES_COUNT);
    }

    // Cap by byte length (RFC 2822 compliance)
    let totalBytes = references.join(' ').length;
    while (totalBytes > MAX_REFERENCES_BYTES && references.length > 1) {
      references.shift(); // Remove oldest reference
      totalBytes = references.join(' ').length;
    }

    return references;
  }

  /**
   * Generate all threading headers for outbound email
   */
  static buildThreadingHeaders(
    messageId: string,
    inReplyTo?: string,
    references?: string[]
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Message-Id': messageId,
    };

    if (inReplyTo) {
      headers['In-Reply-To'] = inReplyTo;
    }

    const referencesChain = this.buildReferences(references, inReplyTo);
    if (referencesChain.length > 0) {
      headers['References'] = referencesChain.join(' ');
    }

    return headers;
  }

  // ==========================================================================
  // CONVERSATION MANAGEMENT
  // ==========================================================================

  /**
   * Get or create conversation with proper threading context
   */
  async getOrCreateConversation(
    lookup: ConversationLookup,
    subject?: string
  ): Promise<ConversationResult> {
    const normalizedEmail = lookup.leadEmail.toLowerCase().trim();
    
    try {
      // Transaction wrapper for conversation management
      return await db.transaction(async (tx) => {
        
        // First, try to find existing conversation
        const existingConversations = await tx
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.agentId, lookup.agentId),
            eq(conversations.leadEmail, normalizedEmail),
            eq(conversations.status, 'active') // Only active conversations
          ))
          .orderBy(conversations.updatedAt); // Most recent first

        let conversation: Conversation;
        let isNewConversation = false;

        if (existingConversations.length > 0) {
          // Use most recent active conversation
          conversation = existingConversations[0];
        } else {
          // Create new conversation
          const threadId = lookup.threadId || `thread-${randomUUID()}`;
          
          const newConversation: NewConversation = {
            agentId: lookup.agentId,
            leadEmail: normalizedEmail,
            threadId,
            subject: subject || 'Email Conversation',
            status: 'active',
            messageCount: 0,
          };

          [conversation] = await tx
            .insert(conversations)
            .values(newConversation)
            .returning();
          
          isNewConversation = true;
        }

        // Get last message ID for threading
        const lastMessages = await tx
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversation.id))
          .orderBy(messages.createdAt)
          .limit(1);

        return {
          conversationId: conversation.id,
          threadId: conversation.threadId,
          lastMessageId: lastMessages[0]?.messageId,
          isNewConversation,
        };
      });
      
    } catch (error) {
      throw new ThreadingError(
        'Failed to get or create conversation',
        'DB_ERROR',
        { lookup, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }


  // ==========================================================================
  // MAIN SEND EMAIL METHOD
  // ==========================================================================

  /**
   * Send email with perfect threading headers and database tracking
   * DB-first approach ensures Message-ID is idempotent on retries
   */
  async sendEmail(args: OutboundArgs): Promise<OutboundResult> {
    MailgunThreading.validateAgentDomain(args.agent);
    
    // Get or create conversation first
    const conversationResult = await this.getOrCreateConversation(
      {
        agentId: args.agent.id,
        leadEmail: args.to,
      },
      args.subject
    );

    // Use provided threading context or conversation's last message
    const inReplyTo = args.inReplyTo || conversationResult.lastMessageId;

    try {
      return await db.transaction(async (tx) => {
        // If messageId is pre-generated (from ConversationEngine), use it directly
        // Otherwise, insert message row first to get DB UUID for deterministic Message-ID
        let messageId: string;
        let messageRow: { id: string } | undefined;
        
        if (args.messageId) {
          // Use pre-generated messageId (ConversationEngine has already inserted the message)
          messageId = args.messageId;
        } else {
          // Legacy path: Insert message row first (get DB UUID for deterministic Message-ID)
          const [row] = await tx
            .insert(messages)
            .values({
              conversationId: conversationResult.conversationId,
              sender: 'agent',
              content: args.html,
              messageId: '', // Will be updated after successful send
              inReplyTo: inReplyTo || null,
            })
            .returning({ id: messages.id });
          
          messageRow = row;
          // Compute deterministic Message-ID from DB row ID
          messageId = MailgunThreading.computeMessageId(messageRow.id, args.agent.domain);
        }

        // 3) Build threading headers
        const headers: Record<string, string> = { 'Message-Id': messageId };
        if (inReplyTo) {
          headers['In-Reply-To'] = inReplyTo;
        }
        if (args.references?.length) {
          headers['References'] = MailgunThreading.capReferences(args.references);
        }

        // 4) Build agent identity - use agent's actual domain for From/Reply-To
        // Use agent's actual email address for proper multi-tenant branding
        const identity = buildAgentEmailIdentity({
          name: args.agent.name,
          local_part: args.agent.localPart,
          domain: args.agent.domain,
        });
        const fromHeader = identity.fromHeader; // e.g. "Riley Donovan <riley@kunesmacomb.kunesauto.vip>"

        // 5) Send via transport using agent's domain
        const transportResult = await this.transport.sendRaw({
          from: fromHeader,
          to: args.to,
          subject: args.subject,
          html: args.html,
          headers: {
            ...headers,
            'Reply-To': fromHeader, // Full name form for Reply-To
          },
          domain: args.agent.domain, // Use agent's domain for Mailgun API endpoint
        });

        // 6) Update message row with Message-ID and mark sent (legacy path only)
        if (!args.messageId && messageRow) {
          // Only update messageId if we generated it (legacy path)
          await tx
            .update(messages)
            .set({ messageId })
            .where(eq(messages.id, messageRow.id));
        }

        // 7) Update conversation's lastMessageId for next reply
        await tx
          .update(conversations)
          .set({
            lastMessageId: messageId,
            messageCount: sql`${conversations.messageCount} + 1`, // Increment count using SQL
            updatedAt: new Date()
          })
          .where(eq(conversations.id, conversationResult.conversationId));

        return {
          messageId,
          conversationId: conversationResult.conversationId,
        };
      });

    } catch (error) {
      // Transport health log: record non-OK Mailgun responses
      try {
        const status =
          (typeof (error as any)?.status === 'number' && (error as any).status) ||
          (typeof (error as any)?.statusCode === 'number' && (error as any).statusCode) ||
          (() => {
            if (error instanceof Error) {
              const match = error.message.match(/mailgun\s+(\d{3})/i);
              return match ? parseInt(match[1], 10) : undefined;
            }
            return undefined;
          })();

        // Emit one structured line for telemetry
        console.warn(
          JSON.stringify({
            event: 'mailgun_error',
            status,
            conversationId: conversationResult?.conversationId,
            agentId: args?.agent?.id,
            timestamp: new Date().toISOString(),
          })
        );
      } catch {}

      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new ThreadingError(
          'Duplicate Message-ID detected',
          'DUPLICATE_MESSAGE_ID',
          { conversationId: conversationResult.conversationId }
        );
      }
      
      throw new ThreadingError(
        'Failed to send email',
        'DB_ERROR',
        { 
          agent: args.agent.id,
          to: args.to,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  // ==========================================================================
  // DIAGNOSTICS
  // ==========================================================================

  /**
   * Analyze thread chain integrity for debugging
   */
  async diagnoseThreadChain(conversationId: string): Promise<ThreadDiagnostic> {
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    const messageIds = conversationMessages.map(m => m.messageId);
    const duplicateMessageIds = messageIds.filter(
      (id, index) => messageIds.indexOf(id) !== index
    );

    // Check chronology and threading
    const chronologyIssues: Array<{ messageId: string; issue: 'out_of_order' | 'missing_parent' }> = [];
    
    for (let i = 1; i < conversationMessages.length; i++) {
      const current = conversationMessages[i];
      const previous = conversationMessages[i - 1];
      
      // Check if In-Reply-To points to previous message
      if (current.inReplyTo && current.inReplyTo !== previous.messageId) {
        const referencedMessage = conversationMessages.find(m => m.messageId === current.inReplyTo);
        if (!referencedMessage) {
          chronologyIssues.push({
            messageId: current.messageId,
            issue: 'missing_parent'
          });
        }
      }
    }

    const chainIntegrity = duplicateMessageIds.length > 0 || chronologyIssues.length > 0 
      ? 'broken' 
      : conversationMessages.length > 1 
        ? 'complete' 
        : 'missing_links';

    return {
      conversationId,
      messageCount: conversationMessages.length,
      chainIntegrity,
      duplicateMessageIds,
      chronologyIssues,
      lastMessageId: conversationMessages[conversationMessages.length - 1]?.messageId,
    };
  }
}

// Re-export for test imports expecting this path
export { ThreadingError } from './ThreadingError';
