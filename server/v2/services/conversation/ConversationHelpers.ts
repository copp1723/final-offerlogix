/**
 * ConversationEngine Helper Functions
 * 
 * Database loading utilities for agent configuration and conversation history.
 */

import { dbV2, v2schema } from '../../db.js';
import { eq, desc } from 'drizzle-orm';
import type { AgentIdentity } from '../email/types';
import type { ChatMessage } from '../agent/AgentCore';

export async function loadAgent(agentId: string): Promise<{ 
  globalPrompt: string; 
  vars: Record<string, string>; 
  identity: AgentIdentity 
}> {
  const [result] = await dbV2
    .select({
      // Agent identity
      id: v2schema.agents.id,
      name: v2schema.agents.name,
      domain: v2schema.agents.domain,
      localPart: v2schema.agents.localPart,
      variables: v2schema.agents.variables,
      // System prompt
      prompt: v2schema.systemPrompts.prompt
    })
    .from(v2schema.agents)
    .innerJoin(v2schema.systemPrompts, eq(v2schema.agents.systemPromptId, v2schema.systemPrompts.id))
    .where(eq(v2schema.agents.id, agentId));

  if (!result) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  return {
    globalPrompt: result.prompt,
    vars: result.variables as Record<string, string>,
    identity: {
      id: result.id,
      name: result.name,
      domain: result.domain,
      localPart: result.localPart
    }
  };
}

export async function loadHistory(conversationId: string, limit = 5): Promise<ChatMessage[]> {
  const messages = await dbV2
    .select({
      sender: v2schema.messages.sender,
      content: v2schema.messages.content,
      createdAt: v2schema.messages.createdAt
    })
    .from(v2schema.messages)
    .where(eq(v2schema.messages.conversationId, conversationId))
    .orderBy(desc(v2schema.messages.createdAt))
    .limit(limit);

  // Convert to ChatMessage format and reverse to get chronological order
  return messages
    .reverse()
    .map(msg => ({
      role: msg.sender === 'lead' ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));
}