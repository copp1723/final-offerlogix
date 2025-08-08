import {
  campaigns,
  users,
  conversations,
  conversationMessages,
  leads,
  aiAgentConfig,
  type Campaign,
  type InsertCampaign,
  type User,
  type InsertUser,
  type Conversation,
  type InsertConversation,
  type ConversationMessage,
  type InsertConversationMessage,
  type Lead,
  type InsertLead,
  type AiAgentConfig,
  type InsertAiAgentConfig,
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
  cloneCampaign(id: string, newName?: string): Promise<Campaign>;
  
  // Conversation methods
  getConversations(userId?: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, conversation: Partial<InsertConversation>): Promise<Conversation>;
  
  // Conversation message methods
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  
  // Lead methods
  getLeads(campaignId?: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  createLeads(leads: InsertLead[]): Promise<Lead[]>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;
  
  // AI Agent Configuration methods
  getAiAgentConfigs(): Promise<AiAgentConfig[]>;
  getActiveAiAgentConfig(): Promise<AiAgentConfig | undefined>;
  getAiAgentConfig(id: string): Promise<AiAgentConfig | undefined>;
  createAiAgentConfig(config: InsertAiAgentConfig): Promise<AiAgentConfig>;
  updateAiAgentConfig(id: string, config: Partial<InsertAiAgentConfig>): Promise<AiAgentConfig>;
  deleteAiAgentConfig(id: string): Promise<void>;
  setActiveAiAgentConfig(id: string): Promise<AiAgentConfig>;
  getLeadsByEmail(email: string): Promise<Lead[]>;
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
    
    // Store campaign in Supermemory for AI recall
    try {
      const supermemoryModule = await import('./services/supermemory');
      if (supermemoryModule.memoryMapper && typeof supermemoryModule.memoryMapper.addMemory === 'function') {
        await supermemoryModule.memoryMapper.addMemory({
          content: `Campaign: ${newCampaign.name}\nContext: ${newCampaign.context}\nGoals: ${newCampaign.handoverGoals}`,
          tags: ['campaign', `campaign:${newCampaign.id}`],
          metadata: {
            type: 'campaign',
            name: newCampaign.name,
            status: newCampaign.status,
            clientId: newCampaign.clientId || undefined
          }
        });
      }
    } catch (error) {
      console.warn('Failed to store campaign in Supermemory:', error);
    }
    
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

  async cloneCampaign(id: string, newName?: string): Promise<Campaign> {
    const originalCampaign = await this.getCampaign(id);
    if (!originalCampaign) {
      throw new Error("Campaign not found");
    }

    const clonedCampaign: InsertCampaign = {
      name: newName || `${originalCampaign.name} (Copy)`,
      context: originalCampaign.context,
      handoverGoals: originalCampaign.handoverGoals,
      status: "draft" as const,
      templates: originalCampaign.templates as any,
      subjectLines: originalCampaign.subjectLines as any,
      numberOfTemplates: originalCampaign.numberOfTemplates,
      daysBetweenMessages: originalCampaign.daysBetweenMessages,
      isTemplate: false,
      originalCampaignId: id,
    };

    return await this.createCampaign(clonedCampaign);
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

  // Update conversation status for handover
  async updateConversationStatus(id: string, status: string): Promise<Conversation | null> {
    const conversation = await this.getConversation(id);
    if (!conversation) return null;
    
    return this.updateConversation(id, { status });
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
    
    // Store human messages in Supermemory for AI recall
    if (!message.isFromAI && newMessage.content && typeof newMessage.content === 'string') {
      try {
        const conversation = await this.getConversation(message.conversationId || '');
        const supermemoryModule = await import('./services/supermemory');
        if (supermemoryModule.memoryMapper && typeof supermemoryModule.memoryMapper.addMemory === 'function') {
          await supermemoryModule.memoryMapper.addMemory({
            content: newMessage.content,
            tags: ['conversation', `conversation:${message.conversationId}`],
            metadata: {
              type: 'lead_message',
              conversationId: message.conversationId,
              senderId: message.senderId
            }
          });
        }
      } catch (error) {
        console.warn('Failed to store lead message in Supermemory:', error);
      }
    }
    
    return newMessage;
  }

  // Lead methods
  async getLeads(campaignId?: string): Promise<Lead[]> {
    if (campaignId) {
      return await db.select().from(leads).where(eq(leads.campaignId, campaignId)).orderBy(desc(leads.createdAt));
    }
    return await db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async createLeads(leadList: InsertLead[]): Promise<Lead[]> {
    const newLeads = await db.insert(leads).values(leadList).returning();
    return newLeads;
  }

  async updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead> {
    const [updatedLead] = await db
      .update(leads)
      .set({ ...lead, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  async getLeadsByEmail(email: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.email, email));
  }

  async getLeadByEmail(email: string): Promise<Lead | null> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || null;
  }

  async getConversationsByLead(leadId: string): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.userId, leadId)).orderBy(desc(conversations.createdAt));
  }

  // AI Agent Configuration methods
  async getAiAgentConfigs(): Promise<AiAgentConfig[]> {
    return await db.select().from(aiAgentConfig).orderBy(desc(aiAgentConfig.createdAt));
  }

  async getActiveAiAgentConfig(): Promise<AiAgentConfig | undefined> {
    const [config] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.isActive, true));
    return config;
  }

  async getAiAgentConfig(id: string): Promise<AiAgentConfig | undefined> {
    const [config] = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.id, id));
    return config;
  }

  async createAiAgentConfig(config: InsertAiAgentConfig): Promise<AiAgentConfig> {
    const [newConfig] = await db.insert(aiAgentConfig).values({
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newConfig;
  }

  async updateAiAgentConfig(id: string, config: Partial<InsertAiAgentConfig>): Promise<AiAgentConfig> {
    const [updatedConfig] = await db
      .update(aiAgentConfig)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(eq(aiAgentConfig.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteAiAgentConfig(id: string): Promise<void> {
    await db.delete(aiAgentConfig).where(eq(aiAgentConfig.id, id));
  }

  async setActiveAiAgentConfig(id: string): Promise<AiAgentConfig> {
    // First, deactivate all configs
    await db.update(aiAgentConfig).set({ isActive: false });
    
    // Then activate the selected config
    const [activeConfig] = await db
      .update(aiAgentConfig)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(aiAgentConfig.id, id))
      .returning();
    return activeConfig;
  }
}

export const storage = new DatabaseStorage();
