import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uuid } from "drizzle-orm/pg-core";
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
  senderId: varchar("sender_id").references(() => users.id),
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
  dosList: jsonb("dos_list").default([]), // Array of do's
  dontsList: jsonb("donts_list").default([]), // Array of don'ts  
  industry: varchar("industry").default("automotive"), // Industry specialization
  responseStyle: text("response_style").default("helpful"), // helpful, consultative, direct
  isActive: boolean("is_active").default(true), // Whether this config is currently active
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
  status: true,
  templates: true,
  subjectLines: true,
  numberOfTemplates: true,
  daysBetweenMessages: true,
  openRate: true,
  isTemplate: true,
  originalCampaignId: true,
});

export const insertAiAgentConfigSchema = createInsertSchema(aiAgentConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  campaignId: true,
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
