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
  getUsers(limit?: number): Promise<User[]>; // New: list users for handover recipient suggestions

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
  deleteConversation(id: string): Promise<void>;

  // Conversation message methods
  getConversationMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]>;
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;

  // Lead methods
  getLeads(campaignId?: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  createLeads(leads: InsertLead[]): Promise<Lead[]>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;
  getLeadsByCampaign(campaignId: string): Promise<Lead[]>;
  getLeadByPhone(phone: string): Promise<Lead | null>;

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

  async getUsers(limit: number = 10): Promise<User[]> {
    // Basic list for suggestions (could scope by clientId later)
    return await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(insertUser)
      .returning() as User[];
    if (result.length === 0) {
      throw new Error('Failed to create user');
    }
    return result[0];
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
    // Lightweight hardening: sanitize JSONB-bound fields to avoid 22P02 errors
    const safeArray = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      }
      return [];
    };
    const sanitizedTemplates = safeArray((campaign as any).templates)
      .map((t) => {
        // String template => treat as HTML content; derive subject from first 80 chars
        if (typeof t === 'string') {
          const content = t.trim();
          const subj = content ? content.replace(/<[^>]*>/g, '').slice(0, 80) : 'Untitled';
          return { subject: subj, content };
        }
        if (!t || typeof t !== 'object') return null;
        // Object template => normalize into { subject, content }
        const subj = typeof (t as any).subject === 'string' && (t as any).subject.trim()
          ? String((t as any).subject).slice(0, 140)
          : typeof (t as any).title === 'string' && (t as any).title.trim()
            ? String((t as any).title).slice(0, 140)
            : 'Untitled';
        const content = typeof (t as any).content === 'string' && (t as any).content.trim()
          ? (t as any).content
          : (typeof (t as any).html === 'string' && (t as any).html.trim())
            ? (t as any).html
            : (typeof (t as any).body === 'string' && (t as any).body.trim())
              ? (t as any).body
              : (typeof (t as any).text === 'string' && (t as any).text.trim())
                ? (t as any).text
                : '';
        return { subject: subj, content };
      })
      .filter(Boolean) as { subject: string; content: string }[];
    const sanitizedSubjects = safeArray((campaign as any).subjectLines)
      .filter(s => typeof s === 'string' && s.trim())
      .map(s => s.slice(0, 140));

    const result = await db
      .insert(campaigns)
      .values({
        ...campaign,
        templates: sanitizedTemplates,
        subjectLines: sanitizedSubjects,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning() as Campaign[];
    if (result.length === 0) {
      throw new Error('Failed to create campaign');
    }
    const newCampaign = result[0];

    // Store campaign in Supermemory for AI recall
    try {
      const { MemoryMapper } = await import('./integrations/supermemory');
      await MemoryMapper.writeCampaignSummary({
        type: 'campaign_summary',
        clientId: newCampaign.clientId || 'default',
        campaignId: newCampaign.id,
        summary: `Campaign: ${newCampaign.name}\nContext: ${newCampaign.context}\nGoals: ${newCampaign.handoverGoals}`,
        meta: {
          name: newCampaign.name,
          status: newCampaign.status
        }
      });
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
    const result = await db
      .insert(conversations)
      .values({
        ...conversation,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning() as Conversation[];
    if (result.length === 0) {
      throw new Error('Failed to create conversation');
    }
    return result[0];
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

  async deleteConversation(id: string): Promise<void> {
    // Delete messages first to satisfy FK constraints, then delete conversation
    await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  // Update conversation status for handover
  async updateConversationStatus(id: string, status: string): Promise<Conversation | null> {
    const conversation = await this.getConversation(id);
    if (!conversation) return null;

    return this.updateConversation(id, { status });
  }

  // Conversation message methods
  async getConversationMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]> {
    const baseQuery = db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt); // ascending (oldest first)

    if (limit) {
      return await baseQuery.limit(limit);
    }

    return await baseQuery;
  }

  async createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const result = await db
      .insert(conversationMessages)
      .values({
        ...message,
        createdAt: new Date(),
      })
      .returning() as ConversationMessage[];
    if (result.length === 0) {
      throw new Error('Failed to create conversation message');
    }
    const newMessage = result[0];

    // Store human messages in Supermemory for AI recall
    if (!newMessage.isFromAI && newMessage.content && typeof newMessage.content === 'string') {
      try {
        const conversation = await this.getConversation(newMessage.conversationId || '');
        const { MemoryMapper } = await import('./integrations/supermemory');
        await MemoryMapper.writeLeadMessage({
          type: 'lead_msg',
          clientId: 'default', // TODO: Add clientId to message context
          campaignId: conversation?.campaignId || undefined,
          leadEmail: newMessage.senderId || undefined,
          content: newMessage.content,
          meta: {
            conversationId: newMessage.conversationId,
            senderId: newMessage.senderId
          }
        });
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
    const result = await db.insert(leads).values(lead).returning() as Lead[];
    if (result.length === 0) {
      throw new Error('Failed to create lead');
    }
    return result[0];
  }

  async createLeads(leadList: InsertLead[]): Promise<Lead[]> {
    const result = await db.insert(leads).values(leadList).returning();
    return result as Lead[];
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

  async getLeadsByCampaign(campaignId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.campaignId, campaignId)).orderBy(desc(leads.createdAt));
  }

  async getLeadByPhone(phone: string): Promise<Lead | null> {
    const [lead] = await db.select().from(leads).where(eq(leads.phone, phone));
    return lead || null;
  }


  async getConversationsByLead(leadId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.leadId, leadId))
      .orderBy(desc(conversations.createdAt));
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
    const result = await db.insert(aiAgentConfig).values({
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning() as AiAgentConfig[];
    if (result.length === 0) {
      throw new Error('Failed to create AI agent config');
    }
    return result[0];
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
