var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// server/env.ts
var env_exports = {};
__export(env_exports, {
  getEnv: () => getEnv,
  validateEnv: () => validateEnv
});
import { z } from "zod";
function validateEnv() {
  try {
    env = envSchema.parse(process.env);
    console.log("\u2705 Environment validation successful");
    return env;
  } catch (error) {
    console.error("\u274C Environment validation failed:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\n\u{1F4CB} Required environment variables:");
      console.error("  - DATABASE_URL: PostgreSQL connection string");
      console.error("  - APP_URL, CLIENT_URL, FRONTEND_URL, SITE_URL, CORS_ORIGIN: Application URLs");
      console.error("  - SESSION_SECRET: Random string (32+ characters)");
      console.error("  - MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL: Mailgun configuration");
      console.error("  - MAILGUN_TRACKING_DOMAIN, MAILGUN_WEBHOOK_SIGNING_KEY: Mailgun settings");
      console.error("  - OPENROUTER_API_KEY: AI service key");
      console.error("  - INBOUND_ACCEPT_DOMAIN_SUFFIX: Domain for inbound emails");
      console.error("  - INBOUND_REQUIRE_CAMPAIGN_REPLY: true/false");
    } else {
      console.error("  - Unknown validation error:", error);
    }
    console.error("\n\u{1F527} Fix these issues and restart the server.");
    process.exit(1);
  }
}
function getEnv() {
  if (!env) {
    env = validateEnv();
  }
  return env;
}
var envSchema, env;
var init_env = __esm({
  "server/env.ts"() {
    "use strict";
    envSchema = z.object({
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default("5050"),
      // Database
      DATABASE_URL: z.string().url(),
      // Application URLs
      APP_URL: z.string().url(),
      CLIENT_URL: z.string().url(),
      FRONTEND_URL: z.string().url(),
      SITE_URL: z.string().url(),
      CORS_ORIGIN: z.string().url(),
      // Authentication & Security
      SESSION_SECRET: z.string().min(32),
      // Mailgun Configuration
      MAILGUN_API_KEY: z.string().min(1),
      MAILGUN_DOMAIN: z.string().min(1),
      MAILGUN_FROM_EMAIL: z.string().min(1),
      // Allowing custom format like "Brittany <brittany@mail.offerlogix.me>"
      MAILGUN_TRACKING_DOMAIN: z.string().min(1),
      MAILGUN_WEBHOOK_SIGNING_KEY: z.string().min(1),
      // AI Services
      OPENROUTER_API_KEY: z.string().min(1),
      // Inbound Email Configuration
      INBOUND_ACCEPT_DOMAIN_SUFFIX: z.string().min(1),
      INBOUND_REQUIRE_CAMPAIGN_REPLY: z.string().transform((val) => val === "true").default("true"),
      // Optional Environment Variables with Defaults
      SUPERMEMORY_API_KEY: z.string().optional(),
      SUPERMEMORY_BASE_URL: z.string().url().optional(),
      SUPERMEMORY_RAG: z.string().optional(),
      // Rate Limiting (for the components we'll add)
      AI_CONVERSATION_COOLDOWN_MS: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default("300000"),
      // 5 minutes
      CAMPAIGN_RATE_LIMIT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default("10"),
      WEBHOOK_RATE_LIMIT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default("100"),
      // Database Connection Pool
      DATABASE_POOL_MAX: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default("20"),
      DATABASE_POOL_MIN: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default("5"),
      DATABASE_IDLE_TIMEOUT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default("30000"),
      DATABASE_CONNECTION_TIMEOUT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default("10000"),
      // Logging
      LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info")
    });
    if (process.env.NODE_ENV === "production") {
      validateEnv();
    }
  }
});

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
      email: true,
      clientId: true
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

// server/logging/config.ts
import winston from "winston";
import path from "path";
import { existsSync, mkdirSync } from "fs";
var logLevels, env2, isProduction, isDevelopment, logLevel, logDir, logFormat, consoleFormat, transports, logger, PerformanceLogger, performanceLogger;
var init_config = __esm({
  "server/logging/config.ts"() {
    "use strict";
    init_env();
    logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      security: 4
    };
    env2 = getEnv();
    isProduction = env2.NODE_ENV === "production";
    isDevelopment = env2.NODE_ENV === "development";
    logLevel = env2.LOG_LEVEL || (isProduction ? "info" : "debug");
    logDir = path.join(process.cwd(), "logs");
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    logFormat = winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp: timestamp2, level, message, correlationId, service, ...meta }) => {
        const logEntry = {
          timestamp: timestamp2,
          level,
          message,
          correlationId: correlationId || "no-correlation",
          service: service || "offerlogix-api",
          environment: env2.NODE_ENV || "development",
          ...meta
        };
        return JSON.stringify(logEntry);
      })
    );
    consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: "HH:mm:ss" }),
      winston.format.printf(({ timestamp: timestamp2, level, message, correlationId, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
        const corrId = correlationId ? `[${String(correlationId).slice(0, 8)}]` : "";
        return `${timestamp2} ${level} ${corrId} ${message} ${metaStr}`;
      })
    );
    transports = [
      // Console transport (always enabled for development visibility)
      new winston.transports.Console({
        format: isDevelopment ? consoleFormat : logFormat,
        level: isDevelopment ? "debug" : "info"
      }),
      // Application logs (simple file logging)
      new winston.transports.File({
        filename: path.join(logDir, "application.log"),
        maxsize: 100 * 1024 * 1024,
        // 100MB
        maxFiles: 5,
        level: "info",
        format: logFormat
      }),
      // Error logs (separate error file)
      new winston.transports.File({
        filename: path.join(logDir, "error.log"),
        maxsize: 100 * 1024 * 1024,
        // 100MB
        maxFiles: 10,
        level: "error",
        format: logFormat
      })
    ];
    if (isDevelopment) {
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, "debug.log"),
          maxsize: 50 * 1024 * 1024,
          // 50MB
          maxFiles: 3,
          level: "debug",
          format: logFormat
        })
      );
    }
    logger = winston.createLogger({
      levels: logLevels,
      level: logLevel,
      format: logFormat,
      transports,
      // Handle uncaught exceptions and unhandled rejections
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, "exceptions.log"),
          format: logFormat
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, "rejections.log"),
          format: logFormat
        })
      ],
      // Exit on uncaught exceptions in production
      exitOnError: isProduction
    });
    winston.addColors({
      error: "red",
      warn: "yellow",
      info: "green",
      debug: "blue",
      security: "magenta"
    });
    PerformanceLogger = class {
      constructor() {
        this.metrics = {
          requestCount: 0,
          errorCount: 0,
          averageResponseTime: 0,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        };
        this.responseTimes = [];
        this.maxResponseTimes = 1e3;
      }
      logRequest(responseTime, isError2 = false) {
        this.metrics.requestCount++;
        if (isError2) this.metrics.errorCount++;
        this.responseTimes.push(responseTime);
        if (this.responseTimes.length > this.maxResponseTimes) {
          this.responseTimes.shift();
        }
        this.metrics.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      }
      getMetrics() {
        return {
          ...this.metrics,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        };
      }
      logMetrics() {
        const metrics = this.getMetrics();
        logger.info("Performance metrics", {
          component: "performance",
          metrics
        });
      }
    };
    performanceLogger = new PerformanceLogger();
    if (isProduction) {
      setInterval(() => {
        performanceLogger.logMetrics();
      }, 5 * 60 * 1e3);
    }
  }
});

// server/logging/logger.ts
var Logger, log;
var init_logger = __esm({
  "server/logging/logger.ts"() {
    "use strict";
    init_config();
    Logger = class _Logger {
      /**
       * Log debug information
       */
      debug(message, context) {
        logger.debug(message, this.sanitizeContext(context));
      }
      /**
       * Log general information
       */
      info(message, context) {
        logger.info(message, this.sanitizeContext(context));
      }
      /**
       * Log warnings
       */
      warn(message, context) {
        logger.warn(message, this.sanitizeContext(context));
      }
      /**
       * Log errors with structured context
       */
      error(message, context) {
        const errorContext = context ? {
          ...this.sanitizeContext(context),
          ...context.error && {
            errorName: context.error.name,
            errorMessage: context.error.message,
            stackTrace: context.error.stack
          }
        } : {};
        logger.error(message, errorContext);
        performanceLogger.logRequest(0, true);
      }
      /**
       * Log security events
       */
      security(message, context) {
        const securityContext = {
          ...this.sanitizeContext(context),
          level: "security",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        logger.security(message, securityContext);
      }
      /**
       * Log performance metrics
       */
      performance(message, context) {
        const perfContext = {
          ...this.sanitizeContext(context),
          component: "performance"
        };
        logger.info(message, perfContext);
        performanceLogger.logRequest(context.duration, context.status === "failure");
      }
      /**
       * Log database operations
       */
      database(message, context) {
        const dbContext = {
          ...this.sanitizeContext(context),
          component: "database",
          // Sanitize query to remove sensitive data
          query: context.query ? this.sanitizeQuery(context.query) : void 0
        };
        logger.info(message, dbContext);
      }
      /**
       * Log API operations
       */
      api(message, context) {
        const apiContext = {
          ...this.sanitizeContext(context),
          component: "api"
        };
        logger.info(message, apiContext);
        if (context.responseTime) {
          performanceLogger.logRequest(
            context.responseTime,
            (context.statusCode || 0) >= 400
          );
        }
      }
      /**
       * Log AI/LLM operations
       */
      ai(message, context) {
        const aiContext = {
          ...this.sanitizeContext(context),
          component: "ai"
        };
        logger.info(message, aiContext);
      }
      /**
       * Create logger with default context (for request-scoped logging)
       */
      withContext(context) {
        const contextualLogger = new _Logger();
        const originalSanitize = contextualLogger.sanitizeContext.bind(contextualLogger);
        contextualLogger.sanitizeContext = (additionalContext) => {
          return originalSanitize({ ...context, ...additionalContext });
        };
        return contextualLogger;
      }
      /**
       * Create logger from Express request
       */
      fromRequest(req) {
        const context = {
          correlationId: this.getCorrelationId(req),
          requestId: req.headers["x-request-id"],
          userId: req.user?.id,
          tenantId: req.tenant?.id || req.clientId,
          sessionId: req.sessionID || "no-session",
          ipAddress: this.getClientIp(req),
          userAgent: req.headers["user-agent"],
          method: req.method,
          path: req.path,
          query: Object.keys(req.query).length > 0 ? req.query : void 0
        };
        return this.withContext(context);
      }
      /**
       * Sanitize context to remove sensitive information
       */
      sanitizeContext(context) {
        if (!context) return {};
        const sanitized = { ...context };
        const sensitiveFields = [
          "password",
          "secret",
          "token",
          "key",
          "authorization",
          "cookie",
          "session",
          "credit_card",
          "ssn",
          "api_key"
        ];
        sensitiveFields.forEach((field) => {
          if (field in sanitized) {
            delete sanitized[field];
          }
        });
        Object.keys(sanitized).forEach((key) => {
          if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
            sanitized[key] = this.sanitizeObject(sanitized[key]);
          }
        });
        return sanitized;
      }
      /**
       * Sanitize nested objects
       */
      sanitizeObject(obj) {
        if (Array.isArray(obj)) {
          return obj.map(
            (item) => typeof item === "object" ? this.sanitizeObject(item) : item
          );
        }
        if (typeof obj === "object" && obj !== null) {
          const sanitized = { ...obj };
          const sensitiveFields = [
            "password",
            "secret",
            "token",
            "key",
            "authorization"
          ];
          sensitiveFields.forEach((field) => {
            if (field in sanitized) {
              sanitized[field] = "[REDACTED]";
            }
          });
          return sanitized;
        }
        return obj;
      }
      /**
       * Sanitize SQL queries to remove sensitive data
       */
      sanitizeQuery(query) {
        return query.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password='[REDACTED]'").replace(/token\s*=\s*['"][^'"]*['"]/gi, "token='[REDACTED]'").replace(/key\s*=\s*['"][^'"]*['"]/gi, "key='[REDACTED]'").replace(/secret\s*=\s*['"][^'"]*['"]/gi, "secret='[REDACTED]'");
      }
      /**
       * Extract correlation ID from request
       */
      getCorrelationId(req) {
        return req.headers["x-correlation-id"] || req.headers["x-request-id"] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      /**
       * Extract client IP from request
       */
      getClientIp(req) {
        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim() : req.connection.remoteAddress || req.socket.remoteAddress || "127.0.0.1";
        return ip;
      }
      /**
       * Get current performance metrics
       */
      getPerformanceMetrics() {
        return performanceLogger.getMetrics();
      }
    };
    log = new Logger();
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
    log.info("Database extensions ensured", {
      component: "database",
      operation: "extension_setup",
      extensions: ["pgcrypto", "uuid-ossp"]
    });
  } catch (err) {
    log.warn("Database extension setup warning", {
      component: "database",
      operation: "extension_setup",
      error: err,
      message: err?.message || String(err)
    });
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
      log.info("Adding campaigns.context column", {
        component: "database",
        operation: "schema_patch",
        table: "campaigns",
        column: "context"
      });
      await client.query(`ALTER TABLE campaigns ADD COLUMN context text NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE campaigns ALTER COLUMN context DROP DEFAULT`);
      log.info("campaigns.context column added successfully", {
        component: "database",
        operation: "schema_patch",
        table: "campaigns",
        column: "context"
      });
    }
    const addColumn = async (col, ddl) => {
      const { rowCount } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name=$1`,
        [col]
      );
      if (!rowCount) {
        log.info(`Adding campaigns.${col} column`, {
          component: "database",
          operation: "schema_patch",
          table: "campaigns",
          column: col
        });
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
        log.info(`Adding ${table}.${col} column`, {
          component: "database",
          operation: "schema_patch",
          table,
          column: col
        });
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
      log.info("Creating missing ai_agent_config table", {
        component: "database",
        operation: "table_creation",
        table: "ai_agent_config"
      });
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
      log.warn("Model default update warning", {
        component: "database",
        operation: "schema_patch",
        table: "ai_agent_config",
        field: "model",
        error: e
      });
    }
    try {
      await client.query(`ALTER TABLE ai_agent_config ADD CONSTRAINT ai_agent_config_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES clients(id)`);
    } catch (e) {
    }
    if (!await tableExists(client, "ai_personas")) {
      log.info("Creating missing ai_personas table", {
        component: "database",
        operation: "table_creation",
        table: "ai_personas"
      });
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
      log.info("Creating missing handovers table", {
        component: "database",
        operation: "table_creation",
        table: "handovers"
      });
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
    log.warn("Warning while applying legacy patches", {
      component: "database",
      operation: "legacy_patches",
      error: err,
      message: err?.message || String(err)
    });
  } finally {
    client.release();
  }
}
async function gracefulShutdown(signal) {
  log.info(`Received ${signal}, closing database connections`, {
    component: "database",
    operation: "graceful_shutdown",
    signal
  });
  try {
    await pool.end();
    log.info("Database connections closed successfully", {
      component: "database",
      operation: "graceful_shutdown"
    });
    process.exit(0);
  } catch (error) {
    log.error("Error closing database connections", {
      component: "database",
      operation: "graceful_shutdown",
      error
    });
    process.exit(1);
  }
}
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_logger();
    if (!process.env.DATABASE_URL) {
      const error = new Error("DATABASE_URL must be set. Did you forget to provision a database?");
      log.error("Database URL not configured", {
        component: "database",
        operation: "initialization",
        error,
        severity: "critical"
      });
      throw error;
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
    log.info("Database pool configured", {
      component: "database",
      operation: "pool_configuration",
      poolConfig: {
        max: pool.options.max,
        min: pool.options.min,
        idleTimeoutMs: pool.options.idleTimeoutMillis,
        connectionTimeoutMs: pool.options.connectionTimeoutMillis,
        ssl: !!pool.options.ssl
      }
    });
    void ensureDatabaseReady();
    void applyLegacyPatches();
    db = drizzle(pool, { schema: schema_exports });
    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
  }
});

// server/utils/error-utils.ts
function isError(error) {
  return error instanceof Error;
}
function toError(error) {
  if (isError(error)) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String(error.message));
  }
  return new Error("Unknown error occurred: " + String(error));
}
function getErrorMessage(error) {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Unknown error: " + String(error);
}
function createErrorContext(error, additionalContext) {
  const errorObj = toError(error);
  return {
    error: errorObj,
    message: errorObj.message,
    stack: errorObj.stack,
    ...additionalContext
  };
}
function categorizeError(error) {
  const err = toError(error);
  const msg = err.message.toLowerCase();
  if (msg.includes("network") || msg.includes("fetch") || err.code === "ECONNREFUSED") {
    return "network";
  }
  if (msg.includes("timeout")) {
    return "network";
  }
  if (msg.includes("json") || msg.includes("parse")) {
    return "parsing";
  }
  if (msg.includes("invalid") || msg.includes("validation")) {
    return "validation";
  }
  if (msg.includes("unauthorized") || msg.includes("forbidden")) {
    return "auth";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "rate_limit";
  }
  return "unknown";
}
function buildErrorResponse(error) {
  const category = categorizeError(error);
  let message = getErrorMessage(error);
  const userFriendlyMessages = {
    network: "Network error. Please check your connection and retry.",
    api: "AI service error. Please try again later.",
    parsing: "Received an unexpected response from the AI service.",
    validation: "Invalid input provided. Please review and try again.",
    auth: "Authentication required. Please refresh the page.",
    rate_limit: "Too many requests. Please wait a moment and try again.",
    unknown: "Unexpected error occurred. Please try again."
  };
  message = userFriendlyMessages[category];
  return { message, type: category };
}
var init_error_utils = __esm({
  "server/utils/error-utils.ts"() {
    "use strict";
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
function recordFailure(error) {
  consecutiveFails += 1;
  if (consecutiveFails === CIRCUIT_FAILS) {
    circuitOpenedAt = Date.now();
    if (error) {
      const errorContext = createErrorContext(error, {
        operation: "supermemory_circuit_opened",
        consecutiveFails,
        category: categorizeError(error)
      });
      console.warn("Supermemory circuit breaker opened:", errorContext);
    }
  }
}
async function requestWithRetries(path4, method, body) {
  if (!API_KEY) throw new Error("Supermemory API key missing");
  const url = `${BASE_URL.replace(/\/$/, "")}${path4}`;
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
        const retryError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        recordFailure(retryError);
        if (attempt >= MAX_RETRIES) return res;
        await sleep(backoff(attempt));
        continue;
      }
      recordSuccess();
      return res;
    } catch (err) {
      clearTimeout(timer);
      recordFailure(err);
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
    init_error_utils();
    BASE_URL = process.env.SUPERMEMORY_BASE_URL || "https://supermemory.ai/api";
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
        const res = await requestWithRetries("/add", "POST", payload);
        if (!res.ok) {
          const text2 = await res.text().catch(() => "");
          const error = new Error(`Supermemory add failed: ${res.status} ${text2}`);
          const errorContext = createErrorContext(error, {
            operation: "supermemory_add",
            status: res.status,
            category: categorizeError(error),
            contentLength: payload.content?.length || 0
          });
          console.error("Supermemory add error:", errorContext);
          throw error;
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
        const res = await requestWithRetries("/search", "POST", body);
        if (!res.ok) {
          const text2 = await res.text().catch(() => "");
          const error = new Error(`Supermemory search failed: ${res.status} ${text2}`);
          const errorContext = createErrorContext(error, {
            operation: "supermemory_search",
            status: res.status,
            category: categorizeError(error),
            query: body.query
          });
          console.error("Supermemory search error:", errorContext);
          throw error;
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
  clientId: clientId2,
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
    `client:${clientId2}`,
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
      async deleteUser(id) {
        await db.delete(users).where(eq(users.id, id));
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
async function isEmailSuppressed(email) {
  try {
    const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    const lead = await storage2.getLeadByEmail(email);
    if (lead) {
      const suppressedStatuses = ["bounced", "complained", "unsubscribed"];
      return suppressedStatuses.includes(lead.status);
    }
    return false;
  } catch (error) {
    console.error("Error checking email suppression:", error);
    return false;
  }
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
    const isSuppressed = await isEmailSuppressed(toAddr);
    if (isSuppressed) {
      console.warn(`Mailgun: email suppressed (bounced/complained/unsubscribed): ${toAddr}`);
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
    const trackingDomain = process.env.MAILGUN_TRACKING_DOMAIN || domain;
    const unsubscribeToken = Buffer.from(JSON.stringify({ email: toAddr, domain, timestamp: Date.now() })).toString("base64url");
    const body = new URLSearchParams({
      from: fromEmail,
      to: toAddr,
      subject,
      html,
      text: text2,
      // Reply-To if provided in variables
      ...variables.replyTo ? { "h:Reply-To": variables.replyTo } : {},
      // Replies should not look like bulk mail; skip List-* and Precedence unless explicitly allowed
      ...!options.suppressBulkHeaders ? {
        "h:X-Auto-Response-Suppress": "OOF, DR, RN, NRN, AutoReply",
        "h:List-Id": `<${domain}>`,
        "h:List-Help": `<mailto:help@${domain}>`,
        "h:List-Unsubscribe": `<mailto:unsubscribe@${domain}?subject=unsubscribe${process.env.MAILGUN_TRACKING_DOMAIN ? `>, <https://${trackingDomain}/unsubscribe?token=${unsubscribeToken}>` : ">"}`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        // Do NOT set Precedence: bulk for replies
      } : {},
      // Threading headers
      ...options.inReplyTo ? { "h:In-Reply-To": options.inReplyTo } : {},
      ...options.references && options.references.length ? { "h:References": options.references.join(" ") } : {},
      // Custom headers (prefix with h: for Mailgun)
      ...options.headers ? Object.fromEntries(Object.entries(options.headers).map(([k, v]) => [`h:${k}`, v])) : {}
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
      constructor() {
        this.clients = [];
      }
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
          const domainUsed = activeCfg?.agentEmailDomain || process.env.MAILGUN_DOMAIN || "";
          const configuredReplyTo = process.env.MAILGUN_REPLY_TO_EMAIL;
          const replyTo = configuredReplyTo && configuredReplyTo.trim() ? configuredReplyTo.trim() : domainUsed ? `campaign-${campaign.id}@${domainUsed}` : void 0;
          const success = await this.sendWithRetries(
            emailData.to,
            emailData.subject,
            emailData.html,
            activeCfg?.agentEmailDomain,
            replyTo
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
      async sendWithRetries(to, subject, html, domainOverride, replyTo) {
        const { sendCampaignEmail: sendCampaignEmail2, mailgunAuthIsSuppressed: mailgunAuthIsSuppressed2 } = await Promise.resolve().then(() => (init_mailgun(), mailgun_exports));
        let attempt = 0;
        while (true) {
          attempt++;
          try {
            if (mailgunAuthIsSuppressed2()) {
              return false;
            }
            const headers = {};
            if (replyTo) headers["h:Reply-To"] = replyTo;
            const ok = await sendCampaignEmail2(to, subject, html, {}, { domainOverride, headers });
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
      constructor() {
        this.assignmentRules = [
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
      }
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
      constructor() {
        this.activeExecutions = /* @__PURE__ */ new Map();
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
var call_openrouter_exports = {};
__export(call_openrouter_exports, {
  callOpenRouterJSON: () => callOpenRouterJSON
});
async function callOpenRouterJSON({
  model = "openai/gpt-5-chat",
  system,
  messages,
  temperature = 0.2,
  maxTokens = 1e3
}) {
  const env4 = getEnv();
  const apiKey = env4.OPENROUTER_API_KEY;
  if (!apiKey) {
    log.error("OPENROUTER_API_KEY not set", {
      component: "ai",
      operation: "openrouter_call",
      error: new Error("OPENROUTER_API_KEY not set"),
      model
    });
    throw new Error("OPENROUTER_API_KEY not set");
  }
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
  const referer = env4.SITE_URL;
  const startTime = performance.now();
  log.info("Starting OpenRouter API call", {
    component: "ai",
    operation: "openrouter_call",
    model,
    messageCount: messages.length,
    temperature,
    maxTokens,
    systemPromptLength: system.length
  });
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
    const duration2 = performance.now() - startTime;
    const error = new Error(`OpenRouter error ${res.status}: ${txt}`);
    const errorContext = createErrorContext(error, {
      status: res.status,
      statusText: res.statusText,
      response: txt.slice(0, 500),
      model,
      system: system.slice(0, 100) + "..."
    });
    log.ai("OpenRouter API call failed", {
      provider: "openrouter",
      model,
      latency: Math.round(duration2),
      cost: 0,
      // Could calculate based on token usage
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: 0,
      component: "ai",
      operation: "openrouter_call",
      error,
      httpStatus: res.status,
      httpStatusText: res.statusText
    });
    throw error;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  const duration = performance.now() - startTime;
  if (!content) {
    const error = new Error("No content from OpenRouter");
    const errorContext = createErrorContext(error, {
      data,
      model,
      system: system.slice(0, 100) + "..."
    });
    log.ai("OpenRouter API call returned no content", {
      provider: "openrouter",
      model,
      latency: Math.round(duration),
      cost: 0,
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: 0,
      component: "ai",
      operation: "openrouter_call",
      error,
      usage: data?.usage
    });
    throw error;
  }
  try {
    const parsedResult = JSON.parse(content);
    log.ai("OpenRouter API call successful", {
      provider: "openrouter",
      model,
      latency: Math.round(duration),
      cost: 0,
      // Could calculate based on token usage
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: content.length,
      tokenCount: {
        input: data?.usage?.prompt_tokens || 0,
        output: data?.usage?.completion_tokens || 0,
        total: data?.usage?.total_tokens || 0
      },
      component: "ai",
      operation: "openrouter_call",
      usage: data?.usage
    });
    return parsedResult;
  } catch (e) {
    const parseError = new Error("Failed to parse OpenRouter JSON content");
    const errorContext = createErrorContext(parseError, {
      content: content.slice(0, 500),
      originalError: getErrorMessage(e),
      model,
      system: system.slice(0, 100) + "...",
      errorCategory: categorizeError(e)
    });
    log.ai("OpenRouter JSON parse failed", {
      provider: "openrouter",
      model,
      latency: Math.round(duration),
      cost: 0,
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: content.length,
      component: "ai",
      operation: "openrouter_call",
      error: parseError,
      rawContent: content.slice(0, 200)
    });
    throw parseError;
  }
}
var init_call_openrouter = __esm({
  "server/services/call-openrouter.ts"() {
    "use strict";
    init_env();
    init_error_utils();
    init_logger();
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
    init_storage();
    init_error_utils();
    router = Router();
    router.post("/generate", async (req, res) => {
      try {
        const { context, campaignId } = req.body || {};
        let templateContext2 = context;
        if (campaignId && !context) {
          try {
            const campaign = await storage.getCampaign(campaignId);
            if (campaign) {
              templateContext2 = `Campaign: ${campaign.name}. Goals: ${campaign.handoverGoals || "Generate leads and drive conversions"}. Target: ${campaign.targetAudience || "potential customers"}`;
            } else {
              templateContext2 = "General marketing campaign focused on lead generation and customer engagement";
            }
          } catch (error) {
            const errorContext = createErrorContext(error, {
              operation: "fetch_campaign_context",
              campaignId
            });
            console.error("Error fetching campaign for context:", errorContext);
            templateContext2 = "General marketing campaign focused on lead generation and customer engagement";
          }
        }
        if (!templateContext2) {
          const errorResponse = buildErrorResponse(new Error("context or campaignId required"));
          return res.status(400).json(errorResponse);
        }
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
          model: "openai/gpt-5-chat",
          system,
          messages: [
            { role: "user", content: `Generate 3 subject lines and 3 short HTML templates (no external images).
Context: ${templateContext2}
Respond JSON: { "subject_lines": string[], "templates": string[] }` }
          ],
          temperature: 0.5,
          maxTokens: 1200
        });
        res.json({ subject_lines: json.subject_lines || [], templates: json.templates || [] });
      } catch (e) {
        const errorContext = createErrorContext(e, {
          operation: "template_generation",
          campaignId: req.body?.campaignId,
          hasContext: !!templateContext
        });
        console.error("Template generation error:", errorContext);
        const errorResponse = buildErrorResponse(e);
        res.status(500).json(errorResponse);
      }
    });
    templates_default = router;
  }
});

// server/routes/unsubscribe.ts
var unsubscribe_exports = {};
__export(unsubscribe_exports, {
  default: () => unsubscribe_default
});
import { Router as Router2 } from "express";
async function processUnsubscribe(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    if (!decoded.email || !decoded.domain || !decoded.timestamp) {
      return { success: false, error: "Invalid token format" };
    }
    const tokenAge = Date.now() - decoded.timestamp;
    const maxAge = 30 * 24 * 60 * 60 * 1e3;
    if (tokenAge > maxAge) {
      return { success: false, error: "Token has expired" };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(decoded.email)) {
      return { success: false, error: "Invalid email format" };
    }
    const lead = await storage.getLeadByEmail(decoded.email);
    if (lead) {
      await storage.updateLead(lead.id, {
        status: "unsubscribed",
        unsubscribedAt: (/* @__PURE__ */ new Date()).toISOString(),
        unsubscribeReason: "user_request"
      });
      console.log(`Lead unsubscribed: ${decoded.email}`);
    } else {
      await storage.createLead({
        email: decoded.email,
        status: "unsubscribed",
        leadSource: "unsubscribe_suppression",
        unsubscribedAt: (/* @__PURE__ */ new Date()).toISOString(),
        unsubscribeReason: "user_request"
      });
      console.log(`Suppression record created: ${decoded.email}`);
    }
    return { success: true, email: decoded.email };
  } catch (error) {
    console.error("Token processing error:", error);
    return { success: false, error: "Invalid or corrupted token" };
  }
}
var router2, unsubscribe_default;
var init_unsubscribe = __esm({
  "server/routes/unsubscribe.ts"() {
    "use strict";
    init_storage();
    router2 = Router2();
    router2.get("/unsubscribe", async (req, res) => {
      try {
        const { token } = req.query;
        if (!token || typeof token !== "string") {
          return res.status(400).send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Invalid Unsubscribe Link</h2>
          <p>This unsubscribe link is invalid or has expired.</p>
          <p>If you continue to receive unwanted emails, please contact us directly.</p>
        </body></html>
      `);
        }
        const result = await processUnsubscribe(token);
        if (result.success) {
          res.send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Successfully Unsubscribed</h2>
          <p>You have been successfully unsubscribed from our mailing list.</p>
          <p>Email: <strong>${result.email}</strong></p>
          <p>You will no longer receive marketing emails from us.</p>
          <p>If you continue to receive emails, please contact our support team.</p>
        </body></html>
      `);
        } else {
          res.status(400).send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Unsubscribe Failed</h2>
          <p>${result.error}</p>
          <p>Please try again or contact our support team.</p>
        </body></html>
      `);
        }
      } catch (error) {
        console.error("Unsubscribe error:", error);
        res.status(500).send(`
      <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
        <h2>Error Processing Unsubscribe</h2>
        <p>An error occurred while processing your unsubscribe request.</p>
        <p>Please try again later or contact our support team.</p>
      </body></html>
    `);
      }
    });
    router2.post("/unsubscribe", async (req, res) => {
      try {
        const { token } = req.body;
        if (!token) {
          return res.status(400).json({ error: "Token required" });
        }
        const result = await processUnsubscribe(token);
        if (result.success) {
          res.json({ success: true, message: "Successfully unsubscribed", email: result.email });
        } else {
          res.status(400).json({ success: false, error: result.error });
        }
      } catch (error) {
        console.error("One-click unsubscribe error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    router2.get("/unsubscribe/health", (req, res) => {
      res.json({ status: "ok", service: "unsubscribe" });
    });
    unsubscribe_default = router2;
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
      constructor() {
        this.blockRules = [
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
        this.spamKeywords = [
          "100% FREE",
          "URGENT",
          "MAKE MONEY FAST",
          "CLICK HERE NOW",
          "LIMITED TIME",
          "ACT NOW",
          "GUARANTEED",
          "NO RISK"
        ];
      }
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
  const from = process.env.MAILGUN_FROM_EMAIL;
  const idDomain = (opts.domainOverride || process.env.MAILGUN_DOMAIN || "").split("@").pop().trim() || "mail.offerlogix.me";
  const convToken = opts.conversationId ? `conv_${opts.conversationId}` : null;
  const replyToEmail = convToken ? `brittany+${convToken}@${idDomain}` : void 0;
  return sendCampaignEmail(
    opts.to,
    opts.subject,
    opts.html,
    {
      from: from || void 0,
      replyTo: replyToEmail
    },
    {
      // Treat as normal send so configured From is honored
      isAutoResponse: false,
      domainOverride: opts.domainOverride,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
      // Backup headers for conversation mapping
      headers: {
        ...opts.messageId ? { "Message-ID": `<${opts.messageId}>` } : {},
        ...opts.conversationId ? { "X-Conversation-ID": String(opts.conversationId) } : {},
        ...opts.campaignId ? { "X-Campaign-ID": String(opts.campaignId) } : {}
      },
      // Critical: make this look like a human reply, not a bulk send
      suppressBulkHeaders: true
    }
  );
}
var init_mailgun_threaded = __esm({
  "server/services/mailgun-threaded.ts"() {
    "use strict";
    init_mailgun();
  }
});

// server/services/conversation-rate-limiter.ts
var ConversationRateLimit, ConversationRateLimiters;
var init_conversation_rate_limiter = __esm({
  "server/services/conversation-rate-limiter.ts"() {
    "use strict";
    init_env();
    ConversationRateLimit = class {
      constructor(config) {
        this.config = config;
        this.store = /* @__PURE__ */ new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1e3);
      }
      /**
       * Check if AI response is allowed for conversation
       */
      checkLimit(identifier) {
        const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
        const now = Date.now();
        let entry = this.store.get(key);
        if (!entry || now > entry.resetTime) {
          entry = {
            count: 0,
            resetTime: now + this.config.windowMs,
            firstHit: now
          };
          this.store.set(key, entry);
        }
        const allowed = entry.count < this.config.maxMessages;
        const remaining = Math.max(0, this.config.maxMessages - entry.count);
        const resetTime = new Date(entry.resetTime);
        let retryAfter;
        if (!allowed) {
          retryAfter = Math.ceil((entry.resetTime - now) / 1e3);
        }
        return {
          allowed,
          remaining,
          resetTime,
          retryAfter
        };
      }
      /**
       * Record an AI response being sent
       */
      recordSent(identifier) {
        const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
        const entry = this.store.get(key);
        if (entry) {
          entry.count++;
          this.store.set(key, entry);
        }
      }
      /**
       * Get current usage stats for conversation
       */
      getUsage(identifier) {
        const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
        const entry = this.store.get(key);
        const now = Date.now();
        if (!entry || now > entry.resetTime) {
          return {
            count: 0,
            limit: this.config.maxMessages,
            remaining: this.config.maxMessages,
            resetTime: new Date(now + this.config.windowMs)
          };
        }
        return {
          count: entry.count,
          limit: this.config.maxMessages,
          remaining: Math.max(0, this.config.maxMessages - entry.count),
          resetTime: new Date(entry.resetTime)
        };
      }
      /**
       * Reset rate limit for specific conversation (admin override)
       */
      reset(identifier) {
        const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
        this.store.delete(key);
      }
      /**
       * Get all current rate limit entries for monitoring
       */
      getAllUsage() {
        const results = [];
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
          if (now <= entry.resetTime) {
            results.push({
              identifier: key,
              count: entry.count,
              resetTime: new Date(entry.resetTime)
            });
          }
        }
        return results.sort((a, b) => b.count - a.count);
      }
      /**
       * Clean up expired entries
       */
      cleanup() {
        const now = Date.now();
        const toDelete = [];
        for (const [key, entry] of this.store.entries()) {
          if (now > entry.resetTime) {
            toDelete.push(key);
          }
        }
        toDelete.forEach((key) => this.store.delete(key));
        if (toDelete.length > 0) {
          console.log(`\u{1F9F9} Cleaned up ${toDelete.length} expired conversation rate limit entries`);
        }
      }
      /**
       * Destroy the rate limiter and cleanup
       */
      destroy() {
        clearInterval(this.cleanupInterval);
        this.store.clear();
      }
    };
    ConversationRateLimiters = class _ConversationRateLimiters {
      static {
        this.env = getEnv();
      }
      static {
        // AI Conversation throttling - configurable via environment  
        this.aiConversation = new ConversationRateLimit({
          maxMessages: 1,
          // One AI response allowed per window
          windowMs: _ConversationRateLimiters.env.AI_CONVERSATION_COOLDOWN_MS,
          // 5 minutes by default
          keyGenerator: (conversationId) => `ai:conversation:${conversationId}`
        });
      }
      static {
        // Lead-level throttling - prevents spam from single lead
        this.leadDaily = new ConversationRateLimit({
          maxMessages: 20,
          // Max 20 AI responses per lead per day
          windowMs: 24 * 60 * 60 * 1e3,
          // 24 hours
          keyGenerator: (leadEmail) => `ai:lead:${leadEmail}:daily`
        });
      }
      static {
        // Campaign-level throttling - prevents campaign overload
        this.campaignHourly = new ConversationRateLimit({
          maxMessages: 50,
          // Max 50 AI responses per campaign per hour
          windowMs: 60 * 60 * 1e3,
          // 1 hour
          keyGenerator: (campaignId) => `ai:campaign:${campaignId}:hourly`
        });
      }
      static {
        // System-level protection - global AI response limit
        this.systemHourly = new ConversationRateLimit({
          maxMessages: 200,
          // Max 200 AI responses per hour system-wide
          windowMs: 60 * 60 * 1e3,
          // 1 hour
          keyGenerator: () => "ai:system:hourly"
        });
      }
      static {
        // Burst protection for active conversations
        this.burstProtection = new ConversationRateLimit({
          maxMessages: 3,
          // Max 3 quick responses
          windowMs: 2 * 60 * 1e3,
          // 2 minute window
          keyGenerator: (identifier) => `ai:burst:${identifier}`
        });
      }
      /**
       * Check if AI response is allowed for INBOUND lead replies
       * NOTE: Lead replies should ALWAYS be allowed - rate limiting only applies to:
       * 1. System-wide protection (prevent total overload)
       * 2. Lead daily limits (prevent abuse)
       * 3. Campaign limits (prevent campaign abuse)
       * 
       * CONVERSATION-level rate limiting is DISABLED for inbound lead replies
       */
      static checkAIResponseAllowed(conversationId, leadEmail, campaignId) {
        const systemLimit = this.systemHourly.checkLimit("system");
        if (!systemLimit.allowed) {
          return {
            allowed: false,
            reason: "System rate limit exceeded - please try again later",
            retryAfter: systemLimit.retryAfter
          };
        }
        if (leadEmail) {
          const leadLimit = this.leadDaily.checkLimit(leadEmail);
          if (!leadLimit.allowed) {
            return {
              allowed: false,
              reason: "Daily message limit reached for this lead",
              retryAfter: leadLimit.retryAfter
            };
          }
        }
        if (campaignId) {
          const campaignLimit = this.campaignHourly.checkLimit(campaignId);
          if (!campaignLimit.allowed) {
            return {
              allowed: false,
              reason: "Campaign rate limit exceeded",
              retryAfter: campaignLimit.retryAfter
            };
          }
        }
        return { allowed: true };
      }
      /**
       * Record AI INBOUND response being sent (no conversation-level tracking)
       */
      static recordAIInboundResponse(conversationId, leadEmail, campaignId) {
        this.systemHourly.recordSent("system");
        if (leadEmail) {
          this.leadDaily.recordSent(leadEmail);
        }
        if (campaignId) {
          this.campaignHourly.recordSent(campaignId);
        }
      }
      /**
       * Record AI OUTBOUND response being sent (full tracking including conversation limits)
       */
      static recordAIOutboundResponse(conversationId, leadEmail, campaignId) {
        this.aiConversation.recordSent(conversationId);
        this.systemHourly.recordSent("system");
        if (leadEmail) {
          this.leadDaily.recordSent(leadEmail);
        }
        if (campaignId) {
          this.campaignHourly.recordSent(campaignId);
        }
      }
      /**
       * Get comprehensive rate limit status for monitoring
       */
      static getStatus(conversationId, leadEmail, campaignId) {
        const status = {
          conversation: this.aiConversation.getUsage(conversationId),
          system: this.systemHourly.getUsage("system")
        };
        if (leadEmail) {
          status.lead = this.leadDaily.getUsage(leadEmail);
        }
        if (campaignId) {
          status.campaign = this.campaignHourly.getUsage(campaignId);
        }
        return status;
      }
    };
  }
});

// server/services/inbound-email.ts
var inbound_email_exports = {};
__export(inbound_email_exports, {
  InboundEmailService: () => InboundEmailService
});
import { createHmac } from "crypto";
function extractEmail(addr) {
  if (!addr) return "";
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim();
}
function extractLocal(recipient) {
  const match = recipient.toLowerCase().match(/^[^@]+/);
  return match ? match[0] : "";
}
function tryGetConversationIdFromRecipient(recipient) {
  const local = extractLocal(recipient);
  const m = local.match(/conv_(\d+)/);
  return m ? Number(m[1]) : null;
}
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
    init_error_utils();
    init_logger();
    init_conversation_rate_limiter();
    REPLY_RATE_LIMIT_MINUTES = parseInt(process.env.AI_REPLY_RATE_LIMIT_MINUTES || "15", 10);
    InboundEmailService = class {
      /**
       * Handle incoming email responses from leads
       * This webhook endpoint processes Mailgun inbound emails
       */
      static async handleInboundEmail(req, res) {
        try {
          const event = (req.headers["content-type"] || "").includes("application/json") ? req.body : Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
          if (process.env.NODE_ENV === "production" && !this.verifyMailgunSignature(event)) {
            log.warn("Mailgun signature verification failed - processing anyway for now", {
              component: "inbound-email",
              operation: "webhook_signature_verification",
              sender: event.sender,
              recipient: event.recipient,
              hasSignature: !!event.signature,
              hasTimestamp: !!event.timestamp,
              hasToken: !!event.token
            });
          }
          const REQUIRE_CAMPAIGN = String(process.env.INBOUND_REQUIRE_CAMPAIGN_REPLY || "true").toLowerCase() !== "false";
          const recipient = (event.recipient || "").toLowerCase();
          const match = recipient.match(/campaign-([a-z0-9-]+)@/i);
          const ACCEPT_SUFFIX = (process.env.INBOUND_ACCEPT_DOMAIN_SUFFIX || "offerlogix.me").toLowerCase();
          const recipientDomain = recipient.split("@")[1] || "";
          const ACCEPT_BY_DOMAIN = recipientDomain.endsWith(ACCEPT_SUFFIX);
          if (REQUIRE_CAMPAIGN && !match && !ACCEPT_BY_DOMAIN) {
            return res.status(200).json({ message: "Ignored: not a campaign reply" });
          }
          let leadInfo = null;
          let campaignId;
          let campaign = null;
          if (match) {
            campaignId = match[1];
            campaign = await storage.getCampaign(campaignId);
            if (!campaign) {
              return res.status(200).json({ message: "Ignored: unknown campaign" });
            }
            const leads2 = await storage.getLeadsByCampaign(campaignId);
            const senderEmail = extractEmail(event.sender || "").toLowerCase();
            const matchingLead = leads2.find((l) => (l.email || "").toLowerCase() === senderEmail);
            if (!matchingLead) {
              return res.status(200).json({ message: "Ignored: sender not a lead on campaign" });
            }
            leadInfo = { leadId: matchingLead.id, lead: matchingLead };
          } else {
            leadInfo = await this.extractLeadFromEmail(event);
          }
          if (!leadInfo && ACCEPT_BY_DOMAIN) {
            const senderEmail = extractEmail(event.sender || "").toLowerCase();
            let lead = await storage.getLeadByEmail(senderEmail);
            if (!lead) {
              lead = await storage.createLead({ email: senderEmail, leadSource: "email_inbound", status: "new" });
            }
            leadInfo = { leadId: lead.id, lead };
          }
          if (!leadInfo) {
            log.info("Could not identify lead from email", {
              component: "inbound-email",
              operation: "lead_identification",
              sender: event.sender,
              recipient: event.recipient,
              subject: event.subject?.slice(0, 100)
            });
            return res.status(200).json({ message: "Email processed but lead not identified" });
          }
          let conversation = null;
          const recipientConvId = tryGetConversationIdFromRecipient(event.recipient || "");
          if (recipientConvId) {
            try {
              conversation = await storage.getConversationById(recipientConvId);
              if (conversation) {
                log.info("Conversation found via plus-addressing token", {
                  component: "inbound-email",
                  operation: "conversation_lookup_fallback",
                  conversationId: recipientConvId,
                  sender: event.sender,
                  method: "plus_addressing"
                });
              }
            } catch (err) {
              log.warn("Failed to get conversation by plus-addressing token", {
                component: "inbound-email",
                operation: "conversation_lookup_fallback",
                conversationId: recipientConvId,
                error: err.message
              });
            }
          }
          if (!conversation) {
            conversation = await this.getOrCreateConversation(leadInfo.leadId, event.subject, campaignId);
          }
          await storage.createConversationMessage({
            conversationId: conversation.id,
            senderId: null,
            // Lead replies don't have a user ID
            messageType: "email",
            content: event["stripped-text"] || event["body-plain"],
            isFromAI: 0
          });
          const recentMessages = await storage.getConversationMessages(conversation.id, 10);
          const now = Date.now();
          const lastMsg = recentMessages[recentMessages.length - 1];
          if (lastMsg && lastMsg.isFromAI && now - new Date(lastMsg.createdAt).getTime() < REPLY_RATE_LIMIT_MINUTES * 60 * 1e3) {
            log.info("AI Reply Guard: Skipping consecutive AI reply", {
              component: "inbound-email",
              operation: "rate_limiting",
              conversationId: conversation.id,
              cooldownMinutes: REPLY_RATE_LIMIT_MINUTES,
              lastAiReplyTime: lastMsg.createdAt,
              sender: event.sender
            });
            return res.status(200).json({ message: "Rate-limited; no consecutive AI reply" });
          }
          const systemPrompt = `### Core Identity
You are Brittany from the OfferLogix team, reaching out to dealerships and technology partners.  
Your job is to clearly explain what we do, how we solve problems, and why it matters \u2014 without fluff, jargon, or over-the-top sales language.  
Think of yourself as a straight-talking teammate who knows the product, knows the industry, and values people's time.

### OfferLogix Company Knowledge
Main Value Proposition: "Advertise Automotive Payments With Confidence"

What We Do: OfferLogix provides penny perfect payment solutions using unique, patented technology to simplify calculating lease and finance payments for any dealer's inventory. Our solutions integrate across all customer touchpoints, advertising precise, compliant payments for every vehicle.

Company Scale:
- $1.5 Billion in accurate payments processed monthly
- 8,000+ dealerships powered in North America  
- 18+ years of experience (US and Canada)

Core Solutions:

1. Payment Calculation Solutions - Patented single-call API that generates dynamic, precise payments with:
   - Regional incentives and rebates
   - Lender affiliations and dealer pricing
   - Daily updates for accuracy
   - Built-in Reg M and Reg Z compliance (all 50 states + Canada)
   - Foundation Package: Basic payment data delivery
   - Premium Package: Automated Offer Manager with daily-updated inventory integration

2. Instant Credit Solutions - Real-time credit processing without impacting consumer credit scores:
   - Soft credit pulls from Equifax (no credit score impact)
   - Real-time credit approvals with live APR from selected banks
   - Credit Perfect Payments using actual credit scores
   - White-labeled customer credit dashboard
   - Elite Package: Lead generation + pre-qualification
   - Premium Package: Full credit approval + real-time APR

Proven Results:
- +16% average engagement rate
- +60% showroom visits
- +134% increase in lead volume

Key Partnerships: Equifax, VinCue, Fullpath, THE SHOP (FordDirect), STELLANTIS

Target Audiences: 
- Dealers: GMs, Finance Managers, Digital Marketing Managers
- Vendors: Technology partners needing payment calculation integration  

### Communication Style
- Be real: Conversational, approachable, clear \u2014 never robotic.  
- Be direct: Say what matters in plain language. Short sentences. Easy to skim.  
- Be value-focused: Always tie back to what helps the dealership/vendor: save time, boost leads, simplify compliance, streamline payment advertising.  
- Be respectful: Decision-makers are busy \u2014 you get to the point without hype.  
- Be collaborative: Frame messages like: "Here's what we can do for you if it's a fit."  

### Rules of Engagement
1. Start with context: One\u2011liner on what's relevant to them.  
2. Point out the benefit: How OfferLogix makes their life easier, faster, or safer.  
3. Ask one clear next question: No long surveys, no multiple asks at once.  
4. Keep it light but professional: Sound like a competent peer, not a telemarketer.  
5. Always respect opt\u2011out / handover: If they're not interested, acknowledge and move on.  

### What NOT to Do
- Don't write like a press release ("industry-leading, cutting-edge\u2026")  
- Don't overload with technical terms (keep compliance/API/payment details simple).  
- Don't over-hype ("This will revolutionize your\u2026").  
- Don't bury the ask in long paragraphs.  

### Prime Directive
Sound like a real OfferLogix teammate having a straight conversation with a busy dealership/vendor contact.  
- Keep it human.  
- Keep it clear.  
- Always tie back to value.  
- Guide toward either engagement or graceful exit.  

### EMAIL FORMATTING REQUIREMENTS
- Write in PLAIN, CONVERSATIONAL text - NO markdown, NO asterisks, NO formatting symbols
- Use HTML paragraph tags (<p></p>) for proper spacing - NO other HTML formatting
- Keep emails concise - 3-4 short paragraphs maximum
- Write like a normal business email, not a formatted document
- NO bold, italic, bullet points, or special characters in the email body
- Professional but friendly tone throughout
- Each paragraph should be wrapped in <p></p> tags for proper spacing
- NO <strong>, <em>, <ul>, <li>, or other formatting tags

EXAMPLE GOOD FORMAT:
<p>Hi [Name],</p>
<p>Thanks for reaching out about OfferLogix payment solutions. We help dealerships advertise precise, compliant payments using our patented technology that processes $1.5 billion monthly across 8,000+ dealerships.</p>
<p>Our Instant Credit Solutions use soft pulls from Equifax to give customers real-time approvals without impacting their credit scores. This typically increases showroom visits by 60% and lead volume by 134%.</p>
<p>Would you be interested in a quick 10-minute call to see how this could work for your dealership?</p>
<p>Best regards,<br>Brittany</p>

Output strictly JSON only with keys: should_reply (boolean), handover (boolean), reply_subject (string), reply_body_html (string), rationale (string).`;
          const rateLimitCheck = ConversationRateLimiters.checkAIResponseAllowed(
            conversation.id,
            leadInfo?.lead?.email,
            campaign?.id
          );
          if (!rateLimitCheck.allowed) {
            log.info("AI Reply Decision: Rate limited, skipping AI response", {
              conversationId: conversation.id,
              sender: event.sender,
              reason: rateLimitCheck.reason,
              retryAfter: rateLimitCheck.retryAfter,
              component: "inbound-email",
              operation: "ai_reply_decision"
            });
            return res.status(200).json({ status: "rate_limited", message: rateLimitCheck.reason });
          }
          let aiResult;
          try {
            aiResult = await callOpenRouterJSON({
              model: "openai/gpt-5-chat",
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
          } catch (err) {
            const errorContext = createErrorContext(err, {
              conversationId: conversation.id,
              sender: event.sender,
              operation: "ai_reply_decision"
            });
            log.error("AI Reply Decision: OpenRouter error, falling back to handover", {
              ...errorContext,
              component: "inbound-email",
              operation: "ai_reply_decision"
            });
            aiResult = { should_reply: false, handover: true, rationale: "AI service unavailable" };
          }
          const safeHtml = sanitizeHtmlBasic(aiResult.reply_body_html || "");
          log.info("AI Reply Decision completed", {
            component: "inbound-email",
            operation: "ai_reply_decision",
            conversationId: conversation.id,
            should_reply: aiResult.should_reply,
            handover: aiResult.handover,
            rationale: aiResult.rationale?.slice(0, 300),
            sender: event.sender
          });
          if (aiResult?.handover || !aiResult?.should_reply) {
            await storage.createHandover({ conversationId: conversation.id, reason: aiResult?.rationale || "AI requested handover" });
            return res.status(200).json({ message: "Handover created" });
          }
          ConversationRateLimiters.recordAIInboundResponse(conversation.id, leadInfo?.lead?.email, campaign?.id);
          try {
            let messageId;
            try {
              const headersArr = JSON.parse(event["message-headers"] || "[]");
              messageId = headersArr.find((h) => (h[0] || "").toLowerCase() === "message-id")?.[1]?.replace(/[<>]/g, "");
            } catch {
            }
            if (!messageId && event["Message-Id"]) {
              messageId = event["Message-Id"].replace(/[<>]/g, "");
            }
            if (!messageId && event["message-id"]) {
              messageId = event["message-id"].replace(/[<>]/g, "");
            }
            if (!messageId) {
              const idDomain2 = (process.env.MAILGUN_DOMAIN || "").split("@").pop().trim() || "mail.offerlogix.me";
              messageId = `conversation-${conversation.id}@${idDomain2}`;
              log.warn("No Message-ID found, using conversation-based threading", {
                component: "inbound-email",
                operation: "email_threading_fallback",
                conversationId: conversation.id,
                generatedMessageId: messageId
              });
            }
            log.info("Email threading debug", {
              component: "inbound-email",
              operation: "email_threading",
              sender: event.sender,
              subject: event.subject,
              extractedMessageId: messageId,
              hasMessageHeaders: !!event["message-headers"],
              hasDirectMessageId: !!event["Message-Id"],
              hasLowercaseMessageId: !!event["message-id"],
              eventKeys: Object.keys(event).slice(0, 15)
              // Show available fields
            });
            let references = [];
            let originalMessageId;
            try {
              const headersArr = JSON.parse(event["message-headers"] || "[]");
              const existingRefs = headersArr.find((h) => (h[0] || "").toLowerCase() === "references")?.[1];
              if (existingRefs) {
                const existingRefsList = existingRefs.trim().split(/\s+/).filter((ref) => ref.length > 0);
                references = [...existingRefsList];
                if (existingRefsList.length > 0) {
                  originalMessageId = existingRefsList[existingRefsList.length - 1].replace(/[<>]/g, "");
                }
              }
              const inReplyToHeader = headersArr.find((h) => (h[0] || "").toLowerCase() === "in-reply-to")?.[1];
              if (inReplyToHeader && !originalMessageId) {
                originalMessageId = inReplyToHeader.replace(/[<>]/g, "");
                references.push(inReplyToHeader);
              }
            } catch {
            }
            if (messageId) {
              references.push(`<${messageId}>`);
            }
            if (!originalMessageId) {
              originalMessageId = messageId;
            }
            const idDomain = (process.env.MAILGUN_DOMAIN || "").split("@").pop().trim() || "mail.offerlogix.me";
            const replyMessageId = `reply-${conversation.id}-${Date.now()}@${idDomain}`;
            log.info("Enhanced email threading debug", {
              component: "inbound-email",
              operation: "email_threading_enhanced",
              sender: event.sender,
              incomingMessageId: messageId,
              originalMessageId,
              replyMessageId,
              inReplyToHeader: originalMessageId ? `<${originalMessageId}>` : void 0,
              referencesChain: references,
              conversationId: conversation.id
            });
            await sendThreadedReply({
              to: extractEmail(event.sender || ""),
              subject: aiResult.reply_subject || `Re: ${event.subject || "Your email"}`,
              html: sanitizeHtmlBasic(aiResult.reply_body_html || ""),
              messageId: replyMessageId,
              // Our reply's Message-ID
              inReplyTo: originalMessageId ? `<${originalMessageId}>` : void 0,
              // Reference to ORIGINAL message we should reply to
              references: references.length > 0 ? references : void 0,
              domainOverride: campaign?.agentEmailDomain,
              // if present
              conversationId: String(conversation.id),
              // for plus-addressing token
              campaignId: campaign?.id ? String(campaign.id) : void 0
              // for tracking headers
            });
          } catch (sendErr) {
            const errorContext = createErrorContext(sendErr, {
              conversationId: conversation.id,
              recipient: event.sender,
              operation: "send_ai_reply"
            });
            log.error("Failed to send AI reply email", {
              ...errorContext,
              component: "inbound-email",
              operation: "send_ai_reply"
            });
          }
          await storage.createConversationMessage({
            conversationId: conversation.id,
            senderId: null,
            // AI replies don't have a user ID
            messageType: "email",
            content: aiResult.reply_body_html || "",
            isFromAI: 1
          });
          res.status(200).json({ message: "Email processed and replied" });
        } catch (error) {
          const errorContext = createErrorContext(error, {
            sender: req.body?.sender,
            recipient: req.body?.recipient,
            operation: "inbound_email_processing"
          });
          log.error("Inbound email processing error (non-fatal path will ack)", {
            ...errorContext,
            component: "inbound-email",
            operation: "inbound_email_processing"
          });
          try {
          } catch {
          }
          const errorResponse = buildErrorResponse(error);
          res.status(200).json({ ...errorResponse, acknowledged: true });
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
            log.warn("MAILGUN_WEBHOOK_SIGNING_KEY not set; bypassing signature verification in non-production", {
              component: "inbound-email",
              operation: "webhook_signature_verification",
              environment: process.env.NODE_ENV
            });
            return !!(event.sender && event.timestamp && event.token);
          }
          log.security("MAILGUN_WEBHOOK_SIGNING_KEY missing in production", {
            eventType: "missing_webhook_key",
            severity: "high",
            component: "inbound-email",
            operation: "webhook_signature_verification",
            environment: process.env.NODE_ENV
          });
          return false;
        }
        try {
          const hmac = createHmac("sha256", signingKey).update(String(event.timestamp) + String(event.token)).digest("hex");
          return hmac === event.signature;
        } catch (err) {
          const errorContext = createErrorContext(err, { operation: "mailgun_signature_verification" });
          log.error("Signature verification error", {
            ...errorContext,
            component: "inbound-email",
            operation: "mailgun_signature_verification"
          });
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
      static async getOrCreateConversation(leadId, subject, campaignId) {
        const conversations2 = await storage.getConversationsByLead(leadId);
        if (conversations2.length > 0) {
          return conversations2[0];
        }
        return await storage.createConversation({
          leadId,
          campaignId,
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

// server/routes/mailgun-webhooks.ts
var mailgun_webhooks_exports = {};
__export(mailgun_webhooks_exports, {
  default: () => mailgun_webhooks_default
});
import { Router as Router3 } from "express";
import crypto from "crypto";
function verifyWebhookSignature(body) {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("MAILGUN_WEBHOOK_SIGNING_KEY not set; bypassing signature verification in non-production");
      return true;
    }
    console.error("MAILGUN_WEBHOOK_SIGNING_KEY missing in production");
    return false;
  }
  const { timestamp: timestamp2, token, signature } = body.signature;
  const value = timestamp2 + token;
  const hash = crypto.createHmac("sha256", signingKey).update(value).digest("hex");
  return hash === signature;
}
async function handleBounce(recipient, reason, severity, eventData) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      const isHardBounce = severity === "permanent" || reason && (reason.includes("mailbox does not exist") || reason.includes("user unknown") || reason.includes("invalid recipient") || reason.includes("domain not found"));
      if (isHardBounce) {
        await storage.updateLead(lead.id, {
          status: "bounced",
          bounceReason: reason || "Hard bounce",
          bouncedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        console.log(`Hard bounce suppressed: ${recipient} - ${reason}`);
      } else {
        console.log(`Soft bounce tracked: ${recipient} - ${reason}`);
      }
    } else {
      await storage.createLead({
        email: recipient,
        status: "bounced",
        leadSource: "bounce_suppression",
        bounceReason: reason || "Bounce",
        bouncedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log(`Bounce suppression record created: ${recipient}`);
    }
  } catch (error) {
    console.error(`Error handling bounce for ${recipient}:`, error);
  }
}
async function handleComplaint(recipient, eventData) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      await storage.updateLead(lead.id, {
        status: "complained",
        complainedAt: (/* @__PURE__ */ new Date()).toISOString(),
        complaintReason: "Spam complaint"
      });
    } else {
      await storage.createLead({
        email: recipient,
        status: "complained",
        leadSource: "complaint_suppression",
        complainedAt: (/* @__PURE__ */ new Date()).toISOString(),
        complaintReason: "Spam complaint"
      });
    }
    console.log(`Spam complaint suppressed: ${recipient}`);
  } catch (error) {
    console.error(`Error handling complaint for ${recipient}:`, error);
  }
}
async function handleUnsubscribe(recipient, eventData) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      await storage.updateLead(lead.id, {
        status: "unsubscribed",
        unsubscribedAt: (/* @__PURE__ */ new Date()).toISOString(),
        unsubscribeReason: "mailgun_unsubscribe"
      });
    } else {
      await storage.createLead({
        email: recipient,
        status: "unsubscribed",
        leadSource: "unsubscribe_suppression",
        unsubscribedAt: (/* @__PURE__ */ new Date()).toISOString(),
        unsubscribeReason: "mailgun_unsubscribe"
      });
    }
    console.log(`Unsubscribe processed: ${recipient}`);
  } catch (error) {
    console.error(`Error handling unsubscribe for ${recipient}:`, error);
  }
}
async function handleDelivered(recipient, eventData) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      await storage.updateLead(lead.id, {
        lastEmailDeliveredAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  } catch (error) {
    console.error(`Error handling delivery for ${recipient}:`, error);
  }
}
async function handleOpened(recipient, eventData) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      await storage.updateLead(lead.id, {
        lastEmailOpenedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  } catch (error) {
    console.error(`Error handling open for ${recipient}:`, error);
  }
}
async function handleClicked(recipient, eventData) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      await storage.updateLead(lead.id, {
        lastEmailClickedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  } catch (error) {
    console.error(`Error handling click for ${recipient}:`, error);
  }
}
var router3, mailgun_webhooks_default;
var init_mailgun_webhooks = __esm({
  "server/routes/mailgun-webhooks.ts"() {
    "use strict";
    init_storage();
    router3 = Router3();
    router3.post("/webhooks/mailgun/events", async (req, res) => {
      try {
        const event = req.body;
        if (!verifyWebhookSignature(event)) {
          console.error("Invalid Mailgun webhook signature");
          return res.status(401).json({ error: "Unauthorized" });
        }
        const eventData = event["event-data"];
        const { event: eventType, recipient, reason, severity } = eventData;
        console.log(`Mailgun event: ${eventType} for ${recipient}`);
        switch (eventType) {
          case "failed":
            await handleBounce(recipient, reason, severity, eventData);
            break;
          case "complained":
            await handleComplaint(recipient, eventData);
            break;
          case "unsubscribed":
            await handleUnsubscribe(recipient, eventData);
            break;
          case "delivered":
            await handleDelivered(recipient, eventData);
            break;
          case "opened":
            await handleOpened(recipient, eventData);
            break;
          case "clicked":
            await handleClicked(recipient, eventData);
            break;
          default:
            console.log(`Unhandled Mailgun event type: ${eventType}`);
        }
        res.status(200).json({ received: true });
      } catch (error) {
        console.error("Mailgun webhook error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    router3.get("/webhooks/mailgun/health", (req, res) => {
      res.json({
        status: "ok",
        service: "mailgun-webhooks",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
    mailgun_webhooks_default = router3;
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
      constructor() {
        this.activeExecutions = /* @__PURE__ */ new Map();
        this.executionHistory = [];
      }
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
import { Router as Router4 } from "express";
var router4, handovers_default;
var init_handovers = __esm({
  "server/routes/handovers.ts"() {
    "use strict";
    init_storage();
    router4 = Router4();
    router4.get("/", async (req, res) => {
      try {
        const list = await storage.getHandovers();
        res.json(list);
      } catch (e) {
        res.status(500).json({ message: "Failed to fetch handovers" });
      }
    });
    router4.patch("/:id/resolve", async (req, res) => {
      try {
        const updated = await storage.resolveHandover(req.params.id);
        if (!updated) return res.status(404).json({ message: "Not found" });
        res.json(updated);
      } catch (e) {
        res.status(500).json({ message: "Failed to resolve handover" });
      }
    });
    handovers_default = router4;
  }
});

// server/routes/health.ts
var health_exports = {};
__export(health_exports, {
  default: () => health_default
});
import { Router as Router5 } from "express";
var router5, health_default;
var init_health = __esm({
  "server/routes/health.ts"() {
    "use strict";
    router5 = Router5();
    router5.get("/email", async (_req, res) => {
      try {
        const { getEnv: getEnv3 } = await Promise.resolve().then(() => (init_env(), env_exports));
        const env4 = getEnv3();
        const hasMailgun = !!(env4.MAILGUN_DOMAIN && env4.MAILGUN_API_KEY);
        let authStatus = { ok: false, details: {} };
        if (hasMailgun) {
          try {
            const fetch2 = (await import("node-fetch")).default;
            const response = await fetch2(`https://api.mailgun.net/v3/domains/${env4.MAILGUN_DOMAIN}`, {
              method: "GET",
              headers: {
                "Authorization": `Basic ${Buffer.from(`api:${env4.MAILGUN_API_KEY}`).toString("base64")}`
              }
            });
            authStatus = {
              ok: response.ok,
              details: {
                domain: env4.MAILGUN_DOMAIN,
                status: response.ok ? "healthy" : "unhealthy",
                authentication: response.ok ? "configured" : "failed",
                deliverability: response.ok ? "ready" : "unavailable"
              }
            };
          } catch (error) {
            authStatus = {
              ok: false,
              details: {
                domain: env4.MAILGUN_DOMAIN,
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
    router5.get("/realtime", async (_req, res) => {
      try {
        let wsStatus = { ok: false, details: {} };
        try {
          const connectedClients = 0;
          wsStatus = {
            ok: true,
            details: {
              status: "active",
              connectedClients,
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
    router5.get("/ai", async (_req, res) => {
      try {
        const { getEnv: getEnv3 } = await Promise.resolve().then(() => (init_env(), env_exports));
        const env4 = getEnv3();
        const hasOpenRouter = !!env4.OPENROUTER_API_KEY;
        let aiStatus = { ok: false, details: {} };
        if (hasOpenRouter) {
          try {
            const { callOpenRouterJSON: callOpenRouterJSON2 } = await Promise.resolve().then(() => (init_call_openrouter(), call_openrouter_exports));
            const testResponse = await callOpenRouterJSON2({
              model: "openai/gpt-5-chat",
              system: 'Respond with JSON: {"status": "OK"}',
              messages: [{ role: "user", content: "Test" }],
              maxTokens: 20
            });
            aiStatus = {
              ok: testResponse.status === "OK",
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
    router5.get("/database", async (_req, res) => {
      try {
        const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const { clients: clients2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
        const result = await db2.select().from(clients2).limit(1);
        res.json({
          ok: true,
          details: {
            status: "healthy",
            type: "PostgreSQL",
            connectivity: "active",
            response: Array.isArray(result)
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
    router5.get("/system", async (_req, res) => {
      try {
        const checkDatabase = async () => {
          try {
            const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
            const { clients: clients2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
            await db2.select().from(clients2).limit(1);
            return { ok: true, status: "healthy" };
          } catch {
            return { ok: false, status: "error" };
          }
        };
        const checkEmail = async () => {
          try {
            const { getEnv: getEnv3 } = await Promise.resolve().then(() => (init_env(), env_exports));
            const env4 = getEnv3();
            return { ok: !!(env4.MAILGUN_DOMAIN && env4.MAILGUN_API_KEY), status: "configured" };
          } catch {
            return { ok: false, status: "not_configured" };
          }
        };
        const checkAI = async () => {
          try {
            const { getEnv: getEnv3 } = await Promise.resolve().then(() => (init_env(), env_exports));
            const env4 = getEnv3();
            return { ok: !!env4.OPENROUTER_API_KEY, status: "configured" };
          } catch {
            return { ok: false, status: "not_configured" };
          }
        };
        const checks = await Promise.allSettled([
          checkDatabase(),
          checkEmail(),
          checkAI()
        ]);
        const results = {
          database: checks[0].status === "fulfilled" ? checks[0].value : { ok: false, status: "error" },
          email: checks[1].status === "fulfilled" ? checks[1].value : { ok: false, status: "error" },
          ai: checks[2].status === "fulfilled" ? checks[2].value : { ok: false, status: "error" }
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
    health_default = router5;
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
import { Router as Router6 } from "express";
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
var router6, imapHealthStatus, health_imap_default;
var init_health_imap = __esm({
  "server/routes/health-imap.ts"() {
    "use strict";
    router6 = Router6();
    imapHealthStatus = {
      connected: false,
      messagesProcessed: 0,
      errors: []
    };
    router6.get("/imap", (req, res) => {
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
    health_imap_default = router6;
  }
});

// server/services/agent-runtime.ts
import { eq as eq4, and as and3 } from "drizzle-orm";
import crypto2 from "crypto";
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
        return crypto2.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").substring(0, 16);
      }
      /**
       * Load the active config for a client
       */
      static async getActiveConfig(clientId2) {
        try {
          const rows = await db.select().from(aiAgentConfig).where(and3(eq4(aiAgentConfig.clientId, clientId2), eq4(aiAgentConfig.isActive, true))).limit(1);
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
          const { clientId: clientId2, leadId, topic } = opts;
          let lead = null;
          if (leadId) {
            const rows = await db.select().from(leads).where(eq4(leads.id, leadId)).limit(1);
            lead = rows?.[0] || null;
          }
          const tags = [
            `client:${clientId2}`,
            lead?.email ? `lead:${_AgentRuntime.hashEmail(lead.email)}` : null
          ].filter(Boolean);
          const query = topic && topic.trim() ? topic : "recent conversation context and similar successful replies";
          const { searchMemories: searchMemories2 } = await Promise.resolve().then(() => (init_supermemory(), supermemory_exports));
          const results = await searchMemories2({
            q: query,
            clientId: clientId2 || "default",
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
        const traceId = crypto2.randomUUID ? crypto2.randomUUID() : Math.random().toString(36).slice(2);
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
      static async ensureDefaultConfig(clientId2) {
        try {
          const existing = await this.getActiveConfig(clientId2);
          if (existing) return existing.id;
          const defaultConfig = await db.insert(aiAgentConfig).values({
            clientId: clientId2,
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
import { Router as Router7 } from "express";
import { eq as eq5 } from "drizzle-orm";
var agentRouter, agent_default;
var init_agent = __esm({
  "server/routes/agent.ts"() {
    "use strict";
    init_agent_runtime();
    init_schema();
    init_db();
    agentRouter = Router7();
    agentRouter.post("/reply", async (req, res) => {
      try {
        const clientId2 = req.body.clientId || "default-client";
        const { message, leadId, conversationId, topic, model } = req.body;
        if (!message) {
          return res.status(400).json({ error: "message is required" });
        }
        await AgentRuntime.ensureDefaultConfig(clientId2);
        const result = await AgentRuntime.reply({
          clientId: clientId2,
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
        const clientId2 = req.query.clientId || "default-client";
        const config = await AgentRuntime.getActiveConfig(clientId2);
        if (!config) {
          const configId = await AgentRuntime.ensureDefaultConfig(clientId2);
          const newConfig = await AgentRuntime.getActiveConfig(clientId2);
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
        const clientId2 = req.body.clientId || "default-client";
        const {
          name: name2,
          personality,
          tonality,
          responseStyle,
          dosList,
          dontsList,
          model,
          systemPrompt
        } = req.body;
        const currentConfig = await AgentRuntime.getActiveConfig(clientId2);
        if (currentConfig) {
          await db.update(aiAgentConfig).set({
            name: name2 || currentConfig.name,
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
          const configId = await AgentRuntime.ensureDefaultConfig(clientId2);
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
        const clientId2 = req.query.clientId || "default-client";
        const config = await AgentRuntime.getActiveConfig(clientId2);
        const testReply = await AgentRuntime.reply({
          clientId: clientId2,
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

// server/routes/ai-persona.ts
var ai_persona_exports = {};
__export(ai_persona_exports, {
  default: () => ai_persona_default
});
import { Router as Router8 } from "express";
import { z as z3 } from "zod";
import { eq as eq6, and as and5, desc as desc2 } from "drizzle-orm";
var router7, ai_persona_default;
var init_ai_persona = __esm({
  "server/routes/ai-persona.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_error_utils();
    router7 = Router8();
    router7.get("/", async (req, res) => {
      try {
        const clientId2 = req.headers["x-client-id"] || "00000000-0000-0000-0000-000000000001";
        const {
          targetAudience: targetAudience2,
          industry: industry2,
          isActive,
          includeKnowledgeBases,
          includeCampaignCounts
        } = req.query;
        const conditions = [eq6(aiPersonas.clientId, clientId2)];
        if (targetAudience2) {
          conditions.push(eq6(aiPersonas.targetAudience, targetAudience2));
        }
        if (industry2) {
          conditions.push(eq6(aiPersonas.industry, industry2));
        }
        if (isActive !== void 0) {
          conditions.push(eq6(aiPersonas.isActive, isActive === "true"));
        }
        const personas = await db.select().from(aiPersonas).where(and5(...conditions)).orderBy(desc2(aiPersonas.priority), desc2(aiPersonas.createdAt));
        res.json({
          success: true,
          data: personas,
          total: personas.length
        });
      } catch (error) {
        const errorContext = createErrorContext(error, { operation: "get_personas", clientId });
        console.error("Get personas error:", errorContext);
        const errorResponse = buildErrorResponse(error);
        res.status(500).json({
          success: false,
          ...errorResponse
        });
      }
    });
    router7.post("/create-defaults", async (req, res) => {
      try {
        const clientId2 = req.headers["x-client-id"] || "00000000-0000-0000-0000-000000000001";
        const personas = [];
        res.status(201).json({
          success: true,
          data: personas,
          message: `Personas feature is not yet fully implemented`
        });
      } catch (error) {
        const errorContext = createErrorContext(error, { operation: "create_default_personas", clientId });
        console.error("Create default personas error:", errorContext);
        const errorResponse = buildErrorResponse(error);
        res.status(500).json({
          success: false,
          ...errorResponse
        });
      }
    });
    router7.get("/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!id) {
          const errorResponse2 = buildErrorResponse(new Error("Persona ID is required"));
          return res.status(400).json({
            success: false,
            ...errorResponse2
          });
        }
        const errorResponse = buildErrorResponse(new Error("Persona not found"));
        return res.status(404).json({
          success: false,
          ...errorResponse
        });
      } catch (error) {
        const errorContext = createErrorContext(error, { operation: "get_persona", personaId: req.params.id });
        console.error("Get persona error:", errorContext);
        const errorResponse = buildErrorResponse(error);
        res.status(500).json({
          success: false,
          ...errorResponse
        });
      }
    });
    router7.post("/", async (req, res) => {
      try {
        const clientId2 = req.headers["x-client-id"] || "00000000-0000-0000-0000-000000000001";
        const {
          name: name2,
          description,
          targetAudience: targetAudience2,
          industry: industry2 = "automotive",
          tonality = "professional",
          personality,
          communicationStyle = "helpful",
          model = "openai/gpt-4o",
          temperature = 70,
          maxTokens = 300,
          systemPrompt,
          responseGuidelines = [],
          escalationCriteria = [],
          preferredChannels = ["email"],
          handoverSettings = {},
          knowledgeBaseAccessLevel = "campaign_only",
          isActive = true,
          isDefault = false,
          priority = 0,
          metadata = {},
          emailSubdomain
        } = req.body;
        if (!name2 || !targetAudience2) {
          const errorResponse = buildErrorResponse(new Error("Name and target audience are required"));
          return res.status(400).json({
            success: false,
            ...errorResponse
          });
        }
        const [newPersona] = await db.insert(aiPersonas).values({
          clientId: clientId2,
          name: name2,
          description,
          targetAudience: targetAudience2,
          industry: industry2,
          tonality,
          personality,
          communicationStyle,
          model,
          temperature,
          maxTokens,
          systemPrompt,
          responseGuidelines,
          escalationCriteria,
          preferredChannels,
          handoverSettings,
          knowledgeBaseAccessLevel,
          isActive,
          isDefault,
          priority,
          metadata,
          emailSubdomain
        }).returning();
        res.status(201).json({
          success: true,
          data: newPersona,
          message: "Persona created successfully"
        });
      } catch (error) {
        const errorContext = createErrorContext(error, {
          operation: "create_persona",
          clientId,
          personaData: { name, targetAudience, industry }
        });
        console.error("Create persona error:", errorContext);
        const errorResponse = buildErrorResponse(error);
        res.status(500).json({
          success: false,
          ...errorResponse
        });
      }
    });
    router7.put("/:id", async (req, res) => {
      try {
        const errorResponse = buildErrorResponse(new Error("Persona update not yet implemented"));
        res.status(501).json({
          success: false,
          ...errorResponse
        });
      } catch (error) {
        const errorContext = createErrorContext(error, { operation: "update_persona", personaId: req.params.id });
        console.error("Update persona error:", errorContext);
        const errorResponse = buildErrorResponse(error);
        res.status(500).json({
          success: false,
          ...errorResponse
        });
      }
    });
    ai_persona_default = router7;
  }
});

// server/services/user-notification.ts
import { eq as eq7 } from "drizzle-orm";
var notificationTemplates, UserNotificationService, userNotificationService;
var init_user_notification = __esm({
  "server/services/user-notification.ts"() {
    "use strict";
    init_mailgun();
    init_db();
    init_schema();
    notificationTemplates = {
      ["campaign_executed" /* CAMPAIGN_EXECUTED */]: (data) => ({
        subject: `Campaign "${data.campaignName}" Successfully Executed`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Campaign Execution Complete</h2>
        <p>Your automotive email campaign "<strong>${data.campaignName}</strong>" has been successfully executed.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Execution Summary:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Emails Sent:</strong> ${data.emailsSent || 0}</li>
            <li><strong>Leads Targeted:</strong> ${data.leadsTargeted || 0}</li>
            <li><strong>Template Used:</strong> ${data.templateTitle || "N/A"}</li>
            <li><strong>Execution Time:</strong> ${new Date(data.executedAt || Date.now()).toLocaleString()}</li>
          </ul>
        </div>
        
        <p>You can monitor campaign performance and view detailed analytics in your dashboard.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/campaigns" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Campaign Results
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          OfferLogix - Automotive Email Marketing Platform
        </p>
      </div>
    `,
        text: `Campaign "${data.campaignName}" Successfully Executed

Your automotive email campaign has been completed.

Execution Summary:
- Emails Sent: ${data.emailsSent || 0}
- Leads Targeted: ${data.leadsTargeted || 0}
- Template Used: ${data.templateTitle || "N/A"}
- Execution Time: ${new Date(data.executedAt || Date.now()).toLocaleString()}

View your campaign results at: ${process.env.SITE_URL || "http://localhost:5050"}/campaigns`
      }),
      ["campaign_completed" /* CAMPAIGN_COMPLETED */]: (data) => ({
        subject: `Campaign "${data.campaignName}" Sequence Completed`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Campaign Sequence Complete</h2>
        <p>Your automotive email campaign "<strong>${data.campaignName}</strong>" has completed its full sequence.</p>
        
        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #059669;">Final Results:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Total Emails Sent:</strong> ${data.totalEmailsSent || 0}</li>
            <li><strong>Overall Open Rate:</strong> ${data.openRate || 0}%</li>
            <li><strong>Leads Engaged:</strong> ${data.leadsEngaged || 0}</li>
            <li><strong>Campaign Duration:</strong> ${data.duration || "N/A"}</li>
          </ul>
        </div>
        
        <p>Congratulations on completing your automotive email campaign! Review the detailed analytics to optimize future campaigns.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/campaigns/${data.campaignId}/analytics" 
             style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Complete Analytics
          </a>
        </div>
      </div>
    `,
        text: `Campaign "${data.campaignName}" Sequence Completed

Your automotive email campaign has completed its full sequence.

Final Results:
- Total Emails Sent: ${data.totalEmailsSent || 0}
- Overall Open Rate: ${data.openRate || 0}%
- Leads Engaged: ${data.leadsEngaged || 0}
- Campaign Duration: ${data.duration || "N/A"}`
      }),
      ["lead_assigned" /* LEAD_ASSIGNED */]: (data) => ({
        subject: `New Lead Assigned: ${data.leadName}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">New Lead Assignment</h2>
        <p>A new lead has been assigned to your campaign "<strong>${data.campaignName}</strong>".</p>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #dc2626;">Lead Details:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Name:</strong> ${data.leadName}</li>
            <li><strong>Email:</strong> ${data.leadEmail}</li>
            <li><strong>Phone:</strong> ${data.leadPhone || "Not provided"}</li>
            <li><strong>Vehicle Interest:</strong> ${data.vehicleInterest || "General inquiry"}</li>
            <li><strong>Lead Source:</strong> ${data.leadSource || "Unknown"}</li>
          </ul>
        </div>
        
        <p>This lead will be included in your next campaign execution. Consider personalizing the approach based on their vehicle interest.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/leads" 
             style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Manage Leads
          </a>
        </div>
      </div>
    `,
        text: `New Lead Assignment

A new lead has been assigned to your campaign "${data.campaignName}".

Lead Details:
- Name: ${data.leadName}
- Email: ${data.leadEmail}
- Phone: ${data.leadPhone || "Not provided"}
- Vehicle Interest: ${data.vehicleInterest || "General inquiry"}
- Lead Source: ${data.leadSource || "Unknown"}`
      }),
      ["high_engagement" /* HIGH_ENGAGEMENT */]: (data) => ({
        subject: `High Engagement Alert: ${data.campaignName}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">High Engagement Detected! \u{1F3AF}</h2>
        <p>Your campaign "<strong>${data.campaignName}</strong>" is performing exceptionally well.</p>
        
        <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <h3 style="margin-top: 0; color: #7c3aed;">Performance Highlights:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Current Open Rate:</strong> ${data.openRate || 0}% (${data.benchmark || "25"}% above average)</li>
            <li><strong>Click-through Rate:</strong> ${data.clickRate || 0}%</li>
            <li><strong>Active Responses:</strong> ${data.responses || 0}</li>
            <li><strong>Engagement Score:</strong> ${data.engagementScore || 0}/100</li>
          </ul>
        </div>
        
        <p>Consider scaling this successful campaign or using its templates as a foundation for future campaigns.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/campaigns/${data.campaignId}" 
             style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Campaign Performance
          </a>
        </div>
      </div>
    `,
        text: `High Engagement Alert: ${data.campaignName}

Your campaign is performing exceptionally well!

Performance Highlights:
- Current Open Rate: ${data.openRate || 0}% (${data.benchmark || "25"}% above average)
- Click-through Rate: ${data.clickRate || 0}%
- Active Responses: ${data.responses || 0}
- Engagement Score: ${data.engagementScore || 0}/100`
      }),
      ["system_alert" /* SYSTEM_ALERT */]: (data) => ({
        subject: `System Alert: ${data.alertTitle}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">System Alert</h2>
        <p><strong>${data.alertTitle}</strong></p>
        
        <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
          <p style="margin: 0;">${data.message}</p>
          ${data.details ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">${data.details}</p>` : ""}
        </div>
        
        ${data.actionRequired ? `
        <p style="color: #dc2626;"><strong>Action Required:</strong> ${data.actionRequired}</p>
        ` : ""}
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/dashboard" 
             style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
      </div>
    `,
        text: `System Alert: ${data.alertTitle}

${data.message}

${data.details || ""}

${data.actionRequired ? `Action Required: ${data.actionRequired}` : ""}`
      }),
      ["monthly_report" /* MONTHLY_REPORT */]: (data) => ({
        subject: `Monthly Report - ${data.month} ${data.year}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Monthly Campaign Report</h2>
        <p>Here's your automotive email marketing summary for <strong>${data.month} ${data.year}</strong>.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Monthly Statistics:</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <p style="margin: 5px 0;"><strong>Campaigns Executed:</strong> ${data.campaignsExecuted || 0}</p>
              <p style="margin: 5px 0;"><strong>Total Emails Sent:</strong> ${data.totalEmailsSent || 0}</p>
              <p style="margin: 5px 0;"><strong>New Leads:</strong> ${data.newLeads || 0}</p>
            </div>
            <div>
              <p style="margin: 5px 0;"><strong>Average Open Rate:</strong> ${data.avgOpenRate || 0}%</p>
              <p style="margin: 5px 0;"><strong>Response Rate:</strong> ${data.responseRate || 0}%</p>
              <p style="margin: 5px 0;"><strong>Conversions:</strong> ${data.conversions || 0}</p>
            </div>
          </div>
        </div>
        
        <p>Keep up the great work with your automotive email marketing campaigns!</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/analytics" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Detailed Analytics
          </a>
        </div>
      </div>
    `,
        text: `Monthly Campaign Report - ${data.month} ${data.year}

Monthly Statistics:
- Campaigns Executed: ${data.campaignsExecuted || 0}
- Total Emails Sent: ${data.totalEmailsSent || 0}
- New Leads: ${data.newLeads || 0}
- Average Open Rate: ${data.avgOpenRate || 0}%
- Response Rate: ${data.responseRate || 0}%
- Conversions: ${data.conversions || 0}`
      }),
      ["email_validation_warning" /* EMAIL_VALIDATION_WARNING */]: (data) => ({
        subject: `Email Validation Warning: Action Required`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Email Validation Warning</h2>
        <p>We've detected potential issues with your email campaign that require attention.</p>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #dc2626;">Issues Detected:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${data.issues?.map((issue) => `<li>${issue}</li>`).join("") || "<li>Validation issues detected</li>"}
          </ul>
        </div>
        
        <p><strong>Campaign Affected:</strong> ${data.campaignName}</p>
        <p>Please review and fix these issues before your next campaign execution to ensure optimal deliverability.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/campaigns/${data.campaignId}" 
             style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Fix Campaign Issues
          </a>
        </div>
      </div>
    `,
        text: `Email Validation Warning: Action Required

We've detected potential issues with your email campaign.

Campaign Affected: ${data.campaignName}

Issues Detected:
${data.issues?.map((issue) => `- ${issue}`).join("\n") || "- Validation issues detected"}

Please review and fix these issues before your next campaign execution.`
      }),
      ["quota_warning" /* QUOTA_WARNING */]: (data) => ({
        subject: `Usage Quota Warning: ${data.percentage}% Used`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Usage Quota Warning</h2>
        <p>You've used <strong>${data.percentage}%</strong> of your monthly email quota.</p>
        
        <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
          <h3 style="margin-top: 0; color: #ea580c;">Current Usage:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Emails Sent:</strong> ${data.emailsSent || 0} / ${data.emailsQuota || 0}</li>
            <li><strong>Remaining:</strong> ${(data.emailsQuota || 0) - (data.emailsSent || 0)} emails</li>
            <li><strong>Reset Date:</strong> ${data.resetDate || "End of month"}</li>
          </ul>
        </div>
        
        <p>Consider upgrading your plan or optimizing your campaigns to stay within your quota.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || "http://localhost:5050"}/billing" 
             style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Manage Billing
          </a>
        </div>
      </div>
    `,
        text: `Usage Quota Warning: ${data.percentage}% Used

Current Usage:
- Emails Sent: ${data.emailsSent || 0} / ${data.emailsQuota || 0}
- Remaining: ${(data.emailsQuota || 0) - (data.emailsSent || 0)} emails
- Reset Date: ${data.resetDate || "End of month"}

Consider upgrading your plan or optimizing your campaigns.`
      })
    };
    UserNotificationService = class {
      /**
       * Send a notification to a user
       */
      async sendNotification(options) {
        try {
          const { userId, type, data, urgency = "medium", sendEmail = true } = options;
          if (!sendEmail) {
            console.log(`Notification queued for user ${userId}: ${type}`, data);
            return true;
          }
          const [user] = await db.select().from(users).where(eq7(users.id, userId));
          if (!user?.email) {
            console.error(`User ${userId} not found or has no email`);
            return false;
          }
          const template = notificationTemplates[type];
          if (!template) {
            console.error(`No template found for notification type: ${type}`);
            return false;
          }
          const content = template(data);
          const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
          const activeCfg = await storage2.getActiveAiAgentConfig().catch(() => void 0);
          const success = await sendCampaignEmail(
            user.email,
            content.subject,
            content.html,
            content.text,
            "OfferLogix"
          );
          if (success) {
            console.log(`\u2705 Notification sent to ${user.email}: ${type}`);
          } else {
            console.error(`\u274C Failed to send notification to ${user.email}: ${type}`);
          }
          return success;
        } catch (error) {
          console.error("Error sending user notification:", error);
          return false;
        }
      }
      /**
       * Send campaign execution notification
       */
      async notifyCampaignExecuted(userId, campaignData) {
        return this.sendNotification({
          userId,
          type: "campaign_executed" /* CAMPAIGN_EXECUTED */,
          data: campaignData,
          urgency: "medium"
        });
      }
      /**
       * Send campaign completion notification  
       */
      async notifyCampaignCompleted(userId, campaignData) {
        return this.sendNotification({
          userId,
          type: "campaign_completed" /* CAMPAIGN_COMPLETED */,
          data: campaignData,
          urgency: "low"
        });
      }
      /**
       * Send new lead assignment notification
       */
      async notifyLeadAssigned(userId, leadData) {
        return this.sendNotification({
          userId,
          type: "lead_assigned" /* LEAD_ASSIGNED */,
          data: leadData,
          urgency: "high"
        });
      }
      /**
       * Send high engagement alert
       */
      async notifyHighEngagement(userId, engagementData) {
        return this.sendNotification({
          userId,
          type: "high_engagement" /* HIGH_ENGAGEMENT */,
          data: engagementData,
          urgency: "medium"
        });
      }
      /**
       * Send system alert
       */
      async sendSystemAlert(userId, alertData) {
        return this.sendNotification({
          userId,
          type: "system_alert" /* SYSTEM_ALERT */,
          data: alertData,
          urgency: "high"
        });
      }
      /**
       * Send monthly report
       */
      async sendMonthlyReport(userId, reportData) {
        return this.sendNotification({
          userId,
          type: "monthly_report" /* MONTHLY_REPORT */,
          data: reportData,
          urgency: "low"
        });
      }
      /**
       * Send email validation warning
       */
      async sendValidationWarning(userId, validationData) {
        return this.sendNotification({
          userId,
          type: "email_validation_warning" /* EMAIL_VALIDATION_WARNING */,
          data: validationData,
          urgency: "high"
        });
      }
      /**
       * Send quota warning
       */
      async sendQuotaWarning(userId, quotaData) {
        return this.sendNotification({
          userId,
          type: "quota_warning" /* QUOTA_WARNING */,
          data: quotaData,
          urgency: "medium"
        });
      }
    };
    userNotificationService = new UserNotificationService();
  }
});

// server/routes/notifications.ts
var notifications_exports = {};
__export(notifications_exports, {
  default: () => notifications_default
});
import { Router as Router9 } from "express";
import { z as z4 } from "zod";
import { eq as eq8 } from "drizzle-orm";
var router8, notificationPreferencesSchema, testNotificationSchema, notifications_default;
var init_notifications = __esm({
  "server/routes/notifications.ts"() {
    "use strict";
    init_user_notification();
    init_db();
    init_schema();
    router8 = Router9();
    notificationPreferencesSchema = z4.object({
      emailNotifications: z4.boolean().default(true),
      campaignAlerts: z4.boolean().default(true),
      leadAlerts: z4.boolean().default(true),
      systemAlerts: z4.boolean().default(true),
      monthlyReports: z4.boolean().default(true),
      highEngagementAlerts: z4.boolean().default(true),
      quotaWarnings: z4.boolean().default(true)
    });
    testNotificationSchema = z4.object({
      type: z4.enum([
        "campaign_executed",
        "campaign_completed",
        "lead_assigned",
        "high_engagement",
        "system_alert",
        "monthly_report",
        "email_validation_warning",
        "quota_warning"
      ]),
      data: z4.record(z4.any()).optional().default({})
    });
    router8.get("/preferences/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const [user] = await db.select().from(users).where(eq8(users.id, userId));
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({
          preferences: user.notificationPreferences || {
            emailNotifications: true,
            campaignAlerts: true,
            leadAlerts: true,
            systemAlerts: true,
            monthlyReports: true,
            highEngagementAlerts: true,
            quotaWarnings: true
          }
        });
      } catch (error) {
        console.error("Error fetching notification preferences:", error);
        res.status(500).json({ message: "Unable to fetch notification preferences" });
      }
    });
    router8.put("/preferences/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const validatedData = notificationPreferencesSchema.parse(req.body);
        const [updatedUser] = await db.update(users).set({
          notificationPreferences: validatedData
        }).where(eq8(users.id, userId)).returning();
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({
          message: "Notification preferences updated successfully",
          preferences: updatedUser.notificationPreferences
        });
      } catch (error) {
        console.error("Error updating notification preferences:", error);
        res.status(500).json({ message: "Unable to update notification preferences" });
      }
    });
    router8.post("/test/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const { type, data } = testNotificationSchema.parse(req.body);
        const [user] = await db.select().from(users).where(eq8(users.id, userId));
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const testData = {
          campaign_executed: {
            campaignName: "Test Campaign - 2025 Honda Civic",
            campaignId: "test-campaign-id",
            emailsSent: 25,
            leadsTargeted: 25,
            templateTitle: "Introduction Email",
            executedAt: /* @__PURE__ */ new Date(),
            ...data
          },
          campaign_completed: {
            campaignName: "Test Campaign - 2025 Honda Civic",
            campaignId: "test-campaign-id",
            totalEmailsSent: 75,
            openRate: 42,
            leadsEngaged: 18,
            duration: "3 weeks",
            ...data
          },
          lead_assigned: {
            leadName: "John Smith",
            leadEmail: "john.smith@example.com",
            leadPhone: "(555) 123-4567",
            vehicleInterest: "2025 Honda Civic",
            leadSource: "website",
            campaignName: "Test Campaign",
            ...data
          },
          high_engagement: {
            campaignName: "Test Campaign - 2025 Honda Civic",
            campaignId: "test-campaign-id",
            openRate: 65,
            clickRate: 15,
            responses: 12,
            engagementScore: 85,
            benchmark: 40,
            ...data
          },
          system_alert: {
            alertTitle: "System Maintenance Scheduled",
            message: "A system maintenance window is scheduled for tonight from 2-4 AM EST.",
            details: "Email sending services may be temporarily unavailable during this time.",
            actionRequired: "Please avoid scheduling campaigns during the maintenance window.",
            ...data
          },
          monthly_report: {
            month: "January",
            year: 2025,
            campaignsExecuted: 8,
            totalEmailsSent: 1250,
            newLeads: 45,
            avgOpenRate: 38,
            responseRate: 12,
            conversions: 6,
            ...data
          },
          email_validation_warning: {
            campaignName: "Test Campaign - 2025 Honda Civic",
            campaignId: "test-campaign-id",
            issues: [
              "Missing unsubscribe link in template #2",
              "Subject line contains spam trigger words",
              "From email domain not verified"
            ],
            ...data
          },
          quota_warning: {
            percentage: 85,
            emailsSent: 8500,
            emailsQuota: 1e4,
            resetDate: "February 1, 2025",
            ...data
          }
        };
        const notificationData = testData[type];
        let success = false;
        switch (type) {
          case "campaign_executed":
            success = await userNotificationService.notifyCampaignExecuted(userId, notificationData);
            break;
          case "campaign_completed":
            success = await userNotificationService.notifyCampaignCompleted(userId, notificationData);
            break;
          case "lead_assigned":
            success = await userNotificationService.notifyLeadAssigned(userId, notificationData);
            break;
          case "high_engagement":
            success = await userNotificationService.notifyHighEngagement(userId, notificationData);
            break;
          case "system_alert":
            success = await userNotificationService.sendSystemAlert(userId, notificationData);
            break;
          case "monthly_report":
            success = await userNotificationService.sendMonthlyReport(userId, notificationData);
            break;
          case "email_validation_warning":
            success = await userNotificationService.sendValidationWarning(userId, notificationData);
            break;
          case "quota_warning":
            success = await userNotificationService.sendQuotaWarning(userId, notificationData);
            break;
        }
        if (success) {
          res.json({
            message: `Test ${type} notification sent successfully to ${user.email}`,
            type,
            data: notificationData
          });
        } else {
          res.status(500).json({
            message: `Unable to send test ${type} notification`,
            type
          });
        }
      } catch (error) {
        console.error("Error sending test notification:", error);
        res.status(500).json({ message: "Unable to send test notification" });
      }
    });
    router8.get("/types", async (req, res) => {
      const notificationTypes = [
        {
          type: "campaign_executed",
          name: "Campaign Executed",
          description: "Sent when a campaign is successfully executed",
          urgency: "medium"
        },
        {
          type: "campaign_completed",
          name: "Campaign Completed",
          description: "Sent when a campaign sequence is fully completed",
          urgency: "low"
        },
        {
          type: "lead_assigned",
          name: "Lead Assigned",
          description: "Sent when a new lead is assigned to a campaign",
          urgency: "high"
        },
        {
          type: "high_engagement",
          name: "High Engagement",
          description: "Sent when a campaign shows exceptional performance",
          urgency: "medium"
        },
        {
          type: "system_alert",
          name: "System Alert",
          description: "Important system-wide notifications and alerts",
          urgency: "high"
        },
        {
          type: "monthly_report",
          name: "Monthly Report",
          description: "Monthly performance summary and analytics",
          urgency: "low"
        },
        {
          type: "email_validation_warning",
          name: "Email Validation Warning",
          description: "Warnings about email deliverability issues",
          urgency: "high"
        },
        {
          type: "quota_warning",
          name: "Quota Warning",
          description: "Alerts when approaching usage limits",
          urgency: "medium"
        }
      ];
      res.json({ notificationTypes });
    });
    notifications_default = router8;
  }
});

// server/index.ts
init_env();
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
  constructor() {
    this.schedulerInterval = null;
    this.loopInProgress = false;
  }
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
    let clientId2 = null;
    const host = req.get("host") || "";
    const subdomain = host.split(".")[0];
    if (subdomain && subdomain !== "localhost" && subdomain !== "127" && !subdomain.includes(":")) {
      const [client] = await db.select().from(clients).where(eq3(clients.domain, subdomain));
      if (client) {
        clientId2 = client.id;
      }
    }
    if (!clientId2 && host) {
      const [client] = await db.select().from(clients).where(eq3(clients.domain, host));
      if (client) {
        clientId2 = client.id;
      }
    }
    if (!clientId2 && req.headers["x-tenant-id"]) {
      clientId2 = req.headers["x-tenant-id"];
    }
    if (!clientId2) {
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
        clientId2 = defaultClient.id;
      }
    }
    req.clientId = clientId2;
    if (clientId2) {
      const [client] = await db.select().from(clients).where(eq3(clients.id, clientId2));
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
import { eq as eq9 } from "drizzle-orm";
import multer from "multer";
import { parse as parse2 } from "csv-parse/sync";

// server/services/csv/csv-validation.ts
import { parse } from "csv-parse/sync";
import { z as z2 } from "zod";
var leadValidationSchema = z2.object({
  firstName: z2.string().max(100).optional().or(z2.literal("")),
  lastName: z2.string().max(100).optional().or(z2.literal("")),
  email: z2.string().email("Invalid email format"),
  phone: z2.string().optional(),
  vehicleInterest: z2.string().optional(),
  budget: z2.string().optional(),
  timeframe: z2.string().optional(),
  source: z2.string().optional(),
  notes: z2.string().optional()
});
var CSVValidationService = class {
  static {
    this.DEFAULT_OPTIONS = {
      maxFileSize: 10 * 1024 * 1024,
      // 10MB
      maxRows: 1e4,
      requireColumns: ["email"],
      // Only email is truly required
      sanitizeData: true
    };
  }
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
          if (validationError instanceof z2.ZodError) {
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

// server/middleware/rate-limiter.ts
var store = {};
function createRateLimit(options) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip || "unknown",
    message = "Too many requests, please try again later"
  } = options;
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;
    if (store[key] && store[key].resetTime < now) {
      delete store[key];
    }
    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs
      };
    } else {
      store[key].count++;
    }
    if (store[key].count > maxRequests) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((store[key].resetTime - now) / 1e3)
      });
    }
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - store[key].count));
    res.setHeader("X-RateLimit-Reset", new Date(store[key].resetTime).toISOString());
    next();
  };
}
var campaignRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  maxRequests: 10,
  // 10 campaign operations per 15 minutes
  message: "Too many campaign operations, please wait before trying again"
});
var bulkEmailRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  maxRequests: 5,
  // 5 bulk email operations per hour
  keyGenerator: (req) => `${req.ip}-bulk`,
  message: "Bulk email rate limit exceeded, please wait before sending more campaigns"
});

// server/middleware/logging-middleware.ts
init_logger();
function requestLoggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestLogger = log.fromRequest(req);
  requestLogger.info("API Request received", {
    component: "api",
    endpoint: req.path,
    method: req.method,
    query: req.query,
    headers: {
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
      "origin": req.headers.origin
    }
  });
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    requestLogger.api("API Response sent", {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      requestSize: parseInt(req.headers["content-length"] || "0"),
      responseSize: res.get("content-length") ? parseInt(res.get("content-length")) : 0
    });
    return originalEnd.call(this, chunk, encoding);
  };
  next();
}
function securityLoggingMiddleware(req, res, next) {
  const suspiciousPatterns = [
    /\.\.\//g,
    // Path traversal
    /<script/gi,
    // XSS attempts
    /union\s+select/gi,
    // SQL injection
    /javascript:/gi,
    // Script injection
    /eval\(/gi
    // Code injection
  ];
  const url = req.url;
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  const combinedContent = `${url} ${body}`;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(combinedContent)) {
      log.security("Suspicious request detected", {
        eventType: "suspicious_request",
        severity: "medium",
        sourceIp: req.ip,
        userAgent: req.headers["user-agent"],
        endpoint: req.path,
        method: req.method,
        pattern: pattern.toString(),
        actionTaken: "logged"
      });
      break;
    }
  }
  next();
}
function errorLoggingMiddleware(error, req, res, next) {
  const requestLogger = log.fromRequest(req);
  requestLogger.error("Unhandled error in request", {
    error,
    component: "api",
    operation: `${req.method} ${req.path}`,
    severity: res.statusCode >= 500 ? "high" : "medium"
  });
  next(error);
}

// server/routes.ts
var csvUploadRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1e3,
  // 10 minutes
  maxRequests: 3,
  message: "Too many CSV uploads, please wait before trying again"
});
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
      let [client] = await db.select().from(clients).where(eq9(clients.domain, domain));
      if (!client) {
        [client] = await db.select().from(clients).where(eq9(clients.name, "Default Client"));
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
      const [client] = await db.update(clients).set({ ...clientData, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(clients.id, req.params.id)).returning();
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
      await db.delete(clients).where(eq9(clients.id, req.params.id));
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
      const { name: name2 } = req.body;
      const clonedCampaign = await storage.cloneCampaign(req.params.id, name2);
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
  app2.post("/api/campaigns/:id/launch", campaignRateLimit, async (req, res) => {
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
  const unsubscribeRoutes = await Promise.resolve().then(() => (init_unsubscribe(), unsubscribe_exports));
  app2.use("/", unsubscribeRoutes.default);
  app2.post("/api/email/send", bulkEmailRateLimit, async (req, res) => {
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
  app2.post("/api/leads/upload-csv-basic", csvUploadRateLimit, basicUpload.single("file"), async (req, res) => {
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
  const mailgunWebhookRoutes = await Promise.resolve().then(() => (init_mailgun_webhooks(), mailgun_webhooks_exports));
  app2.use("/api", mailgunWebhookRoutes.default);
  app2.post("/api/campaigns/:id/execute", campaignRateLimit, async (req, res) => {
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
  app2.post("/api/campaigns/:id/send-followup", bulkEmailRateLimit, async (req, res) => {
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
  app2.get("/api/users", async (req, res) => {
    try {
      const users2 = await storage.getUsers(100);
      res.json(users2);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.post("/api/users", async (req, res) => {
    try {
      const { username, password, role, email, clientId: clientId2 } = req.body;
      if (!username || !password || !role) {
        return res.status(400).json({ message: "Username, password, and role are required" });
      }
      if (!["admin", "manager", "user"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }
      const newUser = await storage.createUser({
        username,
        password,
        // In production, this should be hashed
        role,
        email: email || null,
        clientId: clientId2 || null
      });
      const { password: _, ...userResponse } = newUser;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Create user error:", error);
      if (error?.message?.includes("unique")) {
        res.status(409).json({ message: "Username already exists" });
      } else {
        res.status(500).json({ message: "Failed to create user" });
      }
    }
  });
  app2.put("/api/users/:id/role", async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["admin", "manager", "user"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }
      const user = await storage.updateUserRole(req.params.id, role);
      const { password: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });
  app2.delete("/api/users/:id", async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
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
  app2.post("/api/campaigns/:id/leads/upload", csvUploadRateLimit, upload.single("file"), async (req, res) => {
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
  app2.post("/api/leads/upload-csv", csvUploadRateLimit, upload.single("file"), async (req, res) => {
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
  const personaRoutes = await Promise.resolve().then(() => (init_ai_persona(), ai_persona_exports));
  app2.use("/api/personas", personaRoutes.default);
  const notificationRoutes = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
  app2.use("/api/notifications", notificationRoutes.default);
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
  app2.post("/api/ai/suggest-goals", async (req, res) => {
    res.status(501).json({
      message: "AI goal suggestion not yet implemented",
      suggestions: ["Generate leads", "Increase conversions", "Build relationships"]
    });
  });
  app2.post("/api/ai/enhance-templates", async (req, res) => {
    res.status(501).json({
      message: "AI template enhancement not yet implemented",
      templates: []
    });
  });
  app2.post("/api/ai/generate-subjects", async (req, res) => {
    res.status(501).json({
      message: "AI subject generation not yet implemented",
      subjects: []
    });
  });
  app2.post("/api/ai/suggest-names", async (req, res) => {
    res.status(501).json({
      message: "AI name suggestion not yet implemented",
      names: []
    });
  });
  app2.post("/api/ai/generate-templates", async (req, res) => {
    try {
      const templateRoutes2 = await Promise.resolve().then(() => (init_templates(), templates_exports));
      const { context, campaignId } = req.body;
      const mockReq = { body: { context, campaignId } };
      const mockRes = {
        json: (data) => res.json(data),
        status: (code) => ({ json: (data) => res.status(code).json(data) })
      };
      const { callOpenRouterJSON: callOpenRouterJSON2 } = await Promise.resolve().then(() => (init_call_openrouter(), call_openrouter_exports));
      const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      let templateContext2 = context;
      if (campaignId && !context) {
        try {
          const campaign = await storage2.getCampaign(campaignId);
          if (campaign) {
            templateContext2 = `Campaign: ${campaign.name}. Goals: ${campaign.handoverGoals || "Generate leads and drive conversions"}. Target: ${campaign.targetAudience || "potential customers"}`;
          } else {
            templateContext2 = "General marketing campaign focused on lead generation and customer engagement";
          }
        } catch (error) {
          console.error("Error fetching campaign for context:", error);
          templateContext2 = "General marketing campaign focused on lead generation and customer engagement";
        }
      }
      if (!templateContext2) {
        return res.status(400).json({ message: "context or campaignId required" });
      }
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
      const json = await callOpenRouterJSON2({
        model: "openai/gpt-5-chat",
        system,
        messages: [
          { role: "user", content: `Generate 3 subject lines and 3 short HTML templates (no external images).
Context: ${templateContext2}
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
  app2.post("/api/ai/analyze-conversation", async (req, res) => {
    res.status(501).json({
      message: "AI conversation analysis not yet implemented",
      analysis: null
    });
  });
  app2.post("/api/ai/generate-prompt", async (req, res) => {
    res.status(501).json({
      message: "AI prompt generation not yet implemented",
      prompt: ""
    });
  });
  app2.post("/api/ai/chat-campaign", async (req, res) => {
    res.status(501).json({
      message: "AI chat campaign not yet implemented",
      response: null
    });
  });
  app2.get("/api/email-monitor/status", async (req, res) => {
    res.json({
      status: "not_implemented",
      message: "Email monitoring not yet implemented",
      isRunning: false,
      lastCheck: null,
      totalEmails: 0,
      unreadEmails: 0
    });
  });
  app2.get("/api/email-monitor/rules", async (req, res) => {
    res.json({
      rules: [],
      message: "Email monitoring rules not yet implemented"
    });
  });
  app2.post("/api/email-monitor/start", async (req, res) => {
    res.status(501).json({
      message: "Email monitor start not yet implemented",
      status: "not_started"
    });
  });
  app2.post("/api/email-monitor/stop", async (req, res) => {
    res.status(501).json({
      message: "Email monitor stop not yet implemented",
      status: "not_stopped"
    });
  });
  app2.delete("/api/email-monitor/rules/:id", async (req, res) => {
    res.status(501).json({
      message: "Email monitor rule deletion not yet implemented"
    });
  });
  app2.post("/api/email-monitor/rules", async (req, res) => {
    res.status(501).json({
      message: "Email monitor rule creation not yet implemented"
    });
  });
  app2.use(errorLoggingMiddleware);
  const httpServer = createServer(app2);
  webSocketService.initialize(httpServer);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path2.resolve(__dirname, "client", "src"),
      "@shared": path2.resolve(__dirname, "shared")
    }
  },
  root: path2.resolve(__dirname, "client"),
  build: {
    outDir: path2.resolve(__dirname, "dist/public"),
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
var __dirname2 = path3.dirname(fileURLToPath2(import.meta.url));
var viteLogger = createLogger();
function devCacheBuster() {
  return Math.random().toString(36).slice(2, 10);
}
function log2(message, source = "express") {
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
      const clientTemplate = path3.resolve(
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
  const distPath = path3.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.get("/offerlogix-chat-widget.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(path3.resolve(distPath, "offerlogix-chat-widget.js"));
  });
  app2.use("*", (req, res) => {
    if (req.originalUrl.includes("offerlogix-chat-widget") || req.originalUrl.includes("chat-widget-demo")) {
      return res.status(404).send("File not found");
    }
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
dotenv.config();
var env3 = validateEnv();
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
app.use(requestLoggingMiddleware);
app.use(securityLoggingMiddleware);
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log2(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use(errorLoggingMiddleware);
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
  const port = env3.PORT;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, async () => {
    log2(`serving on port ${port}`);
    log2("\u2705 Server started successfully");
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
