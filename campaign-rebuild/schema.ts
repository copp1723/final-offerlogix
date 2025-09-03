/**
 * Simplified Campaign Schema - Drizzle ORM
 * Clean, focused schema for reliable AI-powered email campaigns
 */

import { sql } from "drizzle-orm";
import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  boolean, 
  timestamp, 
  integer,
  decimal,
  jsonb,
  unique,
  index
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// AGENTS - AI agent configurations
// ============================================
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic Info
  name: varchar("name", { length: 255 }).notNull(),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  
  // Email Configuration (CRITICAL)
  subdomain: varchar("subdomain", { length: 255 }).notNull().unique(),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  senderEmail: varchar("sender_email", { length: 255 }).notNull().unique(),
  
  // Agent Personality  
  role: varchar("role", { length: 255 }),
  goal: text("goal"),
  
  // System Prompt Configuration
  systemPrompt: text("system_prompt").notNull(),
  promptVariables: jsonb("prompt_variables").default(sql`'{}'::jsonb`),
  
  // Handover Configuration
  handoverTriggers: text("handover_triggers").array(),
  maxMessages: integer("max_messages").default(8),
  confidenceThreshold: decimal("confidence_threshold", { precision: 3, scale: 2 }).default("0.70"),
  handoverEmail: varchar("handover_email", { length: 255 }),
  
  // Status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// ============================================
// CAMPAIGNS - Email campaigns
// ============================================
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  
  // Campaign Info
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  initialMessage: text("initial_message").notNull(),
  
  // Status
  status: varchar("status", { length: 50 }).default("draft"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// ============================================
// LEADS - Campaign recipients
// ============================================
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Contact Info
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  
  // Custom Fields
  customFields: jsonb("custom_fields").default(sql`'{}'::jsonb`),
  
  // Status
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// ============================================
// CONVERSATIONS - Email threads
// ============================================
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  leadId: uuid("lead_id").references(() => leads.id).notNull(),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  
  // Threading Info (CRITICAL)
  threadId: varchar("thread_id", { length: 255 }).notNull().unique(),
  initialMessageId: varchar("initial_message_id", { length: 500 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("active"),
  handedOverAt: timestamp("handed_over_at"),
  handoverReason: text("handover_reason"),
  
  // Metrics
  messageCount: integer("message_count").default(0),
  aiMessageCount: integer("ai_message_count").default(0),
  lastMessageAt: timestamp("last_message_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  uniqueConversation: unique().on(table.agentId, table.leadId, table.campaignId)
}));

// ============================================
// MESSAGES - Individual emails
// ============================================
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  
  // Message Info
  direction: varchar("direction", { length: 20 }).notNull(),
  senderType: varchar("sender_type", { length: 20 }).notNull(),
  
  // Email Headers (CRITICAL for threading)
  messageId: varchar("message_id", { length: 500 }).unique(),
  inReplyTo: varchar("in_reply_to", { length: 500 }),
  references: text("references"),
  
  // Content
  subject: varchar("subject", { length: 500 }),
  content: text("content").notNull(),
  
  // AI Metadata
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  aiModel: varchar("ai_model", { length: 100 }),
  
  // Delivery Status
  status: varchar("status", { length: 50 }).default("sent"),
  deliveredAt: timestamp("delivered_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`)
});

// ============================================
// HANDOVERS - Human intervention tracking
// ============================================
export const handovers = pgTable("handovers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  
  // Trigger Info
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerDetail: text("trigger_detail"),
  
  // Assignment
  status: varchar("status", { length: 50 }).default("pending"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  assignedAt: timestamp("assigned_at"),
  resolvedAt: timestamp("resolved_at"),
  
  // Context
  conversationSummary: text("conversation_summary"),
  suggestedResponse: text("suggested_response"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// ============================================
// SYSTEM_PROMPTS - Reusable templates
// ============================================
export const systemPrompts = pgTable("system_prompts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  template: text("template").notNull(),
  availablePlaceholders: text("available_placeholders").array(),
  isDefault: boolean("is_default").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// ============================================
// WEBHOOK_EVENTS - Deduplication tracking
// ============================================
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerMessageId: varchar("provider_message_id", { length: 500 }).unique(),
  rawPayload: jsonb("raw_payload"),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`)
});

// ============================================
// INDEXES
// ============================================
export const conversationsAgentIdx = index("idx_conversations_agent_id").on(conversations.agentId);
export const conversationsLeadIdx = index("idx_conversations_lead_id").on(conversations.leadId);
export const conversationsThreadIdx = index("idx_conversations_thread_id").on(conversations.threadId);
export const conversationsStatusIdx = index("idx_conversations_status").on(conversations.status);

export const messagesConversationIdx = index("idx_messages_conversation_id").on(messages.conversationId);
export const messagesMessageIdIdx = index("idx_messages_message_id").on(messages.messageId);
export const messagesCreatedAtIdx = index("idx_messages_created_at").on(messages.createdAt);

export const handoversConversationIdx = index("idx_handovers_conversation_id").on(handovers.conversationId);
export const handoversStatusIdx = index("idx_handovers_status").on(handovers.status);

export const webhookEventsProviderMessageIdx = index("idx_webhook_events_provider_message_id").on(webhookEvents.providerMessageId);
export const webhookEventsProcessedIdx = index("idx_webhook_events_processed").on(webhookEvents.processed);

// ============================================
// ZOD SCHEMAS
// ============================================
export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  subdomain: z.string()
    .min(2, "Subdomain must be at least 2 characters")
    .max(50, "Subdomain must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens"),
  senderEmail: z.string().email("Invalid email address"),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  handoverTriggers: z.array(z.string()).optional(),
  promptVariables: z.record(z.string()).optional()
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  email: z.string().email("Invalid email address"),
  customFields: z.record(z.any()).optional()
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
}).extend({
  direction: z.enum(["inbound", "outbound"]),
  senderType: z.enum(["agent", "lead", "human"])
});

export const insertHandoverSchema = createInsertSchema(handovers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  triggerType: z.enum(["keyword", "max_messages", "low_confidence", "manual"])
});

// ============================================
// TYPE EXPORTS
// ============================================
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Handover = typeof handovers.$inferSelect;
export type InsertHandover = z.infer<typeof insertHandoverSchema>;
export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
