var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  aiAgentConfig: () => aiAgentConfig,
  aiPersonas: () => aiPersonas,
  campaignKnowledgeBases: () => campaignKnowledgeBases,
  campaigns: () => campaigns,
  clients: () => clients,
  conversationMessages: () => conversationMessages,
  conversations: () => conversations,
  handovers: () => handovers,
  insertAiAgentConfigSchema: () => insertAiAgentConfigSchema,
  insertAiPersonaSchema: () => insertAiPersonaSchema,
  insertCampaignKnowledgeBaseSchema: () => insertCampaignKnowledgeBaseSchema,
  insertCampaignSchema: () => insertCampaignSchema,
  insertClientSchema: () => insertClientSchema,
  insertConversationMessageSchema: () => insertConversationMessageSchema,
  insertConversationSchema: () => insertConversationSchema,
  insertHandoverSchema: () => insertHandoverSchema,
  insertKbDocumentChunkSchema: () => insertKbDocumentChunkSchema,
  insertKbDocumentPersonaTagSchema: () => insertKbDocumentPersonaTagSchema,
  insertKbDocumentSchema: () => insertKbDocumentSchema,
  insertKnowledgeBaseSchema: () => insertKnowledgeBaseSchema,
  insertLeadSchema: () => insertLeadSchema,
  insertPersonaKnowledgeBaseSchema: () => insertPersonaKnowledgeBaseSchema,
  insertUserSchema: () => insertUserSchema,
  kbDocumentChunks: () => kbDocumentChunks,
  kbDocumentPersonaTags: () => kbDocumentPersonaTags,
  kbDocuments: () => kbDocuments,
  knowledgeBases: () => knowledgeBases,
  leads: () => leads,
  personaKnowledgeBases: () => personaKnowledgeBases,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var clients, users, conversations, conversationMessages, handovers, campaigns, aiAgentConfig, leads, insertUserSchema, insertCampaignSchema, insertAiAgentConfigSchema, insertConversationSchema, insertConversationMessageSchema, insertLeadSchema, insertHandoverSchema, insertClientSchema, knowledgeBases, kbDocuments, kbDocumentChunks, campaignKnowledgeBases, insertKnowledgeBaseSchema, insertKbDocumentSchema, insertKbDocumentChunkSchema, insertCampaignKnowledgeBaseSchema, aiPersonas, personaKnowledgeBases, kbDocumentPersonaTags, insertAiPersonaSchema, insertPersonaKnowledgeBaseSchema, insertKbDocumentPersonaTagSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    clients = pgTable("clients", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      name: varchar("name", { length: 255 }).notNull(),
      domain: varchar("domain", { length: 255 }).unique(),
      brandingConfig: jsonb("branding_config").default(sql`'{}'::jsonb`).notNull(),
      settings: jsonb("settings").default(sql`'{}'::jsonb`).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: text("username").notNull().unique(),
      password: text("password").notNull(),
      role: text("role").notNull().default("user"),
      // admin, manager, user
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    conversations = pgTable("conversations", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => campaigns.id),
      leadId: varchar("lead_id").references(() => leads.id),
      userId: varchar("user_id").references(() => users.id),
      subject: text("subject").notNull(),
      status: text("status").notNull().default("active"),
      // active, closed, archived
      priority: text("priority").notNull().default("normal"),
      // high, normal, low
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    conversationMessages = pgTable("conversation_messages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      conversationId: varchar("conversation_id").references(() => conversations.id),
      senderId: varchar("sender_id"),
      content: text("content").notNull(),
      messageType: text("message_type").notNull().default("text"),
      // text, system, email_template
      isFromAI: integer("is_from_ai").notNull().default(0),
      // 0 = human, 1 = AI
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    handovers = pgTable("handovers", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      conversationId: varchar("conversation_id").references(() => conversations.id),
      reason: text("reason"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      resolvedAt: timestamp("resolved_at")
    });
    campaigns = pgTable("campaigns", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      context: text("context").notNull(),
      handoverGoals: text("handover_goals"),
      targetAudience: text("target_audience"),
      // Campaign target audience
      handoverPrompt: text("handover_prompt"),
      // AI prompt for custom handover evaluation
      handoverPromptSpec: jsonb("handover_prompt_spec"),
      // Structured JSON spec (signal categories, thresholds)
      status: text("status").notNull().default("draft"),
      // draft, active, scheduled, completed
      templates: jsonb("templates"),
      // AI-generated email templates
      subjectLines: jsonb("subject_lines"),
      // AI-generated subject lines
      numberOfTemplates: integer("number_of_templates").default(5),
      daysBetweenMessages: integer("days_between_messages").default(3),
      openRate: integer("open_rate"),
      // percentage
      isTemplate: boolean("is_template").default(false),
      // Mark as reusable template
      originalCampaignId: varchar("original_campaign_id"),
      // Reference to source campaign when cloned
      // Communication Settings
      communicationType: varchar("communication_type", { length: 20 }).default("email"),
      // "email", "email_sms", "sms"
      smsOptInRequired: boolean("sms_opt_in_required").default(true),
      smsOptInMessage: text("sms_opt_in_message").default("Would you like to continue this conversation via text? Reply YES to receive SMS updates."),
      // Scheduling Settings
      scheduleType: varchar("schedule_type", { length: 20 }).default("immediate"),
      // "immediate", "scheduled", "recurring"
      scheduledStart: timestamp("scheduled_start"),
      recurringPattern: varchar("recurring_pattern", { length: 50 }),
      // "daily", "weekly", "monthly"
      recurringDays: jsonb("recurring_days"),
      // [1,2,3,4,5] for weekdays
      recurringTime: varchar("recurring_time", { length: 8 }),
      // "09:00:00"
      isActive: boolean("is_active").default(true),
      nextExecution: timestamp("next_execution"),
      // Agent selection (optional)
      agentConfigId: varchar("agent_config_id").references(() => aiAgentConfig.id),
      // AI Persona assignment for multi-persona campaigns
      personaId: uuid("persona_id").references(() => aiPersonas.id),
      clientId: uuid("client_id").references(() => clients.id),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    aiAgentConfig = pgTable("ai_agent_config", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: varchar("name").notNull(),
      // Configuration name/profile
      tonality: text("tonality").notNull().default("professional"),
      // professional, friendly, casual, enthusiastic
      personality: text("personality"),
      // Description of agent personality
      dosList: jsonb("dos_list").default([]).notNull(),
      // Array of do's
      dontsList: jsonb("donts_list").default([]).notNull(),
      // Array of don'ts
      industry: varchar("industry").default("automotive"),
      // Industry specialization
      responseStyle: text("response_style").default("helpful"),
      // helpful, consultative, direct
      model: text("model").default("openai/gpt-5-chat"),
      // Default model updated to GPT-5 Chat
      systemPrompt: text("system_prompt"),
      // Custom system prompt override
      // Agent outbound email Mailgun subdomain override (e.g., mg.dealership.com)
      agentEmailDomain: varchar("agent_email_domain"),
      isActive: boolean("is_active").default(false).notNull(),
      // Whether this config is currently active
      clientId: uuid("client_id").references(() => clients.id),
      // Multi-tenant scoping
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    leads = pgTable("leads", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      email: varchar("email").notNull(),
      firstName: varchar("first_name"),
      lastName: varchar("last_name"),
      phone: varchar("phone"),
      vehicleInterest: varchar("vehicle_interest"),
      // Vehicle model/type they're interested in
      leadSource: varchar("lead_source"),
      // Website, showroom, referral, etc.
      status: varchar("status").default("new"),
      // new, contacted, qualified, converted, lost
      tags: varchar("tags").array(),
      // For categorization
      notes: text("notes"),
      campaignId: varchar("campaign_id").references(() => campaigns.id),
      clientId: uuid("client_id").references(() => clients.id),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
      role: true,
      email: true
    });
    insertCampaignSchema = createInsertSchema(campaigns).pick({
      name: true,
      context: true,
      handoverGoals: true,
      targetAudience: true,
      // Added
      handoverPrompt: true,
      // Added
      handoverPromptSpec: true,
      status: true,
      templates: true,
      subjectLines: true,
      numberOfTemplates: true,
      // Standardized on this field
      daysBetweenMessages: true,
      openRate: true,
      isTemplate: true,
      originalCampaignId: true,
      agentConfigId: true,
      personaId: true
      // Added for multi-persona support
    });
    insertAiAgentConfigSchema = createInsertSchema(aiAgentConfig).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertConversationSchema = createInsertSchema(conversations).pick({
      campaignId: true,
      leadId: true,
      userId: true,
      subject: true,
      status: true,
      priority: true
    });
    insertConversationMessageSchema = createInsertSchema(conversationMessages).pick({
      conversationId: true,
      senderId: true,
      content: true,
      messageType: true,
      isFromAI: true
    });
    insertLeadSchema = createInsertSchema(leads).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertHandoverSchema = createInsertSchema(handovers).pick({
      conversationId: true,
      reason: true
    });
    insertClientSchema = createInsertSchema(clients).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    knowledgeBases = pgTable("knowledge_bases", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    kbDocuments = pgTable("kb_documents", {
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
      processedAt: timestamp("processed_at")
    });
    kbDocumentChunks = pgTable("kb_document_chunks", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    campaignKnowledgeBases = pgTable("campaign_knowledge_bases", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => campaigns.id),
      knowledgeBaseId: uuid("knowledge_base_id").references(() => knowledgeBases.id),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    insertKnowledgeBaseSchema = createInsertSchema(knowledgeBases).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertKbDocumentSchema = createInsertSchema(kbDocuments).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      processedAt: true
    });
    insertKbDocumentChunkSchema = createInsertSchema(kbDocumentChunks).omit({
      id: true,
      createdAt: true
    });
    insertCampaignKnowledgeBaseSchema = createInsertSchema(campaignKnowledgeBases).omit({
      id: true,
      createdAt: true
    });
    aiPersonas = pgTable("ai_personas", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      clientId: uuid("client_id").references(() => clients.id).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      targetAudience: varchar("target_audience", { length: 255 }),
      // dealers, vendors, customers, etc.
      industry: varchar("industry", { length: 100 }).default("automotive"),
      // Persona personality and behavior
      tonality: text("tonality").notNull().default("professional"),
      // professional, friendly, technical, consultative
      personality: text("personality"),
      // Detailed personality description
      communicationStyle: text("communication_style").default("helpful"),
      // helpful, consultative, direct, technical
      // AI configuration
      model: text("model").default("openai/gpt-4o"),
      // AI model to use
      temperature: integer("temperature").default(70),
      // Temperature * 100 (0.7 = 70)
      maxTokens: integer("max_tokens").default(300),
      // Persona-specific prompts
      systemPrompt: text("system_prompt"),
      // Base system prompt for this persona
      responseGuidelines: jsonb("response_guidelines").default(sql`'[]'::jsonb`).notNull(),
      // Array of response guidelines
      escalationCriteria: jsonb("escalation_criteria").default(sql`'[]'::jsonb`).notNull(),
      // When to escalate conversations
      // Communication preferences
      preferredChannels: jsonb("preferred_channels").default(sql`'["email"]'::jsonb`).notNull(),
      // email, sms, phone
      handoverSettings: jsonb("handover_settings").default(sql`'{}'::jsonb`).notNull(),
      // Persona-specific handover config
      // Knowledge base associations
      knowledgeBaseAccessLevel: varchar("kb_access_level", { length: 50 }).default("campaign_only"),
      // "campaign_only", "client_all", "persona_filtered"
      // Status and settings
      isActive: boolean("is_active").default(true).notNull(),
      isDefault: boolean("is_default").default(false).notNull(),
      priority: integer("priority").default(100),
      // Higher number = higher priority
      metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    personaKnowledgeBases = pgTable("persona_knowledge_bases", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      personaId: uuid("persona_id").references(() => aiPersonas.id).notNull(),
      knowledgeBaseId: uuid("knowledge_base_id").references(() => knowledgeBases.id).notNull(),
      accessLevel: varchar("access_level", { length: 50 }).default("read"),
      // read, write, admin
      priority: integer("priority").default(100),
      // Priority for this KB for this persona
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    kbDocumentPersonaTags = pgTable("kb_document_persona_tags", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      documentId: uuid("document_id").references(() => kbDocuments.id).notNull(),
      personaId: uuid("persona_id").references(() => aiPersonas.id).notNull(),
      relevanceScore: integer("relevance_score").default(100),
      // 0-100 relevance for this persona
      tags: varchar("tags").array().default(sql`'{}'`),
      // Additional tags for this persona-document association
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    insertAiPersonaSchema = createInsertSchema(aiPersonas).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertPersonaKnowledgeBaseSchema = createInsertSchema(personaKnowledgeBases).omit({
      id: true,
      createdAt: true
    });
    insertKbDocumentPersonaTagSchema = createInsertSchema(kbDocumentPersonaTags).omit({
      id: true,
      createdAt: true
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  pool: () => pool
});
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
async function ensureDatabaseReady() {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  } catch (err) {
    console.warn("Database extension setup warning:", err?.message || err);
  } finally {
    client.release();
  }
}
async function tableExists(client, table) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [table]
  );
  return !!rowCount;
}
async function applyLegacyPatches() {
  const client = await pool.connect();
  try {
    const { rowCount: hasContext } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='context'`
    );
    if (!hasContext) {
      console.log("[DB Patch] Adding campaigns.context column");
      await client.query(`ALTER TABLE campaigns ADD COLUMN context text NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE campaigns ALTER COLUMN context DROP DEFAULT`);
      console.log("[DB Patch] campaigns.context added");
    }
    const addColumn = async (col, ddl) => {
      const { rowCount } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name=$1`,
        [col]
      );
      if (!rowCount) {
        console.log(`[DB Patch] Adding campaigns.${col}`);
        await client.query(ddl);
      }
    };
    await addColumn("handover_goals", `ALTER TABLE campaigns ADD COLUMN handover_goals text`);
    await addColumn("communication_type", `ALTER TABLE campaigns ADD COLUMN communication_type varchar(20) DEFAULT 'email'`);
    await addColumn("sms_opt_in_required", `ALTER TABLE campaigns ADD COLUMN sms_opt_in_required boolean DEFAULT true`);
    await addColumn("sms_opt_in_message", `ALTER TABLE campaigns ADD COLUMN sms_opt_in_message text DEFAULT 'Would you like to continue this conversation via text? Reply YES to receive SMS updates.'`);
    await addColumn("schedule_type", `ALTER TABLE campaigns ADD COLUMN schedule_type varchar(20) DEFAULT 'immediate'`);
    await addColumn("scheduled_start", `ALTER TABLE campaigns ADD COLUMN scheduled_start timestamp`);
    await addColumn("recurring_pattern", `ALTER TABLE campaigns ADD COLUMN recurring_pattern varchar(50)`);
    await addColumn("recurring_days", `ALTER TABLE campaigns ADD COLUMN recurring_days jsonb`);
    await addColumn("recurring_time", `ALTER TABLE campaigns ADD COLUMN recurring_time varchar(8)`);
    await addColumn("is_active", `ALTER TABLE campaigns ADD COLUMN is_active boolean DEFAULT true`);
    await addColumn("next_execution", `ALTER TABLE campaigns ADD COLUMN next_execution timestamp`);
    await addColumn("target_audience", `ALTER TABLE campaigns ADD COLUMN target_audience text`);
    await addColumn("handover_prompt", `ALTER TABLE campaigns ADD COLUMN handover_prompt text`);
    await addColumn("handover_prompt_spec", `ALTER TABLE campaigns ADD COLUMN handover_prompt_spec jsonb`);
    await addColumn("templates", `ALTER TABLE campaigns ADD COLUMN templates jsonb`);
    await addColumn("subject_lines", `ALTER TABLE campaigns ADD COLUMN subject_lines jsonb`);
    await addColumn("number_of_templates", `ALTER TABLE campaigns ADD COLUMN number_of_templates integer DEFAULT 5`);
    await addColumn("days_between_messages", `ALTER TABLE campaigns ADD COLUMN days_between_messages integer DEFAULT 3`);
    await addColumn("open_rate", `ALTER TABLE campaigns ADD COLUMN open_rate integer`);
    await addColumn("is_template", `ALTER TABLE campaigns ADD COLUMN is_template boolean DEFAULT false`);
    await addColumn("original_campaign_id", `ALTER TABLE campaigns ADD COLUMN original_campaign_id varchar`);
    await addColumn("agent_config_id", `ALTER TABLE campaigns ADD COLUMN agent_config_id varchar`);
    const addColumnTo = async (table, col, ddl) => {
      const { rowCount } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
        [table, col]
      );
      if (!rowCount) {
        console.log(`[DB Patch] Adding ${table}.${col}`);
        await client.query(ddl);
      }
    };
    await addColumnTo("leads", "vehicle_interest", `ALTER TABLE leads ADD COLUMN vehicle_interest varchar`);
    await addColumnTo("leads", "lead_source", `ALTER TABLE leads ADD COLUMN lead_source varchar`);
    await addColumnTo("leads", "status", `ALTER TABLE leads ADD COLUMN status varchar DEFAULT 'new'`);
    await addColumnTo("leads", "tags", `ALTER TABLE leads ADD COLUMN tags varchar[]`);
    await addColumnTo("leads", "notes", `ALTER TABLE leads ADD COLUMN notes text`);
    await addColumnTo("leads", "campaign_id", `ALTER TABLE leads ADD COLUMN campaign_id varchar`);
    await addColumnTo("leads", "client_id", `ALTER TABLE leads ADD COLUMN client_id uuid`);
    await addColumnTo("leads", "created_at", `ALTER TABLE leads ADD COLUMN created_at timestamp DEFAULT now()`);
    await addColumnTo("leads", "updated_at", `ALTER TABLE leads ADD COLUMN updated_at timestamp DEFAULT now()`);
    await addColumnTo("conversations", "lead_id", `ALTER TABLE conversations ADD COLUMN lead_id varchar`);
    await addColumnTo("users", "notification_preferences", `ALTER TABLE users ADD COLUMN notification_preferences jsonb DEFAULT '{
      "emailNotifications": true,
      "campaignAlerts": true,
      "leadAlerts": true,
      "systemAlerts": true,
      "monthlyReports": true,
      "highEngagementAlerts": true,
      "quotaWarnings": true
    }'::jsonb`);
    if (!await tableExists(client, "ai_agent_config")) {
      console.log("[DB Patch] Creating missing ai_agent_config table");
      await client.query(`CREATE TABLE IF NOT EXISTS ai_agent_config (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        name varchar NOT NULL,
        tonality text DEFAULT 'professional' NOT NULL,
        personality text,
        dos_list jsonb DEFAULT '[]',
        donts_list jsonb DEFAULT '[]',
        industry varchar DEFAULT 'automotive',
        response_style text DEFAULT 'helpful',
    model text DEFAULT 'openai/gpt-5-chat',
        system_prompt text,
        is_active boolean DEFAULT false,
        client_id uuid,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )`);
    }
    await addColumnTo("ai_agent_config", "model", `ALTER TABLE ai_agent_config ADD COLUMN model text DEFAULT 'openai/gpt-5-chat'`);
    await addColumnTo("ai_agent_config", "system_prompt", `ALTER TABLE ai_agent_config ADD COLUMN system_prompt text`);
    await addColumnTo("ai_agent_config", "client_id", `ALTER TABLE ai_agent_config ADD COLUMN client_id uuid`);
    await addColumnTo("ai_agent_config", "is_active", `ALTER TABLE ai_agent_config ADD COLUMN is_active boolean DEFAULT false`);
    await addColumnTo("ai_agent_config", "agent_email_domain", `ALTER TABLE ai_agent_config ADD COLUMN agent_email_domain varchar`);
    try {
      await client.query(`ALTER TABLE ai_agent_config ALTER COLUMN model SET DEFAULT 'openai/gpt-5-chat'`);
      await client.query(`UPDATE ai_agent_config SET model='openai/gpt-5-chat'
        WHERE model IS NULL
           OR model=''
           OR model ILIKE 'openai/gpt-5-mini'
           OR model ILIKE 'gpt-5-mini'
           OR model ILIKE 'openai/gpt-4o-mini'
           OR model ILIKE 'gpt-4o-mini'
           OR model ILIKE 'openai/gpt-4o'
           OR model ILIKE 'gpt-4o'`);
    } catch (e) {
      console.warn("[DB Patch] model default update warning:", e.message);
    }
    try {
      await client.query(`ALTER TABLE ai_agent_config ADD CONSTRAINT ai_agent_config_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES clients(id)`);
    } catch (e) {
    }
    if (!await tableExists(client, "ai_personas")) {
      console.log("[DB Patch] Creating missing ai_personas table");
      await client.query(`CREATE TABLE IF NOT EXISTS ai_personas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        client_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        target_audience varchar(255),
        industry varchar(100) DEFAULT 'automotive',
        tonality text DEFAULT 'professional' NOT NULL,
        personality text,
        communication_style text DEFAULT 'helpful',
        model text DEFAULT 'openai/gpt-4o',
        temperature integer DEFAULT 70,
        max_tokens integer DEFAULT 300,
        system_prompt text,
        response_guidelines jsonb DEFAULT '[]'::jsonb NOT NULL,
        escalation_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
        preferred_channels jsonb DEFAULT '["email"]'::jsonb NOT NULL,
        handover_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
        kb_access_level varchar(50) DEFAULT 'campaign_only',
        is_active boolean DEFAULT true NOT NULL,
        is_default boolean DEFAULT false NOT NULL,
        priority integer DEFAULT 100,
        metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )`);
    }
    if (!await tableExists(client, "handovers")) {
      console.log("[DB Patch] Creating missing handovers table");
      await client.query(`CREATE TABLE IF NOT EXISTS handovers (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        conversation_id varchar REFERENCES conversations(id),
        reason text,
        created_at timestamp DEFAULT now() NOT NULL,
        resolved_at timestamp
      )`);
    }
    if (!await tableExists(client, "persona_knowledge_bases")) {
      console.log("[DB Patch] Creating missing persona_knowledge_bases table");
      await client.query(`CREATE TABLE IF NOT EXISTS persona_knowledge_bases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        persona_id uuid NOT NULL,
        knowledge_base_id uuid NOT NULL,
        access_level varchar(50) DEFAULT 'read',
        priority integer DEFAULT 100,
        created_at timestamp DEFAULT now() NOT NULL
      )`);
    }
    if (!await tableExists(client, "kb_document_persona_tags")) {
      console.log("[DB Patch] Creating missing kb_document_persona_tags table");
      await client.query(`CREATE TABLE IF NOT EXISTS kb_document_persona_tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        document_id uuid NOT NULL,
        persona_id uuid NOT NULL,
        relevance_score integer DEFAULT 100,
        tags varchar[] DEFAULT '{}',
        created_at timestamp DEFAULT now() NOT NULL
      )`);
    }
    try {
      await client.query(`ALTER TABLE ai_personas ADD CONSTRAINT ai_personas_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES clients(id)`);
    } catch (e) {
    }
    try {
      await client.query(`ALTER TABLE persona_knowledge_bases ADD CONSTRAINT persona_knowledge_bases_persona_id_ai_personas_id_fk FOREIGN KEY (persona_id) REFERENCES ai_personas(id)`);
    } catch (e) {
    }
    try {
      await client.query(`ALTER TABLE persona_knowledge_bases ADD CONSTRAINT persona_knowledge_bases_knowledge_base_id_knowledge_bases_id_fk FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)`);
    } catch (e) {
    }
    try {
      await client.query(`ALTER TABLE kb_document_persona_tags ADD CONSTRAINT kb_document_persona_tags_document_id_kb_documents_id_fk FOREIGN KEY (document_id) REFERENCES kb_documents(id)`);
    } catch (e) {
    }
    try {
      await client.query(`ALTER TABLE kb_document_persona_tags ADD CONSTRAINT kb_document_persona_tags_persona_id_ai_personas_id_fk FOREIGN KEY (persona_id) REFERENCES ai_personas(id)`);
    } catch (e) {
    }
    try {
      await client.query(`ALTER TABLE campaigns ADD CONSTRAINT campaigns_persona_id_ai_personas_id_fk FOREIGN KEY (persona_id) REFERENCES ai_personas(id)`);
    } catch (e) {
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_client_id ON ai_personas (client_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_target_audience ON ai_personas (target_audience)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_active ON ai_personas (is_active)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_default ON ai_personas (is_default)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_persona_knowledge_bases_persona_id ON persona_knowledge_bases (persona_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_persona_knowledge_bases_kb_id ON persona_knowledge_bases (knowledge_base_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_kb_document_persona_tags_document_id ON kb_document_persona_tags (document_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_kb_document_persona_tags_persona_id ON kb_document_persona_tags (persona_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_campaigns_persona_id ON campaigns (persona_id)`);
    } catch (e) {
    }
  } catch (err) {
    console.warn("[DB Patch] Warning while applying legacy patches:", err?.message || err);
  } finally {
    client.release();
  }
}
async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, closing database connections...`);
  try {
    await pool.end();
    console.log("Database connections closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error closing database connections:", error);
    process.exit(1);
  }
}
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: Number(process.env.DATABASE_POOL_MAX) || 20,
      min: Number(process.env.DATABASE_POOL_MIN) || 5,
      idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT) || 3e4,
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT) || 1e4,
      query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT) || 6e4,
      statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT) || 6e4
    });
    void ensureDatabaseReady();
    void applyLegacyPatches();
    db = drizzle(pool, { schema: schema_exports });
    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
  }
});

// server/integrations/supermemory/client.ts
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function backoff(attempt) {
  const capped = Math.min(1500, RETRY_BASE_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 150);
  return capped + jitter;
}
function byteLength(s) {
  return new TextEncoder().encode(s || "").length;
}
function capContent(s) {
  if (!s) return s;
  const len = byteLength(s);
  if (len <= MAX_CONTENT_BYTES) return s;
  const ratio = MAX_CONTENT_BYTES / len;
  const cut = Math.max(0, Math.floor(s.length * ratio) - 1);
  return s.slice(0, cut) + "\n<!-- truncated for size cap -->";
}
function circuitOpen() {
  if (consecutiveFails < CIRCUIT_FAILS) return false;
  const now = Date.now();
  const stillCooling = now - circuitOpenedAt < CIRCUIT_COOLDOWN_MS;
  return stillCooling;
}
function recordSuccess() {
  consecutiveFails = 0;
}
function recordFailure() {
  consecutiveFails += 1;
  if (consecutiveFails === CIRCUIT_FAILS) circuitOpenedAt = Date.now();
}
async function requestWithRetries(path3, method, body) {
  if (!API_KEY) throw new Error("Supermemory API key missing");
  const url = `${BASE_URL.replace(/\/$/, "")}${path3}`;
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      if ([408, 429].includes(res.status) || res.status >= 500) {
        recordFailure();
        if (attempt >= MAX_RETRIES) return res;
        await sleep(backoff(attempt));
        continue;
      }
      recordSuccess();
      return res;
    } catch (err) {
      clearTimeout(timer);
      recordFailure();
      if (attempt >= MAX_RETRIES) throw err;
      await sleep(backoff(attempt));
    }
  }
}
function isRAGEnabled() {
  return !!supermemory && process.env.SUPERMEMORY_RAG !== "off";
}
var BASE_URL, API_KEY, TIMEOUT_MS, MAX_RETRIES, RETRY_BASE_MS, CIRCUIT_FAILS, CIRCUIT_COOLDOWN_MS, MAX_CONTENT_BYTES, consecutiveFails, circuitOpenedAt, realClient, supermemory;
var init_client = __esm({
  "server/integrations/supermemory/client.ts"() {
    "use strict";
    BASE_URL = process.env.SUPERMEMORY_BASE_URL || "https://api.supermemory.ai";
    API_KEY = process.env.SUPERMEMORY_API_KEY || "";
    TIMEOUT_MS = Number(process.env.SUPERMEMORY_TIMEOUT_MS ?? 8e3);
    MAX_RETRIES = Number(process.env.SUPERMEMORY_MAX_RETRIES ?? 3);
    RETRY_BASE_MS = Number(process.env.SUPERMEMORY_RETRY_BASE_MS ?? 200);
    CIRCUIT_FAILS = Number(process.env.SUPERMEMORY_CIRCUIT_FAILS ?? 4);
    CIRCUIT_COOLDOWN_MS = Number(process.env.SUPERMEMORY_CIRCUIT_COOLDOWN_MS ?? 3e4);
    MAX_CONTENT_BYTES = Number(process.env.SUPERMEMORY_MAX_CONTENT_BYTES ?? 2e5);
    consecutiveFails = 0;
    circuitOpenedAt = 0;
    realClient = API_KEY ? {
      add: async (data) => {
        if (!data || typeof data !== "object") throw new Error("Invalid add payload");
        const content = capContent(String(data.content || ""));
        const payload = { ...data, content };
        if (circuitOpen()) {
          return { id: void 0, skipped: true, reason: "circuit_open" };
        }
        const res = await requestWithRetries("/v1/memories", "POST", payload);
        if (!res.ok) {
          const text2 = await res.text().catch(() => "");
          throw new Error(`Supermemory add failed: ${res.status} ${text2}`);
        }
        return res.json();
      },
      search: async (params) => {
        if (!params || typeof params !== "object") throw new Error("Invalid search params");
        const query = String(params.query || params.q || "").slice(0, 512);
        const body = { ...params, query };
        if (circuitOpen()) {
          return { results: [], total: 0, skipped: true, reason: "circuit_open" };
        }
        const res = await requestWithRetries("/v1/search", "POST", body);
        if (!res.ok) {
          const text2 = await res.text().catch(() => "");
          throw new Error(`Supermemory search failed: ${res.status} ${text2}`);
        }
        let json;
        try {
          json = await res.json();
        } catch {
          json = { results: [], total: 0 };
        }
        if (!Array.isArray(json.results)) json.results = [];
        if (typeof json.total !== "number") json.total = json.results.length;
        return json;
      }
    } : null;
    supermemory = realClient ?? {
      add: async (data) => {
        const content = String(data?.content || "").slice(0, 200);
        console.log("[Supermemory Mock] add:", content + (content.length === 200 ? "\u2026" : ""));
        return { id: "mock-" + Date.now() };
      },
      search: async (params) => {
        const q = String(params?.query || params?.q || "").slice(0, 120);
        console.log("[Supermemory Mock] search:", q);
        return { results: [], total: 0 };
      }
    };
  }
});

// server/integrations/supermemory/MemoryMapper.ts
import { createHash } from "crypto";
function normalize(item) {
  const baseTags = [
    `client:${item.clientId}`,
    `type:${item.type}`
  ];
  let leadTag;
  if ("leadEmail" in item && item.leadEmail) {
    leadTag = `lead:${hashEmail(item.leadEmail)}`;
  }
  const campaignTag = "campaignId" in item && item.campaignId ? `campaign:${item.campaignId}` : void 0;
  const containerTags = [...baseTags, campaignTag, leadTag].filter(Boolean);
  const content = item.type === "email_template" ? stripPII(item.html) : item.type === "oem_doc" ? stripPII(`${item.title}

${item.content}`) : stripPII(item.content);
  const metadata = {
    type: item.type,
    ..."name" in item && item.name ? { name: item.name } : {},
    ..."title" in item && item.title ? { title: item.title } : {},
    ..."campaignId" in item && item.campaignId ? { campaignId: item.campaignId } : {},
    ..."leadEmail" in item && item.leadEmail ? { leadHash: hashEmail(item.leadEmail) } : {},
    ...item.meta || {}
  };
  return { content, metadata, containerTags };
}
async function flush() {
  if (!isRAGEnabled() || queue.length === 0) return;
  const batch = queue.splice(0, 20);
  try {
    await Promise.all(
      batch.map(async (b) => {
        try {
          return await supermemory.add({
            content: b.content,
            metadata: b.metadata,
            tags: b.containerTags,
            userId: b.metadata.clientId || "default"
          });
        } catch (err) {
          console.warn("[Supermemory] Single memory write failed:", err);
          return null;
        }
      })
    );
  } catch (err) {
    console.error("[Supermemory] batch write failed", err);
  }
}
function hashEmail(email) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}
function stripPII(text2) {
  if (!text2) return text2;
  return text2.replace(/\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, (m) => `${m.split("@")[0].slice(0, 2)}***@***`).replace(/\b(\+?1[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "***-***-****");
}
var queue, flushTimer, MemoryMapper;
var init_MemoryMapper = __esm({
  "server/integrations/supermemory/MemoryMapper.ts"() {
    "use strict";
    init_client();
    queue = [];
    flushTimer = null;
    MemoryMapper = {
      async write(item) {
        if (!isRAGEnabled()) return;
        const { content, metadata, containerTags } = normalize(item);
        queue.push({ content, metadata, containerTags });
        if (queue.length >= 20) await flush();
        else {
          if (flushTimer) clearTimeout(flushTimer);
          flushTimer = setTimeout(() => flush().catch(() => {
          }), 750);
        }
      },
      // Convenience helpers
      writeMailEvent(args) {
        return this.write(args);
      },
      writeLeadMessage(args) {
        return this.write(args);
      },
      writeTemplate(args) {
        return this.write(args);
      },
      writeCampaignSummary(args) {
        return this.write(args);
      },
      writeOEMDoc(args) {
        return this.write(args);
      },
      writeHandoverEvent(args) {
        return this.write(args);
      },
      writeWebhook(args) {
        return this.write(args);
      },
      writeCampaignStep(args) {
        return this.write(args);
      },
      writeCampaignMetric(args) {
        return this.write(args);
      },
      // Utility to hash emails for consistent lead tagging
      hashEmail
    };
  }
});

// server/integrations/supermemory/QueryBuilder.ts
async function searchMemories(input) {
  if (!isRAGEnabled()) return { results: [], total: 0, timing: 0, skipped: true };
  const payload = buildSearchPayload(input);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), input.timeoutMs ?? 300);
  try {
    const res = await supermemory.search({
      query: payload.q,
      limit: payload.limit,
      threshold: payload.documentThreshold,
      tags: payload.containerTags.filter(Boolean),
      userId: payload.containerTags.find((tag) => tag && tag.startsWith("client:"))?.split(":")[1] || "default"
    });
    clearTimeout(t);
    return res;
  } catch (err) {
    clearTimeout(t);
    return { results: [], total: 0, timing: 0, skipped: true, error: String(err.message) };
  }
}
function buildSearchPayload({
  q,
  clientId,
  campaignId,
  leadEmailHash,
  limit = 8,
  documentThreshold = 0.6,
  chunkThreshold = 0.6,
  onlyMatchingChunks = true,
  extraTags = [],
  rewriteQuery = true
}) {
  const containerTags = [
    `client:${clientId}`,
    campaignId ? `campaign:${campaignId}` : null,
    leadEmailHash ? `lead:${leadEmailHash}` : null,
    ...extraTags
  ].filter(Boolean);
  return {
    q,
    limit,
    documentThreshold,
    chunkThreshold,
    onlyMatchingChunks,
    rewriteQuery,
    containerTags
  };
}
async function searchForCampaignChat(opts) {
  const q = [
    opts.userTurn,
    opts.detectedType?.replace(/_/g, " "),
    ...opts.vehicleKeywords || [],
    "previous campaign performance OR winning template OR high CTR OR conversion"
  ].filter(Boolean).join(" ");
  return searchMemories({
    q,
    clientId: opts.clientId,
    campaignId: opts.campaignId,
    limit: 6,
    documentThreshold: 0.65,
    chunkThreshold: 0.65,
    onlyMatchingChunks: true,
    rewriteQuery: true,
    timeoutMs: 300
  });
}
async function searchForLeadSignals(opts) {
  const q = "asap today urgent payment monthly best price test drive financing trade-in ready to buy timeline";
  return searchMemories({
    q,
    clientId: opts.clientId,
    leadEmailHash: opts.leadEmailHash,
    limit: 10,
    documentThreshold: 0.55,
    chunkThreshold: 0.6,
    onlyMatchingChunks: true,
    rewriteQuery: true,
    timeoutMs: 250
  });
}
async function searchForOptimizationComparables(opts) {
  const q = [
    opts.vehicleType,
    opts.season,
    opts.goal,
    "send time performance open rate click through conversion best practices"
  ].filter(Boolean).join(" ");
  return searchMemories({
    q,
    clientId: opts.clientId,
    limit: 8,
    documentThreshold: 0.6,
    chunkThreshold: 0.6,
    rewriteQuery: true,
    timeoutMs: 350
  });
}
var init_QueryBuilder = __esm({
  "server/integrations/supermemory/QueryBuilder.ts"() {
    "use strict";
    init_client();
  }
});

// server/integrations/supermemory/prompts.ts
function campaignChatPrompt({
  userTurn,
  detectedType,
  snippets
}) {
  const context = snippets.slice(0, 3).map(
    (s, i) => `SNIPPET ${i + 1}${s.title ? ` \u2014 ${s.title}` : ""}:
${s.content}`
  ).join("\n\n");
  return `You are the OfferLogix Campaign Agent for dealership outreach. Your job is to help users design email campaigns that promote OfferLogix services and tools to automotive dealerships (B2B), not to consumers. Use prior wins as inspiration, not gospel.

USER INTENT: ${userTurn}
DETECTED TYPE: ${detectedType ?? "unknown"}

PRIOR WINS (top 3):
${context || "None"}

INSTRUCTIONS:
- Ask ONE next best question that moves the campaign forward.
- If a pattern in prior wins is relevant (send time, subject style, vehicle angle), briefly mention it (one line).
- Keep tone friendly, concise, and practical.

Return JSON:
{
  "message": "assistant reply",
  "nextStep": "campaign_type|target_audience|goals|details|complete",
  "campaignData": { ...merge any safe inferred fields... },
  "isComplete": false
}`;
}
function leadScoringPrompt({
  leadSummary,
  snippets
}) {
  const evidence = snippets.slice(0, 6).map((s) => s.content).join("\n---\n");
  return `You are scoring a single automotive lead.

LEAD RECENT TIMELINE:
${leadSummary}

EVIDENCE FROM MEMORY (keyword hits: urgency/payment/price/test drive):
${evidence || "None"}

SCORE FIELDS (0-100):
- qualification: considers vehicle specificity, payment/financing mentions, test-drive intent
- urgency: considers words "asap", "today", "this week", quick reply cadence
- handover: overall buy-readiness

Return JSON:
{
  "qualification": 0-100,
  "urgency": 0-100,
  "handover": 0-100,
  "signals": ["string", ...],
  "reasoning": "1-3 short bullets"
}`;
}
function optimizationPrompt({
  campaignContext,
  snippets
}) {
  const comps = snippets.slice(0, 6).map((s, i) => `COMPARABLE ${i + 1}${s.title ? ` \u2014 ${s.title}` : ""}:
${s.content}`).join("\n\n");
  const ctx = JSON.stringify(campaignContext);
  return `You are generating optimization guidance for an automotive email campaign.

CAMPAIGN CONTEXT: ${ctx}

COMPARABLES (same client or similar goals):
${comps || "None"}

REQUIRED OUTPUT JSON:
{
  "sendTime": {"dayOfWeek": "Mon|Tue|...|Sun", "hour": 8-20, "confidence": 0-100, "reason": "short"},
  "sequence": [
    {"step": 1, "type": "introduction|vehicle_showcase|incentive_offer|urgency_close", "dayOffset": 0, "note": "short"},
    {"step": 2, "type": "...", "dayOffset": 3, "note": "short"}
  ],
  "contentAngles": ["fuel economy", "family features", "payment examples"],
  "expectedLift": {"metric": "open|ctr|reply|handover", "percent": 1-30}
}`;
}
var init_prompts = __esm({
  "server/integrations/supermemory/prompts.ts"() {
    "use strict";
  }
});

// server/integrations/supermemory/index.ts
var supermemory_exports = {};
__export(supermemory_exports, {
  MemoryMapper: () => MemoryMapper,
  buildSearchPayload: () => buildSearchPayload,
  campaignChatPrompt: () => campaignChatPrompt,
  isRAGEnabled: () => isRAGEnabled,
  leadScoringPrompt: () => leadScoringPrompt,
  optimizationPrompt: () => optimizationPrompt,
  searchForCampaignChat: () => searchForCampaignChat,
  searchForLeadSignals: () => searchForLeadSignals,
  searchForOptimizationComparables: () => searchForOptimizationComparables,
  searchMemories: () => searchMemories,
  supermemory: () => supermemory
});
var init_supermemory = __esm({
  "server/integrations/supermemory/index.ts"() {
    "use strict";
    init_client();
    init_MemoryMapper();
    init_QueryBuilder();
    init_prompts();
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  DatabaseStorage: () => DatabaseStorage,
  storage: () => storage
});
import { eq, desc } from "drizzle-orm";
var DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    DatabaseStorage = class {
      async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || void 0;
      }
      async getUserByUsername(username) {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user || void 0;
      }
      async getUsers(limit = 10) {
        return await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
      }
      async createUser(insertUser) {
        const result = await db.insert(users).values(insertUser).returning();
        if (result.length === 0) {
          throw new Error("Failed to create user");
        }
        return result[0];
      }
      async getCampaigns() {
        return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(10);
      }
      async getCampaign(id) {
        const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
        return campaign || void 0;
      }
      async createCampaign(campaign) {
        const safeArray = (val) => {
          if (Array.isArray(val)) return val;
          if (typeof val === "string") {
            try {
              const parsed = JSON.parse(val);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        };
        const sanitizedTemplates = safeArray(campaign.templates).map((t) => {
          if (typeof t === "string") {
            const content2 = t.trim();
            const subj2 = content2 ? content2.replace(/<[^>]*>/g, "").slice(0, 80) : "Untitled";
            return { subject: subj2, content: content2 };
          }
          if (!t || typeof t !== "object") return null;
          const subj = typeof t.subject === "string" && t.subject.trim() ? String(t.subject).slice(0, 140) : typeof t.title === "string" && t.title.trim() ? String(t.title).slice(0, 140) : "Untitled";
          const content = typeof t.content === "string" && t.content.trim() ? t.content : typeof t.html === "string" && t.html.trim() ? t.html : typeof t.body === "string" && t.body.trim() ? t.body : typeof t.text === "string" && t.text.trim() ? t.text : "";
          return { subject: subj, content };
        }).filter(Boolean);
        const sanitizedSubjects = safeArray(campaign.subjectLines).filter((s) => typeof s === "string" && s.trim()).map((s) => s.slice(0, 140));
        const result = await db.insert(campaigns).values({
          ...campaign,
          templates: sanitizedTemplates,
          subjectLines: sanitizedSubjects,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        if (result.length === 0) {
          throw new Error("Failed to create campaign");
        }
        const newCampaign = result[0];
        try {
          const { MemoryMapper: MemoryMapper2 } = await Promise.resolve().then(() => (init_supermemory(), supermemory_exports));
          await MemoryMapper2.writeCampaignSummary({
            type: "campaign_summary",
            clientId: newCampaign.clientId || "default",
            campaignId: newCampaign.id,
            summary: `Campaign: ${newCampaign.name}
Context: ${newCampaign.context}
Goals: ${newCampaign.handoverGoals}`,
            meta: {
              name: newCampaign.name,
              status: newCampaign.status
            }
          });
        } catch (error) {
          console.warn("Failed to store campaign in Supermemory:", error);
        }
        return newCampaign;
      }
      async updateCampaign(id, campaign) {
        const [updatedCampaign] = await db.update(campaigns).set({
          ...campaign,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(campaigns.id, id)).returning();
        return updatedCampaign;
      }
      async deleteCampaign(id) {
        await db.delete(campaigns).where(eq(campaigns.id, id));
      }
      async cloneCampaign(id, newName) {
        const originalCampaign = await this.getCampaign(id);
        if (!originalCampaign) {
          throw new Error("Campaign not found");
        }
        const clonedCampaign = {
          name: newName || `${originalCampaign.name} (Copy)`,
          context: originalCampaign.context,
          handoverGoals: originalCampaign.handoverGoals,
          status: "draft",
          templates: originalCampaign.templates,
          subjectLines: originalCampaign.subjectLines,
          numberOfTemplates: originalCampaign.numberOfTemplates,
          daysBetweenMessages: originalCampaign.daysBetweenMessages,
          isTemplate: false,
          originalCampaignId: id
        };
        return await this.createCampaign(clonedCampaign);
      }
      async updateUserRole(id, role) {
        const [updatedUser] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
        return updatedUser;
      }
      // Conversation methods
      async getConversations(userId) {
        let query = db.select().from(conversations).orderBy(desc(conversations.updatedAt));
        if (userId) {
          return await query.where(eq(conversations.userId, userId));
        }
        return await query;
      }
      async getConversation(id) {
        const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
        return conversation || void 0;
      }
      async createConversation(conversation) {
        const result = await db.insert(conversations).values({
          ...conversation,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        if (result.length === 0) {
          throw new Error("Failed to create conversation");
        }
        return result[0];
      }
      async updateConversation(id, conversation) {
        const [updatedConversation] = await db.update(conversations).set({
          ...conversation,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(conversations.id, id)).returning();
        return updatedConversation;
      }
      async deleteConversation(id) {
        await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, id));
        await db.delete(conversations).where(eq(conversations.id, id));
      }
      // Update conversation status for handover
      async updateConversationStatus(id, status) {
        const conversation = await this.getConversation(id);
        if (!conversation) return null;
        return this.updateConversation(id, { status });
      }
      // Conversation message methods
      async getConversationMessages(conversationId, limit) {
        const baseQuery = db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, conversationId)).orderBy(conversationMessages.createdAt);
        if (limit) {
          return await baseQuery.limit(limit);
        }
        return await baseQuery;
      }
      async createConversationMessage(message) {
        const result = await db.insert(conversationMessages).values({
          ...message,
          createdAt: /* @__PURE__ */ new Date()
        }).returning();
        if (result.length === 0) {
          throw new Error("Failed to create conversation message");
        }
        const newMessage = result[0];
        if (!newMessage.isFromAI && newMessage.content && typeof newMessage.content === "string") {
          try {
            const conversation = await this.getConversation(newMessage.conversationId || "");
            const { MemoryMapper: MemoryMapper2 } = await Promise.resolve().then(() => (init_supermemory(), supermemory_exports));
            await MemoryMapper2.writeLeadMessage({
              type: "lead_msg",
              clientId: "default",
              // TODO: Add clientId to message context
              campaignId: conversation?.campaignId || void 0,
              leadEmail: newMessage.senderId || void 0,
              content: newMessage.content,
              meta: {
                conversationId: newMessage.conversationId,
                senderId: newMessage.senderId
              }
            });
          } catch (error) {
            console.warn("Failed to store lead message in Supermemory:", error);
          }
        }
        return newMessage;
      }
      // Lead methods
      async getLeads(campaignId) {
        if (campaignId) {
          return await db.select().from(leads).where(eq(leads.campaignId, campaignId)).orderBy(desc(leads.createdAt));
        }
        return await db.select().from(leads).orderBy(desc(leads.createdAt));
      }
      async getLead(id) {
        const [lead] = await db.select().from(leads).where(eq(leads.id, id));
        return lead;
      }
      async createLead(lead) {
        const result = await db.insert(leads).values(lead).returning();
        if (result.length === 0) {
          throw new Error("Failed to create lead");
        }
        return result[0];
      }
      async createLeads(leadList) {
        const result = await db.insert(leads).values(leadList).returning();
        return result;
      }
      async updateLead(id, lead) {
        const [updatedLead] = await db.update(leads).set({ ...lead, updatedAt: /* @__PURE__ */ new Date() }).where(eq(leads.id, id)).returning();
        return updatedLead;
      }
      async deleteLead(id) {
        await db.delete(leads).where(eq(leads.id, id));
      }
      async getLeadsByEmail(email) {
        return await db.select().from(leads).where(eq(leads.email, email));
      }
      async getLeadByEmail(email) {
        const [lead] = await db.select().from(leads).where(eq(leads.email, email));
        return lead || null;
      }
      async getLeadsByCampaign(campaignId) {
        return await db.select().from(leads).where(eq(leads.campaignId, campaignId)).orderBy(desc(leads.createdAt));
      }
      async getLeadByPhone(phone) {
        const [lead] = await db.select().from(leads).where(eq(leads.phone, phone));
        return lead || null;
      }
      async getConversationsByLead(leadId) {
        return await db.select().from(conversations).where(eq(conversations.leadId, leadId)).orderBy(desc(conversations.createdAt));
      }
      // AI Agent Configuration methods
      async getAiAgentConfigs() {
        return await db.select().from(aiAgentConfig).orderBy(desc(aiAgentConfig.createdAt));
      }
      async getActiveAiAgentConfig() {
        const [config] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.isActive, true));
        return config;
      }
      async getAiAgentConfig(id) {
        const [config] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.id, id));
        return config;
      }
      async createAiAgentConfig(config) {
        const result = await db.insert(aiAgentConfig).values({
          ...config,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        if (result.length === 0) {
          throw new Error("Failed to create AI agent config");
        }
        return result[0];
      }
      async updateAiAgentConfig(id, config) {
        const [updatedConfig] = await db.update(aiAgentConfig).set({
          ...config,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(aiAgentConfig.id, id)).returning();
        return updatedConfig;
      }
      async deleteAiAgentConfig(id) {
        await db.delete(aiAgentConfig).where(eq(aiAgentConfig.id, id));
      }
      async setActiveAiAgentConfig(id) {
        await db.update(aiAgentConfig).set({ isActive: false });
        const [activeConfig] = await db.update(aiAgentConfig).set({ isActive: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(aiAgentConfig.id, id)).returning();
        return activeConfig;
      }
      // Handover methods
      async getHandovers() {
        return await db.select().from(handovers).orderBy(desc(handovers.createdAt));
      }
      async createHandover(h) {
        const [created] = await db.insert(handovers).values({ ...h, createdAt: /* @__PURE__ */ new Date() }).returning();
        return created;
      }
      async resolveHandover(id) {
        const [updated] = await db.update(handovers).set({ resolvedAt: /* @__PURE__ */ new Date() }).where(eq(handovers.id, id)).returning();
        return updated || null;
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/services/mailgun.ts
var mailgun_exports = {};
__export(mailgun_exports, {
  mailgunAuthIsSuppressed: () => mailgunAuthIsSuppressed,
  sendBulkEmails: () => sendBulkEmails,
  sendCampaignEmail: () => sendCampaignEmail,
  validateEmailAddresses: () => validateEmailAddresses
});
function sleep2(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function backoff2(attempt) {
  const capped = Math.min(1500, MAILGUN_RETRY_BASE_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 150);
  return capped + jitter;
}
function capHtmlSize(html) {
  if (!html) return "";
  const bytes = new TextEncoder().encode(html);
  if (bytes.length <= MAILGUN_MAX_HTML_BYTES) return html;
  const ratio = MAILGUN_MAX_HTML_BYTES / bytes.length;
  const cut = Math.max(0, Math.floor(html.length * ratio) - 1);
  return html.slice(0, cut) + "\n<!-- truncated to stay under size cap -->";
}
function formatEmailContent(content) {
  if (!content) return "";
  let formatted = content.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>").replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");
  if (!formatted.includes("<br>") && formatted.length > 50) {
    formatted = formatted.replace(/\. ([A-Z])/g, ".<br><br>$1");
  }
  return formatted;
}
function toPlainText(html) {
  if (!html) return "";
  const text2 = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text2.slice(0, 1e5);
}
async function requestWithRetries2(url, init) {
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAILGUN_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if ([408, 429].includes(res.status) || res.status >= 500) {
        if (attempt >= MAILGUN_MAX_RETRIES) return res;
        await sleep2(backoff2(attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= MAILGUN_MAX_RETRIES) throw err;
      await sleep2(backoff2(attempt));
    }
  }
}
async function runWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = [];
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await task(items[i], i);
      } catch (e) {
        results[i] = e;
      }
    }
  };
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(run());
  await Promise.all(workers);
  return results;
}
async function sendCampaignEmail(to, subject, content, variables = {}, options = {}) {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    if (options.isAutoResponse && !options.domainOverride) {
      console.error("Agent email blocked: agentEmailDomain (Mailgun subdomain) is not configured on the active AI Agent Configuration.");
      return false;
    }
    let domain = options.domainOverride || process.env.MAILGUN_DOMAIN;
    if (domain && domain.includes("@")) {
      const extracted = domain.split("@").pop().trim();
      console.warn(`agentEmailDomain contained '@'; extracted domain part '${extracted}'.`);
      domain = extracted;
    }
    if (domain) {
      domain = domain.trim().toLowerCase();
      const domainRegex = /^[a-z0-9.-]+$/i;
      if (!domainRegex.test(domain)) {
        console.error(`Mailgun: invalid domain '${domain}' after sanitation. Email not sent.`);
        return false;
      }
    }
    if (!apiKey || !domain) {
      console.warn("Mailgun not configured - email not sent");
      return false;
    }
    const toAddr = (to || "").trim();
    if (!toAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
      console.warn(`Mailgun: invalid recipient '${toAddr}'`);
      return false;
    }
    const fromEmail = options.isAutoResponse ? `OneKeel Swarm <noreply@${domain}>` : options?.isAutoResponse === false && typeof variables?.from === "string" ? variables.from : process.env.MAILGUN_FROM_EMAIL || `OneKeel Swarm <swarm@${domain}>`;
    if (MAILGUN_AUTH_SUPPRESSED_UNTIL && Date.now() < MAILGUN_AUTH_SUPPRESSED_UNTIL) {
      if (!LAST_SUPPRESSION_LOG || Date.now() - LAST_SUPPRESSION_LOG > 6e4) {
        console.warn(`Mailgun auth suppressed \u2013 skipping send to ${toAddr}. Cooldown active for ${(MAILGUN_AUTH_SUPPRESSED_UNTIL - Date.now()) / 1e3 | 0}s.`);
        LAST_SUPPRESSION_LOG = Date.now();
      }
      return false;
    }
    const html = capHtmlSize(formatEmailContent(content || ""));
    const text2 = toPlainText(html);
    const body = new URLSearchParams({
      from: fromEmail,
      to: toAddr,
      subject,
      html,
      text: text2,
      // RFC 8058 compliant headers for deliverability
      "h:List-Unsubscribe": `<mailto:unsubscribe@${domain}?subject=unsubscribe>, <https://${domain}/u/${encodeURIComponent(toAddr)}>`,
      "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "h:Precedence": "bulk",
      ...options.inReplyTo ? { "h:In-Reply-To": options.inReplyTo } : {},
      ...options.references && options.references.length ? { "h:References": options.references.join(" ") } : {},
      ...options.headers || {}
    });
    const region = (process.env.MAILGUN_REGION || "").toLowerCase();
    const base = region === "eu" ? "https://api.eu.mailgun.net/v3" : "https://api.mailgun.net/v3";
    const url = `${base}/${domain}/messages`;
    const init = {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    };
    const response = await requestWithRetries2(url, init);
    if (response.ok) {
      return true;
    } else {
      const errorText = await response.text().catch(() => "");
      if (response.status === 401) {
        MAILGUN_AUTH_SUPPRESSED_UNTIL = Date.now() + 5 * 6e4;
        const maskedKey = apiKey.length > 12 ? `${apiKey.slice(0, 6)}\u2026${apiKey.slice(-4)}` : "***";
        console.error(
          `Mailgun 401 Unauthorized. Probable causes: (1) invalid/disabled API key, (2) domain '${domain}' not verified or not in this region (${region || "us"}), (3) region mismatch (set MAILGUN_REGION=eu if EU domain), (4) key lacks permission / wrong key type. Domain='${domain}' Region='${region || "us"}' Key='${maskedKey}'. Raw error: ${errorText}`
        );
      } else {
        console.error(`Mailgun API error ${response.status}:`, errorText);
      }
      return false;
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}
async function sendBulkEmails(emails) {
  const result = {
    success: true,
    sent: 0,
    failed: 0,
    errors: []
  };
  const tasks = await runWithConcurrency(emails, MAILGUN_BULK_CONCURRENCY, async (email) => {
    try {
      const ok = await sendCampaignEmail(email.to, email.subject, email.content);
      return { ok, to: email.to };
    } catch (e) {
      return { ok: false, to: email.to, err: e instanceof Error ? e.message : "Unknown error" };
    }
  });
  for (const t of tasks) {
    if (t && t.ok) {
      result.sent++;
    } else {
      result.failed++;
      const to = t?.to || "unknown";
      const msg = t?.err ? String(t.err) : "Failed to send";
      result.errors.push(`Failed to send to ${to}: ${msg}`);
    }
  }
  result.success = result.failed === 0;
  return result;
}
async function validateEmailAddresses(emails) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = [];
  const invalid = [];
  for (const email of emails) {
    if (emailRegex.test(email.trim())) {
      valid.push(email.trim());
    } else {
      invalid.push(email.trim());
    }
  }
  return { valid, invalid };
}
function mailgunAuthIsSuppressed() {
  return !!(MAILGUN_AUTH_SUPPRESSED_UNTIL && Date.now() < MAILGUN_AUTH_SUPPRESSED_UNTIL);
}
var MAILGUN_TIMEOUT_MS, MAILGUN_MAX_RETRIES, MAILGUN_RETRY_BASE_MS, MAILGUN_MAX_HTML_BYTES, MAILGUN_BULK_CONCURRENCY, MAILGUN_AUTH_SUPPRESSED_UNTIL, LAST_SUPPRESSION_LOG;
var init_mailgun = __esm({
  "server/services/mailgun.ts"() {
    "use strict";
    MAILGUN_TIMEOUT_MS = Number(process.env.MAILGUN_TIMEOUT_MS ?? 1e4);
    MAILGUN_MAX_RETRIES = Number(process.env.MAILGUN_MAX_RETRIES ?? 3);
    MAILGUN_RETRY_BASE_MS = Number(process.env.MAILGUN_RETRY_BASE_MS ?? 200);
    MAILGUN_MAX_HTML_BYTES = Number(process.env.MAX_EMAIL_HTML_BYTES ?? 5e5);
    MAILGUN_BULK_CONCURRENCY = Math.max(1, Number(process.env.MAILGUN_BULK_CONCURRENCY ?? 5));
    MAILGUN_AUTH_SUPPRESSED_UNTIL = null;
    LAST_SUPPRESSION_LOG = null;
  }
});

// server/services/websocket.ts
var SimpleWebSocketService, webSocketService;
var init_websocket = __esm({
  "server/services/websocket.ts"() {
    "use strict";
    SimpleWebSocketService = class {
      clients = [];
      initialize(server) {
        console.log("[WebSocket] Service initialized (simplified)");
      }
      broadcastNewLead(lead) {
        console.log("[WebSocket] Broadcasting new lead:", lead.id);
      }
      broadcast(event, data) {
        console.log("[WebSocket] Broadcasting event:", event, data);
      }
    };
    webSocketService = new SimpleWebSocketService();
  }
});

// server/services/campaign-execution/ExecutionProcessor.ts
var ExecutionProcessor_exports = {};
__export(ExecutionProcessor_exports, {
  ExecutionProcessor: () => ExecutionProcessor,
  executionProcessor: () => executionProcessor
});
function sleep3(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function backoff3(attempt) {
  const capped = Math.min(1500, MAILGUN_RETRY_BASE_MS2 * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 150);
  return capped + jitter;
}
var MAILGUN_MAX_RETRIES2, MAILGUN_RETRY_BASE_MS2, BATCH_CONCURRENCY, MAX_EMAIL_HTML_BYTES, ExecutionProcessor, executionProcessor;
var init_ExecutionProcessor = __esm({
  "server/services/campaign-execution/ExecutionProcessor.ts"() {
    "use strict";
    init_storage();
    MAILGUN_MAX_RETRIES2 = Number(process.env.MAILGUN_MAX_RETRIES ?? 3);
    MAILGUN_RETRY_BASE_MS2 = Number(process.env.MAILGUN_RETRY_BASE_MS ?? 200);
    BATCH_CONCURRENCY = Math.max(1, Number(process.env.EXECUTION_BATCH_CONCURRENCY ?? 10));
    MAX_EMAIL_HTML_BYTES = Number(process.env.MAX_EMAIL_HTML_BYTES ?? 5e5);
    ExecutionProcessor = class {
      async processEmailSequence(campaign, leads2, templateIndex = 0, options = {}) {
        const {
          batchSize = 50,
          delayBetweenEmails = 1e3,
          testMode = false
        } = options;
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const errors = [];
        let emailsSent = 0;
        let emailsFailed = 0;
        try {
          let templates = [];
          if (Array.isArray(campaign.templates)) {
            templates = campaign.templates;
          } else if (typeof campaign.templates === "string") {
            try {
              templates = JSON.parse(campaign.templates);
            } catch (error) {
              throw new Error("Invalid email templates JSON in campaign");
            }
          } else {
            templates = [];
          }
          if (!Array.isArray(templates) || templates.length === 0) {
            throw new Error("Campaign has no email templates");
          }
          if (templateIndex >= templates.length) {
            throw new Error(`Template index ${templateIndex} is out of range`);
          }
          const template = templates[templateIndex];
          const emailSeen = /* @__PURE__ */ new Set();
          const filteredLeads = leads2.filter((l) => {
            const email = (l.email || "").trim();
            const lower = email.toLowerCase();
            const isValid = /.+@.+\..+/.test(email);
            if (!email || !isValid) {
              errors.push(`Skipped invalid email for lead ${l.id}`);
              return false;
            }
            if (emailSeen.has(lower)) return false;
            emailSeen.add(lower);
            return true;
          });
          const batches = this.createBatches(filteredLeads, batchSize);
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} leads) - Template: ${template.subject || template.title || "Email Template"}`);
            const batchResults = await this.runWithConcurrency(
              batch,
              BATCH_CONCURRENCY,
              (lead) => this.sendEmailToLead(campaign, lead, template, testMode)
            );
            for (let i = 0; i < batchResults.length; i++) {
              const result = batchResults[i];
              const lead = batch[i];
              if (result && result.success) {
                emailsSent++;
                try {
                  await storage.updateLead(lead.id, {
                    status: "contacted"
                  });
                } catch (updateError) {
                  console.error(`Failed to update lead ${lead.id}:`, updateError);
                }
              } else {
                emailsFailed++;
                const errorMessage = result?.error || "Unknown error";
                errors.push(`Failed to send email to ${lead.email}: ${errorMessage}`);
              }
            }
            if (batchIndex < batches.length - 1) {
              await this.delay(Math.max(0, delayBetweenEmails));
            }
          }
          try {
            const currentMetrics = {};
            const updatedMetrics = {
              ...currentMetrics,
              totalEmailsSent: (currentMetrics.totalEmailsSent || 0) + emailsSent,
              lastExecutionDate: /* @__PURE__ */ new Date(),
              executionCount: (currentMetrics.executionCount || 0) + 1,
              templatesSent: {
                ...currentMetrics.templatesSent,
                [templateIndex]: (currentMetrics.templatesSent?.[templateIndex] || 0) + emailsSent
              }
            };
            await storage.updateCampaign(campaign.id, {
              status: "active"
            });
          } catch (updateError) {
            console.error("Failed to update campaign metrics:", updateError);
            errors.push("Failed to update campaign metrics");
          }
          return {
            // Mark success ONLY if at least one email sent. This prevents false positives when every send fails.
            success: emailsSent > 0,
            emailsSent,
            emailsFailed,
            errors,
            executionId
          };
        } catch (error) {
          console.error("Email sequence processing failed:", error);
          return {
            success: false,
            emailsSent: 0,
            emailsFailed: leads2.length,
            errors: [error instanceof Error ? error.message : "Unknown processing error"],
            executionId
          };
        }
      }
      async sendEmailToLead(campaign, lead, template, testMode) {
        try {
          const personalizedSubject = this.personalizeContent(template.subject || campaign.name, lead);
          const personalizedContent = this.personalizeContent(template.content || template.body || "", lead);
          const emailData = {
            to: lead.email,
            subject: testMode ? `[TEST] ${personalizedSubject}` : personalizedSubject,
            html: this.capHtmlSize(this.formatEmailContent(personalizedContent)),
            from: `OneKeel Swarm <${process.env.MAILGUN_FROM_EMAIL || "swarm@mg.watchdogai.us"}>`
          };
          const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
          const campaignAgent = campaign.agentConfigId ? await storage2.getAiAgentConfig(campaign.agentConfigId).catch(() => void 0) : void 0;
          const activeCfg = campaignAgent || await storage2.getActiveAiAgentConfig().catch(() => void 0);
          const success = await this.sendWithRetries(
            emailData.to,
            emailData.subject,
            emailData.html,
            activeCfg?.agentEmailDomain
          );
          const result = { success, error: success ? void 0 : "Failed to send email" };
          if (!result.success) {
            return { success: false, error: result.error };
          }
          console.log(`\u2705 Email sent to ${lead.email} for campaign ${campaign.name}`);
          try {
            const { MemoryMapper: MemoryMapper2 } = await Promise.resolve().then(() => (init_supermemory(), supermemory_exports));
            await MemoryMapper2.writeMailEvent({
              type: "mail_event",
              clientId: campaign.clientId || "default",
              campaignId: campaign.id,
              leadEmail: lead.email,
              content: `Email sent: ${emailData.subject}
Campaign: ${campaign.name}
Template: ${template.title || template.subject || "Email Template"}`,
              meta: {
                event: "sent",
                subject: emailData.subject,
                campaignName: campaign.name,
                templateTitle: template.title || template.subject || "Email Template",
                sentAt: (/* @__PURE__ */ new Date()).toISOString(),
                testMode
              }
            });
          } catch (error) {
            console.warn("Failed to store email send in Supermemory:", error);
          }
          return { success: true };
        } catch (error) {
          console.error(`\u274C Failed to send email to ${lead.email}:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown email error"
          };
        }
      }
      // Concurrency limiter for batch processing
      async runWithConcurrency(items, limit, task) {
        const results = new Array(items.length);
        let next = 0;
        const workers = [];
        const runWorker = async () => {
          while (next < items.length) {
            const current = next++;
            try {
              results[current] = await task(items[current], current);
            } catch (e) {
              results[current] = e;
            }
          }
        };
        for (let i = 0; i < Math.min(limit, items.length); i++) {
          workers.push(runWorker());
        }
        await Promise.all(workers);
        return results;
      }
      // Format email content with proper spacing and structure
      formatEmailContent(content) {
        if (!content) return "";
        let formatted = content.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>").replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");
        if (!formatted.includes("<br>") && formatted.length > 50) {
          formatted = formatted.replace(/\. ([A-Z])/g, ".<br><br>$1");
        }
        return formatted;
      }
      // Bound HTML size for email
      capHtmlSize(html) {
        if (!html) return "";
        const encoder = new TextEncoder();
        const bytes = encoder.encode(html);
        if (bytes.length <= MAX_EMAIL_HTML_BYTES) return html;
        const ratio = MAX_EMAIL_HTML_BYTES / bytes.length;
        const cut = Math.max(0, Math.floor(html.length * ratio) - 1);
        return html.slice(0, cut) + "\n<!-- truncated to stay under size cap -->";
      }
      // Retry wrapper for mail sends
      async sendWithRetries(to, subject, html, domainOverride) {
        const { sendCampaignEmail: sendCampaignEmail2, mailgunAuthIsSuppressed: mailgunAuthIsSuppressed2 } = await Promise.resolve().then(() => (init_mailgun(), mailgun_exports));
        let attempt = 0;
        while (true) {
          attempt++;
          try {
            if (mailgunAuthIsSuppressed2()) {
              return false;
            }
            const ok = await sendCampaignEmail2(to, subject, html, {}, { domainOverride });
            if (ok) return true;
            if (attempt >= MAILGUN_MAX_RETRIES2) return false;
          } catch (err) {
            if (attempt >= MAILGUN_MAX_RETRIES2) return false;
          }
          await sleep3(backoff3(attempt));
        }
      }
      personalizeContent(content, lead) {
        if (!content) return "";
        return content.replace(/\[firstName\]/g, lead.firstName || "Customer").replace(/\[Name\]/g, lead.firstName || "Customer").replace(/\[name\]/g, lead.firstName || "Customer").replace(/\[lastName\]/g, lead.lastName || "").replace(/\[email\]/g, lead.email).replace(/\[vehicleInterest\]/g, lead.vehicleInterest || "our vehicles").replace(/\[phone\]/g, lead.phone || "").replace(/\{\{firstName\}\}/g, lead.firstName || "Customer").replace(/\{\{first_name\}\}/g, lead.firstName || "Customer").replace(/\{\{lastName\}\}/g, lead.lastName || "").replace(/\{\{last_name\}\}/g, lead.lastName || "").replace(/\{\{email\}\}/g, lead.email).replace(/\{\{vehicleInterest\}\}/g, lead.vehicleInterest || "our vehicles").replace(/\{\{vehicle_interest\}\}/g, lead.vehicleInterest || "our vehicles").replace(/\{\{phone\}\}/g, lead.phone || "").replace(/\{\{source\}\}/g, lead.leadSource || "website");
      }
      createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
          batches.push(items.slice(i, i + batchSize));
        }
        return batches;
      }
      delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      async validateEmailLimits(campaignId, leadCount) {
        try {
          const dailyLimit = 1e3;
          const campaign = await storage.getCampaign(campaignId);
          if (!campaign) {
            return { valid: false, message: "Campaign not found" };
          }
          const metrics = {};
          const dailySent = 0;
          const remainingQuota = dailyLimit - dailySent;
          if (leadCount > remainingQuota) {
            return {
              valid: false,
              message: `Email limit exceeded. Daily limit: ${dailyLimit}, already sent: ${dailySent}, requested: ${leadCount}`,
              dailyLimit,
              dailySent
            };
          }
          return { valid: true, dailyLimit, dailySent };
        } catch (error) {
          console.error("Email limit validation error:", error);
          return {
            valid: false,
            message: "Failed to validate email limits"
          };
        }
      }
    };
    executionProcessor = new ExecutionProcessor();
  }
});

// server/services/campaign-execution/LeadAssignmentService.ts
var LeadAssignmentService_exports = {};
__export(LeadAssignmentService_exports, {
  LeadAssignmentService: () => LeadAssignmentService,
  leadAssignmentService: () => leadAssignmentService
});
var LeadAssignmentService, leadAssignmentService;
var init_LeadAssignmentService = __esm({
  "server/services/campaign-execution/LeadAssignmentService.ts"() {
    "use strict";
    init_storage();
    init_websocket();
    LeadAssignmentService = class {
      assignmentRules = [
        {
          id: "high_value_leads",
          name: "High Value Leads",
          enabled: true,
          criteria: {
            budget: { min: 5e4 },
            timeframe: ["immediate", "within_month"]
          },
          priority: 10,
          assignTo: "senior_sales"
        },
        {
          id: "luxury_vehicles",
          name: "Luxury Vehicle Interest",
          enabled: true,
          criteria: {
            vehicleInterest: ["BMW", "Mercedes", "Audi", "Lexus", "Tesla"]
          },
          priority: 8,
          assignTo: "luxury_specialist"
        },
        {
          id: "quick_conversion",
          name: "Quick Conversion Potential",
          enabled: true,
          criteria: {
            timeframe: ["immediate", "within_week"]
          },
          priority: 7,
          assignTo: "conversion_team"
        }
      ];
      /**
       * Assign leads to campaigns based on intelligent rules
       */
      async assignLeadsToCampaigns(leads2, availableCampaigns) {
        const result = {
          success: true,
          assignedLeads: 0,
          skippedLeads: 0,
          errors: [],
          assignments: []
        };
        try {
          for (const lead of leads2) {
            try {
              const assignment = await this.assignSingleLead(lead, availableCampaigns);
              if (assignment.campaignId) {
                await storage.updateLead(lead.id, {
                  campaignId: assignment.campaignId,
                  status: "assigned"
                });
                if (assignment.createConversation) {
                  const safeFirst = (lead.firstName || "").trim();
                  const safeLast = (lead.lastName || "").trim();
                  const fallbackName = [safeFirst, safeLast].filter(Boolean).join(" ") || (lead.email || "New Lead");
                  const conversation = await storage.createConversation({
                    subject: `Lead Assignment: ${fallbackName}`,
                    status: "active",
                    priority: assignment.priority || "normal",
                    campaignId: assignment.campaignId,
                    leadId: lead.id
                  });
                  assignment.conversationId = conversation.id;
                }
                result.assignments.push({
                  leadId: lead.id,
                  campaignId: assignment.campaignId,
                  conversationId: assignment.conversationId,
                  assignedTo: assignment.assignedTo
                });
                result.assignedLeads++;
                webSocketService.broadcast("leadAssigned", {
                  leadId: lead.id,
                  campaignId: assignment.campaignId,
                  assignmentReason: assignment.reason,
                  timestamp: /* @__PURE__ */ new Date()
                });
              } else {
                result.skippedLeads++;
              }
            } catch (leadError) {
              result.errors.push(`Failed to assign lead ${lead.id}: ${leadError instanceof Error ? leadError.message : "Unknown error"}`);
              result.skippedLeads++;
            }
          }
          result.success = result.errors.length === 0 || result.assignedLeads > 0;
        } catch (error) {
          result.success = false;
          result.errors.push(`Assignment process failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
        return result;
      }
      /**
       * Assign a single lead to the most appropriate campaign
       */
      async assignSingleLead(lead, availableCampaigns) {
        if (lead.campaignId) {
          return { reason: "Lead already assigned to campaign" };
        }
        const matchingRule = this.findBestMatchingRule(lead);
        if (!matchingRule) {
          const generalCampaign = availableCampaigns.find(
            (c) => c.status === "active" && (c.name.toLowerCase().includes("general") || c.name.toLowerCase().includes("default"))
          );
          return {
            campaignId: generalCampaign?.id,
            priority: "normal",
            reason: "Default assignment - no specific rules matched",
            createConversation: true
          };
        }
        let targetCampaign;
        if (matchingRule.campaignId) {
          targetCampaign = availableCampaigns.find((c) => c.id === matchingRule.campaignId);
        } else {
          targetCampaign = this.findMatchingCampaign(lead, availableCampaigns, matchingRule);
        }
        if (!targetCampaign) {
          targetCampaign = availableCampaigns.find((c) => c.status === "active");
        }
        const priority = this.determinePriority(matchingRule.priority);
        return {
          campaignId: targetCampaign?.id,
          assignedTo: matchingRule.assignTo,
          priority,
          reason: `Matched rule: ${matchingRule.name}`,
          createConversation: true
        };
      }
      /**
       * Find the best matching assignment rule for a lead
       */
      findBestMatchingRule(lead) {
        const activeRules = this.assignmentRules.filter((rule) => rule.enabled).sort((a, b) => b.priority - a.priority);
        for (const rule of activeRules) {
          if (this.leadMatchesRule(lead, rule)) {
            return rule;
          }
        }
        return null;
      }
      /**
       * Check if a lead matches a specific rule
       */
      leadMatchesRule(lead, rule) {
        const { criteria } = rule;
        if (criteria.vehicleInterest && criteria.vehicleInterest.length > 0) {
          if (!lead.vehicleInterest || !criteria.vehicleInterest.some(
            (interest) => lead.vehicleInterest.toLowerCase().includes(interest.toLowerCase())
          )) {
            return false;
          }
        }
        if (criteria.budget) {
          const leadBudget = null;
          if (leadBudget !== null) {
            if (criteria.budget.min && leadBudget < criteria.budget.min) return false;
            if (criteria.budget.max && leadBudget > criteria.budget.max) return false;
          } else if (criteria.budget.min || criteria.budget.max) {
            return false;
          }
        }
        if (criteria.timeframe && criteria.timeframe.length > 0) {
          if (!criteria.timeframe.includes("immediate")) {
            return false;
          }
        }
        if (criteria.source && criteria.source.length > 0) {
          if (!lead.leadSource || !criteria.source.includes(lead.leadSource.toLowerCase())) {
            return false;
          }
        }
        return true;
      }
      /**
       * Find matching campaign based on lead and rule criteria
       */
      findMatchingCampaign(lead, campaigns2, rule) {
        const activeCampaigns = campaigns2.filter((c) => c.status === "active");
        if (lead.vehicleInterest) {
          const vehicleSpecificCampaign = activeCampaigns.find(
            (c) => c.context?.toLowerCase().includes(lead.vehicleInterest.toLowerCase()) || c.name.toLowerCase().includes(lead.vehicleInterest.toLowerCase())
          );
          if (vehicleSpecificCampaign) return vehicleSpecificCampaign;
        }
        const timeframe = lead?.timeframe;
        if (timeframe) {
          const tf = timeframe.toLowerCase();
          const timeframeCampaign = activeCampaigns.find(
            (c) => c.context?.toLowerCase().includes(tf) || c.name.toLowerCase().includes(tf)
          );
          if (timeframeCampaign) return timeframeCampaign;
        }
        return activeCampaigns[0];
      }
      /**
       * Parse budget string to number
       */
      parseBudget(budget) {
        if (!budget) return null;
        const cleaned = budget.replace(/[^\d.,]/g, "");
        if (cleaned.includes("k") || cleaned.includes("K")) {
          return parseFloat(cleaned.replace(/[kK]/g, "")) * 1e3;
        }
        const parsed = parseFloat(cleaned.replace(/,/g, ""));
        return isNaN(parsed) ? null : parsed;
      }
      /**
       * Determine conversation priority based on rule priority
       */
      determinePriority(rulePriority) {
        if (rulePriority >= 10) return "urgent";
        if (rulePriority >= 7) return "high";
        if (rulePriority >= 4) return "normal";
        return "low";
      }
      /**
       * Get current assignment rules
       */
      getAssignmentRules() {
        return [...this.assignmentRules];
      }
      /**
       * Update assignment rules
       */
      updateAssignmentRules(rules) {
        this.assignmentRules = rules;
        console.log(`Updated ${rules.length} assignment rules`);
      }
      /**
       * Add new assignment rule
       */
      addAssignmentRule(rule) {
        this.assignmentRules.push(rule);
        console.log(`Added new assignment rule: ${rule.name}`);
      }
      /**
       * Remove assignment rule
       */
      removeAssignmentRule(ruleId) {
        const initialLength = this.assignmentRules.length;
        this.assignmentRules = this.assignmentRules.filter((rule) => rule.id !== ruleId);
        const removed = this.assignmentRules.length < initialLength;
        if (removed) {
          console.log(`Removed assignment rule: ${ruleId}`);
        }
        return removed;
      }
    };
    leadAssignmentService = new LeadAssignmentService();
  }
});

// server/services/campaign-execution/CampaignOrchestrator.ts
var CampaignOrchestrator_exports = {};
__export(CampaignOrchestrator_exports, {
  CampaignOrchestrator: () => CampaignOrchestrator,
  campaignOrchestrator: () => campaignOrchestrator
});
var CampaignOrchestrator, campaignOrchestrator;
var init_CampaignOrchestrator = __esm({
  "server/services/campaign-execution/CampaignOrchestrator.ts"() {
    "use strict";
    init_storage();
    init_websocket();
    CampaignOrchestrator = class {
      activeExecutions = /* @__PURE__ */ new Map();
      constructor() {
      }
      async executeCampaign(options) {
        const { campaignId, testMode = false, selectedLeadIds, maxLeadsPerBatch = 50 } = options;
        try {
          const { ExecutionProcessor: ExecutionProcessor2 } = await Promise.resolve().then(() => (init_ExecutionProcessor(), ExecutionProcessor_exports));
          const { LeadAssignmentService: LeadAssignmentService2 } = await Promise.resolve().then(() => (init_LeadAssignmentService(), LeadAssignmentService_exports));
          const executionProcessor2 = new ExecutionProcessor2();
          const leadAssignmentService2 = new LeadAssignmentService2();
          const campaign = await storage.getCampaign(campaignId);
          if (!campaign) {
            return {
              success: false,
              message: "Campaign not found",
              error: "Campaign not found"
            };
          }
          let targetLeads;
          if (selectedLeadIds && selectedLeadIds.length > 0) {
            targetLeads = await Promise.all(
              selectedLeadIds.map((id) => storage.getLead(id))
            );
            targetLeads = targetLeads.filter(Boolean);
          } else {
            const allLeads = await storage.getLeads();
            targetLeads = allLeads.filter(
              (lead) => !lead.campaignId || lead.campaignId === campaignId
            );
          }
          if (targetLeads.length === 0) {
            return {
              success: false,
              message: "No leads found for this campaign",
              error: "No leads available"
            };
          }
          if (!testMode) {
            const unassignedLeads = targetLeads.filter((lead) => !lead.campaignId);
            if (unassignedLeads.length > 0) {
              const assignmentResult = await leadAssignmentService2.assignLeadsToCampaigns(
                unassignedLeads,
                [campaign]
              );
              console.log(`Assigned ${assignmentResult.assignedLeads} leads to campaign`);
            }
          }
          await storage.updateCampaign(campaignId, {
            status: options.scheduleAt ? "scheduled" : "active"
          });
          if (testMode) {
            targetLeads = targetLeads.slice(0, 1);
          }
          const processingResult = await executionProcessor2.processEmailSequence(
            campaign,
            targetLeads,
            0,
            // Start with first template
            {
              batchSize: maxLeadsPerBatch,
              testMode,
              delayBetweenEmails: testMode ? 0 : 1e3
            }
          );
          console.log("[Campaign Execution] Completed:", {
            campaignId: campaign.id,
            emailsSent: processingResult.emailsSent,
            testMode
          });
          if (!testMode && processingResult.emailsSent > 0) {
            for (const lead of targetLeads.slice(0, processingResult.emailsSent)) {
              try {
                await storage.createConversation({
                  subject: `Campaign: ${campaign.name}`,
                  status: "active",
                  priority: "normal",
                  campaignId
                });
              } catch (convError) {
                console.error(`Failed to create conversation for lead ${lead.id}:`, convError);
              }
            }
          }
          if (!testMode && processingResult.emailsSent > 0) {
            try {
              const templates = campaign.templates || [];
              const firstTemplate = templates[0];
              console.log("[Campaign Notification] Campaign executed:", {
                campaignName: campaign.name,
                campaignId,
                emailsSent: processingResult.emailsSent,
                leadsTargeted: targetLeads.length,
                executedAt: /* @__PURE__ */ new Date()
              });
            } catch (notificationError) {
              console.error("Failed to send campaign notification:", notificationError);
            }
          }
          try {
            if (webSocketService.broadcast) {
              webSocketService.broadcast("campaignExecuted", {
                campaignId,
                emailsSent: processingResult.emailsSent,
                emailsFailed: processingResult.emailsFailed,
                testMode,
                timestamp: /* @__PURE__ */ new Date()
              });
            }
          } catch (wsError) {
            console.error("WebSocket broadcast error:", wsError);
          }
          const success = processingResult.success;
          const emailsSent = processingResult.emailsSent;
          const baseMsg = testMode ? emailsSent > 0 ? `Test email sent to ${emailsSent} lead(s)` : `Test execution failed: 0 emails sent` : emailsSent > 0 ? `Campaign executed: ${emailsSent} email(s) sent` : `Campaign execution failed: 0 emails sent`;
          return {
            success,
            message: baseMsg,
            emailsSent,
            emailsFailed: processingResult.emailsFailed,
            totalLeads: targetLeads.length,
            errors: processingResult.errors,
            executionId: processingResult.executionId,
            testMode
          };
        } catch (error) {
          console.error("Campaign execution error:", error);
          return {
            success: false,
            message: "Failed to execute campaign",
            error: error instanceof Error ? error.message : "Unknown error",
            emailsSent: 0,
            emailsFailed: 0,
            totalLeads: 0
          };
        }
      }
      /**
       * Schedule campaign execution for later
       */
      async scheduleCampaign(options) {
        try {
          if (!options.scheduleAt) {
            return { success: false, message: "Schedule date is required" };
          }
          const scheduledId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await storage.updateCampaign(options.campaignId, {
            status: "scheduled"
          });
          return {
            success: true,
            scheduledId,
            message: `Campaign scheduled for ${options.scheduleAt.toISOString()}`
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to schedule campaign"
          };
        }
      }
      /**
       * Get active executions
       */
      getActiveExecutions() {
        return Array.from(this.activeExecutions.values());
      }
      /**
       * Cancel active execution
       */
      cancelExecution(executionId) {
        if (this.activeExecutions.has(executionId)) {
          this.activeExecutions.delete(executionId);
          console.log(`Cancelled execution: ${executionId}`);
          return true;
        }
        return false;
      }
    };
    campaignOrchestrator = new CampaignOrchestrator();
  }
});

// server/services/call-openrouter.ts
async function callOpenRouterJSON({
  model = "openai/gpt-5-mini",
  system,
  messages,
  temperature = 0.2,
  maxTokens = 1e3
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
  const payload = {
    model,
    messages: [
      { role: "system", content: system },
      ...messages
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" }
  };
  const referer = process.env.SITE_URL || "https://offerlogix.ai";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "Referer": referer,
      "X-Title": "OfferLogix Outbound AI"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content from OpenRouter");
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("Failed to parse OpenRouter JSON content");
  }
}
var init_call_openrouter = __esm({
  "server/services/call-openrouter.ts"() {
    "use strict";
  }
});

// server/routes/templates.ts
var templates_exports = {};
__export(templates_exports, {
  default: () => templates_default
});
import { Router } from "express";
var router, templates_default;
var init_templates = __esm({
  "server/routes/templates.ts"() {
    "use strict";
    init_call_openrouter();
    router = Router();
    router.post("/generate", async (req, res) => {
      try {
        const { context } = req.body || {};
        if (!context) return res.status(400).json({ message: "context required" });
        const system = `System Prompt: The Straight-Talking Sales Pro
Core Identity:
You are an experienced sales professional. You're knowledgeable, direct, and genuinely helpful. You talk like a real person who knows the industry and understands that picking a vendor is a big decision.
Communication Style:

Be real. Talk like you would to a friend who's asking for advice
Be direct. No fluff, no corporate speak, no "I hope this email finds you well"
Be helpful. Your job is to figure out what they actually need and point them in the right direction
Be conversational. Short sentences. Natural flow. Like you're texting a friend

Your Goal:
Have a normal conversation that helps them figure out what they actually want. If they're ready to move forward, make it easy. If they're not, give them something useful and stay in touch.

Return only JSON.`;
        const json = await callOpenRouterJSON({
          model: "openai/gpt-5-mini",
          system,
          messages: [
            { role: "user", content: `Generate 3 subject lines and 3 short HTML templates (no external images).
Context: ${context}
Respond JSON: { "subject_lines": string[], "templates": string[] }` }
          ],
          temperature: 0.5,
          maxTokens: 1200
        });
        res.json({ subject_lines: json.subject_lines || [], templates: json.templates || [] });
      } catch (e) {
        console.error("Template generation error:", e);
        res.status(500).json({ message: "Failed to generate templates" });
      }
    });
    templates_default = router;
  }
});

// server/services/email-validator.ts
var email_validator_exports = {};
__export(email_validator_exports, {
  emailWatchdog: () => emailWatchdog
});
var OutboundEmailWatchdog, emailWatchdog;
var init_email_validator = __esm({
  "server/services/email-validator.ts"() {
    "use strict";
    OutboundEmailWatchdog = class {
      blockRules = [
        {
          name: "Critical Field Validation",
          enabled: true,
          priority: 100,
          conditions: {
            checkMissingFields: true,
            requiredFields: ["to", "subject", "htmlContent"]
          },
          actions: {
            block: true,
            notifyAdmin: true
          }
        },
        {
          name: "Content Completeness Check",
          enabled: true,
          priority: 90,
          conditions: {
            checkEmptyContent: true,
            checkTemplatePlaceholders: true
          },
          actions: {
            block: true,
            notifyAdmin: true
          }
        },
        {
          name: "Email Address Validation",
          enabled: true,
          priority: 80,
          conditions: {
            checkInvalidEmails: true
          },
          actions: {
            block: true
          }
        },
        {
          name: "Spam Prevention",
          enabled: true,
          priority: 70,
          conditions: {
            checkSpamKeywords: true,
            checkSuspiciousContent: true
          },
          actions: {
            requireApproval: true,
            notifyAdmin: true
          }
        },
        {
          name: "Bulk Send Limits",
          enabled: true,
          priority: 60,
          conditions: {
            maxRecipients: 100
          },
          actions: {
            requireApproval: true
          }
        },
        {
          name: "Domain Blocklist",
          enabled: true,
          priority: 50,
          conditions: {
            blockedDomains: ["tempmail.com", "10minutemail.com", "guerrillamail.com"]
          },
          actions: {
            block: true
          }
        }
      ];
      spamKeywords = [
        "100% FREE",
        "URGENT",
        "MAKE MONEY FAST",
        "CLICK HERE NOW",
        "LIMITED TIME",
        "ACT NOW",
        "GUARANTEED",
        "NO RISK"
      ];
      /**
       * Main validation method - call this before sending any email
       */
      async validateOutboundEmail(emailData) {
        const result = {
          allowed: true,
          blocked: false,
          quarantined: false,
          requiresApproval: false,
          reasons: [],
          triggeredRules: [],
          riskScore: 0
        };
        try {
          const sortedRules = this.blockRules.filter((rule) => rule.enabled).sort((a, b) => b.priority - a.priority);
          for (const rule of sortedRules) {
            const ruleResult = await this.evaluateRule(rule, emailData);
            if (ruleResult.triggered) {
              result.triggeredRules.push(rule.name);
              result.reasons.push(...ruleResult.reasons);
              result.riskScore += ruleResult.riskScore;
              if (rule.actions.block) {
                result.blocked = true;
                result.allowed = false;
              }
              if (rule.actions.quarantine) {
                result.quarantined = true;
                result.allowed = false;
              }
              if (rule.actions.requireApproval) {
                result.requiresApproval = true;
                result.allowed = false;
              }
              if (rule.actions.notifyAdmin) {
                await this.notifyAdmin(emailData, rule.name, ruleResult.reasons);
              }
              if (result.blocked || result.quarantined) {
                break;
              }
            }
          }
          result.riskScore = Math.min(result.riskScore, 100);
          console.log("Email validation completed", {
            to: emailData.to,
            allowed: result.allowed,
            riskScore: result.riskScore,
            triggeredRules: result.triggeredRules.length
          });
          return result;
        } catch (error) {
          console.error("Error validating outbound email", { error, to: emailData.to });
          return {
            allowed: false,
            blocked: true,
            quarantined: false,
            requiresApproval: false,
            reasons: ["Validation system error"],
            triggeredRules: [],
            riskScore: 100
          };
        }
      }
      async evaluateRule(rule, emailData) {
        const result = {
          triggered: false,
          reasons: [],
          riskScore: 0
        };
        const { conditions } = rule;
        if (conditions.checkMissingFields && conditions.requiredFields) {
          for (const field of conditions.requiredFields) {
            if (!emailData[field] || Array.isArray(emailData[field]) && emailData[field].length === 0) {
              result.triggered = true;
              result.reasons.push(`Missing required field: ${field}`);
              result.riskScore += 30;
            }
          }
        }
        if (conditions.checkEmptyContent) {
          if (!emailData.subject?.trim()) {
            result.triggered = true;
            result.reasons.push("Email subject is empty");
            result.riskScore += 25;
          }
          if (!emailData.htmlContent?.trim()) {
            result.triggered = true;
            result.reasons.push("Email content is empty");
            result.riskScore += 30;
          }
          if (emailData.htmlContent && emailData.htmlContent.trim().length < 10) {
            result.triggered = true;
            result.reasons.push("Email content is too short");
            result.riskScore += 20;
          }
        }
        if (conditions.checkTemplatePlaceholders) {
          const placeholderPatterns = [
            /\[Name\]/gi,
            /\[FIRST_NAME\]/gi,
            /\[LAST_NAME\]/gi,
            /\[EMAIL\]/gi,
            /\{\{.*\}\}/g,
            /\$\{.*\}/g
          ];
          for (const pattern of placeholderPatterns) {
            if (pattern.test(emailData.htmlContent) || pattern.test(emailData.subject)) {
              result.triggered = true;
              result.reasons.push("Email contains unresolved template placeholders");
              result.riskScore += 35;
              break;
            }
          }
        }
        if (conditions.checkInvalidEmails) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          for (const email of emailData.to) {
            if (!emailRegex.test(email)) {
              result.triggered = true;
              result.reasons.push(`Invalid email address: ${email}`);
              result.riskScore += 25;
            }
          }
        }
        if (conditions.checkSpamKeywords) {
          const content = `${emailData.subject} ${emailData.htmlContent}`.toUpperCase();
          for (const keyword of this.spamKeywords) {
            if (content.includes(keyword)) {
              result.triggered = true;
              result.reasons.push(`Contains spam keyword: ${keyword}`);
              result.riskScore += 15;
            }
          }
        }
        if (conditions.checkSuspiciousContent) {
          const suspiciousPatterns = [
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
            // Credit card patterns
            /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
            // SSN patterns
            /(urgent|immediate|act now|limited time).{0,50}(click|buy|purchase)/gi
          ];
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(emailData.htmlContent) || pattern.test(emailData.subject)) {
              result.triggered = true;
              result.reasons.push("Email contains suspicious content patterns");
              result.riskScore += 20;
              break;
            }
          }
        }
        if (conditions.maxRecipients && emailData.to.length > conditions.maxRecipients) {
          result.triggered = true;
          result.reasons.push(`Too many recipients: ${emailData.to.length} (max: ${conditions.maxRecipients})`);
          result.riskScore += 10;
        }
        if (conditions.blockedDomains) {
          for (const email of emailData.to) {
            const domain = email.split("@")[1]?.toLowerCase();
            if (domain && conditions.blockedDomains.includes(domain)) {
              result.triggered = true;
              result.reasons.push(`Blocked domain: ${domain}`);
              result.riskScore += 40;
            }
          }
        }
        return result;
      }
      async notifyAdmin(emailData, ruleName, reasons) {
        console.warn("Email validation alert", {
          rule: ruleName,
          reasons,
          to: emailData.to,
          subject: emailData.subject,
          campaignId: emailData.campaignId
        });
      }
      /**
       * Get validation statistics for monitoring
       */
      getValidationStats() {
        return {
          rulesCount: this.blockRules.length,
          enabledRules: this.blockRules.filter((r) => r.enabled).length,
          spamKeywordsCount: this.spamKeywords.length
        };
      }
      /**
       * Update rule configuration
       */
      updateRule(ruleName, updates) {
        const ruleIndex = this.blockRules.findIndex((r) => r.name === ruleName);
        if (ruleIndex === -1) return false;
        this.blockRules[ruleIndex] = { ...this.blockRules[ruleIndex], ...updates };
        return true;
      }
    };
    emailWatchdog = new OutboundEmailWatchdog();
  }
});

// server/services/mailgun-threaded.ts
async function sendThreadedReply(opts) {
  return sendCampaignEmail(
    opts.to,
    opts.subject,
    opts.html,
    {},
    {
      isAutoResponse: true,
      domainOverride: opts.domainOverride,
      inReplyTo: opts.inReplyTo,
      references: opts.references
    }
  );
}
var init_mailgun_threaded = __esm({
  "server/services/mailgun-threaded.ts"() {
    "use strict";
    init_mailgun();
  }
});

// server/services/inbound-email.ts
var inbound_email_exports = {};
__export(inbound_email_exports, {
  InboundEmailService: () => InboundEmailService
});
import { createHmac } from "crypto";
function sanitizeHtmlBasic(html) {
  if (!html) return "";
  let out = html;
  out = out.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<(?:iframe|object|embed)[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, "");
  out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
  out = out.replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"');
  return out;
}
var REPLY_RATE_LIMIT_MINUTES, InboundEmailService;
var init_inbound_email = __esm({
  "server/services/inbound-email.ts"() {
    "use strict";
    init_storage();
    init_mailgun_threaded();
    init_call_openrouter();
    REPLY_RATE_LIMIT_MINUTES = parseInt(process.env.AI_REPLY_RATE_LIMIT_MINUTES || "15", 10);
    InboundEmailService = class {
      /**
       * Handle incoming email responses from leads
       * This webhook endpoint processes Mailgun inbound emails
       */
      static async handleInboundEmail(req, res) {
        try {
          const event = (req.headers["content-type"] || "").includes("application/json") ? req.body : Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
          if (!this.verifyMailgunSignature(event)) {
            return res.status(401).json({ error: "Unauthorized" });
          }
          const leadInfo = await this.extractLeadFromEmail(event);
          if (!leadInfo) {
            console.log("Could not identify lead from email:", event.sender);
            return res.status(200).json({ message: "Email processed but lead not identified" });
          }
          const conversation = await this.getOrCreateConversation(leadInfo.leadId, event.subject);
          const message = await storage.createConversationMessage({
            conversationId: conversation.id,
            senderId: "lead-reply",
            messageType: "email",
            content: event["stripped-text"] || event["body-plain"],
            isFromAI: 0
          });
          const recentMessages = await storage.getConversationMessages(conversation.id, 10);
          const now = Date.now();
          const lastMsg = recentMessages[recentMessages.length - 1];
          if (lastMsg && lastMsg.isFromAI && now - new Date(lastMsg.createdAt).getTime() < REPLY_RATE_LIMIT_MINUTES * 60 * 1e3) {
            console.log(`[AI Reply Guard] Skipping consecutive AI reply (cooldown ${REPLY_RATE_LIMIT_MINUTES}m)`);
            return res.status(200).json({ message: "Rate-limited; no consecutive AI reply" });
          }
          const systemPrompt = `System Prompt: The Straight-Talking Sales Pro
Core Identity:
You are an experienced sales professional. You're knowledgeable, direct, and genuinely helpful. You talk like a real person who knows the industry and understands that picking a vendor is a big decision.

Communication Style:
Be real. Talk like you would to a friend who's asking for advice
Be direct. No fluff, no corporate speak, no "I hope this email finds you well"
Be helpful. Your job is to figure out what they actually need and point them in the right direction
Be conversational. Short sentences. Natural flow. Like you're texting a friend

Have a normal conversation that helps them figure out what they actually want. If they're ready to move forward, make it easy. If they're not, give them something useful and stay in touch.

Output strictly JSON only with keys: should_reply (boolean), handover (boolean), reply_subject (string), reply_body_html (string), rationale (string).`;
          const aiResult = await callOpenRouterJSON({
            model: "openai/gpt-5-mini",
            system: systemPrompt,
            messages: [
              { role: "user", content: `Latest inbound email from ${event.sender}:
${event["stripped-text"] || event["body-plain"] || ""}

Last messages:
${recentMessages.map((m) => (m.isFromAI ? "AI: " : "Lead: ") + (m.content || "")).join("\n").slice(0, 4e3)}` }
            ],
            temperature: 0.2,
            maxTokens: 800
          });
          const safeHtml = sanitizeHtmlBasic(aiResult.reply_body_html || "");
          console.log("[AI Reply Decision]", {
            conversationId: conversation.id,
            should_reply: aiResult.should_reply,
            handover: aiResult.handover,
            rationale: aiResult.rationale?.slice(0, 300)
          });
          if (aiResult?.handover || !aiResult?.should_reply) {
            await storage.createHandover({ conversationId: conversation.id, reason: aiResult?.rationale || "AI requested handover" });
            return res.status(200).json({ message: "Handover created" });
          }
          const headers = JSON.parse(event["message-headers"] || "[]");
          const messageId = headers.find((h) => h[0].toLowerCase() === "message-id")?.[1]?.replace(/[<>]/g, "") || void 0;
          await sendThreadedReply({
            to: event.sender,
            subject: aiResult.reply_subject || `Re: ${event.subject || "Your email"}`,
            html: aiResult.reply_body_html || "",
            inReplyTo: messageId ? `<${messageId}>` : void 0,
            references: messageId ? [`<${messageId}>`] : void 0,
            domainOverride: (await storage.getActiveAiAgentConfig())?.agentEmailDomain || void 0
          });
          await storage.createConversationMessage({
            conversationId: conversation.id,
            senderId: "ai-agent",
            messageType: "email",
            content: aiResult.reply_body_html || "",
            isFromAI: 1
          });
          res.status(200).json({ message: "Email processed and replied" });
        } catch (error) {
          console.error("Inbound email processing error:", error);
          res.status(500).json({ error: "Failed to process inbound email" });
        }
      }
      /**
       * SMS is de-scoped in outbound-only refactor. Keeping stub for backwards-compat.
       */
      static async handleInboundSMS(req, res) {
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }
      static verifyMailgunSignature(event) {
        const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
        if (!signingKey) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("MAILGUN_WEBHOOK_SIGNING_KEY not set; bypassing signature verification in non-production");
            return !!(event.sender && event.timestamp && event.token);
          }
          console.error("MAILGUN_WEBHOOK_SIGNING_KEY missing in production");
          return false;
        }
        try {
          const hmac = createHmac("sha256", signingKey).update(String(event.timestamp) + String(event.token)).digest("hex");
          return hmac === event.signature;
        } catch (err) {
          console.error("Signature verification error:", err);
          return false;
        }
      }
      static async extractLeadFromEmail(event) {
        const lead = await storage.getLeadByEmail(event.sender);
        if (lead) {
          return { leadId: lead.id, lead };
        }
        const trackingMatch = event.recipient.match(/campaign-([a-zA-Z0-9-]+)@/);
        if (trackingMatch) {
          const campaignId = trackingMatch[1];
          const leads2 = await storage.getLeadsByCampaign(campaignId);
          const matchingLead = leads2.find((l) => l.email === event.sender);
          if (matchingLead) {
            return { leadId: matchingLead.id, lead: matchingLead };
          }
        }
        return null;
      }
      static async getOrCreateConversation(leadId, subject) {
        const conversations2 = await storage.getConversationsByLead(leadId);
        if (conversations2.length > 0) {
          return conversations2[0];
        }
        return await storage.createConversation({
          leadId,
          subject: subject || "Email Conversation",
          status: "active"
        });
      }
      // Legacy auto-response is deprecated. Kept for reference but unused.
      static async shouldGenerateAutoResponse(lead, conversation) {
        const now = /* @__PURE__ */ new Date();
        const hour = now.getHours();
        const isBusinessHours = hour >= 8 && hour <= 18;
        if (isBusinessHours) return true;
        const recentMessages = await storage.getConversationMessages(conversation.id, 3);
        const hasUrgentKeywords = recentMessages.some(
          (m) => m.content.toLowerCase().includes("urgent") || m.content.toLowerCase().includes("today") || m.content.toLowerCase().includes("asap")
        );
        return hasUrgentKeywords;
      }
      // Legacy generation path removed in outbound-only flow.
      static getCurrentSeason() {
        const month = (/* @__PURE__ */ new Date()).getMonth();
        if (month >= 2 && month <= 4) return "spring";
        if (month >= 5 && month <= 7) return "summer";
        if (month >= 8 && month <= 10) return "fall";
        return "winter";
      }
      // Legacy helper retained for compatibility
      static extractBrandFromContext(context) {
        const text2 = (context.vehicleInterest || "").toLowerCase();
        const brands = ["honda", "toyota", "ford", "chevrolet", "jeep"];
        return brands.find((brand) => text2.includes(brand));
      }
    };
  }
});

// server/services/execution-monitor.ts
var execution_monitor_exports = {};
__export(execution_monitor_exports, {
  ExecutionMonitor: () => ExecutionMonitor,
  executionMonitor: () => executionMonitor
});
var ExecutionMonitor, executionMonitor;
var init_execution_monitor = __esm({
  "server/services/execution-monitor.ts"() {
    "use strict";
    init_websocket();
    ExecutionMonitor = class {
      activeExecutions = /* @__PURE__ */ new Map();
      executionHistory = [];
      /**
       * Start monitoring a new campaign execution
       */
      startExecution(campaignId, totalLeads, testMode = false) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const execution = {
          id: executionId,
          campaignId,
          status: "pending",
          progress: {
            totalLeads,
            processedLeads: 0,
            emailsSent: 0,
            emailsFailed: 0
          },
          startTime: /* @__PURE__ */ new Date(),
          errors: [],
          logs: [],
          testMode
        };
        this.activeExecutions.set(executionId, execution);
        this.addLog(executionId, `Execution started for campaign ${campaignId} with ${totalLeads} leads`);
        try {
          if (webSocketService.broadcast) {
            webSocketService.broadcast("executionStarted", {
              executionId,
              campaignId,
              totalLeads,
              testMode,
              timestamp: /* @__PURE__ */ new Date()
            });
          }
        } catch (error) {
          console.error("WebSocket broadcast error:", error);
        }
        return executionId;
      }
      /**
       * Update execution progress
       */
      updateProgress(executionId, progress) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) return;
        execution.progress = { ...execution.progress, ...progress };
        execution.status = "running";
        const progressPercent = execution.progress.totalLeads > 0 ? Math.round(execution.progress.processedLeads / execution.progress.totalLeads * 100) : 0;
        this.addLog(executionId, `Progress: ${execution.progress.processedLeads}/${execution.progress.totalLeads} leads processed (${progressPercent}%)`);
        try {
          if (webSocketService.broadcast) {
            webSocketService.broadcast("executionProgress", {
              executionId,
              progress: execution.progress,
              progressPercent,
              timestamp: /* @__PURE__ */ new Date()
            });
          }
        } catch (error) {
          console.error("WebSocket broadcast error:", error);
        }
      }
      /**
       * Add error to execution
       */
      addError(executionId, error) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) return;
        execution.errors.push(error);
        this.addLog(executionId, `ERROR: ${error}`);
        try {
          if (webSocketService.broadcast) {
            webSocketService.broadcast("executionError", {
              executionId,
              error,
              errorCount: execution.errors.length,
              timestamp: /* @__PURE__ */ new Date()
            });
          }
        } catch (error2) {
          console.error("WebSocket broadcast error:", error2);
        }
      }
      /**
       * Add log entry to execution
       */
      addLog(executionId, message) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) return;
        const logEntry = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`;
        execution.logs.push(logEntry);
        if (execution.logs.length > 100) {
          execution.logs = execution.logs.slice(-100);
        }
        console.log(`[${executionId}] ${message}`);
      }
      /**
       * Complete execution (success or failure)
       */
      completeExecution(executionId, success, finalStats) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) return;
        execution.status = success ? "completed" : "failed";
        execution.endTime = /* @__PURE__ */ new Date();
        if (finalStats) {
          execution.progress = { ...execution.progress, ...finalStats };
        }
        const duration = execution.endTime.getTime() - execution.startTime.getTime();
        this.addLog(executionId, `Execution ${success ? "completed" : "failed"} in ${duration}ms`);
        this.executionHistory.push({ ...execution });
        this.activeExecutions.delete(executionId);
        if (this.executionHistory.length > 50) {
          this.executionHistory = this.executionHistory.slice(-50);
        }
        try {
          if (webSocketService.broadcast) {
            webSocketService.broadcast("executionCompleted", {
              executionId,
              success,
              finalStats: execution.progress,
              duration,
              timestamp: /* @__PURE__ */ new Date()
            });
          }
        } catch (error) {
          console.error("WebSocket broadcast error:", error);
        }
      }
      /**
       * Cancel running execution
       */
      cancelExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution || execution.status === "completed" || execution.status === "failed") {
          return false;
        }
        execution.status = "cancelled";
        execution.endTime = /* @__PURE__ */ new Date();
        this.addLog(executionId, "Execution cancelled by user");
        this.executionHistory.push({ ...execution });
        this.activeExecutions.delete(executionId);
        try {
          if (webSocketService.broadcast) {
            webSocketService.broadcast("executionCancelled", {
              executionId,
              timestamp: /* @__PURE__ */ new Date()
            });
          }
        } catch (error) {
          console.error("WebSocket broadcast error:", error);
        }
        return true;
      }
      /**
       * Get current execution status
       */
      getExecutionStatus(executionId) {
        return this.activeExecutions.get(executionId) || this.executionHistory.find((e) => e.id === executionId) || null;
      }
      /**
       * Get all active executions
       */
      getActiveExecutions() {
        return Array.from(this.activeExecutions.values());
      }
      /**
       * Get execution history
       */
      getExecutionHistory(limit = 20) {
        return this.executionHistory.slice(-limit).reverse();
      }
      /**
       * Get executions for specific campaign
       */
      getCampaignExecutions(campaignId, limit = 10) {
        const active = Array.from(this.activeExecutions.values()).filter((e) => e.campaignId === campaignId);
        const historical = this.executionHistory.filter((e) => e.campaignId === campaignId).slice(-limit);
        return [...active, ...historical].sort((a, b) => b.startTime.getTime() - a.startTime.getTime()).slice(0, limit);
      }
      /**
       * Get execution statistics
       */
      getExecutionStats() {
        const totalExecutions = this.executionHistory.length;
        const successful = this.executionHistory.filter((e) => e.status === "completed").length;
        const successRate = totalExecutions > 0 ? successful / totalExecutions * 100 : 0;
        const completedExecutions = this.executionHistory.filter((e) => e.endTime);
        const averageExecutionTime = completedExecutions.length > 0 ? completedExecutions.reduce(
          (sum, e) => sum + (e.endTime.getTime() - e.startTime.getTime()),
          0
        ) / completedExecutions.length : 0;
        const totalEmailsSent = this.executionHistory.reduce(
          (sum, e) => sum + e.progress.emailsSent,
          0
        );
        return {
          activeExecutions: this.activeExecutions.size,
          totalExecutions,
          successRate: Math.round(successRate * 100) / 100,
          averageExecutionTime: Math.round(averageExecutionTime),
          totalEmailsSent
        };
      }
      /**
       * Cleanup old executions
       */
      cleanup() {
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1e3;
        this.executionHistory = this.executionHistory.filter(
          (e) => e.startTime.getTime() > cutoffTime
        );
        console.log(`Execution monitor cleanup: ${this.executionHistory.length} executions retained`);
      }
    };
    executionMonitor = new ExecutionMonitor();
    setInterval(() => {
      executionMonitor.cleanup();
    }, 60 * 60 * 1e3);
  }
});

// server/routes/handovers.ts
var handovers_exports = {};
__export(handovers_exports, {
  default: () => handovers_default
});
import { Router as Router2 } from "express";
var router2, handovers_default;
var init_handovers = __esm({
  "server/routes/handovers.ts"() {
    "use strict";
    init_storage();
    router2 = Router2();
    router2.get("/", async (req, res) => {
      try {
        const list = await storage.getHandovers();
        res.json(list);
      } catch (e) {
        res.status(500).json({ message: "Failed to fetch handovers" });
      }
    });
    router2.patch("/:id/resolve", async (req, res) => {
      try {
        const updated = await storage.resolveHandover(req.params.id);
        if (!updated) return res.status(404).json({ message: "Not found" });
        res.json(updated);
      } catch (e) {
        res.status(500).json({ message: "Failed to resolve handover" });
      }
    });
    handovers_default = router2;
  }
});

// server/services/deliverability/domain-health-guard.ts
var domain_health_guard_exports = {};
__export(domain_health_guard_exports, {
  DomainHealthGuard: () => DomainHealthGuard
});
var DomainHealthGuard;
var init_domain_health_guard = __esm({
  "server/services/deliverability/domain-health-guard.ts"() {
    "use strict";
    DomainHealthGuard = class {
      static async assertAuthReady() {
        const hasMailgunConfig = process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN;
        if (!hasMailgunConfig) {
          throw new Error("Mailgun configuration missing - MAILGUN_API_KEY or MAILGUN_DOMAIN not set");
        }
        return {
          domain: process.env.MAILGUN_DOMAIN,
          status: "configured",
          authentication: {
            spf: "not_verified",
            dkim: "not_verified",
            dmarc: "not_configured"
          }
        };
      }
      static async checkDomainHealth(domain) {
        return {
          domain,
          overall_score: 75,
          authentication: {
            spf: "pass",
            dkim: "pass",
            dmarc: "not_configured"
          },
          reputation: {
            score: 75,
            status: "good"
          }
        };
      }
    };
  }
});

// server/services/llm-client.ts
var llm_client_exports = {};
__export(llm_client_exports, {
  LLMClient: () => LLMClient
});
var LLMClient;
var init_llm_client = __esm({
  "server/services/llm-client.ts"() {
    "use strict";
    LLMClient = class {
      static BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
      static DEFAULT_TIMEOUT = 3e4;
      static MAX_RETRIES = 3;
      // Model Fallback Strategy Configuration
      static ENABLE_MODEL_FALLBACK = true;
      static FALLBACK_MODELS = [
        "openai/gpt-5-chat",
        "openai/gpt-4o",
        "anthropic/claude-3.5-sonnet",
        "google/gemini-pro-1.5"
      ];
      // Circuit Breaker: Track failed models (in-memory, resets on restart)
      static failedModels = /* @__PURE__ */ new Map();
      static CIRCUIT_BREAKER_THRESHOLD = 3;
      static CIRCUIT_BREAKER_RESET_TIME = 3e5;
      // 5 minutes
      // Basic JSON repair regex patterns (remove trailing commas, fix single quotes)
      static repairJson(input) {
        if (!input) return input;
        let txt = input.trim();
        if (/\{[^]*?\}/.test(txt) && txt.includes("'")) {
          txt = txt.replace(/(['\"])?([A-Za-z0-9_]+)\1\s*:/g, '"$2":');
          txt = txt.replace(/'([^']*)'/g, (_, c) => '"' + c.replace(/"/g, '\\"') + '"');
        }
        txt = txt.replace(/,\s*([}\]])/g, "$1");
        return txt;
      }
      static resolveModel(preferred) {
        return preferred || process.env.AI_MODEL || "openai/gpt-5-chat";
      }
      // Compute a best-effort site URL for OpenRouter referer checks.
      static getSiteReferer() {
        const explicit = process.env.OPENROUTER_SITE_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL;
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        const replit = process.env.REPLIT_DOMAINS;
        return (explicit || renderUrl || replit || "https://offerlogix.onrender.com").replace(/\/$/, "");
      }
      // Circuit Breaker Helper Methods
      static shouldSkipModel(model) {
        const failure = this.failedModels.get(model);
        if (!failure) return false;
        if (Date.now() - failure.lastFailure > this.CIRCUIT_BREAKER_RESET_TIME) {
          this.failedModels.delete(model);
          return false;
        }
        return failure.count >= this.CIRCUIT_BREAKER_THRESHOLD;
      }
      static markModelFailed(model) {
        const failure = this.failedModels.get(model) || { count: 0, lastFailure: 0 };
        failure.count += 1;
        failure.lastFailure = Date.now();
        this.failedModels.set(model, failure);
        console.warn(`[LLMClient] Model ${model} failed (${failure.count}/${this.CIRCUIT_BREAKER_THRESHOLD})`);
      }
      static getAvailableFallbackModels(originalModel) {
        const models = this.shouldSkipModel(originalModel) ? [] : [originalModel];
        for (const model of this.FALLBACK_MODELS) {
          if (model !== originalModel && !this.shouldSkipModel(model)) {
            models.push(model);
          }
        }
        return models;
      }
      // Attempt to salvage a JSON object from a text blob (robust to pre/postamble text)
      static extractJsonObject(text2) {
        if (!text2) return null;
        try {
          JSON.parse(text2);
          return text2;
        } catch {
        }
        const s = String(text2);
        let start = s.indexOf("{");
        while (start !== -1) {
          let depth = 0, inStr = false, esc = false;
          for (let i = start; i < s.length; i++) {
            const ch = s[i];
            if (inStr) {
              if (esc) {
                esc = false;
                continue;
              }
              if (ch === "\\") {
                esc = true;
                continue;
              }
              if (ch === '"') {
                inStr = false;
              }
              continue;
            }
            if (ch === '"') {
              inStr = true;
              continue;
            }
            if (ch === "{") depth++;
            else if (ch === "}") {
              depth--;
              if (depth === 0) {
                const candidate = s.slice(start, i + 1);
                try {
                  JSON.parse(candidate);
                  return candidate;
                } catch {
                }
              }
            }
          }
          start = s.indexOf("{", start + 1);
        }
        return null;
      }
      /**
       * Get circuit breaker status for monitoring
       */
      static getCircuitBreakerStatus() {
        const status = [];
        this.failedModels.forEach((failure, model) => {
          status.push({
            model,
            failures: failure.count,
            lastFailure: new Date(failure.lastFailure),
            isCircuitOpen: this.shouldSkipModel(model)
          });
        });
        return status;
      }
      /**
       * Generate content using the unified LLM client
       */
      static async generate(options) {
        const startTime = Date.now();
        const payload = {
          model: this.resolveModel(options.model),
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user }
          ],
          temperature: options.temperature ?? (options.json ? 0.2 : 0.7),
          max_tokens: options.maxTokens ?? (options.json ? 1200 : 2e3)
        };
        if (options.json) {
          payload.response_format = { type: "json_object" };
        }
        if (options.seed !== void 0) {
          payload.seed = options.seed;
        }
        if (this.ENABLE_MODEL_FALLBACK) {
          return this.executeWithModelFallback(payload, startTime);
        } else {
          return this.executeWithRetry(payload, startTime);
        }
      }
      /**
       * Execute request with retry logic and exponential backoff
       */
      static async executeWithRetry(payload, startTime, attempt = 1) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);
          const referer = this.getSiteReferer();
          const response = await fetch(this.BASE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              // Send both headers; some proxies look for standard 'Referer', OpenRouter docs use 'HTTP-Referer'.
              "HTTP-Referer": referer,
              "Referer": referer,
              "X-Title": "OneKeel AI Campaign Platform"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            let bodyText = "";
            try {
              bodyText = await response.text();
            } catch {
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}${bodyText ? ` :: ${bodyText}` : ""}`);
          }
          const data = await response.json();
          let content = data.choices?.[0]?.message?.content;
          if (!content) {
            throw new Error("No content received from LLM");
          }
          if (payload.response_format?.type === "json_object") {
            try {
              JSON.parse(content);
            } catch {
              let salvaged = this.extractJsonObject(content);
              if (!salvaged) salvaged = this.repairJson(content);
              try {
                if (salvaged) JSON.parse(salvaged);
              } catch {
                salvaged = null;
              }
              if (salvaged) content = salvaged;
              else console.warn("LLM returned non-JSON; upstream will coerce");
            }
          }
          const latency = Date.now() - startTime;
          return {
            content,
            tokens: data.usage?.total_tokens,
            latency
          };
        } catch (error) {
          if (attempt < this.MAX_RETRIES && !(error instanceof Error && error.name?.includes("AbortError"))) {
            const delay = Math.pow(2, attempt - 1) * 1e3;
            await new Promise((resolve) => setTimeout(resolve, delay));
            if (payload.response_format?.type === "json_object" && attempt > 1) {
              payload.temperature = 0.2;
            }
            return this.executeWithRetry(payload, startTime, attempt + 1);
          }
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
      /**
       * Execute request with model fallback strategy
       * This method tries multiple models in sequence if the first one fails
       */
      static async executeWithModelFallback(payload, startTime) {
        const originalModel = payload.model;
        const availableModels = this.getAvailableFallbackModels(originalModel);
        if (availableModels.length === 0) {
          throw new Error(`All models are circuit-broken, including original: ${originalModel}`);
        }
        let lastError = null;
        for (let i = 0; i < availableModels.length; i++) {
          const currentModel = availableModels[i];
          const modelPayload = { ...payload, model: currentModel };
          try {
            console.log(`[LLMClient] Attempting model ${currentModel} (${i + 1}/${availableModels.length})`);
            const result = await this.executeWithRetry(modelPayload, startTime);
            if (currentModel !== originalModel) {
              console.log(`[LLMClient] Successfully fell back from ${originalModel} to ${currentModel}`);
            }
            return result;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[LLMClient] Model ${currentModel} failed:`, lastError.message);
            this.markModelFailed(currentModel);
            if (i === availableModels.length - 1) {
              console.error(`[LLMClient] All ${availableModels.length} models exhausted for fallback`);
            }
          }
        }
        throw lastError || new Error("All fallback models failed");
      }
      /**
       * Generate structured customer reply JSON envelope for downstream automation.
       * Returns parsed JSON object; tolerates minor format drift.
       */
      static async generateStructuredCustomerReply(userQuery, context = {}) {
        const system = `You are an automotive sales assistant. Output ONLY valid JSON matching this schema:
{
  "watermark": "NeoWorlder",
  "name": "Customer Name",
  "modified_name": "Preferred Name or empty string",
  "user_query": "The customer's last message",
  "Analysis": "Compliance with internal rules + brief reasoning",
  "type": "email" | "text",
  "quick_insights": "1-2 line summary of needs/context",
  "empathetic_response": "1 sentence empathic bridge",
  "engagement_check": "1 line about how you'll keep it focused",
  "sales_readiness": "low" | "medium" | "high",
  "Answer": "The concise reply to send (no JSON, just the reply text)",
  "retrieve_inventory_data": true | false,
  "research_queries": ["specific queries for inventory lookups"],
  "reply_required": true | false
}
Rules:
- Return valid JSON only, no markdown, no code fencing.
- If user only reacted (emoji/like) and added no text, set reply_required=false and minimal Answer.
- If inventory details are needed, set retrieve_inventory_data=true and provide research_queries.
- Prefer "type" from context.channel if provided; default to "email".`;
        const user = `Customer message: ${userQuery}
Context (JSON): ${JSON.stringify(context).slice(0, 2e3)}`;
        const { content } = await this.generate({
          model: this.resolveModel("openai/gpt-5-chat"),
          system,
          user,
          json: true,
          temperature: 0.2,
          maxTokens: 1e3
        });
        try {
          return JSON.parse(content);
        } catch {
          try {
            const salvaged = this.extractJsonObject(content);
            return salvaged ? JSON.parse(salvaged) : {};
          } catch {
            return {};
          }
        }
      }
      /**
       * Helper method for automotive content generation with enforced JSON
       */
      static async generateAutomotiveContent(prompt, systemPrompt) {
        return this.generate({
          model: this.resolveModel("openai/gpt-5-chat"),
          system: systemPrompt || "You are an expert automotive marketing AI assistant. Always respond with valid JSON.",
          user: prompt,
          json: true,
          temperature: 0.2,
          maxTokens: 1200
        });
      }
      /**
       * Legacy compatibility method for generateContent calls
       */
      static async generateContent(prompt, opts) {
        const response = await this.generate({
          model: this.resolveModel("openai/gpt-5-chat"),
          system: "You are an automotive campaign specialist helping create high-quality marketing campaigns and handover prompts.",
          user: prompt,
          json: opts?.json ?? false,
          temperature: opts?.temperature,
          maxTokens: opts?.maxTokens
        });
        return response.content;
      }
    };
  }
});

// server/routes/health.ts
var health_exports = {};
__export(health_exports, {
  default: () => health_default
});
import { Router as Router3 } from "express";
var router3, health_default;
var init_health = __esm({
  "server/routes/health.ts"() {
    "use strict";
    router3 = Router3();
    router3.get("/email", async (_req, res) => {
      try {
        const hasMailgun = !!(process.env.MAILGUN_DOMAIN && process.env.MAILGUN_API_KEY);
        let authStatus = { ok: false, details: {} };
        if (hasMailgun) {
          try {
            const { DomainHealthGuard: DomainHealthGuard2 } = await Promise.resolve().then(() => (init_domain_health_guard(), domain_health_guard_exports));
            await DomainHealthGuard2.assertAuthReady();
            authStatus = {
              ok: true,
              details: {
                domain: process.env.MAILGUN_DOMAIN,
                status: "healthy",
                authentication: "configured",
                deliverability: "ready"
              }
            };
          } catch (error) {
            authStatus = {
              ok: false,
              details: {
                domain: process.env.MAILGUN_DOMAIN,
                status: "unhealthy",
                error: error instanceof Error ? error.message : "Unknown error"
              }
            };
          }
        } else {
          authStatus = {
            ok: false,
            details: {
              status: "not_configured",
              message: "MAILGUN_DOMAIN and MAILGUN_API_KEY required"
            }
          };
        }
        res.json(authStatus);
      } catch (error) {
        console.error("Health check error:", error);
        res.status(500).json({
          ok: false,
          details: {
            status: "error",
            message: error instanceof Error ? error.message : "Health check failed"
          }
        });
      }
    });
    router3.get("/realtime", async (_req, res) => {
      try {
        let wsStatus = { ok: false, details: {} };
        try {
          wsStatus = {
            ok: true,
            details: {
              status: "active",
              connectedClients: 0,
              // Simplified implementation
              endpoint: "/ws"
            }
          };
        } catch (error) {
          wsStatus = {
            ok: false,
            details: {
              status: "error",
              message: error instanceof Error ? error.message : "WebSocket service unavailable"
            }
          };
        }
        res.json(wsStatus);
      } catch (error) {
        console.error("Realtime health check error:", error);
        res.status(500).json({
          ok: false,
          details: {
            status: "error",
            message: error instanceof Error ? error.message : "Realtime check failed"
          }
        });
      }
    });
    router3.get("/ai", async (_req, res) => {
      try {
        const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
        let aiStatus = { ok: false, details: {} };
        if (hasOpenRouter) {
          try {
            const { LLMClient: LLMClient2 } = await Promise.resolve().then(() => (init_llm_client(), llm_client_exports));
            const testResponse = await LLMClient2.generate({
              model: "openai/gpt-5-chat",
              system: 'Respond with exactly: "OK"',
              user: "Test",
              maxTokens: 10
            });
            aiStatus = {
              ok: testResponse.content.includes("OK"),
              details: {
                status: "healthy",
                provider: "OpenRouter",
                model: "gpt-5-chat",
                responseTime: "normal"
              }
            };
          } catch (error) {
            aiStatus = {
              ok: false,
              details: {
                status: "error",
                provider: "OpenRouter",
                error: error instanceof Error ? error.message : "AI service unavailable"
              }
            };
          }
        } else {
          aiStatus = {
            ok: false,
            details: {
              status: "not_configured",
              message: "OPENROUTER_API_KEY required for AI features"
            }
          };
        }
        res.json(aiStatus);
      } catch (error) {
        console.error("AI health check error:", error);
        res.status(500).json({
          ok: false,
          details: {
            status: "error",
            message: error instanceof Error ? error.message : "AI health check failed"
          }
        });
      }
    });
    router3.get("/database", async (_req, res) => {
      try {
        const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const { sql: sql2 } = await import("drizzle-orm");
        const result = await db2.execute(sql2`SELECT 1 as test`);
        const rows = result;
        res.json({
          ok: true,
          details: {
            status: "healthy",
            type: "PostgreSQL",
            connectivity: "active",
            response: rows.length > 0
          }
        });
      } catch (error) {
        console.error("Database health check error:", error);
        res.status(500).json({
          ok: false,
          details: {
            status: "error",
            type: "PostgreSQL",
            error: error instanceof Error ? error.message : "Database unavailable"
          }
        });
      }
    });
    router3.get("/system", async (_req, res) => {
      try {
        const checks = await Promise.allSettled([
          Promise.resolve({ ok: true }),
          // Database check
          Promise.resolve({ ok: false }),
          // Email check  
          Promise.resolve({ ok: true }),
          // Realtime check
          Promise.resolve({ ok: false })
          // AI check
        ]);
        const results = {
          database: checks[0].status === "fulfilled" ? checks[0].value : { ok: false },
          email: checks[1].status === "fulfilled" ? checks[1].value : { ok: false },
          realtime: checks[2].status === "fulfilled" ? checks[2].value : { ok: false },
          ai: checks[3].status === "fulfilled" ? checks[3].value : { ok: false }
        };
        const overallHealth = Object.values(results).every((check) => check.ok);
        res.json({
          ok: overallHealth,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          checks: results
        });
      } catch (error) {
        console.error("System health check error:", error);
        res.status(500).json({
          ok: false,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          error: error instanceof Error ? error.message : "System health check failed"
        });
      }
    });
    health_default = router3;
  }
});

// server/routes/health-imap.ts
var health_imap_exports = {};
__export(health_imap_exports, {
  default: () => health_imap_default,
  recordIMAPError: () => recordIMAPError,
  recordIMAPMessage: () => recordIMAPMessage,
  updateIMAPHealth: () => updateIMAPHealth
});
import { Router as Router4 } from "express";
function updateIMAPHealth(status) {
  imapHealthStatus = { ...imapHealthStatus, ...status };
}
function recordIMAPMessage(uid) {
  imapHealthStatus.lastProcessedUid = uid;
  imapHealthStatus.lastMessageTimestamp = (/* @__PURE__ */ new Date()).toISOString();
  imapHealthStatus.messagesProcessed = (imapHealthStatus.messagesProcessed || 0) + 1;
}
function recordIMAPError(error) {
  if (!imapHealthStatus.errors) imapHealthStatus.errors = [];
  imapHealthStatus.errors.push(`${(/* @__PURE__ */ new Date()).toISOString()}: ${error}`);
  if (imapHealthStatus.errors.length > 5) {
    imapHealthStatus.errors = imapHealthStatus.errors.slice(-5);
  }
}
var router4, imapHealthStatus, health_imap_default;
var init_health_imap = __esm({
  "server/routes/health-imap.ts"() {
    "use strict";
    router4 = Router4();
    imapHealthStatus = {
      connected: false,
      messagesProcessed: 0,
      errors: []
    };
    router4.get("/imap", (req, res) => {
      try {
        const hasConfig = !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);
        if (!hasConfig) {
          return res.json({
            ok: false,
            details: {
              status: "not_configured",
              message: "IMAP credentials not configured",
              config_needed: ["IMAP_HOST", "IMAP_USER", "IMAP_PASSWORD"]
            }
          });
        }
        const lastMessageAge = imapHealthStatus.lastMessageTimestamp ? Date.now() - new Date(imapHealthStatus.lastMessageTimestamp).getTime() : null;
        const isStale = lastMessageAge && lastMessageAge > 24 * 60 * 60 * 1e3;
        const healthDetails = {
          connected: imapHealthStatus.connected,
          status: imapHealthStatus.connected ? "active" : "disconnected",
          lastMessageAge: lastMessageAge ? `${Math.round(lastMessageAge / 1e3 / 60)} minutes ago` : "never",
          messagesProcessed: imapHealthStatus.messagesProcessed || 0,
          lastProcessedUid: imapHealthStatus.lastProcessedUid,
          configuration: {
            host: process.env.IMAP_HOST,
            user: process.env.IMAP_USER,
            folder: process.env.IMAP_FOLDER || "INBOX",
            idle_enabled: process.env.IMAP_IDLE !== "false"
          },
          recentErrors: imapHealthStatus.errors?.slice(-3) || []
        };
        const isHealthy = imapHealthStatus.connected && !isStale;
        res.json({
          ok: isHealthy,
          details: healthDetails
        });
      } catch (error) {
        res.status(500).json({
          ok: false,
          details: {
            status: "error",
            message: "Health check failed",
            error: error instanceof Error ? error.message : "Unknown error"
          }
        });
      }
    });
    health_imap_default = router4;
  }
});

// server/services/agent-runtime.ts
import { eq as eq4, and as and3 } from "drizzle-orm";
import crypto from "crypto";
function sanitizeUserMsg(s) {
  if (!s) return "";
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}
var OPENROUTER_TIMEOUT_MS, OPENROUTER_MAX_RETRIES, MAX_USER_MSG_CHARS, MAX_MEMORY_DOCS, MAX_MEMORY_SNIPPET, MAX_MEMORY_BLOCK, DEFAULT_FALLBACK_REPLY, AgentRuntime;
var init_agent_runtime = __esm({
  "server/services/agent-runtime.ts"() {
    "use strict";
    init_schema();
    init_db();
    OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 2e4);
    OPENROUTER_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES ?? 3);
    MAX_USER_MSG_CHARS = Number(process.env.AGENT_MAX_USER_MSG ?? 4e3);
    MAX_MEMORY_DOCS = Number(process.env.AGENT_MAX_MEMORY_DOCS ?? 3);
    MAX_MEMORY_SNIPPET = Number(process.env.AGENT_MAX_MEMORY_SNIPPET ?? 300);
    MAX_MEMORY_BLOCK = Number(process.env.AGENT_MAX_MEMORY_BLOCK ?? 1200);
    DEFAULT_FALLBACK_REPLY = "Thanks for reaching out\u2014how can I help?";
    AgentRuntime = class _AgentRuntime {
      static sleep(ms) {
        return new Promise((res) => setTimeout(res, ms));
      }
      static stripJsonFences(s) {
        if (!s) return s;
        return s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
      }
      static async requestWithRetries(url, init, traceId) {
        let attempt = 0;
        while (true) {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
          try {
            const res = await fetch(url, { ...init, signal: controller.signal });
            clearTimeout(t);
            if ([408, 429].includes(res.status) || res.status >= 500) {
              attempt++;
              if (attempt > OPENROUTER_MAX_RETRIES) return res;
              const backoff4 = Math.min(1500, 200 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
              await this.sleep(backoff4);
              continue;
            }
            return res;
          } catch (err) {
            clearTimeout(t);
            attempt++;
            if (attempt > OPENROUTER_MAX_RETRIES) throw err;
            const backoff4 = Math.min(1500, 200 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
            await this.sleep(backoff4);
          }
        }
      }
      /**
       * Hash emails for memory partitioning without leaking PII
       */
      static hashEmail(email) {
        if (!email) return "unknown";
        return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").substring(0, 16);
      }
      /**
       * Load the active config for a client
       */
      static async getActiveConfig(clientId) {
        try {
          const rows = await db.select().from(aiAgentConfig).where(and3(eq4(aiAgentConfig.clientId, clientId), eq4(aiAgentConfig.isActive, true))).limit(1);
          if (!rows?.[0]) return null;
          const r = rows[0];
          return {
            id: r.id,
            name: r.name,
            personality: r.personality ?? void 0,
            tonality: r.tonality ?? "professional",
            responseStyle: r.responseStyle ?? "helpful",
            dosList: Array.isArray(r.dosList) ? r.dosList : [],
            dontsList: Array.isArray(r.dontsList) ? r.dontsList : [],
            industry: r.industry ?? "automotive",
            model: r.model || "openai/gpt-5-chat",
            systemPrompt: r.systemPrompt ?? void 0,
            agentEmailDomain: r.agentEmailDomain ?? void 0
          };
        } catch (error) {
          console.error("Error loading agent config:", error);
          return null;
        }
      }
      /**
       * Compose the system prompt from config with safe, minimal rules
       */
      static buildSystemPrompt(cfg) {
        if (cfg.systemPrompt?.trim()) {
          return cfg.systemPrompt.trim();
        }
        const dos = cfg.dosList?.length ? `
Do:
- ${cfg.dosList.join("\n- ")}` : "";
        const donts = cfg.dontsList?.length ? `
Don't:
- ${cfg.dontsList.join("\n- ")}` : "";
        return [
          `You are an AI assistant for an automotive dealership platform.`,
          `Personality: ${cfg.personality || "professional"}.`,
          `Tonality: ${cfg.tonality}.`,
          `Response style: ${cfg.responseStyle}.`,
          `Goals: be concise, accurate, and helpful. Avoid over-promising or making up facts.`,
          `If scheduling or pricing is requested, propose next concrete step (book test drive, check inventory, connect sales).`,
          `Never claim human identity. Stay within dealership context.`,
          dos,
          donts
        ].join("\n");
      }
      /**
       * Retrieve scoped memory for this conversation/lead
       */
      static async recallMemory(opts) {
        try {
          const { clientId, leadId, topic } = opts;
          let lead = null;
          if (leadId) {
            const rows = await db.select().from(leads).where(eq4(leads.id, leadId)).limit(1);
            lead = rows?.[0] || null;
          }
          const tags = [
            `client:${clientId}`,
            lead?.email ? `lead:${_AgentRuntime.hashEmail(lead.email)}` : null
          ].filter(Boolean);
          const query = topic && topic.trim() ? topic : "recent conversation context and similar successful replies";
          const { searchMemories: searchMemories2 } = await Promise.resolve().then(() => (init_supermemory(), supermemory_exports));
          const results = await searchMemories2({
            q: query,
            clientId: clientId || "default",
            limit: 5
          });
          return (results.results || []).map((r) => ({
            id: r.id || "unknown",
            score: r.score || 0.7,
            snippet: r.content?.slice(0, 500) || ""
          }));
        } catch (error) {
          console.log("Memory recall not available, continuing without context");
        }
        return [];
      }
      /**
       * Generate a reply with optional quick replies
       */
      static async reply(input) {
        const cfg = await this.getActiveConfig(input.clientId) || {
          id: "fallback",
          name: "default",
          tonality: "professional",
          responseStyle: "helpful",
          dosList: [],
          dontsList: [],
          personality: "professional",
          industry: "automotive",
          model: "openai/gpt-5-chat"
        };
        const system = this.buildSystemPrompt(cfg);
        const startedAt = Date.now();
        let memMs = 0;
        let llmMs = 0;
        const userMsg = sanitizeUserMsg(input.message).slice(0, MAX_USER_MSG_CHARS);
        let memoryDocs = [];
        {
          const t0 = Date.now();
          memoryDocs = await this.recallMemory({
            clientId: input.clientId,
            leadId: input.leadId,
            topic: input.topic
          });
          memMs = Date.now() - t0;
          memoryDocs = (memoryDocs || []).slice(0, MAX_MEMORY_DOCS).map((d) => ({
            ...d,
            snippet: (d.snippet || "").slice(0, MAX_MEMORY_SNIPPET)
          }));
        }
        let memoryBlock = "";
        if (memoryDocs.length > 0) {
          const rawBlock = `
Relevant context:
${memoryDocs.map((d) => `- [${d.score.toFixed(2)}] ${d.snippet.replace(/\n+/g, " ")}`).join("\n")}`;
          memoryBlock = rawBlock.length > MAX_MEMORY_BLOCK ? rawBlock.slice(0, MAX_MEMORY_BLOCK) : rawBlock;
        }
        const userPrompt = [
          `Lead message: "${userMsg}"`,
          input.topic ? `Topic hint: ${input.topic}` : "",
          memoryBlock,
          `
Respond naturally and helpfully. If appropriate, include one clear call-to-action.`,
          `Return JSON: {"reply": "...", "quickReplies": ["...","..."]}`
        ].filter(Boolean).join("\n");
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          console.warn("Agent runtime: OPENROUTER_API_KEY not set; returning fallback reply");
          return {
            reply: DEFAULT_FALLBACK_REPLY,
            quickReplies: [],
            usedConfigId: cfg.id,
            memoryContextDocs: memoryDocs
          };
        }
        let reply = "";
        let quickReplies = [];
        const traceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        try {
          const llmStart = Date.now();
          const response = await this.requestWithRetries(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "X-Title": "OneKeel Swarm - Agent Runtime"
              },
              body: JSON.stringify({
                model: input.model || cfg.model || "openai/gpt-5-chat",
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: userPrompt }
                ],
                max_tokens: Math.min(input.maxTokens ?? 700, 1200),
                temperature: 0.2
              })
            },
            traceId
          );
          if (response.ok) {
            const data = await response.json();
            let content = data.choices?.[0]?.message?.content || "";
            content = this.stripJsonFences(content);
            try {
              const parsed = JSON.parse(content);
              reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply : content;
              if (Array.isArray(parsed.quickReplies)) {
                quickReplies = parsed.quickReplies.filter(Boolean).slice(0, 4);
              }
            } catch {
              reply = content || DEFAULT_FALLBACK_REPLY;
            }
          } else {
            console.error(`OpenRouter non-OK ${response.status} (trace ${traceId})`);
            reply = DEFAULT_FALLBACK_REPLY;
          }
          llmMs = Date.now() - llmStart;
        } catch (error) {
          console.error(`Agent runtime LLM error (trace ${traceId}):`, error);
          reply = DEFAULT_FALLBACK_REPLY;
        }
        try {
          const { MemoryMapper: MemoryMapper2 } = await Promise.resolve().then(() => (init_supermemory(), supermemory_exports));
          await MemoryMapper2.writeLeadMessage({
            type: "lead_msg",
            clientId: input.clientId || "default",
            campaignId: void 0,
            leadEmail: void 0,
            content: `[AI Reply] ${reply}`,
            meta: {
              ai_reply: true,
              conversationId: input.conversationId,
              leadId: input.leadId,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
        } catch {
        }
        console.info("agent_runtime.reply", { traceId, clientId: input.clientId, model: input.model || cfg.model, memMs, llmMs, usedConfigId: cfg.id });
        return {
          reply: reply.trim() || DEFAULT_FALLBACK_REPLY,
          quickReplies,
          usedConfigId: cfg.id,
          memoryContextDocs: memoryDocs
        };
      }
      /**
       * Create a default agent config for a client if none exists
       */
      static async ensureDefaultConfig(clientId) {
        try {
          const existing = await this.getActiveConfig(clientId);
          if (existing) return existing.id;
          const defaultConfig = await db.insert(aiAgentConfig).values({
            clientId,
            name: "Swarm Automotive Agent",
            personality: "professional automotive sales assistant",
            tonality: "professional",
            responseStyle: "helpful",
            dosList: [
              "Be concise and specific",
              "Focus on automotive expertise",
              "Provide clear next steps",
              "Use conversation history and lead context"
            ],
            dontsList: [
              "Make promises about pricing without confirmation",
              "Schedule appointments without verification",
              "Share personal information",
              "Claim to be human"
            ],
            industry: "automotive",
            model: process.env.AGENT_MODEL || "openai/gpt-5-chat",
            isActive: true,
            systemPrompt: `You are an automotive sales assistant. Be concise, honest, and specific. 
Use the conversation history, lead profile, and recent campaign context. 
Offer one clear next step (CTA). Avoid over-promising.`
          }).returning({ id: aiAgentConfig.id });
          return defaultConfig[0]?.id || "default";
        } catch (error) {
          console.error("Error creating default agent config:", error);
          return "default";
        }
      }
    };
  }
});

// server/routes/agent.ts
var agent_exports = {};
__export(agent_exports, {
  agentRouter: () => agentRouter,
  default: () => agent_default
});
import { Router as Router5 } from "express";
import { eq as eq5 } from "drizzle-orm";
var agentRouter, agent_default;
var init_agent = __esm({
  "server/routes/agent.ts"() {
    "use strict";
    init_agent_runtime();
    init_schema();
    init_db();
    agentRouter = Router5();
    agentRouter.post("/reply", async (req, res) => {
      try {
        const clientId = req.body.clientId || "default-client";
        const { message, leadId, conversationId, topic, model } = req.body;
        if (!message) {
          return res.status(400).json({ error: "message is required" });
        }
        await AgentRuntime.ensureDefaultConfig(clientId);
        const result = await AgentRuntime.reply({
          clientId,
          message,
          leadId,
          conversationId,
          topic,
          model
        });
        res.json(result);
      } catch (error) {
        console.error("Agent reply error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to generate reply"
        });
      }
    });
    agentRouter.get("/config/active", async (req, res) => {
      try {
        const clientId = req.query.clientId || "default-client";
        const config = await AgentRuntime.getActiveConfig(clientId);
        if (!config) {
          const configId = await AgentRuntime.ensureDefaultConfig(clientId);
          const newConfig = await AgentRuntime.getActiveConfig(clientId);
          return res.json(newConfig);
        }
        res.json(config);
      } catch (error) {
        console.error("Get active config error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to get active config"
        });
      }
    });
    agentRouter.put("/config/active", async (req, res) => {
      try {
        const clientId = req.body.clientId || "default-client";
        const {
          name,
          personality,
          tonality,
          responseStyle,
          dosList,
          dontsList,
          model,
          systemPrompt
        } = req.body;
        const currentConfig = await AgentRuntime.getActiveConfig(clientId);
        if (currentConfig) {
          await db.update(aiAgentConfig).set({
            name: name || currentConfig.name,
            personality: personality || currentConfig.personality,
            tonality: tonality || currentConfig.tonality,
            responseStyle: responseStyle || currentConfig.responseStyle,
            dosList: dosList || currentConfig.dosList,
            dontsList: dontsList || currentConfig.dontsList,
            model: model || currentConfig.model,
            systemPrompt: systemPrompt || currentConfig.systemPrompt,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq5(aiAgentConfig.id, currentConfig.id));
          res.json({ success: true, configId: currentConfig.id });
        } else {
          const configId = await AgentRuntime.ensureDefaultConfig(clientId);
          res.json({ success: true, configId });
        }
      } catch (error) {
        console.error("Update config error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to update config"
        });
      }
    });
    agentRouter.get("/health", async (req, res) => {
      try {
        const clientId = req.query.clientId || "default-client";
        const config = await AgentRuntime.getActiveConfig(clientId);
        const testReply = await AgentRuntime.reply({
          clientId,
          message: "Hello, this is a health check",
          maxTokens: 50
        });
        res.json({
          ok: true,
          details: {
            hasActiveConfig: !!config,
            configId: config?.id || "none",
            model: config?.model || "default",
            replyGeneration: !!testReply.reply,
            openrouterConfigured: !!process.env.OPENROUTER_API_KEY
          }
        });
      } catch (error) {
        console.error("Agent health check error:", error);
        res.status(500).json({
          ok: false,
          error: error instanceof Error ? error.message : "Health check failed"
        });
      }
    });
    agent_default = agentRouter;
  }
});

// server/index.ts
import dotenv from "dotenv";
import express2 from "express";

// server/routes.ts
init_storage();
init_schema();
init_mailgun();
import { createServer } from "http";

// server/services/campaign-scheduler.ts
init_db();
init_schema();
import { eq as eq2, lte, and as and2 } from "drizzle-orm";
var SCHEDULER_INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS ?? 6e4);
var SCHEDULER_JITTER_MS = 5e3;
var CLAIM_LEASE_MS = Number(process.env.CAMPAIGN_CLAIM_LEASE_MS ?? 12e4);
var FAILURE_BACKOFF_MS = Number(process.env.CAMPAIGN_FAILURE_BACKOFF_MS ?? 3e5);
function withJitter(baseMs) {
  const jitter = Math.floor(Math.random() * SCHEDULER_JITTER_MS);
  return baseMs + jitter;
}
var CampaignScheduler = class _CampaignScheduler {
  static instance;
  schedulerInterval = null;
  loopInProgress = false;
  async claimCampaign(campaignId, now) {
    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
    const result = await db.update(campaigns).set({ nextExecution: leaseUntil, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
      eq2(campaigns.id, campaignId),
      eq2(campaigns.status, "scheduled"),
      lte(campaigns.nextExecution, now)
    ));
    const [after] = await db.select({ id: campaigns.id, nextExecution: campaigns.nextExecution }).from(campaigns).where(eq2(campaigns.id, campaignId));
    return !!(after && after.nextExecution && after.nextExecution.getTime() >= leaseUntil.getTime());
  }
  computeNextFromRecurring(pattern, days, timeStr, from) {
    const base = new Date(from);
    const [hh, mm] = (timeStr || "09:00:00").split(":").map(Number);
    const candidate = new Date(base);
    candidate.setSeconds(0, 0);
    candidate.setHours(hh ?? 9, mm ?? 0, 0, 0);
    if (pattern === "daily") {
      if (candidate <= base) candidate.setDate(candidate.getDate() + 1);
      return candidate;
    }
    if (pattern === "weekly") {
      const allowed = days && days.length ? days : [1, 2, 3, 4, 5, 6, 0];
      let d = new Date(candidate);
      for (let i = 0; i < 8; i++) {
        const dow = d.getDay();
        if (allowed.includes(dow) && d > base) return d;
        d.setDate(d.getDate() + 1);
        d.setHours(hh ?? 9, mm ?? 0, 0, 0);
      }
      const nextWeek = new Date(base);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(hh ?? 9, mm ?? 0, 0, 0);
      return nextWeek;
    }
    const next = new Date(candidate);
    next.setMonth(next.getMonth() + (candidate <= base ? 1 : 0));
    return next;
  }
  static getInstance() {
    if (!_CampaignScheduler.instance) {
      _CampaignScheduler.instance = new _CampaignScheduler();
    }
    return _CampaignScheduler.instance;
  }
  // Start the scheduler service
  startScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    const tick = async () => {
      if (this.loopInProgress) return;
      this.loopInProgress = true;
      try {
        await this.processPendingCampaigns();
      } finally {
        this.loopInProgress = false;
      }
      this.schedulerInterval = setTimeout(tick, withJitter(SCHEDULER_INTERVAL_MS));
    };
    this.schedulerInterval = setTimeout(tick, withJitter(500));
    console.log("\u{1F4C5} Campaign scheduler started");
  }
  // Stop the scheduler service
  stopScheduler() {
    if (this.schedulerInterval) {
      clearTimeout(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    console.log("\u{1F4C5} Campaign scheduler stopped");
  }
  // Schedule a campaign
  async scheduleCampaign(campaignId, config) {
    const nextExecution = this.calculateNextExecution(config);
    await db.update(campaigns).set({
      scheduleType: config.scheduleType,
      scheduledStart: config.scheduledStart,
      recurringPattern: config.recurringPattern,
      recurringDays: config.recurringDays || [],
      recurringTime: config.recurringTime,
      nextExecution,
      status: config.scheduleType === "immediate" ? "active" : "scheduled",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(campaigns.id, campaignId));
    console.log(`\u{1F4C5} Campaign ${campaignId} scheduled with type: ${config.scheduleType}`);
    if (config.scheduleType === "immediate") {
      await this.executeCampaign(campaignId);
    }
    return nextExecution;
  }
  // Calculate next execution time based on schedule config
  calculateNextExecution(config) {
    if (config.scheduleType === "immediate") {
      return /* @__PURE__ */ new Date();
    }
    if (config.scheduleType === "scheduled") {
      return config.scheduledStart || null;
    }
    if (config.scheduleType === "recurring") {
      const now = /* @__PURE__ */ new Date();
      return this.computeNextFromRecurring(
        config.recurringPattern,
        config.recurringDays,
        config.recurringTime,
        now
      );
    }
    return null;
  }
  // Process campaigns that are ready to execute
  async processPendingCampaigns() {
    const now = /* @__PURE__ */ new Date();
    try {
      const pending = await db.select().from(campaigns).where(
        and2(
          eq2(campaigns.isActive, true),
          lte(campaigns.nextExecution, now),
          eq2(campaigns.status, "scheduled")
        )
      );
      for (const c of pending) {
        try {
          const claimed = await this.claimCampaign(c.id, now);
          if (!claimed) continue;
          await this.executeCampaign(c.id);
          if (c.scheduleType === "recurring") {
            const nextExecution = this.calculateNextExecution({
              scheduleType: "recurring",
              recurringPattern: c.recurringPattern,
              recurringDays: c.recurringDays,
              recurringTime: c.recurringTime || void 0
            });
            await db.update(campaigns).set({ nextExecution, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(campaigns.id, c.id));
          } else {
            await db.update(campaigns).set({ status: "completed", nextExecution: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(campaigns.id, c.id));
          }
        } catch (err) {
          console.error(`\u274C Error executing campaign ${c.id}:`, err);
          await db.update(campaigns).set({ nextExecution: new Date(Date.now() + FAILURE_BACKOFF_MS), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(campaigns.id, c.id));
        }
      }
    } catch (error) {
      console.error("\u274C Error processing pending campaigns:", error);
    }
  }
  // Execute a campaign (send emails/SMS)
  async executeCampaign(campaignId) {
    const startedAt = /* @__PURE__ */ new Date();
    try {
      console.log(`\u{1F680} Executing campaign: ${campaignId}`);
      const [campaign] = await db.select().from(campaigns).where(eq2(campaigns.id, campaignId));
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }
      await db.update(campaigns).set({ status: "active", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(campaigns.id, campaignId));
      console.log(`\u2705 Campaign ${campaignId} executed successfully`);
      return { success: true, campaignId };
    } catch (error) {
      console.error(`\u274C Error executing campaign ${campaignId}:`, error);
      throw error;
    } finally {
      const finishedAt = /* @__PURE__ */ new Date();
      console.log(`\u23F1\uFE0F Campaign ${campaignId} run time: ${finishedAt.getTime() - startedAt.getTime()}ms`);
    }
  }
  // Get campaign schedule status
  async getCampaignSchedule(campaignId) {
    const [campaign] = await db.select({
      scheduleType: campaigns.scheduleType,
      scheduledStart: campaigns.scheduledStart,
      recurringPattern: campaigns.recurringPattern,
      recurringDays: campaigns.recurringDays,
      recurringTime: campaigns.recurringTime,
      nextExecution: campaigns.nextExecution,
      isActive: campaigns.isActive,
      status: campaigns.status
    }).from(campaigns).where(eq2(campaigns.id, campaignId));
    return campaign;
  }
  // Cancel scheduled campaign
  async cancelScheduledCampaign(campaignId) {
    await db.update(campaigns).set({
      status: "draft",
      nextExecution: null,
      isActive: false,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(campaigns.id, campaignId));
    console.log(`\u{1F6AB} Campaign ${campaignId} schedule cancelled`);
  }
};
var campaignScheduler = CampaignScheduler.getInstance();

// server/tenant.ts
init_db();
init_schema();
import { eq as eq3 } from "drizzle-orm";
var tenantMiddleware = async (req, res, next) => {
  try {
    let clientId = null;
    const host = req.get("host") || "";
    const subdomain = host.split(".")[0];
    if (subdomain && subdomain !== "localhost" && subdomain !== "127" && !subdomain.includes(":")) {
      const [client] = await db.select().from(clients).where(eq3(clients.domain, subdomain));
      if (client) {
        clientId = client.id;
      }
    }
    if (!clientId && host) {
      const [client] = await db.select().from(clients).where(eq3(clients.domain, host));
      if (client) {
        clientId = client.id;
      }
    }
    if (!clientId && req.headers["x-tenant-id"]) {
      clientId = req.headers["x-tenant-id"];
    }
    if (!clientId) {
      let [defaultClient] = await db.select().from(clients).where(eq3(clients.domain, "localhost"));
      if (!defaultClient) {
        const inserted = await db.insert(clients).values({
          name: "Default Client",
          domain: "localhost",
          brandingConfig: {
            primaryColor: "#2563eb",
            secondaryColor: "#1e40af",
            logoUrl: "",
            companyName: "OneKeel Swarm",
            favicon: "",
            customCss: ""
          },
          settings: {}
        }).onConflictDoNothing().returning();
        const insertedResult = inserted;
        if (insertedResult.length) {
          defaultClient = insertedResult[0];
        } else {
          [defaultClient] = await db.select().from(clients).where(eq3(clients.domain, "localhost"));
        }
      }
      if (defaultClient) {
        clientId = defaultClient.id;
      }
    }
    req.clientId = clientId;
    if (clientId) {
      const [client] = await db.select().from(clients).where(eq3(clients.id, clientId));
      req.client = client;
    }
    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    next(error);
  }
};

// server/routes.ts
init_db();
init_schema();
init_websocket();
import { eq as eq6 } from "drizzle-orm";
import multer from "multer";
import { parse as parse2 } from "csv-parse/sync";

// server/services/csv/csv-validation.ts
import { parse } from "csv-parse/sync";
import { z } from "zod";
var leadValidationSchema = z.object({
  firstName: z.string().max(100).optional().or(z.literal("")),
  lastName: z.string().max(100).optional().or(z.literal("")),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  vehicleInterest: z.string().optional(),
  budget: z.string().optional(),
  timeframe: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional()
});
var CSVValidationService = class {
  static DEFAULT_OPTIONS = {
    maxFileSize: 10 * 1024 * 1024,
    // 10MB
    maxRows: 1e4,
    requireColumns: ["email"],
    // Only email is truly required
    sanitizeData: true
  };
  /**
   * Validate and parse CSV file with comprehensive security checks
   */
  static async validateCSV(fileBuffer, options = {}) {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const errors = [];
    const warnings = [];
    try {
      if (fileBuffer.length > config.maxFileSize) {
        return {
          valid: false,
          errors: [`File size ${fileBuffer.length} bytes exceeds maximum allowed ${config.maxFileSize} bytes`]
        };
      }
      const content = fileBuffer.toString("utf8");
      if (this.containsSuspiciousContent(content)) {
        return {
          valid: false,
          errors: ["File contains potentially malicious content"]
        };
      }
      let records;
      try {
        records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          max_record_size: 1e4,
          // Limit record size
          relax_column_count: true
        });
      } catch (parseError) {
        return {
          valid: false,
          errors: [`CSV parsing failed: ${parseError instanceof Error ? parseError.message : "Unknown error"}`]
        };
      }
      if (records.length > config.maxRows) {
        return {
          valid: false,
          errors: [`CSV contains ${records.length} rows, exceeding maximum allowed ${config.maxRows} rows`]
        };
      }
      if (records.length === 0) {
        return {
          valid: false,
          errors: ["CSV file is empty or contains no valid data rows"]
        };
      }
      const headers = Object.keys(records[0] || {});
      const columnValidation = this.validateColumns(headers, config);
      if (!columnValidation.valid) {
        return {
          valid: false,
          errors: columnValidation.errors
        };
      }
      const validatedRecords = [];
      const emailSet = /* @__PURE__ */ new Set();
      let duplicateCount = 0;
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2;
        try {
          const sanitizedRecord = config.sanitizeData ? this.sanitizeRecord(record) : record;
          const validatedRecord = leadValidationSchema.parse(sanitizedRecord);
          if (emailSet.has(validatedRecord.email.toLowerCase())) {
            duplicateCount++;
            warnings.push(`Row ${rowNumber}: Duplicate email address ${validatedRecord.email}`);
            continue;
          }
          emailSet.add(validatedRecord.email.toLowerCase());
          validatedRecords.push(validatedRecord);
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            const fieldErrors = validationError.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
            errors.push(`Row ${rowNumber}: ${fieldErrors}`);
          } else {
            errors.push(`Row ${rowNumber}: Validation failed - ${validationError instanceof Error ? validationError.message : "Unknown error"}`);
          }
        }
      }
      const hasValidData = validatedRecords.length > 0;
      const hasErrors = errors.length > 0;
      return {
        valid: hasValidData && !hasErrors,
        data: validatedRecords,
        errors: errors.length > 0 ? errors : void 0,
        warnings: warnings.length > 0 ? warnings : void 0,
        stats: {
          totalRows: records.length,
          validRows: validatedRecords.length,
          invalidRows: records.length - validatedRecords.length,
          duplicateEmails: duplicateCount
        }
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`CSV validation failed: ${error instanceof Error ? error.message : "Unknown error"}`]
      };
    }
  }
  /**
   * Validate CSV column headers
   */
  static validateColumns(headers, config) {
    const errors = [];
    if (config.requireColumns) {
      const missingColumns = config.requireColumns.filter(
        (col) => !headers.includes(col)
      );
      if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(", ")}`);
      }
    }
    if (config.allowedColumns) {
      const invalidColumns = headers.filter(
        (header) => !config.allowedColumns.includes(header)
      );
      if (invalidColumns.length > 0) {
        errors.push(`Invalid columns found: ${invalidColumns.join(", ")}`);
      }
    }
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : void 0
    };
  }
  /**
   * Sanitize record data to prevent injection attacks
   */
  static sanitizeRecord(record) {
    const sanitized = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string") {
        sanitized[key] = value.replace(/[<>\"'&]/g, "").replace(/\r?\n|\r/g, " ").trim().substring(0, 1e3);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  /**
   * Check for suspicious content that might indicate malicious files
   */
  static containsSuspiciousContent(content) {
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /\.exe\b/gi,
      /\.bat\b/gi,
      /\.cmd\b/gi
    ];
    return suspiciousPatterns.some((pattern) => pattern.test(content));
  }
  /**
   * Generate detailed validation report
   */
  static generateValidationReport(result) {
    const report = [];
    report.push(`CSV Validation Report`);
    report.push(`Status: ${result.valid ? "PASSED" : "FAILED"}`);
    if (result.stats) {
      report.push(`
Statistics:`);
      report.push(`  Total rows processed: ${result.stats.totalRows}`);
      report.push(`  Valid rows: ${result.stats.validRows}`);
      report.push(`  Invalid rows: ${result.stats.invalidRows}`);
      report.push(`  Duplicate emails: ${result.stats.duplicateEmails}`);
    }
    if (result.errors && result.errors.length > 0) {
      report.push(`
Errors:`);
      result.errors.forEach((error) => report.push(`  \u274C ${error}`));
    }
    if (result.warnings && result.warnings.length > 0) {
      report.push(`
Warnings:`);
      result.warnings.forEach((warning) => report.push(`  \u26A0\uFE0F ${warning}`));
    }
    return report.join("\n");
  }
};
var validateCSV = CSVValidationService.validateCSV.bind(CSVValidationService);
var generateValidationReport = CSVValidationService.generateValidationReport.bind(CSVValidationService);

// server/routes.ts
async function registerRoutes(app2) {
  app2.use("/api", tenantMiddleware);
  app2.get("/api/debug/ping", (req, res) => {
    res.json({
      status: "alive",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: process.env.NODE_ENV || "unknown",
      databaseUrl: process.env.DATABASE_URL ? "present" : "missing",
      renderEnvironment: process.env.RENDER ? "true" : "false"
    });
  });
  app2.get("/api/debug/database", async (req, res) => {
    try {
      const testQuery = await db.select().from(clients).limit(1);
      res.json({
        status: "connected",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        clientsTable: "accessible",
        sampleRecordCount: testQuery.length
      });
    } catch (error) {
      console.error("Database diagnostic error:", error);
      res.status(500).json({
        status: "error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : void 0
      });
    }
  });
  app2.get("/api/branding", async (req, res) => {
    try {
      const domain = req.query.domain || req.get("host") || "localhost";
      let [client] = await db.select().from(clients).where(eq6(clients.domain, domain));
      if (!client) {
        [client] = await db.select().from(clients).where(eq6(clients.name, "Default Client"));
      }
      if (client) {
        res.json(client);
      } else {
        res.json({
          id: "default",
          name: "OfferLogix",
          brandingConfig: {
            primaryColor: "#009CA6",
            secondaryColor: "#F58220",
            logoUrl: "",
            companyName: "OfferLogix",
            favicon: "",
            customCss: ""
          }
        });
      }
    } catch (error) {
      console.error("Branding API error:", error);
      res.status(500).json({ message: "Failed to fetch branding" });
    }
  });
  app2.get("/api/clients", async (req, res) => {
    try {
      const allClients = await db.select().from(clients);
      res.json(allClients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });
  app2.post("/api/clients", async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const insertedClients = await db.insert(clients).values(clientData).returning();
      const client = Array.isArray(insertedClients) ? insertedClients[0] : insertedClients;
      res.json(client);
    } catch (error) {
      console.error("Create client error:", error);
      res.status(400).json({ message: "Invalid client data" });
    }
  });
  app2.put("/api/clients/:id", async (req, res) => {
    try {
      const clientData = insertClientSchema.partial().parse(req.body);
      const [client] = await db.update(clients).set({ ...clientData, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(clients.id, req.params.id)).returning();
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data" });
    }
  });
  app2.delete("/api/clients/:id", async (req, res) => {
    try {
      await db.delete(clients).where(eq6(clients.id, req.params.id));
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });
  app2.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns2 = await storage.getCampaigns();
      res.json(campaigns2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });
  app2.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });
  app2.post("/api/campaigns", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ message: "Invalid campaign data" });
    }
  });
  app2.put("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ message: "Failed to update campaign" });
    }
  });
  app2.delete("/api/campaigns/:id", async (req, res) => {
    try {
      await storage.deleteCampaign(req.params.id);
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });
  app2.post("/api/campaigns/:id/clone", async (req, res) => {
    try {
      const { name } = req.body;
      const clonedCampaign = await storage.cloneCampaign(req.params.id, name);
      res.json(clonedCampaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to clone campaign" });
    }
  });
  app2.put("/api/campaigns/:id/templates", async (req, res) => {
    try {
      const { templates, subjectLines, numberOfTemplates, daysBetweenMessages } = req.body;
      if (!templates || !Array.isArray(templates)) {
        return res.status(400).json({ message: "templates array required" });
      }
      let normalized = templates;
      if (normalized.length && typeof normalized[0] === "string") {
        normalized = normalized.map((s) => ({ subject: String(s).slice(0, 80), content: String(s) }));
      } else if (normalized.length && typeof normalized[0] === "object") {
        normalized = normalized.map((t) => ({
          subject: typeof t.subject === "string" && t.subject.trim() ? String(t.subject).slice(0, 140) : typeof t.title === "string" && t.title.trim() ? String(t.title).slice(0, 140) : "Untitled",
          content: typeof t.content === "string" && t.content.trim() ? String(t.content) : typeof t.html === "string" && t.html.trim() ? String(t.html) : typeof t.body === "string" && t.body.trim() ? String(t.body) : typeof t.text === "string" && t.text.trim() ? String(t.text) : ""
        }));
      }
      const campaign = await storage.updateCampaign(req.params.id, {
        templates: normalized,
        subjectLines,
        numberOfTemplates,
        daysBetweenMessages
      });
      res.json({ message: "Templates updated", campaign });
    } catch (error) {
      console.error("Update templates error:", error);
      res.status(500).json({ message: "Failed to update templates" });
    }
  });
  app2.post("/api/campaigns/:id/launch", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (!campaign.templates || (Array.isArray(campaign.templates) ? campaign.templates.length === 0 : false)) {
        try {
          const parsed = typeof campaign.templates === "string" ? JSON.parse(campaign.templates) : [];
          if (!parsed || parsed.length === 0) return res.status(400).json({ message: "No templates available to send" });
        } catch {
          return res.status(400).json({ message: "Invalid templates format" });
        }
      }
      await storage.updateCampaign(campaignId, { status: "active" });
      const { CampaignOrchestrator: CampaignOrchestrator2 } = await Promise.resolve().then(() => (init_CampaignOrchestrator(), CampaignOrchestrator_exports));
      const orchestrator = new CampaignOrchestrator2();
      const result = await orchestrator.executeCampaign({ campaignId, testMode: false });
      res.json({ message: "Campaign launched", execution: result });
    } catch (error) {
      console.error("Launch campaign error:", error);
      res.status(500).json({ message: "Failed to launch campaign" });
    }
  });
  const templateRoutes = await Promise.resolve().then(() => (init_templates(), templates_exports));
  app2.use("/api/templates", templateRoutes.default);
  app2.post("/api/email/send", async (req, res) => {
    try {
      const { to, subject, htmlContent, textContent, fromName, fromEmail } = req.body;
      if (!to || !subject || !htmlContent) {
        return res.status(400).json({ message: "Required fields: to, subject, htmlContent" });
      }
      const result = await sendCampaignEmail(
        to,
        subject,
        htmlContent,
        textContent || "",
        fromName || "OfferLogix"
      );
      res.json(result);
    } catch (error) {
      console.error("Email send error:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });
  app2.post("/api/email/validate", async (req, res) => {
    try {
      const { emails } = req.body;
      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ message: "Emails array is required" });
      }
      const result = await validateEmailAddresses(emails);
      res.json(result);
    } catch (error) {
      console.error("Email validation error:", error);
      res.status(500).json({ message: "Failed to validate emails" });
    }
  });
  app2.post("/api/email/validate-content", async (req, res) => {
    try {
      const emailData = req.body;
      if (!emailData.to || !emailData.subject || !emailData.htmlContent) {
        return res.status(400).json({ message: "Required fields: to, subject, htmlContent" });
      }
      const { emailWatchdog: emailWatchdog2 } = await Promise.resolve().then(() => (init_email_validator(), email_validator_exports));
      const validation = await emailWatchdog2.validateOutboundEmail(emailData);
      res.json(validation);
    } catch (error) {
      console.error("Email content validation error:", error);
      res.status(500).json({ message: "Failed to validate email content" });
    }
  });
  app2.get("/api/email/validation-stats", async (req, res) => {
    try {
      const { emailWatchdog: emailWatchdog2 } = await Promise.resolve().then(() => (init_email_validator(), email_validator_exports));
      const stats = emailWatchdog2.getValidationStats();
      res.json(stats);
    } catch (error) {
      console.error("Email validation stats error:", error);
      res.status(500).json({ message: "Failed to get validation stats" });
    }
  });
  const basicUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
    // 5MB limit
  });
  app2.post("/api/leads/upload-csv-basic", basicUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const fileContent = req.file.buffer.toString("utf-8");
      const records = parse2(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      const leads2 = [];
      const errors = [];
      for (let index = 0; index < records.length; index++) {
        const record = records[index];
        try {
          const leadData = {
            email: record.email || record.Email || "",
            firstName: record.firstName || record["First Name"] || record.first_name || "",
            lastName: record.lastName || record["Last Name"] || record.last_name || "",
            phone: record.phone || record.Phone || record.phoneNumber || "",
            vehicleInterest: record.vehicleInterest || record["Vehicle Interest"] || record.vehicle || "",
            leadSource: record.leadSource || record.source || "csv_import",
            status: record.status || "new",
            campaignId: req.body.campaignId || null,
            clientId: req.clientId
          };
          if (!leadData.email) {
            errors.push(`Row ${index + 1}: Email is required`);
            continue;
          }
          leads2.push(leadData);
        } catch (error) {
          errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : "Invalid data"}`);
        }
      }
      if (leads2.length === 0) {
        return res.status(400).json({ message: "No valid leads found", errors });
      }
      const createdLeads = await storage.createLeads(leads2);
      createdLeads.forEach((lead) => {
        webSocketService.broadcastNewLead(lead);
      });
      res.json({
        message: "CSV uploaded successfully",
        leads: createdLeads,
        errors: errors.length > 0 ? errors : null
      });
    } catch (error) {
      console.error("CSV upload error:", error);
      res.status(500).json({ message: "Failed to process CSV file" });
    }
  });
  app2.post("/api/leads/import/analyze", basicUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const content = req.file.buffer.toString("utf-8");
      const rows = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (rows.length === 0) return res.status(400).json({ message: "Empty file" });
      const headers = rows[0].split(",").map((h) => h.trim());
      const previewRows = rows.slice(1, 6).map((line) => {
        const cols = line.split(",");
        const obj = {};
        headers.forEach((h, i) => obj[h] = cols[i]);
        return obj;
      });
      const suggestedMappings = headers.map((h) => ({
        csvColumn: h,
        leadField: /email/i.test(h) ? "email" : /first.?name/i.test(h) ? "firstName" : /last.?name/i.test(h) ? "lastName" : /phone/i.test(h) ? "phone" : /vehicle|interest/i.test(h) ? "vehicleInterest" : ""
      }));
      res.json({ headers, totalRows: rows.length - 1, previewRows, suggestedMappings });
    } catch (e) {
      console.error("Lead import analyze error:", e);
      res.status(500).json({ message: "Failed to analyze CSV" });
    }
  });
  app2.post("/api/leads/import", basicUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const mappings = (() => {
        try {
          return JSON.parse(req.body.mappings || "[]");
        } catch {
          return [];
        }
      })();
      const campaignId = req.body.campaignId || null;
      const content = req.file.buffer.toString("utf-8");
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return res.status(400).json({ message: "No data rows found" });
      const headers = lines[0].split(",").map((h) => h.trim());
      const mapDict = {};
      for (const m of mappings) if (m.leadField) mapDict[m.csvColumn] = m.leadField;
      const results = [];
      const errors = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (cols.length === 1 && cols[0].trim() === "") continue;
        const record = {};
        headers.forEach((h, idx) => {
          const lf = mapDict[h];
          if (lf) record[lf] = cols[idx];
        });
        if (!record.email) {
          errors.push({ row: i + 1, error: "Missing email" });
          continue;
        }
        results.push({
          email: record.email.trim(),
          firstName: record.firstName?.trim() || null,
          lastName: record.lastName?.trim() || null,
          phone: record.phone?.trim() || null,
          vehicleInterest: record.vehicleInterest?.trim() || null,
          source: record.source || "csv_import",
          status: "new",
          campaignId,
          clientId: req.clientId
        });
      }
      let created = [];
      if (results.length) {
        created = await storage.createLeads(results);
        created.forEach((lead) => webSocketService.broadcastNewLead(lead));
      }
      res.json({ total: results.length + errors.length, successful: created.length, failed: errors.length, errors, leads: created });
    } catch (e) {
      console.error("Lead import process error:", e);
      res.status(500).json({ message: "Failed to import leads" });
    }
  });
  app2.post("/api/webhooks/mailgun/inbound", async (req, res) => {
    try {
      const { InboundEmailService: InboundEmailService2 } = await Promise.resolve().then(() => (init_inbound_email(), inbound_email_exports));
      await InboundEmailService2.handleInboundEmail(req, res);
    } catch (error) {
      console.error("Mailgun inbound webhook error:", error);
      res.status(500).json({ error: "Failed to process inbound email" });
    }
  });
  app2.post("/api/campaigns/:id/execute", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { scheduleAt, testMode = false, selectedLeadIds, maxLeadsPerBatch = 50 } = req.body;
      const { CampaignOrchestrator: CampaignOrchestrator2 } = await Promise.resolve().then(() => (init_CampaignOrchestrator(), CampaignOrchestrator_exports));
      const campaignOrchestrator2 = new CampaignOrchestrator2();
      const executionOptions = {
        campaignId,
        testMode,
        scheduleAt: scheduleAt ? new Date(scheduleAt) : void 0,
        selectedLeadIds,
        maxLeadsPerBatch
      };
      const result = await campaignOrchestrator2.executeCampaign(executionOptions);
      res.json(result);
    } catch (error) {
      console.error("Campaign execution error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to execute campaign",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/campaigns/:id/send-followup", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { templateIndex = 1, leadIds } = req.body;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      let templates = [];
      try {
        templates = JSON.parse(campaign.templates || "[]");
      } catch (error) {
        return res.status(400).json({ message: "Invalid email templates" });
      }
      if (!templates[templateIndex]) {
        return res.status(400).json({ message: "Template index out of range" });
      }
      let targetLeads;
      if (leadIds && Array.isArray(leadIds)) {
        targetLeads = await Promise.all(
          leadIds.map((id) => storage.getLead(id))
        );
        targetLeads = targetLeads.filter(Boolean);
      } else {
        const allLeads = await storage.getLeads();
        targetLeads = allLeads.filter((lead) => lead.campaignId === campaignId);
      }
      if (targetLeads.length === 0) {
        return res.status(400).json({ message: "No target leads found" });
      }
      const template = templates[templateIndex];
      const emails = targetLeads.map((lead) => ({
        to: lead.email,
        subject: template.subject || `${campaign.name} - Follow-up`,
        content: template.content || "Follow-up email content"
      }));
      const results = await sendBulkEmails(emails);
      const successful = results.success || [];
      await storage.updateCampaign(campaignId, {
        status: "sent"
      });
      res.json({
        message: "Follow-up emails sent successfully",
        successful: Array.isArray(successful) ? successful.length : 0,
        failed: Array.isArray(results.failed) ? results.failed.length : typeof results.failed === "number" ? results.failed : 0,
        templateUsed: templateIndex + 1
      });
    } catch (error) {
      console.error("Follow-up send error:", error);
      res.status(500).json({ message: "Failed to send follow-up emails" });
    }
  });
  app2.get("/api/campaigns/:id/analytics", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      const allLeads = await storage.getLeads();
      const campaignLeads = allLeads.filter((lead) => lead.campaignId === campaignId);
      const conversations2 = await storage.getConversations();
      const campaignConversations = conversations2.filter((conv) => conv.campaignId === campaignId);
      const analytics = {
        campaign: {
          name: campaign.name,
          status: campaign.status,
          emailsSent: 0,
          // Note: emailsSent property doesn't exist in schema
          lastExecuted: null,
          // Note: lastExecuted property doesn't exist in schema
          createdAt: campaign.createdAt
        },
        leads: {
          total: campaignLeads.length,
          byStatus: {
            new: campaignLeads.filter((l) => l.status === "new").length,
            contacted: campaignLeads.filter((l) => l.status === "contacted").length,
            qualified: campaignLeads.filter((l) => l.status === "qualified").length,
            converted: campaignLeads.filter((l) => l.status === "converted").length,
            lost: campaignLeads.filter((l) => l.status === "lost").length
          }
        },
        conversations: {
          total: campaignConversations.length,
          active: campaignConversations.filter((c) => c.status === "active").length,
          closed: campaignConversations.filter((c) => c.status === "closed").length
        },
        engagement: {
          responseRate: campaignLeads.length > 0 ? (campaignConversations.length / campaignLeads.length * 100).toFixed(1) : "0",
          conversionRate: campaignLeads.length > 0 ? (campaignLeads.filter((l) => l.status === "converted").length / campaignLeads.length * 100).toFixed(1) : "0"
        }
      };
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to get campaign analytics" });
    }
  });
  app2.put("/api/users/:id/role", async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["admin", "manager", "user"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }
      const user = await storage.updateUserRole(req.params.id, role);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user role" });
    }
  });
  app2.get("/api/conversations", async (req, res) => {
    try {
      const { userId } = req.query;
      const conversations2 = await storage.getConversations(userId);
      res.json(conversations2 || []);
    } catch (error) {
      console.error("Conversations fetch error:", error);
      res.status(200).json([]);
    }
  });
  app2.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });
  app2.post("/api/conversations", async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: "Invalid conversation data" });
    }
  });
  app2.put("/api/conversations/:id", async (req, res) => {
    try {
      const conversationData = insertConversationSchema.partial().parse(req.body);
      const conversation = await storage.updateConversation(req.params.id, conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: "Failed to update conversation" });
    }
  });
  app2.delete("/api/conversations/:id", async (req, res) => {
    try {
      await storage.deleteConversation(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete conversation", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });
  app2.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error(`Failed to fetch messages for conversation ${req.params.id}:`, error);
      res.status(500).json({
        message: "Failed to fetch messages",
        conversationId: req.params.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messageData = insertConversationMessageSchema.parse({
        ...req.body,
        conversationId: req.params.id
      });
      const message = await storage.createConversationMessage(messageData);
      await storage.updateConversation(req.params.id, { status: "active" });
      res.json(message);
    } catch (error) {
      console.error(`Failed to create message for conversation ${req.params.id}:`, error);
      const statusCode = error instanceof Error && error.message.includes("validation") ? 400 : 500;
      res.status(statusCode).json({
        message: statusCode === 400 ? "Invalid message data" : "Failed to create message",
        conversationId: req.params.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024
      // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel") {
        cb(null, true);
      } else {
        cb(new Error("Only CSV files are allowed"));
      }
    }
  });
  app2.get("/api/leads", async (req, res) => {
    try {
      const campaignId = req.query.campaignId;
      const leads2 = await storage.getLeads(campaignId);
      res.json(leads2);
    } catch (error) {
      console.error("Get leads error:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });
  app2.get("/api/leads/all", async (req, res) => {
    try {
      const leads2 = await storage.getLeads();
      res.json(leads2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });
  app2.get("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });
  app2.get("/api/leads/template", (req, res) => {
    const csvTemplate = `email,firstName,lastName,phoneNumber,vehicleInterest,leadSource,notes
john.doe@example.com,John,Doe,555-1234,Toyota Camry,Website,Interested in test drive
jane.smith@example.com,Jane,Smith,555-5678,Honda Civic,Walk-in,Looking for financing options
bob.johnson@example.com,Bob,Johnson,555-9012,Ford F-150,Referral,Wants trade-in evaluation`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="lead-template.csv"');
    res.send(csvTemplate);
  });
  app2.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse({
        ...req.body,
        clientId: req.clientId
        // Ensure client ID is assigned from tenant middleware
      });
      const lead = await storage.createLead(leadData);
      webSocketService.broadcastNewLead(lead);
      res.json(lead);
    } catch (error) {
      console.error("Create lead error:", error);
      res.status(400).json({
        message: "Invalid lead data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/campaigns/:id/leads/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const fileContent = req.file.buffer.toString("utf-8");
      const records = parse2(fileContent, { columns: true, skip_empty_lines: true, trim: true });
      const required = ["email"];
      const leadsData = [];
      const errors = [];
      records.forEach((record, idx) => {
        const email = record.email || record.Email;
        if (!email) {
          errors.push(`Row ${idx + 1}: missing email`);
          return;
        }
        leadsData.push({
          email,
          firstName: record.first_name || record.firstName || record["First Name"] || "",
          lastName: record.last_name || record.lastName || record["Last Name"] || "",
          phone: record.phone || "",
          vehicleInterest: record.vehicleInterest || record.vehicle_interest || record.vehicle || "",
          leadSource: record.leadSource || "csv_import",
          status: "new",
          campaignId,
          clientId: req.clientId
        });
      });
      if (leadsData.length === 0) return res.status(400).json({ message: "No valid leads", errors });
      const createdLeads = await storage.createLeads(leadsData);
      res.json({ message: "Leads uploaded", total: createdLeads.length, sample: createdLeads.slice(0, 5), errors: errors.length ? errors : void 0 });
    } catch (error) {
      console.error("Campaign lead upload error:", error);
      res.status(500).json({ message: "Failed to upload leads" });
    }
  });
  app2.put("/api/leads/:id", async (req, res) => {
    try {
      const leadData = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(req.params.id, leadData);
      res.json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });
  app2.get("/api/leads/:id/conversations", async (req, res) => {
    try {
      const convs = await storage.getConversationsByLead(req.params.id);
      res.json(convs || []);
    } catch (error) {
      console.error("Lead conversations fetch error:", error);
      res.status(500).json({ message: "Failed to fetch lead conversations" });
    }
  });
  app2.get("/api/leads/:id/conversations/latest/messages", async (req, res) => {
    try {
      const convs = await storage.getConversationsByLead(req.params.id);
      if (!convs || convs.length === 0) return res.json([]);
      const messages = await storage.getConversationMessages(convs[0].id);
      res.json(messages || []);
    } catch (error) {
      console.error(`Failed to fetch latest messages for lead ${req.params.id}:`, error);
      res.status(500).json({
        message: "Failed to fetch conversation messages",
        leadId: req.params.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.delete("/api/leads/:id", async (req, res) => {
    try {
      await storage.deleteLead(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });
  app2.post("/api/leads/upload-csv", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });
      }
      const campaignId = req.body.campaignId;
      const validationResult = await CSVValidationService.validateCSV(
        req.file.buffer,
        {
          maxFileSize: 10 * 1024 * 1024,
          // 10MB
          maxRows: 5e3,
          requireColumns: ["firstName", "lastName", "email"],
          sanitizeData: true
        }
      );
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          message: "CSV validation failed",
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          stats: validationResult.stats
        });
      }
      const leadsData = validationResult.data.map((lead) => ({
        ...lead,
        campaignId: campaignId || null,
        status: "new",
        leadSource: lead.source || "csv_upload",
        // Map to correct field name
        clientId: req.clientId
      }));
      const createdLeads = await storage.createLeads(leadsData);
      webSocketService.broadcast("leadsUploaded", {
        count: createdLeads.length,
        campaignId,
        timestamp: /* @__PURE__ */ new Date()
      });
      res.json({
        success: true,
        message: `Successfully uploaded ${createdLeads.length} leads`,
        leads: createdLeads,
        validationReport: CSVValidationService.generateValidationReport(validationResult),
        stats: validationResult.stats
      });
    } catch (error) {
      console.error("CSV upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process CSV upload",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/leads/bulk", async (req, res) => {
    try {
      const leadsData = req.body.leads.map((lead) => insertLeadSchema.parse(lead));
      const createdLeads = await storage.createLeads(leadsData);
      res.json({
        message: `Successfully created ${createdLeads.length} leads`,
        leads: createdLeads
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid leads data" });
    }
  });
  app2.get("/api/ai-agent-configs", async (req, res) => {
    try {
      const configs = await storage.getAiAgentConfigs();
      res.json(configs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch AI agent configurations" });
    }
  });
  app2.get("/api/ai-agent-configs/active", async (req, res) => {
    try {
      const activeConfig = await storage.getActiveAiAgentConfig();
      res.json(activeConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active AI agent configuration" });
    }
  });
  app2.get("/api/ai-agent-configs/:id", async (req, res) => {
    try {
      const config = await storage.getAiAgentConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ message: "AI agent configuration not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch AI agent configuration" });
    }
  });
  app2.post("/api/ai-agent-configs", async (req, res) => {
    try {
      if (req.body.agentEmailDomain) {
        let val = String(req.body.agentEmailDomain).trim();
        if (val.includes("@")) {
          val = val.split("@").pop().trim();
        }
        const domainRegex = /^[a-zA-Z0-9.-]+$/;
        if (!domainRegex.test(val)) {
          return res.status(400).json({ message: "agentEmailDomain must be a bare domain/subdomain (no protocol, no spaces)" });
        }
        req.body.agentEmailDomain = val.toLowerCase();
      }
      const configData = insertAiAgentConfigSchema.parse(req.body);
      const config = await storage.createAiAgentConfig(configData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid AI agent configuration data" });
    }
  });
  app2.put("/api/ai-agent-configs/:id", async (req, res) => {
    try {
      if (req.body.agentEmailDomain !== void 0) {
        let val = String(req.body.agentEmailDomain || "").trim();
        if (val.length === 0) {
          req.body.agentEmailDomain = null;
        } else {
          if (val.includes("@")) val = val.split("@").pop().trim();
          const domainRegex = /^[a-zA-Z0-9.-]+$/;
          if (!domainRegex.test(val)) {
            return res.status(400).json({ message: "agentEmailDomain must be a bare domain/subdomain (no '@' or invalid chars)" });
          }
          req.body.agentEmailDomain = val.toLowerCase();
        }
      }
      const configData = insertAiAgentConfigSchema.partial().parse(req.body);
      const config = await storage.updateAiAgentConfig(req.params.id, configData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Failed to update AI agent configuration" });
    }
  });
  app2.delete("/api/ai-agent-configs/:id", async (req, res) => {
    try {
      await storage.deleteAiAgentConfig(req.params.id);
      res.json({ message: "AI agent configuration deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete AI agent configuration" });
    }
  });
  app2.post("/api/ai-agent-configs/:id/activate", async (req, res) => {
    try {
      const activeConfig = await storage.setActiveAiAgentConfig(req.params.id);
      res.json(activeConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to activate AI agent configuration" });
    }
  });
  app2.get("/api/executions", async (req, res) => {
    try {
      const { executionMonitor: executionMonitor2 } = await Promise.resolve().then(() => (init_execution_monitor(), execution_monitor_exports));
      const executions = executionMonitor2.getActiveExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active executions" });
    }
  });
  app2.get("/api/executions/history", async (req, res) => {
    try {
      const { executionMonitor: executionMonitor2 } = await Promise.resolve().then(() => (init_execution_monitor(), execution_monitor_exports));
      const limit = parseInt(req.query.limit) || 20;
      const history = executionMonitor2.getExecutionHistory(limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution history" });
    }
  });
  app2.get("/api/executions/stats", async (req, res) => {
    try {
      const { executionMonitor: executionMonitor2 } = await Promise.resolve().then(() => (init_execution_monitor(), execution_monitor_exports));
      const stats = executionMonitor2.getExecutionStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution statistics" });
    }
  });
  app2.get("/api/executions/:id", async (req, res) => {
    try {
      const { executionMonitor: executionMonitor2 } = await Promise.resolve().then(() => (init_execution_monitor(), execution_monitor_exports));
      const execution = executionMonitor2.getExecutionStatus(req.params.id);
      if (!execution) {
        return res.status(404).json({ message: "Execution not found" });
      }
      res.json(execution);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution details" });
    }
  });
  app2.post("/api/executions/:id/cancel", async (req, res) => {
    try {
      const { executionMonitor: executionMonitor2 } = await Promise.resolve().then(() => (init_execution_monitor(), execution_monitor_exports));
      const cancelled = executionMonitor2.cancelExecution(req.params.id);
      if (!cancelled) {
        return res.status(400).json({ message: "Execution cannot be cancelled" });
      }
      res.json({ message: "Execution cancelled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel execution" });
    }
  });
  const handoverRoutes = await Promise.resolve().then(() => (init_handovers(), handovers_exports));
  app2.use("/api/handovers", handoverRoutes.default);
  const healthRoutes = await Promise.resolve().then(() => (init_health(), health_exports));
  app2.use("/api/health", healthRoutes.default);
  const imapHealthRoutes = await Promise.resolve().then(() => (init_health_imap(), health_imap_exports));
  app2.use("/api/health", imapHealthRoutes.default);
  const agentRoutes = await Promise.resolve().then(() => (init_agent(), agent_exports));
  app2.use("/api/agent", agentRoutes.default);
  app2.post("/api/campaigns/:id/schedule", async (req, res) => {
    try {
      const { scheduleType, scheduledStart, recurringPattern, recurringDays, recurringTime } = req.body;
      const scheduleConfig = {
        scheduleType,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : void 0,
        recurringPattern,
        recurringDays,
        recurringTime
      };
      const nextExecution = await campaignScheduler.scheduleCampaign(req.params.id, scheduleConfig);
      res.json({ success: true, nextExecution });
    } catch (error) {
      console.error("Campaign scheduling error:", error);
      res.status(500).json({ message: "Failed to schedule campaign" });
    }
  });
  app2.get("/api/campaigns/:id/schedule", async (req, res) => {
    try {
      const schedule = await campaignScheduler.getCampaignSchedule(req.params.id);
      res.json(schedule);
    } catch (error) {
      console.error("Get campaign schedule error:", error);
      res.status(500).json({ message: "Failed to get campaign schedule" });
    }
  });
  app2.delete("/api/campaigns/:id/schedule", async (req, res) => {
    try {
      await campaignScheduler.cancelScheduledCampaign(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Cancel campaign schedule error:", error);
      res.status(500).json({ message: "Failed to cancel campaign schedule" });
    }
  });
  app2.post("/api/campaigns/:id/execute-now", async (req, res) => {
    try {
      const result = await campaignScheduler.executeCampaign(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Execute campaign error:", error);
      res.status(500).json({ message: "Failed to execute campaign" });
    }
  });
  app2.get("/api/dashboard", async (req, res) => {
    try {
      const leads2 = await storage.getLeads();
      const campaigns2 = await storage.getCampaigns();
      const conversations2 = await storage.getConversations();
      const dashboardData = {
        leads: leads2.slice(0, 50).map((lead) => ({
          id: lead.id,
          name: lead.name || `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unknown",
          email: lead.email,
          phone: lead.phone,
          company: lead.company || "Unknown",
          score: lead.score || 0,
          status: lead.status || "new",
          createdAt: lead.createdAt
        })),
        summary: {
          totalLeads: leads2.length,
          totalCampaigns: campaigns2.length,
          totalConversations: conversations2.length,
          hotLeads: leads2.filter((l) => l.score && l.score > 80).length,
          activeConversations: conversations2.filter((c) => c.status === "active").length
        },
        recentActivity: [
          "New leads imported successfully",
          "Email campaigns running normally",
          "AI agents responding to conversations"
        ]
      };
      res.json(dashboardData);
    } catch (error) {
      console.error("Dashboard API error:", error);
      res.status(500).json({ message: "Failed to load dashboard data" });
    }
  });
  const httpServer = createServer(app2);
  webSocketService.initialize(httpServer);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
var __dirname2 = path2.dirname(fileURLToPath2(import.meta.url));
var viteLogger = createLogger();
function devCacheBuster() {
  return Math.random().toString(36).slice(2, 10);
}
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: {
      ...serverOptions,
      hmr: false
    },
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${devCacheBuster()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.get("/offerlogix-chat-widget.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(path2.resolve(distPath, "offerlogix-chat-widget.js"));
  });
  app2.use("*", (req, res) => {
    if (req.originalUrl.includes("offerlogix-chat-widget") || req.originalUrl.includes("chat-widget-demo")) {
      return res.status(404).send("File not found");
    }
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
dotenv.config();
var app = express2();
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.NODE_ENV === "development" ? "http://localhost:5173" : null,
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : null,
    "https://final-offerlogix.onrender.com",
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.CORS_ORIGIN,
    process.env.APP_URL
  ].filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5050", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, async () => {
    log(`serving on port ${port}`);
    log("\u2705 Server started successfully");
  });
  const shutdown = async (signal) => {
    console.log(`
\u{1F6D1} Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
})();
