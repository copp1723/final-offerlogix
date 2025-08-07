import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertConversationSchema, insertConversationMessageSchema, insertLeadSchema, insertAiAgentConfigSchema, insertClientSchema, type AiAgentConfig, type Client } from "@shared/schema";
import { suggestCampaignGoals, enhanceEmailTemplates, generateSubjectLines, suggestCampaignNames, generateEmailTemplates } from "./services/openai";
import { processCampaignChat } from "./services/ai-chat";
import { sendCampaignEmail, sendBulkEmails, validateEmailAddresses } from "./services/mailgun";
import { sendSMS, sendCampaignAlert, validatePhoneNumber } from "./services/twilio";
import { tenantMiddleware, type TenantRequest } from "./tenant";
import { db } from "./db";
import { clients } from "@shared/schema";
import { eq } from "drizzle-orm";
// import multer from "multer";
// import { parse } from "csv-parse/sync";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply tenant middleware to all API routes
  app.use('/api', tenantMiddleware);

  // Branding API - public endpoint for fetching client branding
  app.get("/api/branding", async (req, res) => {
    try {
      const domain = req.query.domain as string || req.get('host') || 'localhost';
      
      // Try to find client by domain
      let [client] = await db.select().from(clients).where(eq(clients.domain, domain));
      
      // Fall back to default client
      if (!client) {
        [client] = await db.select().from(clients).where(eq(clients.name, 'Default Client'));
      }
      
      if (client) {
        res.json(client);
      } else {
        // Return default branding
        res.json({
          id: 'default',
          name: 'AutoCampaigns AI',
          brandingConfig: {
            primaryColor: '#2563eb',
            secondaryColor: '#1e40af',
            logoUrl: '',
            companyName: 'AutoCampaigns AI',
            favicon: '',
            customCss: ''
          }
        });
      }
    } catch (error) {
      console.error('Branding API error:', error);
      res.status(500).json({ message: "Failed to fetch branding" });
    }
  });

  // Client management routes
  app.get("/api/clients", async (req: TenantRequest, res) => {
    try {
      const allClients = await db.select().from(clients);
      res.json(allClients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", async (req: TenantRequest, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const [client] = await db.insert(clients).values(clientData).returning();
      res.json(client);
    } catch (error) {
      console.error('Create client error:', error);
      res.status(400).json({ message: "Invalid client data" });
    }
  });

  app.put("/api/clients/:id", async (req: TenantRequest, res) => {
    try {
      const clientData = insertClientSchema.partial().parse(req.body);
      const [client] = await db.update(clients)
        .set({ ...clientData, updatedAt: new Date() })
        .where(eq(clients.id, req.params.id))
        .returning();
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data" });
    }
  });

  app.delete("/api/clients/:id", async (req: TenantRequest, res) => {
    try {
      await db.delete(clients).where(eq(clients.id, req.params.id));
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req: TenantRequest, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
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

  app.post("/api/campaigns", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ message: "Invalid campaign data" });
    }
  });

  app.put("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      await storage.deleteCampaign(req.params.id);
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Campaign cloning endpoint
  app.post("/api/campaigns/:id/clone", async (req, res) => {
    try {
      const { name } = req.body;
      const clonedCampaign = await storage.cloneCampaign(req.params.id, name);
      res.json(clonedCampaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to clone campaign" });
    }
  });

  // AI Enhancement routes
  app.post("/api/ai/enhance-templates", async (req, res) => {
    try {
      const { context, name } = req.body;
      if (!context || !name) {
        return res.status(400).json({ message: "Context and name are required" });
      }

      const result = await enhanceEmailTemplates(context, name);
      res.json(result);
    } catch (error) {
      console.error('AI enhance templates error:', error);
      res.status(500).json({ message: "Failed to generate templates" });
    }
  });

  app.post("/api/ai/generate-subjects", async (req, res) => {
    try {
      const { context, name } = req.body;
      if (!context || !name) {
        return res.status(400).json({ message: "Context and name are required" });
      }

      const subjectLines = await generateSubjectLines(context, name);
      res.json({ subjectLines });
    } catch (error) {
      console.error('AI generate subjects error:', error);
      res.status(500).json({ message: "Failed to generate subject lines" });
    }
  });

  app.post("/api/ai/suggest-goals", async (req, res) => {
    try {
      const { context } = req.body;
      if (!context) {
        return res.status(400).json({ message: "Context is required" });
      }

      const goals = await suggestCampaignGoals(context);
      res.json({ goals });
    } catch (error) {
      console.error('AI suggest goals error:', error);
      res.status(500).json({ message: "Failed to generate goals" });
    }
  });

  app.post("/api/ai/suggest-names", async (req, res) => {
    try {
      const { context } = req.body;
      if (!context) {
        return res.status(400).json({ message: "Context is required" });
      }

      const names = await suggestCampaignNames(context);
      res.json({ names });
    } catch (error) {
      console.error('AI suggest names error:', error);
      res.status(500).json({ message: "Failed to generate campaign names" });
    }
  });

  app.post("/api/ai/generate-templates", async (req, res) => {
    try {
      const { context, name, numberOfTemplates = 5 } = req.body;
      if (!context || !name) {
        return res.status(400).json({ message: "Context and campaign name are required" });
      }

      const templates = await generateEmailTemplates(context, name, numberOfTemplates);
      res.json({ templates });
    } catch (error) {
      console.error('AI generate templates error:', error);
      res.status(500).json({ message: "Failed to generate email templates" });
    }
  });

  // Email routes
  app.post("/api/email/send", async (req, res) => {
    try {
      const { to, subject, htmlContent, textContent, fromName, fromEmail } = req.body;
      if (!to || !subject || !htmlContent) {
        return res.status(400).json({ message: "Required fields: to, subject, htmlContent" });
      }

      const result = await sendCampaignEmail({
        to: Array.isArray(to) ? to : [to],
        subject,
        htmlContent,
        textContent,
        fromName,
        fromEmail
      });
      res.json(result);
    } catch (error) {
      console.error('Email send error:', error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  app.post("/api/email/validate", async (req, res) => {
    try {
      const { emails } = req.body;
      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ message: "Emails array is required" });
      }

      const result = await validateEmailAddresses(emails);
      res.json(result);
    } catch (error) {
      console.error('Email validation error:', error);
      res.status(500).json({ message: "Failed to validate emails" });
    }
  });

  app.post("/api/email/validate-content", async (req, res) => {
    try {
      const emailData = req.body;
      if (!emailData.to || !emailData.subject || !emailData.htmlContent) {
        return res.status(400).json({ message: "Required fields: to, subject, htmlContent" });
      }

      const { emailWatchdog } = await import('./services/email-validator');
      const validation = await emailWatchdog.validateOutboundEmail(emailData);
      
      res.json(validation);
    } catch (error) {
      console.error('Email content validation error:', error);
      res.status(500).json({ message: "Failed to validate email content" });
    }
  });

  app.get("/api/email/validation-stats", async (req, res) => {
    try {
      const { emailWatchdog } = await import('./services/email-validator');
      const stats = emailWatchdog.getValidationStats();
      res.json(stats);
    } catch (error) {
      console.error('Email validation stats error:', error);
      res.status(500).json({ message: "Failed to get validation stats" });
    }
  });

  // Handover evaluation endpoint
  app.post("/api/conversations/:id/evaluate-handover", async (req, res) => {
    try {
      const { id } = req.params;
      const { message, customCriteria } = req.body;

      // Get conversation from storage
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const { HandoverService } = await import('./services/handover-service');
      const evaluation = await HandoverService.evaluateHandover(id, conversation, message, customCriteria);
      
      res.json(evaluation);
    } catch (error) {
      console.error('Handover evaluation error:', error);
      res.status(500).json({ message: "Failed to evaluate handover" });
    }
  });

  // Get handover statistics
  app.get("/api/handover/stats", async (req, res) => {
    try {
      const { HandoverService } = await import('./services/handover-service');
      const stats = HandoverService.getHandoverStats();
      res.json(stats);
    } catch (error) {
      console.error('Handover stats error:', error);
      res.status(500).json({ message: "Failed to get handover stats" });
    }
  });

  // Generate automotive system prompt
  app.post("/api/ai/generate-prompt", async (req, res) => {
    try {
      const { dealershipConfig, conversationContext } = req.body;
      
      const { AutomotivePromptService } = await import('./services/automotive-prompts');
      const systemPrompt = AutomotivePromptService.generateSystemPrompt(
        dealershipConfig || AutomotivePromptService.getDefaultDealershipConfig(),
        conversationContext
      );
      
      res.json({ systemPrompt });
    } catch (error) {
      console.error('Prompt generation error:', error);
      res.status(500).json({ message: "Failed to generate system prompt" });
    }
  });

  // Analyze conversation for automotive context
  app.post("/api/ai/analyze-conversation", async (req, res) => {
    try {
      const { messageContent, leadName, vehicleInterest, previousMessages } = req.body;
      
      const { AutomotivePromptService } = await import('./services/automotive-prompts');
      const context = AutomotivePromptService.createConversationContext(
        leadName,
        vehicleInterest, 
        messageContent,
        previousMessages
      );
      
      const guidelines = AutomotivePromptService.generateResponseGuidelines(context);
      
      res.json({ context, guidelines });
    } catch (error) {
      console.error('Conversation analysis error:', error);
      res.status(500).json({ message: "Failed to analyze conversation" });
    }
  });

  // SMS routes
  app.post("/api/sms/send", async (req, res) => {
    try {
      const { to, message, from } = req.body;
      if (!to || !message) {
        return res.status(400).json({ message: "Phone number and message are required" });
      }

      const result = await sendSMS({ to, message, from });
      res.json(result);
    } catch (error) {
      console.error('SMS send error:', error);
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  app.post("/api/sms/campaign-alert", async (req, res) => {
    try {
      const { phoneNumber, campaignName, metric, value } = req.body;
      if (!phoneNumber || !campaignName || !metric || !value) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const result = await sendCampaignAlert(phoneNumber, campaignName, metric, value);
      res.json(result);
    } catch (error) {
      console.error('Campaign alert error:', error);
      res.status(500).json({ message: "Failed to send campaign alert" });
    }
  });

  // Campaign Execution Routes
  app.post("/api/campaigns/:id/execute", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { scheduleAt, testMode = false } = req.body;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Get leads for this campaign or all active leads if no specific campaign leads
      const leads = await storage.getLeads();
      const campaignLeads = leads.filter(lead => 
        !lead.campaignId || lead.campaignId === campaignId
      );

      if (campaignLeads.length === 0) {
        return res.status(400).json({ message: "No leads found for this campaign" });
      }

      // Parse email templates from campaign
      let templates: any[] = [];
      try {
        templates = JSON.parse(campaign.templates || '[]');
        if (!Array.isArray(templates) || templates.length === 0) {
          return res.status(400).json({ message: "Campaign has no email templates" });
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid email templates in campaign" });
      }

      // Update campaign status
      await storage.updateCampaign(campaignId, { 
        status: scheduleAt ? 'scheduled' : 'active',
        lastExecuted: scheduleAt ? null : new Date()
      });

      // If test mode, only send to first lead or use a test email
      if (testMode) {
        const testLead = campaignLeads[0];
        const testTemplate = templates[0];
        
        const emailData = {
          to: [testLead.email],
          subject: `[TEST] ${testTemplate.subject || campaign.name}`,
          htmlContent: testTemplate.content || 'Test email content',
          fromName: 'AutoCampaigns AI',
        };

        const result = await sendCampaignEmail(emailData);
        return res.json({ 
          message: "Test email sent successfully",
          sentTo: [testLead.email],
          testMode: true,
          result
        });
      }

      // Schedule or execute immediately
      if (scheduleAt) {
        // Store execution details for scheduled sending
        // In a production system, you'd use a job queue like Bull/Redis
        return res.json({ 
          message: "Campaign scheduled successfully",
          scheduledFor: scheduleAt,
          leadsCount: campaignLeads.length,
          templatesCount: templates.length
        });
      }

      // Execute immediately - send first email to all leads
      const firstTemplate = templates[0];
      const emails = campaignLeads.map(lead => ({
        to: [lead.email],
        subject: firstTemplate.subject || campaign.name,
        htmlContent: firstTemplate.content || 'Email content unavailable',
        fromName: 'AutoCampaigns AI',
      }));

      const results = await sendBulkEmails(emails);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      // Create conversation entries for successful sends
      for (let i = 0; i < campaignLeads.length; i++) {
        if (results[i]?.success) {
          const lead = campaignLeads[i];
          await storage.createConversation({
            subject: `Campaign: ${campaign.name}`,
            leadId: lead.id,
            status: 'active',
            priority: 'normal',
            campaignId: campaignId,
            lastActivity: new Date(),
          });
        }
      }

      // Update campaign metrics
      await storage.updateCampaign(campaignId, {
        emailsSent: (campaign.emailsSent || 0) + successful,
        lastExecuted: new Date()
      });

      res.json({
        message: "Campaign executed successfully",
        successful,
        failed,
        total: campaignLeads.length,
        results: testMode ? results : undefined
      });

    } catch (error) {
      console.error('Campaign execution error:', error);
      res.status(500).json({ message: "Failed to execute campaign" });
    }
  });

  app.post("/api/campaigns/:id/send-followup", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { templateIndex = 1, leadIds } = req.body;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      let templates: any[] = [];
      try {
        templates = JSON.parse(campaign.templates || '[]');
      } catch (error) {
        return res.status(400).json({ message: "Invalid email templates" });
      }

      if (!templates[templateIndex]) {
        return res.status(400).json({ message: "Template index out of range" });
      }

      // Get specific leads or all campaign leads
      let targetLeads;
      if (leadIds && Array.isArray(leadIds)) {
        targetLeads = await Promise.all(
          leadIds.map(id => storage.getLead(id))
        );
        targetLeads = targetLeads.filter(Boolean);
      } else {
        const allLeads = await storage.getLeads();
        targetLeads = allLeads.filter(lead => lead.campaignId === campaignId);
      }

      if (targetLeads.length === 0) {
        return res.status(400).json({ message: "No target leads found" });
      }

      const template = templates[templateIndex];
      const emails = targetLeads.map(lead => ({
        to: [lead.email],
        subject: template.subject || `${campaign.name} - Follow-up`,
        htmlContent: template.content || 'Follow-up email content',
        fromName: 'AutoCampaigns AI',
      }));

      const results = await sendBulkEmails(emails);
      const successful = results.filter(r => r.success).length;

      // Update campaign metrics
      await storage.updateCampaign(campaignId, {
        emailsSent: (campaign.emailsSent || 0) + successful,
        lastExecuted: new Date()
      });

      res.json({
        message: "Follow-up emails sent successfully",
        successful,
        failed: results.filter(r => !r.success).length,
        templateUsed: templateIndex + 1
      });

    } catch (error) {
      console.error('Follow-up send error:', error);
      res.status(500).json({ message: "Failed to send follow-up emails" });
    }
  });

  app.get("/api/campaigns/:id/analytics", async (req, res) => {
    try {
      const campaignId = req.params.id;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Get campaign-related data
      const allLeads = await storage.getLeads();
      const campaignLeads = allLeads.filter(lead => lead.campaignId === campaignId);
      
      const conversations = await storage.getConversations();
      const campaignConversations = conversations.filter(conv => conv.campaignId === campaignId);

      const analytics = {
        campaign: {
          name: campaign.name,
          status: campaign.status,
          emailsSent: campaign.emailsSent || 0,
          lastExecuted: campaign.lastExecuted,
          createdAt: campaign.createdAt
        },
        leads: {
          total: campaignLeads.length,
          byStatus: {
            new: campaignLeads.filter(l => l.status === 'new').length,
            contacted: campaignLeads.filter(l => l.status === 'contacted').length,
            qualified: campaignLeads.filter(l => l.status === 'qualified').length,
            converted: campaignLeads.filter(l => l.status === 'converted').length,
            lost: campaignLeads.filter(l => l.status === 'lost').length,
          }
        },
        conversations: {
          total: campaignConversations.length,
          active: campaignConversations.filter(c => c.status === 'active').length,
          closed: campaignConversations.filter(c => c.status === 'closed').length,
        },
        engagement: {
          responseRate: campaignLeads.length > 0 ? (campaignConversations.length / campaignLeads.length * 100).toFixed(1) : '0',
          conversionRate: campaignLeads.length > 0 ? (campaignLeads.filter(l => l.status === 'converted').length / campaignLeads.length * 100).toFixed(1) : '0'
        }
      };

      res.json(analytics);

    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ message: "Failed to get campaign analytics" });
    }
  });

  app.post("/api/sms/validate-phone", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const result = await validatePhoneNumber(phoneNumber);
      res.json(result);
    } catch (error) {
      console.error('Phone validation error:', error);
      res.status(500).json({ message: "Failed to validate phone number" });
    }
  });

  // User role management routes
  app.put("/api/users/:id/role", async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["admin", "manager", "user"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }
      
      const user = await storage.updateUserRole(req.params.id, role);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const { userId } = req.query;
      const conversations = await storage.getConversations(userId as string);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
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

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: "Invalid conversation data" });
    }
  });

  app.put("/api/conversations/:id", async (req, res) => {
    try {
      const conversationData = insertConversationSchema.partial().parse(req.body);
      const conversation = await storage.updateConversation(req.params.id, conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: "Failed to update conversation" });
    }
  });

  // Conversation message routes
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messageData = insertConversationMessageSchema.parse({
        ...req.body,
        conversationId: req.params.id,
      });
      const message = await storage.createConversationMessage(messageData);
      
      // Update conversation timestamp
      await storage.updateConversation(req.params.id, { status: "active" });
      
      res.json(message);
    } catch (error) {
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  // AI Chat Campaign route
  app.post("/api/ai/chat-campaign", async (req, res) => {
    try {
      const { message, currentStep, campaignData } = req.body;
      
      // AI chat logic for campaign creation
      const response = await processCampaignChat(message, currentStep, campaignData);
      
      res.json(response);
    } catch (error) {
      console.error('AI chat campaign error:', error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Lead management routes
  // const upload = multer({ storage: multer.memoryStorage() });

  // Get all leads or leads for a specific campaign
  app.get("/api/leads", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const leads = await storage.getLeads(campaignId);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Get a specific lead
  app.get("/api/leads/:id", async (req, res) => {
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

  // Create a new lead
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  // Update a lead
  app.put("/api/leads/:id", async (req, res) => {
    try {
      const leadData = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(req.params.id, leadData);
      res.json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  // Delete a lead
  app.delete("/api/leads/:id", async (req, res) => {
    try {
      await storage.deleteLead(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // CSV upload endpoint (temporarily disabled until packages are installed)
  app.post("/api/leads/upload-csv", async (req, res) => {
    res.status(501).json({ message: "CSV upload feature coming soon" });
  });

  // Bulk create leads via API
  app.post("/api/leads/bulk", async (req, res) => {
    try {
      const leadsData = req.body.leads.map((lead: any) => insertLeadSchema.parse(lead));
      const createdLeads = await storage.createLeads(leadsData);
      res.json({
        message: `Successfully created ${createdLeads.length} leads`,
        leads: createdLeads
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid leads data" });
    }
  });

  // AI Agent Configuration routes
  app.get("/api/ai-agent-configs", async (req, res) => {
    try {
      const configs = await storage.getAiAgentConfigs();
      res.json(configs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch AI agent configurations" });
    }
  });

  app.get("/api/ai-agent-configs/active", async (req, res) => {
    try {
      const activeConfig = await storage.getActiveAiAgentConfig();
      res.json(activeConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active AI agent configuration" });
    }
  });

  app.get("/api/ai-agent-configs/:id", async (req, res) => {
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

  app.post("/api/ai-agent-configs", async (req, res) => {
    try {
      const configData = insertAiAgentConfigSchema.parse(req.body);
      const config = await storage.createAiAgentConfig(configData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid AI agent configuration data" });
    }
  });

  app.put("/api/ai-agent-configs/:id", async (req, res) => {
    try {
      const configData = insertAiAgentConfigSchema.partial().parse(req.body);
      const config = await storage.updateAiAgentConfig(req.params.id, configData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Failed to update AI agent configuration" });
    }
  });

  app.delete("/api/ai-agent-configs/:id", async (req, res) => {
    try {
      await storage.deleteAiAgentConfig(req.params.id);
      res.json({ message: "AI agent configuration deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete AI agent configuration" });
    }
  });

  app.post("/api/ai-agent-configs/:id/activate", async (req, res) => {
    try {
      const activeConfig = await storage.setActiveAiAgentConfig(req.params.id);
      res.json(activeConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to activate AI agent configuration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
