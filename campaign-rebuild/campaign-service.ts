/**
 * Campaign Service - Manage and execute campaigns
 * Handles campaign creation, execution, and monitoring
 */

import { db } from './db';
import { 
  agents,
  campaigns, 
  leads,
  conversations,
  messages,
  Agent,
  Campaign,
  Lead
} from './schema';
import { eq, and, inArray, notInArray, sql } from 'drizzle-orm';
import { EmailService } from './email-service';
import { ConversationService } from './conversation-service';

interface CreateCampaignParams {
  agentId: string;
  name: string;
  subject: string;
  initialMessage: string;
}

interface AddLeadsToCampaignParams {
  campaignId: string;
  leadEmails: string[];
}

interface LaunchCampaignParams {
  campaignId: string;
  batchSize?: number;
  delayBetweenBatches?: number; // milliseconds
}

export class CampaignService {
  private emailService: EmailService;
  private conversationService: ConversationService;

  constructor(config: {
    emailService: EmailService;
    conversationService: ConversationService;
  }) {
    this.emailService = config.emailService;
    this.conversationService = config.conversationService;
  }

  /**
   * Create a new campaign
   */
  async createCampaign(params: CreateCampaignParams): Promise<Campaign> {
    const { agentId, name, subject, initialMessage } = params;
    
    // Verify agent exists and is active
    const agent = await db
      .select()
      .from(agents)
      .where(and(
        eq(agents.id, agentId),
        eq(agents.isActive, true)
      ))
      .limit(1);
    
    if (agent.length === 0) {
      throw new Error('Agent not found or inactive');
    }
    
    // Create campaign
    const campaign = await db
      .insert(campaigns)
      .values({
        agentId,
        name,
        subject,
        initialMessage,
        status: 'draft',
      })
      .returning();
    
    return campaign[0];
  }

  /**
   * Add leads to a campaign
   */
  async addLeadsToCampaign(params: AddLeadsToCampaignParams): Promise<{
    added: number;
    existing: number;
    created: number;
  }> {
    const { campaignId, leadEmails } = params;
    
    // Verify campaign exists and is in draft status
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    if (campaign.status !== 'draft') {
      throw new Error('Can only add leads to draft campaigns');
    }
    
    let created = 0;
    let existing = 0;
    
    // Process each email
    for (const email of leadEmails) {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if lead exists
      const existingLead = await db
        .select()
        .from(leads)
        .where(eq(leads.email, normalizedEmail))
        .limit(1);
      
      if (existingLead.length > 0) {
        existing++;
      } else {
        // Create new lead
        await db.insert(leads).values({
          email: normalizedEmail,
          status: 'active',
        });
        created++;
      }
    }
    
    return {
      added: leadEmails.length,
      existing,
      created,
    };
  }

  /**
   * Launch a campaign
   */
  async launchCampaign(params: LaunchCampaignParams): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const { campaignId, batchSize = 10, delayBetweenBatches = 1000 } = params;
    
    // Get campaign and agent
    const campaign = await this.getCampaignWithAgent(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    if (campaign.status !== 'draft') {
      throw new Error('Campaign already launched');
    }
    
    // Update campaign status to active
    await db
      .update(campaigns)
      .set({
        status: 'active',
        startedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
    
    // Get all leads that haven't received this campaign
    const campaignLeads = await this.getUncontactedLeads(campaignId);
    
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Process leads in batches
    for (let i = 0; i < campaignLeads.length; i += batchSize) {
      const batch = campaignLeads.slice(i, i + batchSize);
      
      // Process each lead in the batch
      const batchPromises = batch.map(async (lead) => {
        try {
          await this.sendInitialMessage({
            campaign: campaign.campaign,
            agent: campaign.agent,
            lead,
          });
          sent++;
        } catch (error: any) {
          failed++;
          errors.push(`Failed to send to ${lead.email}: ${error.message}`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Delay between batches to avoid rate limits
      if (i + batchSize < campaignLeads.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    // Update campaign status if all emails sent
    if (sent === campaignLeads.length) {
      await db
        .update(campaigns)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
    }
    
    return { sent, failed, errors };
  }

  /**
   * Send initial campaign message to a lead
   */
  private async sendInitialMessage(params: {
    campaign: Campaign;
    agent: Agent;
    lead: Lead;
  }): Promise<void> {
    const { campaign, agent, lead } = params;
    
    // Personalize the message
    const personalizedMessage = this.personalizeMessage(
      campaign.initialMessage,
      lead
    );
    
    // Create conversation
    const conversation = await this.conversationService.findOrCreateConversation({
      agentId: agent.id,
      leadId: lead.id,
      campaignId: campaign.id,
    });
    
    // Send email
    const emailResult = await this.emailService.sendEmail({
      to: lead.email,
      subject: campaign.subject,
      content: personalizedMessage,
      agent,
      threadId: conversation.threadId,
    });
    
    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Email send failed');
    }
    
    // Store message
    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: 'outbound',
      senderType: 'agent',
      messageId: emailResult.messageId,
      subject: campaign.subject,
      content: personalizedMessage,
      status: 'sent',
    });
    
    // Update conversation metrics
    await this.conversationService.updateConversationMetrics(conversation.id);
  }

  /**
   * Personalize message with lead data
   */
  private personalizeMessage(template: string, lead: Lead): string {
    let message = template;
    
    // Replace {first_name}
    if (lead.firstName) {
      message = message.replace(/{first_name}/g, lead.firstName);
    } else {
      message = message.replace(/{first_name}/g, 'there');
    }
    
    // Replace {last_name}
    if (lead.lastName) {
      message = message.replace(/{last_name}/g, lead.lastName);
    }
    
    // Replace custom fields
    if (lead.customFields && typeof lead.customFields === 'object') {
      const customFields = lead.customFields as Record<string, any>;
      Object.entries(customFields).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        message = message.replace(new RegExp(placeholder, 'g'), String(value));
      });
    }
    
    return message;
  }

  /**
   * Get campaign with agent details
   */
  private async getCampaignWithAgent(campaignId: string): Promise<{
    campaign: Campaign;
    agent: Agent;
  } | null> {
    const result = await db
      .select({
        campaign: campaigns,
        agent: agents,
      })
      .from(campaigns)
      .innerJoin(agents, eq(campaigns.agentId, agents.id))
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get leads that haven't been contacted for a campaign
   */
  private async getUncontactedLeads(campaignId: string): Promise<Lead[]> {
    // Get leads that already have conversations for this campaign
    const contactedLeadIds = await db
      .select({ leadId: conversations.leadId })
      .from(conversations)
      .where(eq(conversations.campaignId, campaignId));
    
    const contactedIds = contactedLeadIds.map(row => row.leadId);
    
    // Get all active leads not in contacted list
    if (contactedIds.length > 0) {
      return await db
        .select()
        .from(leads)
        .where(and(
          eq(leads.status, 'active'),
          notInArray(leads.id, contactedIds)
        ));
    } else {
      return await db
        .select()
        .from(leads)
        .where(eq(leads.status, 'active'));
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string): Promise<Campaign | null> {
    const result = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStatistics(campaignId: string): Promise<{
    totalLeads: number;
    contacted: number;
    responded: number;
    handedOver: number;
    conversionRate: number;
  }> {
    // Get total conversations for this campaign
    const conversationStats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        responded: sql<number>`COUNT(*) FILTER (WHERE message_count > 1)`,
        handedOver: sql<number>`COUNT(*) FILTER (WHERE status = 'handed_over')`,
      })
      .from(conversations)
      .where(eq(conversations.campaignId, campaignId));
    
    const stats = conversationStats[0] || {
      total: 0,
      responded: 0,
      handedOver: 0,
    };
    
    // Get total leads (assuming all active leads are potential recipients)
    const totalLeads = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(eq(leads.status, 'active'));
    
    const total = totalLeads[0]?.count || 0;
    
    return {
      totalLeads: total,
      contacted: stats.total,
      responded: stats.responded,
      handedOver: stats.handedOver,
      conversionRate: stats.total > 0 
        ? Math.round((stats.responded / stats.total) * 100) 
        : 0,
    };
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    await db
      .update(campaigns)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    await db
      .update(campaigns)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  }
}
