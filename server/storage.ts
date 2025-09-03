import {
  campaigns,
  users,
  conversations,
  conversationMessages,
  leads,
  leadCampaignStates,
  aiAgentConfig,
  templates,
  handoverEvents,
  leadScores,
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
  type LeadCampaignState,
  type InsertLeadCampaignState,
  type AiAgentConfig,
  type InsertAiAgentConfig,
  type Template,
  type InsertTemplate,
  type HandoverEvent,
  type InsertHandoverEvent,
  type LeadScore,
  type InsertLeadScore,
} from "../shared/schema.js";
import { db } from "./db.js";
import log from "./logging/logger.js";
import { eq, desc, and, sql, gt, lt, ne, inArray } from "drizzle-orm";
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

  // Template methods
  getTemplatesByCampaign(campaignId: string): Promise<Template[]>;

  // Conversation methods
  getConversations(userId?: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, conversation: Partial<InsertConversation>): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
  getConversationsByLead(leadId: string): Promise<Conversation[]>;

  // Conversation message methods
  getConversationMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]>;
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getLeadMessages(leadId: string, limit: number): Promise<ConversationMessage[]>;
  getConsecutiveAiReplies(conversationId: string): Promise<number>;
  getLeadMessagesSince(since: Date): Promise<ConversationMessage[]>;
  setConversationMessageProviderId(messageId: string, providerMessageId: string): Promise<void>;

  // Lead methods
  getLeads(campaignId?: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  createLeads(leads: InsertLead[]): Promise<Lead[]>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;
  getLeadsByCampaign(campaignId: string): Promise<Lead[]>;
  getLeadByPhone(phone: string): Promise<Lead | null>;

  // Lead campaign state methods
  getLeadCampaignState(leadId: string, campaignId: string): Promise<LeadCampaignState | undefined>;
  upsertLeadCampaignState(state: InsertLeadCampaignState): Promise<LeadCampaignState>;

  // Template methods
  getTemplatesByCampaign(campaignId: string): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  incrementTemplateMetrics(
    templateId: string,
    metrics: { sentCount?: number; openCount?: number; replyCount?: number; handoverCount?: number }
  ): Promise<Template>;
  markTemplateWinner(templateId: string, campaignId: string): Promise<void>;

  // AI Agent Configuration methods
  getAiAgentConfigs(): Promise<AiAgentConfig[]>;
  getActiveAiAgentConfig(): Promise<AiAgentConfig | undefined>;
  getAiAgentConfig(id: string): Promise<AiAgentConfig | undefined>;
  createAiAgentConfig(config: InsertAiAgentConfig): Promise<AiAgentConfig>;
  updateAiAgentConfig(id: string, config: Partial<InsertAiAgentConfig>): Promise<AiAgentConfig>;
  deleteAiAgentConfig(id: string): Promise<void>;
  setActiveAiAgentConfig(id: string): Promise<AiAgentConfig>;
  getLeadsByEmail(email: string): Promise<Lead[]>;

  // Lead scoring methods
  insertLeadScore(score: InsertLeadScore): Promise<void>;
  getLeadScores(leadId: string, campaignId?: string): Promise<LeadScore[]>;
  getLeadScoreDistribution(campaignId: string): Promise<{ range: string; count: number }[]>;
  getLatestLeadScore(leadId: string, campaignId?: string): Promise<LeadScore | undefined>;

  // Handover methods
  getConversationMessagesByLead(leadId: string, limit?: number): Promise<ConversationMessage[]>;
  insertHandoverEvent(event: {
    campaignId: string;
    leadId: string;
    intents: string[];
    triggeredAt: Date;
    reason: 'intent_trigger' | 'manual' | 'rule_threshold';
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  // Maintenance methods
  cleanupAbandonedConversations(cutoff: Date): Promise<number>;
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
    try {
      return await db
        .select()
        .from(campaigns)
        .orderBy(desc(campaigns.createdAt))
        .limit(10);
    } catch (err: any) {
      // Handle newer columns like handover_criteria that may not exist in older DBs
      if (err.message && err.message.includes('handover_criteria')) {
        log.warn('Falling back to explicit column selection due to missing handover_criteria column');
        return await db
          .select({
            id: campaigns.id,
            name: campaigns.name,
            context: campaigns.context,
            handoverGoals: campaigns.handoverGoals,
            targetAudience: campaigns.targetAudience,
            handoverPrompt: campaigns.handoverPrompt,
            handoverPromptSpec: campaigns.handoverPromptSpec,
            handoverRecipient: campaigns.handoverRecipient,
            status: campaigns.status,
            templates: campaigns.templates,
            subjectLines: campaigns.subjectLines,
            numberOfTemplates: campaigns.numberOfTemplates,
            daysBetweenMessages: campaigns.daysBetweenMessages,
            openRate: campaigns.openRate,
            isTemplate: campaigns.isTemplate,
            originalCampaignId: campaigns.originalCampaignId,
            createdAt: campaigns.createdAt
          })
          .from(campaigns)
          .orderBy(desc(campaigns.createdAt))
          .limit(10) as Campaign[];
      }
      throw err;
    }
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
        const obj: any = { subject: subj, content };
        if (t.versions && typeof t.versions === 'object') obj.versions = t.versions;
        if (t.ab && typeof t.ab === 'object') obj.ab = t.ab;
        return obj;
      })
      .filter(Boolean) as any[];
    const sanitizedSubjects = safeArray((campaign as any).subjectLines)
      .filter(s => typeof s === 'string' && s.trim())
      .map(s => s.slice(0, 140));

    // Prepare campaign data with safe defaults to prevent validation errors
    const campaignData = {
      // Core required fields
      name: campaign.name || 'Untitled Campaign',
      context: campaign.context || 'Campaign context',
      status: campaign.status || 'draft',
      
      // Optional fields with safe defaults
      handoverGoals: campaign.handoverGoals || null,
      targetAudience: campaign.targetAudience || null,
      handoverPrompt: campaign.handoverPrompt || null,
      handoverPromptSpec: campaign.handoverPromptSpec || null,
      handoverCriteria: campaign.handoverCriteria || null,
      handoverRecipient: campaign.handoverRecipient || null,
      numberOfTemplates: campaign.numberOfTemplates || 5,
      daysBetweenMessages: campaign.daysBetweenMessages || 3,
      openRate: campaign.openRate || null,
      isTemplate: campaign.isTemplate || false,
      originalCampaignId: campaign.originalCampaignId || null,
      agentConfigId: campaign.agentConfigId || null,
      stopOnComplaint: campaign.stopOnComplaint || false,
      sendWindow: campaign.sendWindow || null,
      
      // Processed fields
      templates: sanitizedTemplates,
      subjectLines: sanitizedSubjects,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const result = await db
        .insert(campaigns)
        .values(campaignData)
        .returning() as Campaign[];
      
      if (result.length === 0) {
        throw new Error('Database insert returned no results');
      }
      
      const newCampaign = result[0];
      log.info('Campaign created successfully', { 
        campaignId: newCampaign.id, 
        name: newCampaign.name,
        templatesCount: sanitizedTemplates.length
      });

      // Store in Supermemory for AI recall (non-blocking)
      this.storeCampaignInSupermemory(newCampaign).catch(err => 
        log.warn('Failed to store campaign in Supermemory', { error: err.message, campaignId: newCampaign.id })
      );
      
      return newCampaign;
    } catch (err: any) {
      // Enhanced error logging for debugging
      log.error('Failed to create campaign in database', {
        error: err.message,
        campaignName: campaign.name,
        hasTemplates: !!campaignData.templates,
        templatesCount: sanitizedTemplates.length,
        hasHandoverCriteria: !!campaign.handoverCriteria,
        sqlState: err.code,
        constraint: err.constraint
      });

      // Handle specific database constraint errors
      if (err.code === '42703' && err.message.includes('handover_criteria')) {
        log.warn('Falling back to campaign creation without handover_criteria column');
        // Retry without handover_criteria for older database schemas
        const { handoverCriteria, ...campaignWithoutHandoverCriteria } = campaignData;
        try {
          const result = await db
            .insert(campaigns)
            .values(campaignWithoutHandoverCriteria)
            .returning() as Campaign[];
          
          if (result.length === 0) {
            throw new Error('Database insert returned no results (fallback)');
          }
          
          const fallbackCampaign = result[0];
          // Store in Supermemory for AI recall (non-blocking)
          this.storeCampaignInSupermemory(fallbackCampaign).catch(err => 
            log.warn('Failed to store campaign in Supermemory (fallback)', { error: err.message, campaignId: fallbackCampaign.id })
          );
          
          return fallbackCampaign;
        } catch (fallbackErr: any) {
          log.error('Fallback campaign creation also failed', { error: fallbackErr.message });
          throw new Error(`Campaign creation failed: ${fallbackErr.message}`);
        }
      }
      
      throw new Error(`Failed to create campaign: ${err.message}`);
    }
  }

  private async storeCampaignInSupermemory(newCampaign: Campaign): Promise<void> {
    // Store campaign in Supermemory for AI recall
    try {
      const { MemoryMapper } = await import('./integrations/supermemory/index.js');
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
      return await query.where(and(eq(conversations.userId, userId), eq(conversations.archived, false)));
    }

    return await query.where(eq(conversations.archived, false));
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
        providerMessageId: (message as any).providerMessageId ?? null
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
        const { MemoryMapper } = await import('./integrations/supermemory/index.js');
        // Get clientId from conversation or lead context
        const lead = conversation?.leadId ? await this.getLead(conversation.leadId) : null;
        const clientId = lead?.clientId || 'default';

        await MemoryMapper.writeLeadMessage({
          type: 'lead_msg',
          clientId,
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

  async getLeadMessages(leadId: string, limit: number): Promise<ConversationMessage[]> {
    const rows = await db
      .select()
      .from(conversationMessages)
      .innerJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
      .where(eq(conversations.leadId, leadId))
      .orderBy(desc(conversationMessages.createdAt))
      .limit(limit);
    // Return chronological (oldest first)
    return rows.map(r => r.conversation_messages).reverse() as ConversationMessage[];
  }

  async getConsecutiveAiReplies(conversationId: string): Promise<number> {
    const rows = await db
      .select({ isFromAI: conversationMessages.isFromAI })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(desc(conversationMessages.createdAt))
      .limit(10);
    let count = 0;
    for (const r of rows) {
      if (r.isFromAI === 1) count++;
      else break;
    }
    return count;
  }

  async getLeadMessagesSince(since: Date): Promise<ConversationMessage[]> {
    return (await db
      .select()
      .from(conversationMessages)
      .where(and(eq(conversationMessages.isFromAI, 0), gt(conversationMessages.createdAt, since)))
      .orderBy(conversationMessages.createdAt)) as ConversationMessage[];
  }

  async setConversationMessageProviderId(messageId: string, providerMessageId: string): Promise<void> {
    try {
      await db
        .update(conversationMessages)
        .set({ providerMessageId })
        .where(eq(conversationMessages.id, messageId));
    } catch (error) {
      log.error('Failed to set providerMessageId on conversation message', { messageId, providerMessageId, error });
      throw error;
    }
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

  // Lead campaign state methods
  async getLeadCampaignState(leadId: string, campaignId: string): Promise<LeadCampaignState | undefined> {
    const [state] = await db.select().from(leadCampaignStates)
      .where(and(eq(leadCampaignStates.leadId, leadId), eq(leadCampaignStates.campaignId, campaignId)));
    return state || undefined;
  }

  async upsertLeadCampaignState(state: InsertLeadCampaignState): Promise<LeadCampaignState> {
    const [result] = await db.insert(leadCampaignStates).values(state)
      .onConflictDoUpdate({ 
        target: [leadCampaignStates.leadId, leadCampaignStates.campaignId], 
        set: {
          respondedAt: state.respondedAt,
          followupState: state.followupState,
        }
      })
      .returning();
    return result;
  }

  async getTemplatesByCampaign(campaignId: string): Promise<Template[]> {
    return await db
      .select()
      .from(templates)
      .where(eq(templates.campaignId, campaignId))
      .orderBy(desc(templates.version));
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(templates)
      .where(eq(templates.campaignId, template.campaignId));
    const version = Number(count) + 1;
    const [newTemplate] = await db
      .insert(templates)
      .values({
        ...template,
        version,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newTemplate;
  }

  async incrementTemplateMetrics(
    templateId: string,
    metrics: { sentCount?: number; openCount?: number; replyCount?: number; handoverCount?: number }
  ): Promise<Template> {
    const update: Record<string, any> = { updatedAt: new Date() };
    if (metrics.sentCount) {
      update.sentCount = sql`${templates.sentCount} + ${metrics.sentCount}`;
    }
    if (metrics.openCount) {
      update.openCount = sql`${templates.openCount} + ${metrics.openCount}`;
    }
    if (metrics.replyCount) {
      update.replyCount = sql`${templates.replyCount} + ${metrics.replyCount}`;
    }
    if (metrics.handoverCount) {
      update.handoverCount = sql`${templates.handoverCount} + ${metrics.handoverCount}`;
    }
    const [updated] = await db
      .update(templates)
      .set(update)
      .where(eq(templates.id, templateId))
      .returning();
    return updated;
  }

  async markTemplateWinner(templateId: string, campaignId: string): Promise<void> {
    await db.update(templates).set({ isWinner: false }).where(eq(templates.campaignId, campaignId));
    await db
      .update(templates)
      .set({ isWinner: true, updatedAt: new Date() })
      .where(eq(templates.id, templateId));
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

  // Lead scoring methods implementation
  async insertLeadScore(score: InsertLeadScore): Promise<void> {
    await db.insert(leadScores).values({
      ...score,
      id: score.id || randomUUID(),
      createdAt: score.createdAt || new Date(),
    });
  }

  async getLeadScores(leadId: string, campaignId?: string): Promise<LeadScore[]> {
    const conditions = [eq(leadScores.leadId, leadId)];
    if (campaignId) {
      conditions.push(eq(leadScores.campaignId, campaignId));
    }
    return db
      .select()
      .from(leadScores)
      .where(and(...conditions))
      .orderBy(desc(leadScores.createdAt));
  }

  async getLeadScoreDistribution(campaignId: string): Promise<{ range: string; count: number }[]> {
    const rows = await db
      .select({ score: leadScores.score })
      .from(leadScores)
      .where(eq(leadScores.campaignId, campaignId));
    
    const distribution: Record<string, number> = { 
      '0-24': 0, '25-49': 0, '50-74': 0, '75-100': 0 
    };
    
    for (const r of rows) {
      if (r.score >= 75) distribution['75-100']++;
      else if (r.score >= 50) distribution['50-74']++;
      else if (r.score >= 25) distribution['25-49']++;
      else distribution['0-24']++;
    }
    
    return Object.entries(distribution).map(([range, count]) => ({ range, count }));
  }

  async getLatestLeadScore(leadId: string, campaignId?: string): Promise<LeadScore | undefined> {
    const conditions = [eq(leadScores.leadId, leadId)];
    if (campaignId) {
      conditions.push(eq(leadScores.campaignId, campaignId));
    }
    
    const [latestScore] = await db
      .select()
      .from(leadScores)
      .where(and(...conditions))
      .orderBy(desc(leadScores.createdAt))
      .limit(1);
    
    return latestScore || undefined;
  }

  // Handover methods implementation
  async getConversationMessagesByLead(leadId: string, limit = 20): Promise<ConversationMessage[]> {
    const messages = await db
      .select({
        id: conversationMessages.id,
        leadId: conversations.leadId,
        createdAt: conversationMessages.createdAt,
        conversationId: conversationMessages.conversationId,
        senderId: conversationMessages.senderId,
        content: conversationMessages.content,
        messageType: conversationMessages.messageType,
        isFromAI: conversationMessages.isFromAI,
        providerMessageId: conversationMessages.providerMessageId,
      })
      .from(conversationMessages)
      .innerJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
      .where(eq(conversations.leadId, leadId))
      .orderBy(desc(conversationMessages.createdAt))
      .limit(limit);
    return messages;
  }

  async logHandoverEvent(event: {
    leadId: string;
    campaignId: string;
    intent: string;
    triggeredAt: Date;
  }): Promise<HandoverEvent> {
    const [handoverEvent] = await db
      .insert(handoverEvents)
      .values({
        id: randomUUID(),
        leadId: event.leadId,
        campaignId: event.campaignId,
        intent: event.intent,
        triggeredAt: event.triggeredAt
      })
      .returning();
    return handoverEvent;
  }

  async getHandoverEvents(
    leadId: string, 
    campaignId?: string, 
    intent?: string
  ): Promise<HandoverEvent[]> {
    const conditions = [eq(handoverEvents.leadId, leadId)];
    
    if (campaignId) {
      conditions.push(eq(handoverEvents.campaignId, campaignId));
    }
    
    if (intent) {
      conditions.push(eq(handoverEvents.intent, intent));
    }
    
    const events = await db
      .select()
      .from(handoverEvents)
      .where(and(...conditions))
      .orderBy(desc(handoverEvents.triggeredAt));
    
    return events;
  }

  async insertHandoverEvent(event: {
    campaignId: string;
    leadId: string;
    intents: string[];
    triggeredAt: Date;
    reason: 'intent_trigger' | 'manual' | 'rule_threshold';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // Insert multiple handover events for each intent
    const events = event.intents.map(intent => ({
      id: randomUUID(),
      leadId: event.leadId,
      campaignId: event.campaignId,
      intent,
      triggeredAt: event.triggeredAt
    }));
    
    if (events.length > 0) {
      await db.insert(handoverEvents).values(events);
    }
  }

  async cleanupAbandonedConversations(cutoff: Date): Promise<number> {
    return await db.transaction(async (tx) => {
      const abandoned = await tx
        .select()
        .from(conversations)
        .where(
          and(
            lt(conversations.updatedAt, cutoff),
            ne(conversations.status, 'archived'),
            ne(conversations.status, 'closed')
          )
        );

      if (abandoned.length === 0) {
        return 0;
      }

      await tx
        .update(conversations)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(inArray(conversations.id, abandoned.map((c) => c.id)));

      return abandoned.length;
    });
  }
}

export const storage = new DatabaseStorage();
