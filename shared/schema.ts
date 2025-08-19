import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Clients table for multi-tenant OfferLogix platform
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).unique(),
  brandingConfig: jsonb("branding_config").default(sql`'{}'::jsonb`).notNull(),
  settings: jsonb("settings").default(sql`'{}'::jsonb`).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // admin, manager, user
  email: text("email"),
  notificationPreferences: jsonb("notification_preferences").default(sql`'{
    "emailNotifications": true,
    "campaignAlerts": true,
    "leadAlerts": true,
    "systemAlerts": true,
    "monthlyReports": true,
    "highEngagementAlerts": true,
    "quotaWarnings": true
  }'::jsonb`).notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  leadId: varchar("lead_id").references(() => leads.id),
  userId: varchar("user_id").references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("active"), // active, closed, archived
  priority: text("priority").notNull().default("normal"), // high, normal, low
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  senderId: varchar("sender_id"),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, system, email_template
  isFromAI: integer("is_from_ai").notNull().default(0), // 0 = human, 1 = AI
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  context: text("context").notNull(),
  handoverGoals: text("handover_goals"),
  targetAudience: text("target_audience"), // Campaign target audience
  handoverPrompt: text("handover_prompt"), // AI prompt for custom handover evaluation
  handoverPromptSpec: jsonb("handover_prompt_spec"), // Structured JSON spec (signal categories, thresholds)
  status: text("status").notNull().default("draft"), // draft, active, scheduled, completed
  templates: jsonb("templates"), // AI-generated email templates
  subjectLines: jsonb("subject_lines"), // AI-generated subject lines
  numberOfTemplates: integer("number_of_templates").default(5),
  daysBetweenMessages: integer("days_between_messages").default(3),
  openRate: integer("open_rate"), // percentage
  isTemplate: boolean("is_template").default(false), // Mark as reusable template
  originalCampaignId: varchar("original_campaign_id"), // Reference to source campaign when cloned

  // Communication Settings
  communicationType: varchar("communication_type", { length: 20 }).default("email"), // "email", "email_sms", "sms"
  smsOptInRequired: boolean("sms_opt_in_required").default(true),
  smsOptInMessage: text("sms_opt_in_message").default("Would you like to continue this conversation via text? Reply YES to receive SMS updates."),

  // Scheduling Settings
  scheduleType: varchar("schedule_type", { length: 20 }).default("immediate"), // "immediate", "scheduled", "recurring"
  scheduledStart: timestamp("scheduled_start"),
  recurringPattern: varchar("recurring_pattern", { length: 50 }), // "daily", "weekly", "monthly"
  recurringDays: jsonb("recurring_days"), // [1,2,3,4,5] for weekdays
  recurringTime: varchar("recurring_time", { length: 8 }), // "09:00:00"
  isActive: boolean("is_active").default(true),
  nextExecution: timestamp("next_execution"),

  // Agent selection (optional)
  agentConfigId: varchar("agent_config_id").references(() => aiAgentConfig.id),
  
  // AI Persona assignment for multi-persona campaigns
  personaId: uuid("persona_id").references(() => aiPersonas.id),

  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Agent Configuration table
export const aiAgentConfig = pgTable("ai_agent_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // Configuration name/profile
  tonality: text("tonality").notNull().default("professional"), // professional, friendly, casual, enthusiastic
  personality: text("personality"), // Description of agent personality
  dosList: jsonb("dos_list").default([]).notNull(), // Array of do's
  dontsList: jsonb("donts_list").default([]).notNull(), // Array of don'ts
  industry: varchar("industry").default("automotive"), // Industry specialization
  responseStyle: text("response_style").default("helpful"), // helpful, consultative, direct
  model: text("model").default("openai/gpt-5-chat"), // Default model updated to GPT-5 Chat
  systemPrompt: text("system_prompt"), // Custom system prompt override
  // Agent outbound email Mailgun subdomain override (e.g., mg.dealership.com)
  agentEmailDomain: varchar("agent_email_domain"),
  isActive: boolean("is_active").default(false).notNull(), // Whether this config is currently active
  clientId: uuid("client_id").references(() => clients.id), // Multi-tenant scoping
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Leads table for automotive campaign management
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  vehicleInterest: varchar("vehicle_interest"), // Vehicle model/type they're interested in
  leadSource: varchar("lead_source"), // Website, showroom, referral, etc.
  status: varchar("status").default("new"), // new, contacted, qualified, converted, lost
  tags: varchar("tags").array(), // For categorization
  notes: text("notes"),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  email: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  name: true,
  context: true,
  handoverGoals: true,
  targetAudience: true,      // Added
  handoverPrompt: true,      // Added
  handoverPromptSpec: true,
  status: true,
  templates: true,
  subjectLines: true,
  numberOfTemplates: true,   // Standardized on this field
  daysBetweenMessages: true,
  openRate: true,
  isTemplate: true,
  originalCampaignId: true,
  agentConfigId: true,
  personaId: true,           // Added for multi-persona support
});

export const insertAiAgentConfigSchema = createInsertSchema(aiAgentConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  campaignId: true,
  leadId: true,
  userId: true,
  subject: true,
  status: true,
  priority: true,
});

export const insertConversationMessageSchema = createInsertSchema(conversationMessages).pick({
  conversationId: true,
  senderId: true,
  content: true,
  messageType: true,
  isFromAI: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Client types and schemas
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertAiAgentConfig = z.infer<typeof insertAiAgentConfigSchema>;
export type AiAgentConfig = typeof aiAgentConfig.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;

// Knowledge Base tables - using existing structure with Supermemory integration
export const knowledgeBases = pgTable("knowledge_bases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  version: integer("version").default(1),
  status: varchar("status", { length: 50 }).default("active"),
  indexStatus: varchar("index_status", { length: 50 }).default("pending"),
  documentCount: integer("document_count").default(0),
  totalChunks: integer("total_chunks").default(0),
  lastIndexedAt: timestamp("last_indexed_at"),
  settings: jsonb("settings").default(sql`'{}'::jsonb`).notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kbDocuments = pgTable("kb_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kbId: uuid("kb_id").references(() => knowledgeBases.id).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  sourceUri: text("source_uri"),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  rawContent: text("raw_content"),
  processedContent: text("processed_content"),
  chunkCount: integer("chunk_count").default(0),
  processingStatus: varchar("processing_status", { length: 50 }).default("pending"),
  processingError: text("processing_error"),
  version: integer("version").default(1),
  fileSizeBytes: integer("file_size_bytes"),
  
  // Supermemory integration fields
  supermemoryId: varchar("supermemory_id"),
  supermemoryStatus: varchar("supermemory_status", { length: 20 }),
  containerTags: varchar("container_tags").array().default(sql`'{}'`),
  
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const kbDocumentChunks = pgTable("kb_document_chunks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").references(() => kbDocuments.id).notNull(),
  kbId: uuid("kb_id").references(() => knowledgeBases.id).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  tokenCount: integer("token_count"),
  supermemoryId: varchar("supermemory_id", { length: 255 }),
  embeddingStatus: varchar("embedding_status", { length: 50 }).default("pending"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table for campaigns to knowledge bases  
export const campaignKnowledgeBases = pgTable("campaign_knowledge_bases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  knowledgeBaseId: uuid("knowledge_base_id").references(() => knowledgeBases.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema validation
export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKbDocumentSchema = createInsertSchema(kbDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  processedAt: true,
});

export const insertKbDocumentChunkSchema = createInsertSchema(kbDocumentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertCampaignKnowledgeBaseSchema = createInsertSchema(campaignKnowledgeBases).omit({
  id: true,
  createdAt: true,
});

// AI Personas table for multi-persona agent system
export const aiPersonas = pgTable("ai_personas", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetAudience: varchar("target_audience", { length: 255 }), // dealers, vendors, customers, etc.
  industry: varchar("industry", { length: 100 }).default("automotive"),
  
  // Persona personality and behavior
  tonality: text("tonality").notNull().default("professional"), // professional, friendly, technical, consultative
  personality: text("personality"), // Detailed personality description
  communicationStyle: text("communication_style").default("helpful"), // helpful, consultative, direct, technical
  
  // AI configuration
  model: text("model").default("openai/gpt-4o"), // AI model to use
  temperature: integer("temperature").default(70), // Temperature * 100 (0.7 = 70)
  maxTokens: integer("max_tokens").default(300),
  
  // Persona-specific prompts
  systemPrompt: text("system_prompt"), // Base system prompt for this persona
  responseGuidelines: jsonb("response_guidelines").default(sql`'[]'::jsonb`).notNull(), // Array of response guidelines
  escalationCriteria: jsonb("escalation_criteria").default(sql`'[]'::jsonb`).notNull(), // When to escalate conversations
  
  // Communication preferences
  preferredChannels: jsonb("preferred_channels").default(sql`'["email"]'::jsonb`).notNull(), // email, sms, phone
  handoverSettings: jsonb("handover_settings").default(sql`'{}'::jsonb`).notNull(), // Persona-specific handover config
  
  // Knowledge base associations
  knowledgeBaseAccessLevel: varchar("kb_access_level", { length: 50 }).default("campaign_only"), // "campaign_only", "client_all", "persona_filtered"
  
  // Status and settings
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  priority: integer("priority").default(100), // Higher number = higher priority
  
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction table for personas to knowledge bases (persona-specific KB filtering)
export const personaKnowledgeBases = pgTable("persona_knowledge_bases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personaId: uuid("persona_id").references(() => aiPersonas.id).notNull(),
  knowledgeBaseId: uuid("knowledge_base_id").references(() => knowledgeBases.id).notNull(),
  accessLevel: varchar("access_level", { length: 50 }).default("read"), // read, write, admin
  priority: integer("priority").default(100), // Priority for this KB for this persona
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Update KB documents to support persona tagging
export const kbDocumentPersonaTags = pgTable("kb_document_persona_tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").references(() => kbDocuments.id).notNull(),
  personaId: uuid("persona_id").references(() => aiPersonas.id).notNull(),
  relevanceScore: integer("relevance_score").default(100), // 0-100 relevance for this persona
  tags: varchar("tags").array().default(sql`'{}'`), // Additional tags for this persona-document association
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema validation for AI personas
export const insertAiPersonaSchema = createInsertSchema(aiPersonas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPersonaKnowledgeBaseSchema = createInsertSchema(personaKnowledgeBases).omit({
  id: true,
  createdAt: true,
});

export const insertKbDocumentPersonaTagSchema = createInsertSchema(kbDocumentPersonaTags).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type InsertKbDocument = z.infer<typeof insertKbDocumentSchema>;
export type KbDocument = typeof kbDocuments.$inferSelect;
export type InsertKbDocumentChunk = z.infer<typeof insertKbDocumentChunkSchema>;
export type KbDocumentChunk = typeof kbDocumentChunks.$inferSelect;
export type InsertCampaignKnowledgeBase = z.infer<typeof insertCampaignKnowledgeBaseSchema>;
export type CampaignKnowledgeBase = typeof campaignKnowledgeBases.$inferSelect;
export type InsertAiPersona = z.infer<typeof insertAiPersonaSchema>;
export type AiPersona = typeof aiPersonas.$inferSelect;
export type InsertPersonaKnowledgeBase = z.infer<typeof insertPersonaKnowledgeBaseSchema>;
export type PersonaKnowledgeBase = typeof personaKnowledgeBases.$inferSelect;
export type InsertKbDocumentPersonaTag = z.infer<typeof insertKbDocumentPersonaTagSchema>;
export type KbDocumentPersonaTag = typeof kbDocumentPersonaTags.$inferSelect;
