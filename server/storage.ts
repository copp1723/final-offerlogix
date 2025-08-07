import {
  campaigns,
  users,
  conversations,
  conversationMessages,
  type Campaign,
  type InsertCampaign,
  type User,
  type InsertUser,
  type Conversation,
  type InsertConversation,
  type ConversationMessage,
  type InsertConversationMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(id: string, role: string): Promise<User>;
  
  // Campaign methods
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;
  
  // Conversation methods
  getConversations(userId?: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, conversation: Partial<InsertConversation>): Promise<Conversation>;
  
  // Conversation message methods
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getCampaigns(): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt))
      .limit(10);
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        ...campaign,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newCampaign;
  }

  async updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign> {
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        ...campaign,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db
      .delete(campaigns)
      .where(eq(campaigns.id, id));
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Conversation methods
  async getConversations(userId?: string): Promise<Conversation[]> {
    let query = db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    
    if (userId) {
      return await query.where(eq(conversations.userId, userId));
    }
    
    return await query;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values({
        ...conversation,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newConversation;
  }

  async updateConversation(id: string, conversation: Partial<InsertConversation>): Promise<Conversation> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({
        ...conversation,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }

  // Conversation message methods
  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(desc(conversationMessages.createdAt));
  }

  async createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [newMessage] = await db
      .insert(conversationMessages)
      .values({
        ...message,
        createdAt: new Date(),
      })
      .returning();
    return newMessage;
  }
}

export const storage = new DatabaseStorage();
