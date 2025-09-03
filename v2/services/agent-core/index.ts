/**
 * AgentCore - The Foundation Service
 * 
 * Handles agent configuration, system prompt rendering, and AI response generation.
 * Everything flows from agent configuration.
 */

import { db } from '../../../server/db';
import { agents, systemPrompts, type Agent, type SystemPrompt } from '../../schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface AIResponse {
  content: string;
  shouldHandover: boolean;
  handoverReason?: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface RenderedPrompt {
  systemPrompt: string;
  variables: Record<string, any>;
  agentId: string;
}

// ============================================================================
// AGENT MANAGEMENT
// ============================================================================

export class AgentCore {
  /**
   * Get active agent by ID with system prompt
   */
  static async getAgent(agentId: string): Promise<(Agent & { systemPrompt: SystemPrompt }) | null> {
    try {
      const result = await db
        .select()
        .from(agents)
        .innerJoin(systemPrompts, eq(agents.systemPromptId, systemPrompts.id))
        .where(and(
          eq(agents.id, agentId),
          eq(agents.isActive, true)
        ))
        .limit(1);

      if (!result[0]) return null;

      return {
        ...result[0].agents,
        systemPrompt: result[0].system_prompts,
      };
    } catch (error) {
      console.error('Failed to get agent:', error);
      return null;
    }
  }

  /**
   * Get agent by client ID and domain (for inbound email routing)
   */
  static async getAgentByDomain(clientId: string, domain: string): Promise<Agent | null> {
    try {
      const result = await db
        .select()
        .from(agents)
        .where(and(
          eq(agents.clientId, clientId),
          eq(agents.domain, domain),
          eq(agents.isActive, true)
        ))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Failed to get agent by domain:', error);
      return null;
    }
  }

  // ============================================================================
  // PROMPT RENDERING
  // ============================================================================

  /**
   * Render system prompt with agent variables
   */
  static renderSystemPrompt(
    systemPrompt: string, 
    variables: Record<string, any>
  ): string {
    let rendered = systemPrompt;

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Remove any remaining unmatched placeholders
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

    return rendered.trim();
  }

  /**
   * Get rendered prompt for agent
   */
  static async getRenderedPrompt(agentId: string): Promise<RenderedPrompt | null> {
    const agent = await this.getAgent(agentId);
    if (!agent) return null;

    const systemPrompt = this.renderSystemPrompt(
      agent.systemPrompt.prompt,
      agent.variables as Record<string, any>
    );

    return {
      systemPrompt,
      variables: agent.variables as Record<string, any>,
      agentId: agent.id,
    };
  }

  // ============================================================================
  // EMAIL ADDRESS GENERATION
  // ============================================================================

  /**
   * Get agent's email address for consistent threading
   */
  static getAgentEmailAddress(agent: Agent): string {
    return `${agent.name} <${agent.localPart}@${agent.domain}>`;
  }

  /**
   * Get agent's reply-to address (same as from for threading consistency)
   */
  static getAgentReplyTo(agent: Agent): string {
    return `${agent.localPart}@${agent.domain}`;
  }

  // ============================================================================
  // AI RESPONSE GENERATION
  // ============================================================================

  /**
   * Generate AI response using OpenRouter
   */
  static async generateResponse(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: string[] = [],
    model: string = 'openai/gpt-5-chat'
  ): Promise<AIResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Build conversation context
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (last 5 messages)
    const recentHistory = conversationHistory.slice(-5);
    for (let i = 0; i < recentHistory.length; i++) {
      messages.push({
        role: i % 2 === 0 ? 'assistant' : 'user',
        content: recentHistory[i]
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    const traceId = crypto.randomUUID();

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'MailMind 2.0 - AgentCore'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 300,
          temperature: 0.7,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('Empty response from AI model');
      }

      // Parse handover signals from AI response
      const { shouldHandover, handoverReason } = this.parseHandoverSignals(content);

      return {
        content,
        shouldHandover,
        handoverReason,
        model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
        },
      };

    } catch (error) {
      console.error(`AI response generation failed (trace: ${traceId}):`, error);
      throw error;
    }
  }

  // ============================================================================
  // HANDOVER LOGIC
  // ============================================================================

  /**
   * Parse handover signals from AI response content
   * 
   * Looks for patterns like:
   * - "Let me connect you with..."
   * - "I'll have our specialist reach out..."
   * - "[HANDOVER: pricing inquiry]"
   */
  static parseHandoverSignals(content: string): { shouldHandover: boolean; handoverReason?: string } {
    const handoverPatterns = [
      /let me connect you with/i,
      /i'll have (?:our|a) (?:specialist|team member|representative) reach out/i,
      /(?:i'll|let me) (?:get|have) someone who can help/i,
      /\[HANDOVER:?\s*([^\]]+)\]/i,
    ];

    for (const pattern of handoverPatterns) {
      const match = content.match(pattern);
      if (match) {
        return {
          shouldHandover: true,
          handoverReason: match[1] || 'Agent initiated handover',
        };
      }
    }

    return { shouldHandover: false };
  }

  // ============================================================================
  // AGENT CREATION (FOR TEAM DEVELOPMENT)
  // ============================================================================

  /**
   * Create a new agent (development helper)
   */
  static async createAgent(data: {
    clientId: string;
    name: string;
    domain: string;
    localPart: string;
    systemPromptId: string;
    variables: Record<string, any>;
  }): Promise<Agent> {
    const [agent] = await db.insert(agents).values(data).returning();
    return agent;
  }

  /**
   * Update agent configuration
   */
  static async updateAgent(
    agentId: string, 
    updates: Partial<Pick<Agent, 'name' | 'domain' | 'localPart' | 'variables' | 'isActive'>>
  ): Promise<Agent | null> {
    const [updated] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, agentId))
      .returning();

    return updated || null;
  }
}