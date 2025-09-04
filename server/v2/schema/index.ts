/**
 * OfferLogix V2 Database Schema
 * 
 * Minimal, indexed schema for email conversations with agents.
 * No IMAP, no memory systems - Mailgun webhooks only.
 */

import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  jsonb, 
  boolean, 
  integer,
  varchar,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

export const systemPrompts = pgTable('system_prompts_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  prompt: text('prompt').notNull(),
  version: integer('version').notNull().default(1),
  isGlobal: boolean('is_global').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// AGENTS
// ============================================================================

export const agents = pgTable('agents_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Multi-tenant isolation
  clientId: varchar('client_id', { length: 255 }).notNull(),
  
  // Agent identity for email addressing
  name: varchar('name', { length: 255 }).notNull(), // "Riley Donovan"
  domain: varchar('domain', { length: 255 }).notNull(), // "kunesmacomb.kunesauto.vip"
  localPart: varchar('local_part', { length: 64 }).notNull(), // "riley"
  
  // AI configuration
  systemPromptId: uuid('system_prompt_id').references(() => systemPrompts.id).notNull(),
  
  // Variables for prompt injection: {role, dealership, handoverTriggers}
  variables: jsonb('variables').notNull().$type<{
    role: string;
    dealership: string;
    handoverTriggers: string;
    [key: string]: unknown;
  }>(),
  
  // Settings
  isActive: boolean('is_active').notNull().default(true),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Unique agent per client+domain combination
  uniqueClientDomain: unique().on(table.clientId, table.domain),
  
  // Indexes for lookups
  clientIdIdx: index('agents_v2_client_id_idx').on(table.clientId),
  domainIdx: index('agents_v2_domain_idx').on(table.domain),
  activeIdx: index('agents_v2_active_idx').on(table.isActive),
  
  // Email format validation
  emailFormatCheck: check('valid_local_part', 
    `local_part ~ '^[a-zA-Z0-9._-]+$' AND length(local_part) <= 64`
  ),
}));

// ============================================================================
// CAMPAIGNS  
// ============================================================================

export const campaigns = pgTable('campaigns_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),

  // Campaign definition
  name: varchar('name', { length: 255 }).notNull(),
  template: text('template').notNull(), // Email template with {{variables}}
  subject: varchar('subject', { length: 255 }).notNull(),
  // New: Multi-touch sequence configuration (array of steps)
  sequence: jsonb('sequence').$type<Array<{
    offsetDays: number; // when to send relative to day 0
    subject: string;
    template: string; // html or text supported
  }>>().default([]),

  // Campaign state
  status: varchar('status', { length: 50 }).notNull().default('draft'),

  // Scheduling configuration: {days: number, hoursBetween: number}
  sendWindow: jsonb('send_window').$type<{
    days: number;
    hoursBetween: number;
    timezone?: string;
  }>(),

  // Business-focused handover configuration
  handoverTriggers: jsonb('handover_triggers').$type<{
    pricingQuestions: boolean;
    testDriveDemo: boolean;
    tradeInValue: boolean;
    financing: boolean;
    vehicleAvailability: boolean;
    urgency: boolean;
    customTriggers: string[];
  }>().default({
    pricingQuestions: false,
    testDriveDemo: false,
    tradeInValue: false,
    financing: false,
    vehicleAvailability: false,
    urgency: false,
    customTriggers: []
  }),
  handoverRecipient: varchar('handover_recipient', { length: 255 }), // Email or team identifier
  handoverRecipientName: varchar('handover_recipient_name', { length: 100 }), // Display name for recipient

  // URL trigger configuration - automatically send URLs when customers ask about topics
  urlTriggers: jsonb('url_triggers').$type<{
    tradeInUrl?: { enabled: boolean; url: string; message: string };
    schedulerUrl?: { enabled: boolean; url: string; message: string };
    financingUrl?: { enabled: boolean; url: string; message: string };
    inventoryUrl?: { enabled: boolean; url: string; message: string };
    warrantyUrl?: { enabled: boolean; url: string; message: string };
    customUrls?: Array<{ trigger: string; url: string; message: string; enabled: boolean }>;
  }>().default({
    tradeInUrl: { enabled: false, url: '', message: '' },
    schedulerUrl: { enabled: false, url: '', message: '' },
    financingUrl: { enabled: false, url: '', message: '' },
    inventoryUrl: { enabled: false, url: '', message: '' },
    warrantyUrl: { enabled: false, url: '', message: '' },
    customUrls: []
  }),

  // Statistics
  totalSent: integer('total_sent').notNull().default(0),
  totalResponses: integer('total_responses').notNull().default(0),
  totalHandovers: integer('total_handovers').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Status validation
  statusCheck: check('valid_status',
    `status IN ('draft', 'active', 'paused', 'completed')`
  ),

  // Handover recipient validation (must be email format)
  handoverRecipientCheck: check('valid_handover_recipient',
    `handover_recipient IS NULL OR handover_recipient ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'`
  ),

  // Indexes
  agentIdIdx: index('campaigns_v2_agent_id_idx').on(table.agentId),
  statusIdx: index('campaigns_v2_status_idx').on(table.status),
}));

// ============================================================================
// LEADS
// ============================================================================

export const leads = pgTable('leads_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Lead identification
  email: varchar('email', { length: 320 }).notNull(), // Max email length per RFC
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  
  // Denormalized agent reference for fast lookups
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  
  // Lead state
  status: varchar('status', { length: 50 }).notNull().default('active'),
  lastActivityAt: timestamp('last_activity_at'),
  
  // Optional data
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  metadata: jsonb('metadata'),

  // Multi-touch sequence tracking
  sequenceIndex: integer('sequence_index').notNull().default(0), // next step to send
  initialSentAt: timestamp('initial_sent_at'), // timestamp of step 0 send
  nextSendAt: timestamp('next_send_at'), // when the next step should be sent

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Prevent duplicate leads per campaign
  uniqueCampaignEmail: unique().on(table.campaignId, table.email),
  
  // Status validation
  statusCheck: check('valid_lead_status',
    `status IN ('active', 'responded', 'handed_over', 'unsubscribed')`
  ),
  
  // Email format validation
  emailCheck: check('valid_email', 
    `email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`
  ),
  
  // Indexes for efficient lookups
  campaignEmailIdx: index('leads_v2_campaign_email_idx').on(table.campaignId, table.email),
  agentIdIdx: index('leads_v2_agent_id_idx').on(table.agentId),
  statusIdx: index('leads_v2_status_idx').on(table.status),
  nextSendIdx: index('leads_v2_next_send_idx').on(table.nextSendAt),
}));

// ============================================================================
// CONVERSATIONS
// ============================================================================

export const conversations = pgTable('conversations_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Conversation identity
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  leadEmail: varchar('lead_email', { length: 320 }).notNull(),
  
  // Email threading
  threadId: varchar('thread_id', { length: 255 }).notNull(), // Internal thread ID
  lastMessageId: varchar('last_message_id', { length: 255 }), // For In-Reply-To
  subject: varchar('subject', { length: 255 }).notNull(),
  
  // Conversation state
  status: varchar('status', { length: 50 }).notNull().default('active'),
  messageCount: integer('message_count').notNull().default(0),
  
  // Handover tracking
  handoverReason: text('handover_reason'),
  handoverAt: timestamp('handover_at'),
  handoverBrief: jsonb('handover_brief'), // Structured handover brief for humans
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Prevent duplicate conversations per agent+lead
  uniqueAgentLeadThread: unique().on(table.agentId, table.leadEmail, table.threadId),
  
  // Status validation
  statusCheck: check('valid_conversation_status',
    `status IN ('active', 'handed_over', 'archived')`
  ),
  
  // Critical index for inbound email routing
  routingIdx: index('conversations_v2_routing_idx').on(table.agentId, table.leadEmail),
  
  // Index for thread management
  threadIdx: index('conversations_v2_thread_idx').on(table.threadId),
  statusIdx: index('conversations_v2_status_idx').on(table.status),
}));

// ============================================================================
// MESSAGES
// ============================================================================

export const messages = pgTable('messages_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),

  // Message content
  content: text('content').notNull(),
  sender: varchar('sender', { length: 10 }).notNull(), // 'agent' | 'lead'

  // Email threading - critical for continuity
  messageId: varchar('message_id', { length: 255 }).notNull(), // Email Message-ID
  inReplyTo: varchar('in_reply_to', { length: 255 }), // In-Reply-To header
  references: text('references'), // References header chain
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'sent' | 'failed'

  // Message metadata
  isHandoverMessage: boolean('is_handover_message').notNull().default(false),
  aiModel: text('ai_model'), // Which model generated this (if agent message)

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Validation constraints
  senderCheck: check('valid_sender', `sender IN ('agent', 'lead')`),
  statusCheck: check('valid_status', `status IN ('pending', 'sent', 'failed')`),

  // Message-ID uniqueness for deduplication
  uniqueMessageId: unique().on(table.messageId),

  // Critical index for chronological message retrieval
  conversationTimeIdx: index('messages_v2_conversation_time_idx')
    .on(table.conversationId, table.createdAt),

  // Index for threading lookups
  messageIdIdx: index('messages_v2_message_id_idx').on(table.messageId),
  inReplyToIdx: index('messages_v2_in_reply_to_idx').on(table.inReplyTo),

  // Index for status lookups
  statusIdx: index('messages_v2_status_idx').on(table.status),
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
  leads: many(leads),
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

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalSent: true,
  totalResponses: true,
  totalHandovers: true,
}).extend({
  // Sequence validation (6-7 steps typical)
  sequence: z.array(z.object({
    offsetDays: z.number().min(0).max(60),
    subject: z.string().min(1).max(255),
    template: z.string().min(1),
  })).max(12).default([]).optional(),
  // Business-focused handover triggers
  handoverTriggers: z.object({
    pricingQuestions: z.boolean().default(false),
    testDriveDemo: z.boolean().default(false),
    tradeInValue: z.boolean().default(false),
    financing: z.boolean().default(false),
    vehicleAvailability: z.boolean().default(false),
    urgency: z.boolean().default(false),
    customTriggers: z.array(z.string().min(1).max(50)).max(10).default([]),
  }).optional(),

  // Handover recipient (required if any triggers are enabled)
  handoverRecipient: z.string().email().optional(),
  handoverRecipientName: z.string().max(100).optional(),

  // URL triggers - automatically send URLs when customers ask about topics
  urlTriggers: z.object({
    tradeInUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().url().optional().or(z.literal('')),
      message: z.string().max(200).optional().default(''),
    }).optional(),
    schedulerUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().url().optional().or(z.literal('')),
      message: z.string().max(200).optional().default(''),
    }).optional(),
    financingUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().url().optional().or(z.literal('')),
      message: z.string().max(200).optional().default(''),
    }).optional(),
    inventoryUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().url().optional().or(z.literal('')),
      message: z.string().max(200).optional().default(''),
    }).optional(),
    warrantyUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().url().optional().or(z.literal('')),
      message: z.string().max(200).optional().default(''),
    }).optional(),
    customUrls: z.array(z.object({
      trigger: z.string().min(1).max(50),
      url: z.string().url(),
      message: z.string().max(200).default(''),
      enabled: z.boolean().default(true),
    })).max(10).default([]),
  }).optional(),

  // Send window validation
  sendWindow: z.object({
    days: z.number().min(1).max(365),
    hoursBetween: z.number().min(1).max(168), // Max 1 week
    timezone: z.string().optional(),
  }).optional(),
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
