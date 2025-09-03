import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uuid, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Clients table for white label multi-tenancy
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
  password: text("passwordHash").notNull(),
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
  archived: boolean("archived").default(false).notNull(), // Whether conversation is archived/hidden
  clientId: uuid("client_id").references(() => clients.id), // Multi-tenant scoping
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  senderId: varchar("sender_id").references(() => users.id), // Nullable - for user messages
  leadId: varchar("lead_id").references(() => leads.id), // Nullable - for lead messages  
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, system, email_template, lead_msg
  isFromAI: integer("is_from_ai").notNull().default(0), // 0 = human, 1 = AI
  providerMessageId: text("provider_message_id"), // For deduplication (e.g., Mailgun Message-ID)
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
  handoverCriteria: jsonb("handover_criteria"), // Intent-based handover triggers
  handoverRecipient: text("handover_recipient"), // Email recipient for handovers
  leadScoreWeights: jsonb("lead_score_weights"), // Custom scoring weights
  handoverScoreThresholds: jsonb("handover_score_thresholds"), // Score thresholds for handover
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
  // Reliability settings
  stopOnComplaint: boolean("stop_on_complaint").default(false),
  isActive: boolean("is_active").default(true),
  nextExecution: timestamp("next_execution"),
  sendWindow: jsonb("send_window"), // { tz: string, start: "HH:mm", end: "HH:mm" }

  // Agent selection (optional)
  agentConfigId: varchar("agent_config_id").references(() => aiAgentConfig.id),

  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id).notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text").notNull(),
  version: integer("version").notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  openCount: integer("open_count").default(0).notNull(),
  replyCount: integer("reply_count").default(0).notNull(),
  handoverCount: integer("handover_count").default(0).notNull(),
  isWinner: boolean("is_winner").default(false).notNull(),
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
  fromName: text("from_name"), // Dedicated email From: display name (e.g., "Riley Donovan")
  // Agent outbound email Mailgun subdomain override (e.g., mg.dealership.com)
  agentEmailDomain: varchar("agent_email_domain"),
  useV2: boolean("use_v2").default(false).notNull(), // Whether to use V2 conversation engine
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

// Lead campaign state table to track replies and follow-up status
export const leadCampaignStates = pgTable("lead_campaign_state", {
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  campaignId: varchar("campaign_id").references(() => campaigns.id).notNull(),
  respondedAt: timestamp("responded_at"),
  followupState: varchar("followup_state").default("active").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.leadId, table.campaignId] }),
}));

// API Keys table for external integrations and authentication
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyHash: varchar("key_hash", { length: 255 }).notNull().unique(), // bcrypt hashed API key
  keyPrefix: varchar("key_prefix", { length: 8 }).notNull(), // First 8 chars for identification (e.g., "mk_live_")
  name: varchar("name", { length: 255 }).notNull(), // Human-readable name
  description: text("description"), // Optional description
  permissions: jsonb("permissions").default(sql`'[]'::jsonb`).notNull(), // Array of allowed permissions
  rateLimitTier: varchar("rate_limit_tier", { length: 20 }).default("standard"), // standard, premium, enterprise
  clientId: uuid("client_id").references(() => clients.id),
  userId: varchar("user_id").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"), // Optional expiration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Rate limit tracking table
export const rateLimitAttempts = pgTable("rate_limit_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: varchar("identifier", { length: 255 }).notNull(), // IP address, API key, or user ID
  endpoint: varchar("endpoint", { length: 255 }).notNull(), // API endpoint path
  attempts: integer("attempts").default(1).notNull(),
  windowStart: timestamp("window_start").defaultNow().notNull(),
  windowEnd: timestamp("window_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Security events table for monitoring and alerting
export const securityEvents = pgTable("security_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(), // low, medium, high, critical
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }).notNull(), // IP address, user agent, etc.
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  userId: varchar("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Enhanced user schema with authentication validations
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  email: true,
  clientId: true,
}).extend({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters'),
  role: z.enum(['admin', 'manager', 'user'], {
    errorMap: () => ({ message: 'Role must be admin, manager, or user' })
  }),
  email: z.string()
    .email('Invalid email address')
    .optional()
    .or(z.literal(''))
});

// Login schema for authentication
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

// Password change schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must be less than 128 characters')
});

// User update schema (excludes password for security)
export const updateUserSchema = insertUserSchema.omit({ password: true }).partial();

// Only name and context are required for campaign creation; all other fields are optional
export const insertCampaignSchema = createInsertSchema(campaigns)
  .pick({
    name: true,
    context: true,
    handoverGoals: true,
    targetAudience: true,
    handoverPrompt: true,
    handoverPromptSpec: true,
    status: true,
    templates: true,
    subjectLines: true,
    numberOfTemplates: true,
    daysBetweenMessages: true,
    openRate: true,
    isTemplate: true,
    originalCampaignId: true,
    agentConfigId: true,
    stopOnComplaint: true,
    handoverCriteria: true,
    handoverRecipient: true,
    sendWindow: true,
  })
  .extend({
    sendWindow: z
      .object({
        tz: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .optional(),
    // V2 Business Handover Triggers
    handoverTriggers: z.object({
      pricingQuestions: z.boolean().default(false),
      testDriveDemo: z.boolean().default(false),
      tradeInValue: z.boolean().default(false),
      financing: z.boolean().default(false),
      vehicleAvailability: z.boolean().default(false),
      urgency: z.boolean().default(false),
      customTriggers: z.array(z.string()).default([]),
    }).optional(),
    handoverRecipient: z.string().email().optional(),
    handoverRecipientName: z.string().optional(),
    // URL triggers - automatically send URLs when customers ask about topics
    urlTriggers: z.object({
      tradeInUrl: z.object({
        enabled: z.boolean().default(false),
        url: z.string().optional(),
        message: z.string().optional(),
      }).optional(),
      schedulerUrl: z.object({
        enabled: z.boolean().default(false),
        url: z.string().optional(),
        message: z.string().optional(),
      }).optional(),
      financingUrl: z.object({
        enabled: z.boolean().default(false),
        url: z.string().optional(),
        message: z.string().optional(),
      }).optional(),
      inventoryUrl: z.object({
        enabled: z.boolean().default(false),
        url: z.string().optional(),
        message: z.string().optional(),
      }).optional(),
      warrantyUrl: z.object({
        enabled: z.boolean().default(false),
        url: z.string().optional(),
        message: z.string().optional(),
      }).optional(),
    }).optional(),
  })
  .partial({
    handoverGoals: true,
    targetAudience: true,
    handoverPrompt: true,
    handoverPromptSpec: true,
    status: true,
    templates: true,
    subjectLines: true,
    numberOfTemplates: true,
    daysBetweenMessages: true,
    openRate: true,
    isTemplate: true,
    originalCampaignId: true,
    agentConfigId: true,
    stopOnComplaint: true,
    handoverCriteria: true,
    handoverRecipient: true,
    sendWindow: true,
    handoverTriggers: true,
    handoverRecipientName: true,
    urlTriggers: true,
  });

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  leadId: true,
  content: true,
  messageType: true,
  isFromAI: true,
}).extend({
  // Ensure either senderId or leadId is provided (but not both)
  senderId: z.string().optional(),
  leadId: z.string().optional(),
}).refine(
  (data) => (data.senderId && !data.leadId) || (!data.senderId && data.leadId),
  { message: "Either senderId or leadId must be provided (but not both)" }
);

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

// API key schemas
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  keyHash: true, // Handled separately for security
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type LeadCampaignState = typeof leadCampaignStates.$inferSelect;
export type InsertLeadCampaignState = typeof leadCampaignStates.$inferInsert;
export type InsertAiAgentConfig = z.infer<typeof insertAiAgentConfigSchema>;
export type AiAgentConfig = typeof aiAgentConfig.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type RateLimitAttempt = typeof rateLimitAttempts.$inferSelect;

// Email Queue and Delivery Tracking Tables
export const emailQueue = pgTable("email_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").unique(), // Bull queue job ID
  idempotencyKey: varchar("idempotency_key").unique(),
  to: varchar("to").notNull(),
  from: varchar("from").notNull(),
  subject: text("subject").notNull(),
  html: text("html"),
  text: text("text"),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  leadId: varchar("lead_id").references(() => leads.id),
  status: varchar("status").default("pending"), // pending, processing, sent, failed, cancelled, dead-letter
  priority: integer("priority").default(0), // Higher number = higher priority
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  scheduledFor: timestamp("scheduled_for"),
  nextRunAt: timestamp("next_run_at"),
  lastAttemptAt: timestamp("last_attempt_at"),
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailDeliveryEvents = pgTable("email_delivery_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailQueueId: varchar("email_queue_id").references(() => emailQueue.id),
  messageId: varchar("message_id"), // Mailgun message ID
  eventType: varchar("event_type").notNull(), // delivered, opened, clicked, bounced, complained, unsubscribed
  timestamp: timestamp("timestamp").notNull(),
  recipientEmail: varchar("recipient_email").notNull(),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  leadId: varchar("lead_id").references(() => leads.id),
  userAgent: text("user_agent"),
  clientName: text("client_name"),
  clientOs: text("client_os"),
  deviceType: text("device_type"),
  url: text("url"), // For click events
  ip: varchar("ip"),
  city: varchar("city"),
  region: varchar("region"),
  country: varchar("country"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailSuppressionList = pgTable("email_suppression_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  suppressionType: varchar("suppression_type").notNull(), // bounce, complaint, unsubscribe, manual
  reason: text("reason"),
  bounceType: varchar("bounce_type"), // hard, soft for bounces
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  leadId: varchar("lead_id").references(() => leads.id),
  suppressedAt: timestamp("suppressed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // For temporary suppressions
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const domainHealth = pgTable("domain_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: varchar("domain").notNull(),
  spfRecord: text("spf_record"),
  spfValid: boolean("spf_valid"),
  dkimValid: boolean("dkim_valid"),
  dmarcRecord: text("dmarc_record"),
  dmarcValid: boolean("dmarc_valid"),
  reputationScore: integer("reputation_score"), // 0-100
  lastChecked: timestamp("last_checked").defaultNow().notNull(),
  sentLast24h: integer("sent_last_24h").default(0),
  deliveredLast24h: integer("delivered_last_24h").default(0),
  bouncedLast24h: integer("bounced_last_24h").default(0),
  complaintsLast24h: integer("complaints_last_24h").default(0),
  deliveryRate: integer("delivery_rate"), // percentage
  bounceRate: integer("bounce_rate"), // percentage
  complaintRate: integer("complaint_rate"), // percentage
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignDeliveryMetrics = pgTable("campaign_delivery_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  date: timestamp("date").notNull(),
  emailsSent: integer("emails_sent").default(0),
  emailsDelivered: integer("emails_delivered").default(0),
  emailsBounced: integer("emails_bounced").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsUnsubscribed: integer("emails_unsubscribed").default(0),
  emailsComplained: integer("emails_complained").default(0),
  deliveryRate: integer("delivery_rate"), // percentage
  openRate: integer("open_rate"), // percentage
  clickRate: integer("click_rate"), // percentage
  bounceRate: integer("bounce_rate"), // percentage
  complaintRate: integer("complaint_rate"), // percentage
  unsubscribeRate: integer("unsubscribe_rate"), // percentage
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const handoverEvents = pgTable("handover_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  leadId: varchar("lead_id").references(() => leads.id),
  intent: text("intent").notNull(),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
});

export type HandoverEvent = typeof handoverEvents.$inferSelect;
export type InsertHandoverEvent = typeof handoverEvents.$inferInsert;

export const leadScores = pgTable("lead_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  leadId: varchar("lead_id").references(() => leads.id),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LeadScore = typeof leadScores.$inferSelect;
export type InsertLeadScore = typeof leadScores.$inferInsert;

// Email Queue schemas
export const insertEmailQueueSchema = createInsertSchema(emailQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailDeliveryEventSchema = createInsertSchema(emailDeliveryEvents).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSuppressionSchema = createInsertSchema(emailSuppressionList).omit({
  id: true,
  createdAt: true,
});

export const insertDomainHealthSchema = createInsertSchema(domainHealth).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignDeliveryMetricsSchema = createInsertSchema(campaignDeliveryMetrics).omit({
  id: true,
  createdAt: true,
});

// Authentication types
export type LoginRequest = z.infer<typeof loginSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

// Email system types
export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = z.infer<typeof insertEmailQueueSchema>;
export type EmailDeliveryEvent = typeof emailDeliveryEvents.$inferSelect;
export type InsertEmailDeliveryEvent = z.infer<typeof insertEmailDeliveryEventSchema>;
export type EmailSuppressionList = typeof emailSuppressionList.$inferSelect;
export type InsertEmailSuppression = z.infer<typeof insertEmailSuppressionSchema>;
export type DomainHealth = typeof domainHealth.$inferSelect;
export type InsertDomainHealth = z.infer<typeof insertDomainHealthSchema>;
export type CampaignDeliveryMetrics = typeof campaignDeliveryMetrics.$inferSelect;
export type InsertCampaignDeliveryMetrics = z.infer<typeof insertCampaignDeliveryMetricsSchema>;

// Handover system types
export type HandoverIntent =
  | 'pricing'
  | 'test_drive'
  | 'trade_in'
  | 'vehicle_info'
  | 'complaint'
  | 'appointment'
  | 'other';

export interface HandoverCriteriaItem {
  intent: HandoverIntent;
  action: 'handover'; // room for future actions
}

