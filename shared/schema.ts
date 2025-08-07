import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // admin, manager, user
  email: text("email"),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
