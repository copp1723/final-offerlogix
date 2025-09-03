import { MailgunThreading } from '../email/MailgunThreading';
import type { EmailTransport, OutboundArgs, OutboundResult, InboundEmail, AgentIdentity } from '../email/types';
import { MailgunTransport } from '../email/MailgunTransport';
import { AgentCore, type LLMResponse, type ChatMessage } from '../agent/AgentCore';
import { dbV2, v2schema } from '../../db.js';
import { eq, desc, and, leftJoin } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { decideHandover, extractHandoverConfig, generateHandoverBrief, type HandoverDecisionInput, type HandoverBrief } from '../handover/handover-decision.js';
import { checkUrlTriggers, extractUrlTriggerConfig, formatUrlTriggers, logUrlTriggerEvent } from '../url-triggers/url-trigger-service.js';

export interface ConversationDeps {
  db: typeof dbV2;
  agentCore: AgentCore;
  mailer: MailgunThreading;
  loadAgent: (agentId: string) => Promise<{ 
    globalPrompt: string; 
    vars: Record<string, string>; 
    identity: AgentIdentity 
  }>;
  loadHistory: (conversationId: string, limit?: number) => Promise<ChatMessage[]>;
  logger?: (event: string, meta: Record<string, any>) => void;
}

export class ConversationEngine {
  constructor(private deps: ConversationDeps) {}
  
  // Minimal counters for ops observability
  private static metrics = {
    inbound_count: 0,
    outbound_count: 0,
    handover_count: 0,
    json_retry_count: 0,
    json_fallback_count: 0,
  };

  // Expose a simple manual send using DI mailer (for dev/manual routes)
  async sendManualEmail(args: OutboundArgs): Promise<OutboundResult> {
    return this.deps.mailer.sendEmail(args);
  }

  async processInbound(inbound: InboundEmail & { agentId: string; conversationId: string }) {
    this.logEvent('processInbound_start', {
      agentId: inbound.agentId,
      messageId: inbound.messageId,
      conversationId: inbound.conversationId,
      fromEmail: inbound.fromEmail,
      subject: inbound.subject
    });

    try {
      // Idempotency guard: check if messageId already exists
      const existingMessage = await this.deps.db
        .select({ id: v2schema.messages.id })
        .from(v2schema.messages)
        .where(eq(v2schema.messages.messageId, inbound.messageId))
        .limit(1);

      if (existingMessage.length > 0) {
        // Duplicate webhook retry - skip processing
        this.logEvent('inbound_duplicate', {
          conversationId: inbound.conversationId,
          messageId: inbound.messageId,
          agentId: inbound.agentId
        });
        return;
      }

      // Normalize References into a single space-delimited string or null
      const refsStr = Array.isArray(inbound.references) && inbound.references.length
        ? inbound.references.join(' ')
        : null;
      // 1) Store inbound message
      await this.deps.db.insert(v2schema.messages).values({
        conversationId: inbound.conversationId,
        content: inbound.text || inbound.html || '',
        sender: 'lead',
        messageId: inbound.messageId,
        inReplyTo: inbound.inReplyTo || null,
        references: refsStr,
      });

      this.logEvent('processInbound_message_storage_complete', {
        conversationId: inbound.conversationId,
        agentId: inbound.agentId,
        messageId: inbound.messageId
      });

      // Metrics: increment inbound counter
      ConversationEngine.metrics.inbound_count += 1;
      this.logEvent('metrics', { type: 'counter', name: 'inbound_count', value: ConversationEngine.metrics.inbound_count });

      this.logEvent('inbound_stored', {
        conversationId: inbound.conversationId,
        messageId: inbound.messageId,
        agentId: inbound.agentId
      });

      // 2) Check if conversation is handed over
      const [conversation] = await this.deps.db
        .select({ status: v2schema.conversations.status })
        .from(v2schema.conversations)
        .where(eq(v2schema.conversations.id, inbound.conversationId));

      this.logEvent('processInbound_conversation_lookup_complete', {
        conversationId: inbound.conversationId,
        messageId: inbound.messageId,
        agentId: inbound.agentId,
        status: conversation?.status || null
      });

      if (conversation?.status === 'handed_over') {
        // No auto-reply for handed over conversations
        this.logEvent('inbound_blocked_handover', {
          conversationId: inbound.conversationId,
          messageId: inbound.messageId,
          agentId: inbound.agentId
        });
        return;
      }

      // 3) Generate response
      this.logEvent('processInbound_ai_call_start', {
        conversationId: inbound.conversationId,
        agentId: inbound.agentId,
        messageId: inbound.messageId
      });

      await this.generateResponse(inbound.conversationId, { startAtMs: Date.now() });

      this.logEvent('processInbound_ai_call_complete', {
        conversationId: inbound.conversationId,
        agentId: inbound.agentId,
        messageId: inbound.messageId
      });

    } catch (error) {
      this.logEvent('processInbound_error', {
        conversationId: inbound.conversationId,
        messageId: inbound.messageId,
        agentId: inbound.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async generateResponse(conversationId: string, opts?: { startAtMs?: number }) {
    try {
      // Load conversation context; tolerate missing lead/campaign (left joins)
      const [conversationData] = await this.deps.db
        .select({
          agentId: v2schema.conversations.agentId,
          leadEmail: v2schema.conversations.leadEmail,
          subject: v2schema.conversations.subject,
          lastMessageId: v2schema.conversations.lastMessageId,
          status: v2schema.conversations.status,
          // Campaign handover configuration via lead (may be null)
          campaignId: v2schema.leads.campaignId,
          handoverTriggers: v2schema.campaigns.handoverTriggers,
          handoverRecipient: v2schema.campaigns.handoverRecipient,
          handoverRecipientName: v2schema.campaigns.handoverRecipientName,
          urlTriggers: v2schema.campaigns.urlTriggers,
        })
        .from(v2schema.conversations)
        .leftJoin(
          v2schema.leads,
          and(
            eq(v2schema.leads.agentId, v2schema.conversations.agentId),
            eq(v2schema.leads.email, v2schema.conversations.leadEmail)
          )
        )
        .leftJoin(v2schema.campaigns, eq(v2schema.campaigns.id, v2schema.leads.campaignId))
        .where(eq(v2schema.conversations.id, conversationId));

      if (!conversationData) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      this.logEvent('handover_config_loaded', {
        conversationId,
        triggers: conversationData.handoverTriggers,
        recipient: conversationData.handoverRecipient,
        recipientName: conversationData.handoverRecipientName
      });

      if (conversationData.status === 'handed_over') {
        return; // Skip generation for handed over conversations
      }

      // Load agent configuration
      const agent = await this.deps.loadAgent(conversationData.agentId);
      
      // Load conversation history (last 5 messages)
      const history = await this.deps.loadHistory(conversationId, 5);
      
      // Generate LLM response
      const response: LLMResponse = await this.deps.agentCore.generate({
        systemPrompt: agent.globalPrompt,
        history,
        variables: agent.vars
      });

      this.logEvent('llm_generated', {
        conversationId,
        agentId: conversationData.agentId,
        handover: response.handover
      });

      // Use configurable handover decision logic
      const lastUserMessage = history.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
      const handoverConfig = extractHandoverConfig(conversationData);

      const handoverDecision = decideHandover({
        config: handoverConfig,
        lastUserMessage,
        modelHandoverFlag: response.handover,
        modelHandoverReason: response.reason
      });

      this.logEvent('handover_decision', {
        conversationId,
        triggers: handoverConfig.triggers,
        recipient: handoverConfig.recipient,
        shouldHandover: handoverDecision.shouldHandover,
        triggeredBy: handoverDecision.triggeredBy,
        reason: handoverDecision.reason,
        modelWanted: response.handover,
        userMessage: lastUserMessage.slice(0, 100)
      });

      // Option A: Always send AI reply, add handoff note if needed (keep as plain text)
      let emailContent = response.reply;

      // Check for URL triggers and append relevant URLs
      const urlTriggerConfig = extractUrlTriggerConfig(conversationData);
      const urlMatches = checkUrlTriggers(urlTriggerConfig, lastUserMessage);
      if (urlMatches.length > 0) {
        const urlContent = formatUrlTriggers(urlMatches);
        emailContent += urlContent;

        // Log URL trigger events
        logUrlTriggerEvent(conversationId, urlMatches, (event: string, data: any) => {
          this.logEvent(event, data);
        });
      }

      if (handoverDecision.shouldHandover) {
        // Add handoff note to this final AI message
        // Use agent default handover line
        const handoverLine = agent.vars.handoverLine ||
          "I'm connecting you with one of our specialists who will be in touch shortly to provide personalized assistance.";
        emailContent += `\n\n${handoverLine}`;
      }

      // Store outbound message with pending status first (DB-first approach)
      // Generate Message-Id with the agent's domain (brand-aligned + unique)
      const msgDomain =
        agent.identity.domain ??
        process.env.MAILGUN_DOMAIN_DEFAULT ??
        "localhost";
      const messageId = `<${randomUUID()}@${msgDomain}>`;
      
      const [messageRow] = await this.deps.db.insert(v2schema.messages).values({
        conversationId,
        // Store plain text for UI readability
        content: emailContent,
        sender: 'agent',
        messageId: messageId,
        status: 'pending', // Will update to 'sent' on success
        isHandoverMessage: handoverDecision.shouldHandover
      }).returning({ id: v2schema.messages.id });

      try {
        // Build References chain from conversation history
        const references = await this.buildReferencesChain(conversationId);

        // Send outbound email using pre-generated messageId
        const outboundResult = await this.deps.mailer.sendEmail({
          agent: agent.identity,
          to: conversationData.leadEmail,
          subject: conversationData.subject,
          // Convert plain text to simple, safe HTML for email rendering
          html: this.formatReplyHtml(emailContent),
          inReplyTo: conversationData.lastMessageId || undefined,
          references,
          conversationId,
          messageId: messageId // Use pre-generated messageId
        });

        // Update message status to sent (messageId already set)
        await this.deps.db
          .update(v2schema.messages)
          .set({
            status: 'sent'
          })
          .where(eq(v2schema.messages.id, messageRow.id));

        // Metrics: increment outbound counter, optional timer
        ConversationEngine.metrics.outbound_count += 1;
        this.logEvent('metrics', { type: 'counter', name: 'outbound_count', value: ConversationEngine.metrics.outbound_count });
        if (opts?.startAtMs) {
          const ms = Date.now() - opts.startAtMs;
          this.logEvent('metrics', { type: 'timer', name: 'inbound_to_outbound_ms', value: ms, conversationId });
        }

        this.logEvent('outbound_sent', {
          conversationId,
          messageId: messageId,
          agentId: conversationData.agentId
        });

        // Update conversation based on handover decision
        if (handoverDecision.shouldHandover) {
          // Generate handover brief from conversation data
          const handoverBrief = generateHandoverBrief({
            conversationHistory: history,
            leadEmail: conversationData.leadEmail,
            campaignName: `Campaign ${conversationData.campaignId}`, // TODO: Get actual campaign name
            handoverReason: handoverDecision.reason,
            triggeredBy: handoverDecision.triggeredBy,
            lastUserMessage
          });

          this.logEvent('handover_brief_generated', {
            conversationId,
            briefSummary: handoverBrief.conversationSummary.slice(0, 100),
            urgencyLevel: handoverBrief.urgencyLevel,
            intents: handoverBrief.keyIntents,
            vehicleInfo: handoverBrief.vehicleInfo,
            leadName: handoverBrief.leadName
          });

          // Option A: After sending final AI message, set handed_over status
          await this.deps.db
            .update(v2schema.conversations)
            .set({
              status: 'handed_over',
              handoverReason: handoverDecision.reason,
              handoverAt: new Date(),
              lastMessageId: messageId,
              updatedAt: new Date(),
              // Store structured JSON directly in jsonb column
              handoverBrief: handoverBrief as any
            })
            .where(eq(v2schema.conversations.id, conversationId));

          // Metrics: increment handover counter
          ConversationEngine.metrics.handover_count += 1;
          this.logEvent('metrics', { type: 'counter', name: 'handover_count', value: ConversationEngine.metrics.handover_count });

          this.logEvent('handover_set', {
            conversationId,
            messageId: messageId,
            agentId: conversationData.agentId,
            reason: handoverDecision.reason
          });
        } else {
          // Update lastMessageId for continued threading
          await this.deps.db
            .update(v2schema.conversations)
            .set({
              lastMessageId: messageId,
              updatedAt: new Date()
            })
            .where(eq(v2schema.conversations.id, conversationId));
        }

      } catch (transportError) {
        // Update message status to failed
        await this.deps.db
          .update(v2schema.messages)
          .set({ status: 'failed' })
          .where(eq(v2schema.messages.id, messageRow.id));

        this.logEvent('outbound_failed', {
          conversationId,
          agentId: conversationData.agentId,
          error: transportError instanceof Error ? transportError.message : 'Transport error'
        });

        throw transportError;
      }

    } catch (error) {
      console.error('[ConversationEngine] generateResponse error:', error);
      throw error;
    }
  }

  /**
   * Convert a plain text reply into simple HTML with paragraphs and line breaks.
   * - Escapes HTML
   * - Preserves blank line paragraph breaks
   * - Converts single newlines to <br>
   * - Groups lines starting with dash/asterisk/bullet into lists
   * - Linkifies http(s) URLs and emails
   * If the content already looks like HTML, returns it unchanged.
   */
  private formatReplyHtml(text: string): string {
    if (!text) return '';
    const looksLikeHtml = /<\s*(p|br|ul|ol|li|div|span|strong|em|a)[\s>]/i.test(text) || /<[^>]+>/.test(text);
    if (looksLikeHtml) return text; // assume caller provided HTML

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const linkify = (s: string) => {
      // URLs
      s = s.replace(/\b(https?:\/\/[^\s<]+)\b/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
      // Emails
      s = s.replace(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi, '<a href="mailto:$1">$1</a>');
      return s;
    };

    // Normalize newlines and trim excessive blank lines
    let t = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    t = t.replace(/\n{3,}/g, '\n\n');

    // Split paragraphs on blank lines
    const paragraphs = t.split(/\n\n/);

    const htmlParts: string[] = [];
    for (const para of paragraphs) {
      const lines = para.split('\n');
      const isList = lines.every((l) => /^\s*(?:[-*•]\s+|\d+\.\s+)/.test(l));
      if (isList) {
        const items = lines
          .map((l) => l.replace(/^\s*(?:[-*•]\s+|\d+\.\s+)/, '').trim())
          .map((l) => `<li>${linkify(escapeHtml(l))}</li>`)
          .join('');
        htmlParts.push(`<ul>${items}</ul>`);
      } else {
        const escaped = escapeHtml(para).replace(/\n/g, '<br>');
        htmlParts.push(`<p>${linkify(escaped)}</p>`);
      }
    }

    // Basic, minimal wrapper for safe rendering in clients
    return `<!doctype html><html><body>${htmlParts.join('\n')}</body></html>`;
  }

  private async buildReferencesChain(conversationId: string): Promise<string[]> {
    const messages = await this.deps.db
      .select({ messageId: v2schema.messages.messageId })
      .from(v2schema.messages)
      .where(eq(v2schema.messages.conversationId, conversationId))
      .orderBy(desc(v2schema.messages.createdAt))
      .limit(10); // RFC 2822 suggests keeping References reasonable
    
    const refs = messages
      .map(m => m.messageId)
      .filter(Boolean)
      .reverse(); // Chronological order for References header
    
    return this.capReferences(refs);
  }

  private capReferences(refs: string[]): string[] {
    const MAX_BYTES = 900;
    const output: string[] = [];
    let bytes = 0;
    
    for (const ref of refs.slice(-10)) {
      const token = ref.includes('<') ? ref : `<${ref}>`;
      if (bytes + token.length > MAX_BYTES) break;
      output.push(token);
      bytes += token.length;
    }
    
    return output;
  }

  async getConversation(id: string) {
    const [conversation] = await this.deps.db
      .select({
        id: v2schema.conversations.id,
        status: v2schema.conversations.status,
        agentId: v2schema.conversations.agentId,
        leadEmail: v2schema.conversations.leadEmail,
        subject: v2schema.conversations.subject,
        lastMessageId: v2schema.conversations.lastMessageId,
        createdAt: v2schema.conversations.createdAt,
        updatedAt: v2schema.conversations.updatedAt
      })
      .from(v2schema.conversations)
      .where(eq(v2schema.conversations.id, id));

    return conversation || null;
  }

  private logEvent(event: string, data: Record<string, any>) {
    // Structured logs (minimal): event, conversationId, messageId, agentId
    const logData = {
      timestamp: new Date().toISOString(),
      event,
      conversationId: data.conversationId || null,
      messageId: data.messageId || null,
      agentId: data.agentId || null,
      ...data
    };

    // Prefer injected logger, else single-line JSON console
    if (this.deps.logger) {
      this.deps.logger(event, logData);
    } else {
      console.log(JSON.stringify(logData));
    }
  }

  // Static factory method for backward compatibility
  static async sendEmail(args: OutboundArgs, transport?: EmailTransport): Promise<OutboundResult> {
    const tx = transport ?? new MailgunTransport({
      domain: process.env.MAILGUN_DOMAIN || '',
      base: process.env.MAILGUN_BASE || 'https://api.mailgun.net/v3',
      key: process.env.MAILGUN_API_KEY || '',
    });
    const threading = new MailgunThreading(tx as any);
    return threading.sendEmail(args);
  }
}
