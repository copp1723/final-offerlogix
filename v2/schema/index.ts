/**
 * MailMind 2.0 - Simplified Database Schema
 * 
 * Core principle: Agent-first architecture with perfect email threading
 */

import { pgTable, text, uuid, timestamp, jsonb, boolean, integer, varchar, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// CORE TABLES
// ============================================================================

/**
 * System Prompts - Global prompts with variable injection points
 */
export const systemPrompts = pgTable('system_prompts_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(), // "Automotive Sales V1"
  prompt: text('prompt').notNull(), // "You are {{role}} at {{dealership}}..."
  version: integer('version').notNull().default(1),
  isGlobal: boolean('is_global').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Agents - The foundation of the system. Everything flows from agent config.
 */
export const agents = pgTable('agents_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: text('client_id').notNull(), // Multi-tenant isolation
  
  // Agent Identity
  name: text('name').notNull(), // "Riley Donovan"
  domain: varchar('domain', { length: 255 }).notNull(), // "kunesmacomb.kunesauto.vip"
  localPart: varchar('local_part', { length: 100 }).notNull(), // "riley" -> riley@domain
  
  // AI Configuration
  systemPromptId: uuid('system_prompt_id').references(() => systemPrompts.id).notNull(),
  variables: jsonb('variables').notNull(), // { role: "Sales Rep", dealership: "Kunes Macomb", handoverTriggers: "..." }
  
  // Settings
  isActive: boolean('is_active').notNull().default(true),
  conversationLimit: integer('conversation_limit'), // Optional: max messages per thread
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqAgentEmailPerClient: uniqueIndex('uq_agents_client_domain_local')
    .on(t.clientId, t.domain, t.localPart),
}));

/**
 * Campaigns - Simple email campaign definitions
 */
export const campaigns = pgTable('campaigns_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  
  // Campaign Info
  name: text('name').notNull(),
  template: text('template').notNull(), // Simple email template with {{variables}}
  subject: text('subject').notNull(),
  
  // Scheduling
  status: text('status').notNull().default('draft'), // 'draft' | 'active' | 'paused' | 'completed'
  sendWindow: jsonb('send_window'), // { days: 3, hoursBetween: 24, timezones: [...] }
  
  // Statistics  
  totalSent: integer('total_sent').notNull().default(0),
  totalResponses: integer('total_responses').notNull().default(0),
  totalHandovers: integer('total_handovers').notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Leads - Simple lead tracking per campaign
 */
export const leads = pgTable('leads_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Lead Info
  email: text('email').notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(), // Denormalized for quick lookups
  
  // Lead Status  
  status: text('status').notNull().default('active'), // 'active' | 'responded' | 'handed_over' | 'unsubscribed'
  lastActivityAt: timestamp('last_activity_at'),
  
  // Optional Lead Data (can be extended)
  firstName: text('first_name'),
  lastName: text('last_name'),
  metadata: jsonb('metadata'), // Flexible additional data
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqLeadPerCampaign: uniqueIndex('uq_leads_campaign_email').on(t.campaignId, t.email),
}));

/**
 * Conversations - Email thread tracking with perfect continuity
 */
export const conversations = pgTable('conversations_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Thread Identity
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  leadEmail: text('lead_email').notNull(),
  threadId: text('thread_id').notNull(), // Internal thread identifier
  
  // Email Threading
  lastMessageId: text('last_message_id'), // For In-Reply-To headers
  subject: text('subject').notNull(), // Email subject line
  
  // Conversation State
  status: text('status').notNull().default('active'), // 'active' | 'handed_over' | 'archived'
  messageCount: integer('message_count').notNull().default(0),
  
  // Handover Data
  handoverReason: text('handover_reason'), // Why was it handed over?
  handoverAt: timestamp('handover_at'), // When was handover triggered?
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqConversationPerAgentLead: uniqueIndex('uq_conversations_agent_lead').on(t.agentId, t.leadEmail),
  ixConversationLookup: index('ix_conversations_agent_lead').on(t.agentId, t.leadEmail),
}));

/**
 * Messages - Individual messages with perfect email threading data
 */
export const messages = pgTable('messages_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  
  // Message Content
  content: text('content').notNull(),
  sender: text('sender').notNull(), // 'agent' | 'lead'
  
  // Email Threading (Critical for continuity)
  messageId: varchar('message_id', { length: 255 }),
  inReplyTo: varchar('in_reply_to', { length: 255 }), // In-Reply-To header value
  references: text('references'), // References header chain
  status: text('status').notNull().default('pending'), // 'pending' | 'sent' | 'failed'
  providerMessageId: varchar('provider_message_id', { length: 255 }), // Mailgun Message-ID for webhook correlation
  
  // Message Metadata
  isHandoverMessage: boolean('is_handover_message').notNull().default(false),
  aiModel: text('ai_model'), // Which model generated this (if agent message)
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uqMessageId: uniqueIndex('uq_messages_message_id').on(t.messageId),
  ixMessagesByConversationTime: index('ix_messages_conversation_created').on(t.conversationId, t.createdAt),
}));

// ============================================================================
// RELATIONSHIPS
// ============================================================================

export const systemPromptsRelations = relations(systemPrompts, ({ many }) => ({
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  systemPrompt: one(systemPrompts, {
    fields: [agents.systemPromptId],
    references: [systemPrompts.id],
  }),
  campaigns: many(campaigns),
  conversations: many(conversations),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  agent: one(agents, {
    fields: [campaigns.agentId],
    references: [agents.id],
  }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [leads.campaignId], 
    references: [campaigns.id],
  }),
  agent: one(agents, {
    fields: [leads.agentId],
    references: [agents.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  agent: one(agents, {
    fields: [conversations.agentId],
    references: [agents.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type NewSystemPrompt = typeof systemPrompts.$inferInsert;

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;