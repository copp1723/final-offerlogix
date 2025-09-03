import type { Conversation, ConversationMessage, Lead } from '@shared/schema';
import { storage, type IStorage } from '../storage';
import { sendReliableCampaignEmail, type CampaignEmailData } from './reliable-email-service';
import logger from '../logging/logger';
import { getOpenAIClient } from './openai';
import { sanitizeAutomotiveReply } from './reply-sanitizer';
import { conversationStateManager as defaultStateManager } from './conversation-state/ConversationStateManager';

export type AIReplyGenerator = (
  conversation: Conversation,
  lead: Lead,
  history: ConversationMessage[],
  newMessage: ConversationMessage
) => Promise<string>;

interface ConversationHistoryManager {
  getRecentMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]>;
  addMessageToHistory(message: ConversationMessage, limit?: number): Promise<void>;
}

async function defaultGenerateReply(
  _conversation: Conversation,
  _lead: Lead,
  _history: ConversationMessage[],
  newMessage: ConversationMessage
): Promise<string> {
  try {
    // Minimal system prompt – no enhancers, no dealership/location content
    const systemPrompt = [
      'You write short, human email replies as a sales agent.',
      'Do NOT mention or imply physical location, distance, directions, addresses, or an invitation to visit.',
      'Avoid location talk entirely, even if the user hints at it — offer to check with a teammate instead.',
      'Keep to 1–3 sentences, under 80 words. Ask at most one clarifying question.',
      'Focus only on the user’s last message; be natural and specific.'
    ].join('\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'MailMind - Minimal Email Auto Response'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'openai/gpt-5-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: newMessage.content }
        ],
        max_tokens: 180,
        temperature: 0.6
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRouter API error', {
        status: response.status,
        statusText: response.statusText,
        error: new Error(errorText)
      });
      throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    return (aiResponse || '').trim();
  } catch (error) {
    logger.error('AI response generation error:', error);
    return '';
  }
}

function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function extractBrandFromContext(context: any): string | undefined {
  const text = (context.vehicleInterest || '').toLowerCase();
  const brands = ['honda', 'toyota', 'ford', 'chevrolet', 'jeep', 'gmc'];
  return brands.find(brand => text.includes(brand));
}



interface ConversationResponderOptions {
  storage?: IStorage;
  aiProvider?: AIReplyGenerator;
  emailSender?: (data: CampaignEmailData) => Promise<{ success: boolean }>;
  logger?: typeof logger;
  stateManager?: ConversationHistoryManager;
}

export class ConversationResponderService {
  private storage: IStorage;
  private aiProvider: AIReplyGenerator;
  private emailSender: (data: CampaignEmailData) => Promise<{ success: boolean }>;
  private log: typeof logger;
  private stateManager: ConversationHistoryManager;
  private poller?: NodeJS.Timeout;
  private lastChecked: Date = new Date(0); // start from epoch for first pass

  constructor(options: ConversationResponderOptions = {}) {
    this.storage = options.storage || storage;
    this.aiProvider = options.aiProvider || defaultGenerateReply;
    this.emailSender = options.emailSender || sendReliableCampaignEmail;
    this.log = options.logger || logger;
    this.stateManager = options.stateManager || defaultStateManager;
  }

  /** Optional polling mode */
  start(intervalMs = 1000) {
    if (this.poller) return;
    this.poller = setInterval(() => this.processNewLeadMessages(), intervalMs);
  }
  stop() {
    if (this.poller) clearInterval(this.poller);
    this.poller = undefined;
  }

  /** Process any new human messages since last check (used by polling mode) */
  async processNewLeadMessages() {
    const messages = await this.storage.getLeadMessagesSince(this.lastChecked);
    this.lastChecked = new Date();
    for (const msg of messages) {
      await this.respondToMessage(msg);
    }
  }

  /** Direct trigger after webhook: respond to the latest human message in this conversation */
  async handleNewLeadMessage(conversationId: string): Promise<void> {
    const convo = await this.storage.getConversation(conversationId);
    if (!convo?.leadId) return;
    const latest = await this.storage.getConversationMessages(conversationId, 1);
    const lastMsg = latest?.[0];
    if (!lastMsg || lastMsg.isFromAI) return;
    await this.respondToMessage(lastMsg);
  }

  private async respondToMessage(message: ConversationMessage) {
    if (message.isFromAI) return; // only respond to human messages
    try {
      const conversation = await this.storage.getConversation(message.conversationId || '');
      const lead = conversation?.leadId ? await this.storage.getLead(conversation.leadId) : null;
      if (!conversation || !lead || !lead.email) return;

      // Loop guard on this conversation
      const consecutive = await this.storage.getConsecutiveAiReplies(conversation.id);
      if (consecutive >= 3) {
        this.log.warn('AI loop guard triggered', { conversationId: conversation.id, leadId: lead.id });
        return;
      }

      await this.stateManager.addMessageToHistory(message, 5);

      // Pull a reasonable history window for context
      const history = await this.stateManager.getRecentMessages(conversation.id, 5);
      const rawReply = await this.aiProvider(conversation, lead, history, message);
      const reply = sanitizeAutomotiveReply(rawReply || '');
      if (!reply) return;

      // Use MessageThreadingService to create AI response with proper threading
      const { messageThreadingService } = await import('./conversation-state/MessageThreadingService.js');
      const aiMessage = await messageThreadingService.processMessage(
        conversation.id,
        'ai-agent',
        reply,
        'text',
        1
      );

      await this.stateManager.addMessageToHistory(aiMessage, 5);

      // Get agent config for proper sender name and domain
      let agentConfig: any = null;
      let senderName = process.env.DEFAULT_SENDER_NAME || 'OneKeel Swarm';
      let domainOverride: any = null;

      try {
        // Try to get campaign-specific agent first, then fall back to active config
        if (conversation.campaignId) {
          const campaign = await this.storage.getCampaign(conversation.campaignId);
          if ((campaign as any)?.agentConfigId) {
            agentConfig = await this.storage.getAiAgentConfig((campaign as any).agentConfigId);
          }
        }

        // Fall back to active agent config if no campaign-specific agent
        if (!agentConfig) {
          agentConfig = await this.storage.getActiveAiAgentConfig();
        }

        if (agentConfig) {
          // Determine sender display name from agent config (per-tenant/persona) or DEFAULT_SENDER_NAME
          // 1) fromName
          // 2) extract persona from systemPrompt: "You are <Name>"
          // 3) DEFAULT_SENDER_NAME / neutral
          const cfgFromName = (agentConfig as any).fromName?.trim();
          if (cfgFromName) {
            senderName = cfgFromName;
          } else if ((agentConfig as any).systemPrompt) {
            const sys = String((agentConfig as any).systemPrompt);
            const m = sys.match(/\bYou are\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\b/);
            if (m && m[1]) senderName = m[1].trim();
          }
          domainOverride = (agentConfig as any).agentEmailDomain;
        }
      } catch (error) {
        this.log.warn('Failed to get agent config for email sender', { error });
      }

      // Prepare threading headers for email reply
      const threadingHeaders: Record<string, string> = {};

      // Get the most recent lead message to reply to
      const leadMessages = await this.storage.getConversationMessages(conversation.id);
      const lastLeadMessage = leadMessages
        .filter(m => !m.isFromAI && m.providerMessageId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (lastLeadMessage?.providerMessageId) {
        // Use the providerMessageId (which contains the original email's Message-ID)
        const originalMessageId = lastLeadMessage.providerMessageId;

        // Ensure Message-ID is properly formatted with angle brackets
        const formattedMessageId = originalMessageId.startsWith('<') && originalMessageId.endsWith('>')
          ? originalMessageId
          : `<${originalMessageId}>`;

        // In-Reply-To should point at the latest lead message
        threadingHeaders['In-Reply-To'] = formattedMessageId;

        // Build a References chain using known providerMessageIds (inbound + prior outbound), oldest -> newest
        const allIds = leadMessages
          .filter(m => m.providerMessageId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map(m => {
            const id = m.providerMessageId as string;
            return id.startsWith('<') && id.endsWith('>') ? id : `<${id}>`;
          });
        threadingHeaders['References'] = allIds.length ? allIds.join(' ') : formattedMessageId;

        // Optional stable thread key to assist internal correlation
        threadingHeaders['X-Thread-ID'] = conversation.id;

        this.log.info('Setting threading headers for reply', {
          conversationId: conversation.id,
          originalMessageId: formattedMessageId,
          threadingHeaders
        });
      } else {
        this.log.warn('No providerMessageId found for threading', {
          conversationId: conversation.id,
          leadMessagesCount: leadMessages.filter(m => !m.isFromAI).length
        });
      }

      // Ensure subject stays aligned with the latest lead email subject for threading
      const lastSubject = lastLeadMessage?.emailHeaders?.['Subject'] || conversation.subject || 'Your inquiry';
      const replySubject = /^re:/i.test(lastSubject) ? lastSubject : `Re: ${lastSubject}`;

      this.log.info('🧵 Sending email with threading headers', {
        conversationId: conversation.id,
        threadingHeaders,
        subject: replySubject,
        to: lead.email
      });

      const effectiveDomain = domainOverride || process.env.MAILGUN_DOMAIN;
      const fromHeader = effectiveDomain ? `${senderName} <campaigns@${effectiveDomain}>` : undefined;

      this.log.info('✉️ Reply Send Params', {
        conversationId: conversation.id,
        to: lead.email,
        from: fromHeader,
        subject: replySubject,
        headers: threadingHeaders
      });

      await this.emailSender({
        to: lead.email,
        subject: replySubject,
        content: reply,
        campaignId: conversation.campaignId || undefined,
        leadId: lead.id,
        clientId: lead.clientId || undefined,
        isAutoResponse: true,
        domainOverride,
        // Mailbox lock: always reply from campaigns@ for thread continuity (use env domain if override missing)
        from: fromHeader,
        threadingHeaders,
        metadata: {
          conversationId: conversation.id,
          aiMessageId: aiMessage.id,
        },
      });
    } catch (error: unknown) {
      this.log.error('Failed to generate AI response', {
        conversationId: message.conversationId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

export const conversationResponderService = new ConversationResponderService();
