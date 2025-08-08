/**
 * Multi-tenant Agent Runtime - Scoped by clientId with memory integration
 * Handles AI reply generation with personality, memory recall, and guardrails
 */

import { storage } from '../storage';
import { aiAgentConfig as aiAgentConfigTable, leads as leadsTable } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import crypto from 'crypto';

type ModelId = 'openai/gpt-5-mini' | 'openai/gpt-4o' | 'anthropic/claude-3-5-sonnet' | string;

export interface AgentRuntimeReplyInput {
  clientId: string;
  message: string;
  leadId?: string;
  conversationId?: string;
  topic?: string; // optional hint (e.g. "pricing", "test drive", "service")
  model?: ModelId;
  maxTokens?: number;
}

export interface AgentRuntimeReply {
  reply: string;
  quickReplies?: string[];
  usedConfigId: string | null;
  memoryContextDocs?: Array<{ id: string; score: number; snippet: string }>;
}

interface ActiveAgentConfig {
  id: string;
  name: string;
  personality?: string;
  tonality: string;
  responseStyle: string;
  dosList: string[];
  dontsList: string[];
  industry?: string;
  model?: ModelId;
  systemPrompt?: string;
}

export class AgentRuntime {
  /**
   * Hash emails for memory partitioning without leaking PII
   */
  private static hashEmail(email?: string | null): string {
    if (!email) return 'unknown';
    return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').substring(0, 16);
  }

  /**
   * Load the active config for a client
   */
  static async getActiveConfig(clientId: string): Promise<ActiveAgentConfig | null> {
    try {
      const rows = await db
        .select()
        .from(aiAgentConfigTable)
        .where(and(eq(aiAgentConfigTable.clientId, clientId), eq(aiAgentConfigTable.isActive, true)))
        .limit(1);

      if (!rows?.[0]) return null;

      const r = rows[0] as any;
      return {
        id: r.id,
        name: r.name,
        personality: r.personality ?? undefined,
        tonality: r.tonality ?? 'professional',
        responseStyle: r.responseStyle ?? 'helpful',
        dosList: Array.isArray(r.dosList) ? r.dosList : [],
        dontsList: Array.isArray(r.dontsList) ? r.dontsList : [],
        industry: r.industry ?? 'automotive',
        model: r.model || 'openai/gpt-5-mini',
        systemPrompt: r.systemPrompt ?? undefined
      };
    } catch (error) {
      console.error('Error loading agent config:', error);
      return null;
    }
  }

  /**
   * Compose the system prompt from config with safe, minimal rules
   */
  static buildSystemPrompt(cfg: ActiveAgentConfig): string {
    // Use custom system prompt if provided, otherwise build from components
    if (cfg.systemPrompt?.trim()) {
      return cfg.systemPrompt.trim();
    }

    const dos = cfg.dosList?.length ? `\nDo:\n- ${cfg.dosList.join('\n- ')}` : '';
    const donts = cfg.dontsList?.length ? `\nDon't:\n- ${cfg.dontsList.join('\n- ')}` : '';

    return [
      `You are an AI assistant for an automotive dealership platform.`,
      `Personality: ${cfg.personality || 'professional'}.`,
      `Tonality: ${cfg.tonality}.`,
      `Response style: ${cfg.responseStyle}.`,
      `Goals: be concise, accurate, and helpful. Avoid over-promising or making up facts.`,
      `If scheduling or pricing is requested, propose next concrete step (book test drive, check inventory, connect sales).`,
      `Never claim human identity. Stay within dealership context.`,
      dos,
      donts
    ].join('\n');
  }

  /**
   * Retrieve scoped memory for this conversation/lead
   */
  static async recallMemory(opts: {
    clientId: string;
    leadId?: string;
    topic?: string;
  }): Promise<Array<{ id: string; score: number; snippet: string }>> {
    try {
      const { clientId, leadId, topic } = opts;

      // Pull lead for hashed email tag
      let lead: { email?: string | null } | null = null;
      if (leadId) {
        const rows = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
        lead = rows?.[0] || null;
      }

      const tags = [
        `client:${clientId}`,
        lead?.email ? `lead:${AgentRuntime.hashEmail(lead.email)}` : null
      ].filter(Boolean) as string[];

      // Try to use Supermemory if available
      const query = topic && topic.trim() ? topic : 'recent conversation context and similar successful replies';
      
      const { searchMemories } = await import('../integrations/supermemory');
      const results = await searchMemories({
        q: query,
        clientId: 'default', // TODO: Pass actual clientId
        limit: 5
      });

      return (results.results || []).map((r: any) => ({
        id: r.id || 'unknown',
        score: r.score || 0.7,
        snippet: r.content?.slice(0, 500) || ''
      }));
    } catch (error) {
      console.log('Memory recall not available, continuing without context');
    }

    return [];
  }

  /**
   * Generate a reply with optional quick replies
   */
  static async reply(input: AgentRuntimeReplyInput): Promise<AgentRuntimeReply> {
    const cfg = (await this.getActiveConfig(input.clientId)) || {
      id: 'fallback',
      name: 'default',
      tonality: 'professional',
      responseStyle: 'helpful',
      dosList: [],
      dontsList: [],
      personality: 'professional',
      industry: 'automotive',
      model: 'openai/gpt-5-mini' as ModelId
    };

    const system = this.buildSystemPrompt(cfg);

    const memoryDocs = await this.recallMemory({
      clientId: input.clientId,
      leadId: input.leadId,
      topic: input.topic
    });

    const memoryBlock = memoryDocs.length > 0
      ? `\nRelevant context:\n${memoryDocs
          .map(d => `- [${d.score.toFixed(2)}] ${d.snippet.replace(/\n+/g, ' ')}`)
          .join('\n')}`
      : '';

    const userPrompt = [
      `Lead message: "${input.message}"`,
      input.topic ? `Topic hint: ${input.topic}` : '',
      memoryBlock,
      `\nRespond naturally and helpfully. If appropriate, include one clear call-to-action.`,
      `Return JSON: {"reply": "...", "quickReplies": ["...","..."]}`
    ].filter(Boolean).join('\n');

    // Generate with OpenRouter API
    let reply = '';
    let quickReplies: string[] = [];

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'OneKeel Swarm - Agent Runtime'
        },
        body: JSON.stringify({
          model: input.model || cfg.model || 'openai/gpt-5-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: input.maxTokens ?? 700,
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        try {
          const parsed = JSON.parse(content);
          reply = parsed.reply || content;
          quickReplies = parsed.quickReplies?.slice(0, 4) || [];
        } catch {
          reply = content || 'Thanks for reaching out—how can I help?';
        }
      } else {
        reply = 'Thanks for the message—how can I help?';
      }
    } catch (error) {
      console.error('Agent runtime LLM error:', error);
      reply = 'Thanks for reaching out. How can I assist you today?';
    }

    // Write the AI reply to memory (best-effort)
    try {
      const supermemoryModule = await import('./supermemory');
      if ('memoryMapper' in supermemoryModule && supermemoryModule.memoryMapper) {
        const tags = [
          `client:${input.clientId}`,
          input.leadId ? `lead:${input.leadId}` : null
        ].filter(Boolean) as string[];

        const { MemoryMapper } = await import('../integrations/supermemory');
        await MemoryMapper.writeLeadMessage({
          type: 'lead_msg',
          clientId: input.clientId || 'default',
          campaignId: undefined,
          leadEmail: input.leadId,
          content: `[AI Reply] ${reply}`,
          meta: {
            ai_reply: true,
            conversationId: input.conversationId,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch {
      // Ignore memory write failures
    }

    return {
      reply: reply.trim() || 'Thanks for the message—how can I help?',
      quickReplies,
      usedConfigId: cfg.id,
      memoryContextDocs: memoryDocs
    };
  }

  /**
   * Create a default agent config for a client if none exists
   */
  static async ensureDefaultConfig(clientId: string): Promise<string> {
    try {
      // Check if active config exists
      const existing = await this.getActiveConfig(clientId);
      if (existing) return existing.id;

      // Create default config
      const defaultConfig = await db.insert(aiAgentConfigTable).values({
        clientId,
        name: 'Swarm Automotive Agent',
        personality: 'professional automotive sales assistant',
        tonality: 'professional',
        responseStyle: 'helpful',
        dosList: [
          'Be concise and specific',
          'Focus on automotive expertise', 
          'Provide clear next steps',
          'Use conversation history and lead context'
        ],
        dontsList: [
          'Make promises about pricing without confirmation',
          'Schedule appointments without verification',
          'Share personal information',
          'Claim to be human'
        ],
        industry: 'automotive',
        model: process.env.AGENT_MODEL || 'openai/gpt-5-mini',
        isActive: true,
        systemPrompt: `You are an automotive sales assistant. Be concise, honest, and specific. 
Use the conversation history, lead profile, and recent campaign context. 
Offer one clear next step (CTA). Avoid over-promising.`
      }).returning({ id: aiAgentConfigTable.id });

      return defaultConfig[0]?.id || 'default';
    } catch (error) {
      console.error('Error creating default agent config:', error);
      return 'default';
    }
  }
}