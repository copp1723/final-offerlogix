/**
 * API Routes - RESTful endpoints for campaign management
 * Clean, simple API for managing agents, campaigns, and conversations
 */

import express, { Router, Request, Response } from 'express';
import { db } from './db';
import { EmailService } from './email-service';
import { AgentService } from './agent-service';
import { ConversationService } from './conversation-service';
import { CampaignService } from './campaign-service';
import { WebhookHandler } from './webhook-handler';
import { 
  agents, 
  campaigns, 
  leads, 
  conversations,
  handovers,
  systemPrompts,
  insertAgentSchema,
  insertCampaignSchema,
  insertLeadSchema
} from './schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';

// Initialize services
const emailService = new EmailService({
  apiKey: process.env.MAILGUN_API_KEY || '',
  baseDomain: process.env.BASE_DOMAIN || 'okcrm.ai',
});

const agentService = new AgentService({
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  defaultModel: process.env.AI_MODEL || 'openai/gpt-4-turbo-preview',
});

const conversationService = new ConversationService();

const campaignService = new CampaignService({
  emailService,
  conversationService,
});

const webhookHandler = new WebhookHandler({
  emailService,
  agentService,
  conversationService,
  webhookSigningKey: process.env.MAILGUN_WEBHOOK_KEY || '',
});

// Create router
const router = Router();

// ============================================
// AGENT ENDPOINTS
// ============================================

// Get all agents
router.get('/api/agents', async (req: Request, res: Response) => {
  try {
    const allAgents = await db
      .select()
      .from(agents)
      .orderBy(desc(agents.createdAt));
    
    res.json(allAgents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get single agent
router.get('/api/agents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1);
    
    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json(agent[0]);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Create agent
router.post('/api/agents', async (req: Request, res: Response) => {
  try {
    const validatedData = insertAgentSchema.parse(req.body);
    
    const newAgent = await db
      .insert(agents)
      .values(validatedData)
      .returning();
    
    res.status(201).json(newAgent[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Update agent
router.put('/api/agents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedAgent = await db
      .update(agents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning();
    
    if (updatedAgent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json(updatedAgent[0]);
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Get agent statistics
router.get('/api/agents/:id/statistics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const stats = await conversationService.getAgentStatistics(id);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching agent statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============================================
// CAMPAIGN ENDPOINTS
// ============================================

// Get all campaigns
router.get('/api/campaigns', async (req: Request, res: Response) => {
  try {
    const allCampaigns = await db
      .select({
        campaign: campaigns,
        agent: agents,
      })
      .from(campaigns)
      .leftJoin(agents, eq(campaigns.agentId, agents.id))
      .orderBy(desc(campaigns.createdAt));
    
    res.json(allCampaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get single campaign
router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const campaign = await campaignService.getCampaign(id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Create campaign
router.post('/api/campaigns', async (req: Request, res: Response) => {
  try {
    const validatedData = insertCampaignSchema.parse(req.body);
    
    const campaign = await campaignService.createCampaign(validatedData);
    
    res.status(201).json(campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Add leads to campaign
router.post('/api/campaigns/:id/leads', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { emails } = req.body;
    
    if (!Array.isArray(emails)) {
      return res.status(400).json({ error: 'Emails must be an array' });
    }
    
    const result = await campaignService.addLeadsToCampaign({
      campaignId: id,
      leadEmails: emails,
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error adding leads to campaign:', error);
    res.status(500).json({ error: error.message || 'Failed to add leads' });
  }
});

// Launch campaign
router.post('/api/campaigns/:id/launch', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { batchSize, delayBetweenBatches } = req.body;
    
    const result = await campaignService.launchCampaign({
      campaignId: id,
      batchSize,
      delayBetweenBatches,
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error launching campaign:', error);
    res.status(500).json({ error: error.message || 'Failed to launch campaign' });
  }
});

// Get campaign statistics
router.get('/api/campaigns/:id/statistics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const stats = await campaignService.getCampaignStatistics(id);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching campaign statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Pause campaign
router.post('/api/campaigns/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await campaignService.pauseCampaign(id);
    
    res.json({ message: 'Campaign paused' });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// Resume campaign
router.post('/api/campaigns/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await campaignService.resumeCampaign(id);
    
    res.json({ message: 'Campaign resumed' });
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

// ============================================
// LEAD ENDPOINTS
// ============================================

// Get all leads
router.get('/api/leads', async (req: Request, res: Response) => {
  try {
    const allLeads = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));
    
    res.json(allLeads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Create lead
router.post('/api/leads', async (req: Request, res: Response) => {
  try {
    const validatedData = insertLeadSchema.parse(req.body);
    
    const newLead = await db
      .insert(leads)
      .values(validatedData)
      .returning();
    
    res.status(201).json(newLead[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Bulk import leads
router.post('/api/leads/import', async (req: Request, res: Response) => {
  try {
    const { leads: leadData } = req.body;
    
    if (!Array.isArray(leadData)) {
      return res.status(400).json({ error: 'Leads must be an array' });
    }
    
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const leadInfo of leadData) {
      try {
        const validatedLead = insertLeadSchema.parse(leadInfo);
        
        // Check if lead exists
        const existing = await db
          .select()
          .from(leads)
          .where(eq(leads.email, validatedLead.email))
          .limit(1);
        
        if (existing.length > 0) {
          skipped++;
        } else {
          await db.insert(leads).values(validatedLead);
          created++;
        }
      } catch (error: any) {
        errors.push(`Failed to import ${leadInfo.email}: ${error.message}`);
      }
    }
    
    res.json({ created, skipped, errors });
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// ============================================
// CONVERSATION ENDPOINTS
// ============================================

// Get all conversations
router.get('/api/conversations', async (req: Request, res: Response) => {
  try {
    const { status, agentId, leadId } = req.query;
    
    const conditions = [];
    if (status) conditions.push(eq(conversations.status, status as string));
    if (agentId) conditions.push(eq(conversations.agentId, agentId as string));
    if (leadId) conditions.push(eq(conversations.leadId, leadId as string));
    
    const allConversations = await db
      .select()
      .from(conversations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(conversations.lastMessageAt));
    
    res.json(allConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get single conversation with messages
router.get('/api/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const conversation = await conversationService.getConversation(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const messages = await conversationService.getAllMessages(id);
    
    res.json({ conversation, messages });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// ============================================
// HANDOVER ENDPOINTS
// ============================================

// Get pending handovers
router.get('/api/handovers', async (req: Request, res: Response) => {
  try {
    const pendingHandovers = await db
      .select({
        handover: handovers,
        conversation: conversations,
      })
      .from(handovers)
      .innerJoin(conversations, eq(handovers.conversationId, conversations.id))
      .where(eq(handovers.status, 'pending'))
      .orderBy(desc(handovers.createdAt));
    
    res.json(pendingHandovers);
  } catch (error) {
    console.error('Error fetching handovers:', error);
    res.status(500).json({ error: 'Failed to fetch handovers' });
  }
});

// Assign handover
router.post('/api/handovers/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    
    const updated = await db
      .update(handovers)
      .set({
        status: 'assigned',
        assignedTo,
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(handovers.id, id))
      .returning();
    
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Handover not found' });
    }
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Error assigning handover:', error);
    res.status(500).json({ error: 'Failed to assign handover' });
  }
});

// Resolve handover
router.post('/api/handovers/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const updated = await db
      .update(handovers)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(handovers.id, id))
      .returning();
    
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Handover not found' });
    }
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Error resolving handover:', error);
    res.status(500).json({ error: 'Failed to resolve handover' });
  }
});

// ============================================
// WEBHOOK ENDPOINTS
// ============================================

// Mailgun webhook handler
router.post('/webhooks/mailgun', async (req: Request, res: Response) => {
  await webhookHandler.handleInboundEmail(req, res);
});

// ============================================
// SYSTEM PROMPT ENDPOINTS
// ============================================

// Get all system prompts
router.get('/api/system-prompts', async (req: Request, res: Response) => {
  try {
    const prompts = await db
      .select()
      .from(systemPrompts)
      .orderBy(desc(systemPrompts.createdAt));
    
    res.json(prompts);
  } catch (error) {
    console.error('Error fetching system prompts:', error);
    res.status(500).json({ error: 'Failed to fetch system prompts' });
  }
});

// Create system prompt
router.post('/api/system-prompts', async (req: Request, res: Response) => {
  try {
    const { name, description, template, availablePlaceholders } = req.body;
    
    const newPrompt = await db
      .insert(systemPrompts)
      .values({
        name,
        description,
        template,
        availablePlaceholders,
      })
      .returning();
    
    res.status(201).json(newPrompt[0]);
  } catch (error) {
    console.error('Error creating system prompt:', error);
    res.status(500).json({ error: 'Failed to create system prompt' });
  }
});

// Export router
export default router;
