import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertConversationSchema, insertConversationMessageSchema, insertLeadSchema, insertAiAgentConfigSchema, insertClientSchema, type AiAgentConfig, type Client } from "@shared/schema";
import { suggestCampaignGoals, enhanceEmailTemplates, generateSubjectLines, suggestCampaignNames, generateEmailTemplates } from "./services/openai";
import { processCampaignChat } from "./services/ai-chat";
import { sendCampaignEmail, sendBulkEmails, validateEmailAddresses } from "./services/mailgun";
import { mailgunService } from "./services/email/mailgun-service";
import { sendSMS, sendCampaignAlert, validatePhoneNumber } from "./services/twilio";
import { campaignScheduler } from "./services/campaign-scheduler";
import { smsIntegration } from "./services/sms-integration";
import { tenantMiddleware, type TenantRequest } from "./tenant";
import { db } from "./db";
import { clients } from "@shared/schema";
import { eq } from "drizzle-orm";
import { webSocketService } from "./services/websocket";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { CSVValidationService } from "./services/csv/csv-validation";
import notificationRoutes from "./routes/notifications";
import deliverabilityRoutes from "./routes/deliverability";
import aiConversationRoutes from "./routes/ai-conversation";
import { leadScoringService } from "./services/lead-scoring";
import { predictiveOptimizationService } from "./services/predictive-optimization";
import { dynamicResponseIntelligenceService } from "./services/dynamic-response-intelligence";


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
          name: 'OneKeel Swarm',
          brandingConfig: {
            primaryColor: '#2563eb',
            secondaryColor: '#1e40af',
            logoUrl: '',
            companyName: 'OneKeel Swarm',
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

  // Update only templates/subjects (lightweight editing endpoint)
  app.put("/api/campaigns/:id/templates", async (req, res) => {
    try {
      const { templates, subjectLines, numberOfTemplates, daysBetweenMessages } = req.body;
      if (!templates || !Array.isArray(templates)) {
        return res.status(400).json({ message: "templates array required" });
      }
      const campaign = await storage.updateCampaign(req.params.id, {
        templates: templates as any,
        subjectLines: subjectLines as any,
        numberOfTemplates,
        daysBetweenMessages
      });
      res.json({ message: 'Templates updated', campaign });
    } catch (error) {
      console.error('Update templates error:', error);
      res.status(500).json({ message: 'Failed to update templates' });
    }
  });

  // Launch endpoint (activates campaign & executes immediately unless schedule provided)
  app.post("/api/campaigns/:id/launch", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

      // Basic readiness checks
      if (!campaign.templates || (Array.isArray(campaign.templates) ? campaign.templates.length === 0 : false)) {
        // try parse if stored as JSON string
        try {
          const parsed = typeof campaign.templates === 'string' ? JSON.parse(campaign.templates as any) : [];
          if (!parsed || parsed.length === 0) return res.status(400).json({ message: 'No templates available to send' });
        } catch {
          return res.status(400).json({ message: 'Invalid templates format' });
        }
      }

      // Update status to active
  await storage.updateCampaign(campaignId, { status: 'active' as any });

      // Execute via orchestrator
      const { CampaignOrchestrator } = await import('./services/campaign-execution/CampaignOrchestrator');
      const orchestrator = new CampaignOrchestrator();
      const result = await orchestrator.executeCampaign({ campaignId, testMode: false });
      res.json({ message: 'Campaign launched', execution: result });
    } catch (error) {
      console.error('Launch campaign error:', error);
      res.status(500).json({ message: 'Failed to launch campaign' });
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

      const result = await sendCampaignEmail(
        to as string,
        subject,
        htmlContent,
        textContent || '',
        fromName || 'AutoCampaigns AI'
      );
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
      const { message, customCriteria, sendEmail = false } = req.body;

      // Get conversation from storage
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const { HandoverService } = await import('./services/handover-service');
      const evaluation = await HandoverService.evaluateHandover(
        id,
        conversation,
        message,          // { role: 'agent' | 'lead', content: string }
        customCriteria
      );
      
      // If handover is triggered and email is requested, process the handover
      if (evaluation.shouldHandover && sendEmail) {
        // Get additional data for handover email
        const allLeads = await storage.getLeads();
        const lead = conversation.leadId ? allLeads.find(l => l.id === conversation.leadId) : null;
        
        const allCampaigns = await storage.getCampaigns();
        const campaign = conversation.campaignId ? 
          allCampaigns.find(c => c.id === conversation.campaignId) : null;
        
        await HandoverService.processHandover(
          id,
          evaluation,
          HandoverService.getDefaultCriteria(),
          {
            lead,
            conversation,
            campaignName: campaign?.name
          }
        );
      }
      
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

  // Generate campaign creation prompt
  app.post("/api/ai/campaign-prompt", async (req, res) => {
    try {
      const { userInput, campaignType, urgency } = req.body;
      
      const { CampaignPromptService } = await import('./services/campaign-prompts');
      const prompt = CampaignPromptService.generateContextualPrompt(userInput, campaignType, urgency);
      
      res.json({ prompt });
    } catch (error) {
      console.error('Campaign prompt generation error:', error);
      res.status(500).json({ message: "Failed to generate campaign prompt" });
    }
  });

  // Analyze user intent for campaign creation
  app.post("/api/ai/analyze-campaign-intent", async (req, res) => {
    try {
      const { message } = req.body;
      
      const { CampaignPromptService } = await import('./services/campaign-prompts');
      const intent = CampaignPromptService.parseUserIntent(message);
      const guidance = CampaignPromptService.generateResponseGuidance(intent);
      
      res.json({ intent, guidance });
    } catch (error) {
      console.error('Campaign intent analysis error:', error);
      res.status(500).json({ message: "Failed to analyze campaign intent" });
    }
  });

  // Generate enhanced system prompt with conversation enhancers
  app.post("/api/ai/enhanced-system-prompt", async (req, res) => {
    try {
      const { 
        messageContent, 
        leadName, 
        vehicleInterest, 
        previousMessages, 
        season, 
        brand, 
        isReEngagement, 
        useStraightTalkingStyle 
      } = req.body;
      
      const { AutomotivePromptService } = await import('./services/automotive-prompts');
      
      const context = AutomotivePromptService.createConversationContext(
        leadName,
        vehicleInterest,
        messageContent,
        previousMessages
      );
      
      const config = AutomotivePromptService.getDefaultDealershipConfig();
      
      const enhancedPrompt = AutomotivePromptService.generateEnhancedSystemPrompt(
        config,
        context,
        {
          season,
          brand,
          isReEngagement,
          useStraightTalkingStyle
        }
      );
      
      res.json({ prompt: enhancedPrompt, context });
    } catch (error) {
      console.error('Enhanced system prompt generation error:', error);
      res.status(500).json({ message: "Failed to generate enhanced system prompt" });
    }
  });

  // Get conversation enhancers for specific context
  app.post("/api/ai/conversation-enhancers", async (req, res) => {
    try {
      const { messageContent, leadName, vehicleInterest, season, brand, isReEngagement } = req.body;
      
      const { AutomotivePromptService } = await import('./services/automotive-prompts');
      
      const context = AutomotivePromptService.createConversationContext(
        leadName,
        vehicleInterest,
        messageContent
      );
      
      const enhancers = AutomotivePromptService.applyConversationEnhancers(
        context,
        season,
        brand,
        isReEngagement
      );
      
      res.json({ enhancers, context });
    } catch (error) {
      console.error('Conversation enhancers error:', error);
      res.status(500).json({ message: "Failed to get conversation enhancers" });
    }
  });

  // CSV upload configuration (enhanced version available in lead management section)
  const basicUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });

  // CSV upload endpoint for leads (basic version)
  app.post("/api/leads/upload-csv-basic", basicUpload.single('file'), async (req: TenantRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const leads = [];
      const errors = [];

      for (let index = 0; index < records.length; index++) {
        const record = records[index] as any;
        try {
          const leadData = {
            email: record.email || record.Email || '',
            firstName: record.firstName || record['First Name'] || record.first_name || '',
            lastName: record.lastName || record['Last Name'] || record.last_name || '',
            phone: record.phone || record.Phone || record.phoneNumber || '',
            vehicleInterest: record.vehicleInterest || record['Vehicle Interest'] || record.vehicle || '',
            leadSource: record.leadSource || record.source || 'csv_import',
            status: record.status || 'new',
            campaignId: req.body.campaignId || null,
            clientId: req.clientId
          };

          if (!leadData.email) {
            errors.push(`Row ${index + 1}: Email is required`);
            continue;
          }

          leads.push(leadData);
        } catch (error) {
          errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
        }
      }

      if (leads.length === 0) {
        return res.status(400).json({ message: "No valid leads found", errors });
      }

      const createdLeads = await storage.createLeads(leads);
      
      // Broadcast new leads via WebSocket
      createdLeads.forEach(lead => {
        webSocketService.broadcastNewLead(lead);
      });

      res.json({ 
        message: "CSV uploaded successfully", 
        leads: createdLeads,
        errors: errors.length > 0 ? errors : null
      });
    } catch (error) {
      console.error('CSV upload error:', error);
      res.status(500).json({ message: "Failed to process CSV file" });
    }
  });

  // Simple webhook endpoints
  app.post("/api/webhooks/mailgun/inbound", async (req, res) => {
    try {
      const { InboundEmailService } = await import('./services/inbound-email');
      await InboundEmailService.handleInboundEmail(req, res);
    } catch (error) {
      console.error('Mailgun inbound webhook error:', error);
      res.status(500).json({ error: 'Failed to process inbound email' });
    }
  });

  // Email Monitor Routes
  const emailRules = [
    {
      id: "automotive-inquiry",
      name: "Automotive Inquiry Detector",
      enabled: true,
      conditions: {
        subject: "test drive|vehicle|car|auto|dealership",
        body: "interested|pricing|quote|appointment"
      },
      actions: {
        createLead: true,
        setSource: "email_inquiry",
        setPriority: "normal",
        autoRespond: true
      }
    },
    {
      id: "urgent-service",
      name: "Urgent Service Request",
      enabled: true,
      conditions: {
        subject: "urgent|emergency|asap|immediate",
        body: "service|repair|maintenance|problem"
      },
      actions: {
        createLead: true,
        setSource: "service_request",
        setPriority: "urgent",
        autoRespond: true
      }
    }
  ];

  // Get email monitoring status (Enhanced)
  app.get("/api/email-monitor/status", async (req, res) => {
    try {
      const { enhancedEmailMonitor } = await import('./services/enhanced-email-monitor');
      const status = enhancedEmailMonitor.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Email monitor status error:', error);
      res.status(500).json({ message: "Failed to get email monitor status" });
    }
  });

  // Get email monitoring rules (Enhanced)
  app.get("/api/email-monitor/rules", async (req, res) => {
    try {
      const { enhancedEmailMonitor } = await import('./services/enhanced-email-monitor');
      const rules = enhancedEmailMonitor.getTriggerRules();
      res.json(rules);
    } catch (error) {
      console.error('Email monitor rules error:', error);
      res.status(500).json({ message: "Failed to get email monitor rules" });
    }
  });

  // Start/stop monitoring (placeholder)
  app.post("/api/email-monitor/start", async (req, res) => {
    res.json({ message: "Email monitor started successfully" });
  });

  app.post("/api/email-monitor/stop", async (req, res) => {
    res.json({ message: "Email monitor stopped successfully" });
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
  // Execute campaign (Enhanced with Orchestrator)
  app.post("/api/campaigns/:id/execute", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { scheduleAt, testMode = false, selectedLeadIds, maxLeadsPerBatch = 50 } = req.body;
      
      const { CampaignOrchestrator } = await import('./services/campaign-execution/CampaignOrchestrator');
      const campaignOrchestrator = new CampaignOrchestrator();
      
      const executionOptions = {
        campaignId,
        testMode,
        scheduleAt: scheduleAt ? new Date(scheduleAt) : undefined,
        selectedLeadIds,
        maxLeadsPerBatch
      };

      const result = await campaignOrchestrator.executeCampaign(executionOptions);
      
      res.json(result);

    } catch (error) {
      console.error('Campaign execution error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to execute campaign",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
        templates = JSON.parse(campaign.templates as string || '[]');
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
        to: lead!.email,
        subject: template.subject || `${campaign.name} - Follow-up`,
        content: template.content || 'Follow-up email content'
      }));

      const results = await sendBulkEmails(emails);
      const successful = results.success || [];

      // Update campaign metrics - note: using status field instead of non-existent emailsSent
      await storage.updateCampaign(campaignId, {
        status: 'sent'
      });

      res.json({
        message: "Follow-up emails sent successfully",
        successful: Array.isArray(successful) ? successful.length : 0,
        failed: Array.isArray(results.failed) ? results.failed.length : (typeof results.failed === 'number' ? results.failed : 0),
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
          emailsSent: 0, // Note: emailsSent property doesn't exist in schema
          lastExecuted: null, // Note: lastExecuted property doesn't exist in schema
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
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const { CampaignChatService } = await import('./services/campaign-chat');
      const response = await CampaignChatService.processCampaignChat(
        message, 
        currentStep || 'context', 
        campaignData || {}
      );
      
      // If campaign is completed, create it in storage
      if (response.completed && response.data) {
        const campaignToCreate = insertCampaignSchema.parse({
          name: response.data.name,
          context: response.data.context,
          handoverGoals: response.data.handoverGoals,
          targetAudience: response.data.targetAudience,
          handoverPrompt: response.data.handoverPrompt,
          numberOfTemplates: response.data.numberOfTemplates || 5,
          daysBetweenMessages: response.data.daysBetweenMessages || 3,
          templates: response.data.templates || [],
          subjectLines: response.data.subjectLines || [],
          status: 'draft'
        });

        const createdCampaign = await storage.createCampaign(campaignToCreate);
        response.data.id = createdCampaign.id;
      }
      
      res.json({
        message: response.message,
        nextStep: response.nextStep,
        campaignData: response.data,
        isComplete: response.completed,
        actions: response.actions,
        suggestions: response.suggestions,
        progress: response.progress
      });
    } catch (error) {
      console.error('AI chat campaign error:', error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Lead management routes
  // Configure multer for CSV uploads with security validation
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    }
  });

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

  // Backward-compatible alias used by older client bundles
  app.get("/api/leads/all", async (req, res) => {
    try {
      const leads = await storage.getLeads();
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

  // Campaign-specific CSV lead upload
  app.post("/api/campaigns/:id/leads/upload", upload.single('file'), async (req: TenantRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

      const fileContent = req.file.buffer.toString('utf-8');
      const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
      const required = ['email'];
      const leadsData: any[] = [];
      const errors: string[] = [];
      records.forEach((record: any, idx: number) => {
        const email = record.email || record.Email;
        if (!email) { errors.push(`Row ${idx+1}: missing email`); return; }
        leadsData.push({
          email,
          firstName: record.first_name || record.firstName || record['First Name'] || '',
          lastName: record.last_name || record.lastName || record['Last Name'] || '',
          phone: record.phone || '',
          vehicleInterest: record.vehicleInterest || record.vehicle_interest || record.vehicle || '',
          leadSource: record.leadSource || 'csv_import',
          status: 'new',
          campaignId,
          clientId: req.clientId
        });
      });
      if (leadsData.length === 0) return res.status(400).json({ message: 'No valid leads', errors });
      const createdLeads = await storage.createLeads(leadsData as any);
      res.json({ message: 'Leads uploaded', total: createdLeads.length, sample: createdLeads.slice(0,5), errors: errors.length?errors:undefined });
    } catch (error) {
      console.error('Campaign lead upload error:', error);
      res.status(500).json({ message: 'Failed to upload leads' });
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



  // Enhanced CSV Upload with Security Validation
  app.post("/api/leads/upload-csv", upload.single('file'), async (req: TenantRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          message: "No file uploaded" 
        });
      }

      const campaignId = req.body.campaignId;

      // Validate CSV with comprehensive security checks
      const validationResult = await CSVValidationService.validateCSV(
        req.file.buffer,
        {
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxRows: 5000,
          requireColumns: ['firstName', 'lastName', 'email'],
          sanitizeData: true
        }
      );

      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          message: "CSV validation failed",
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          stats: validationResult.stats
        });
      }

      // Create leads from validated data
      const leadsData = validationResult.data!.map((lead: any) => ({
        ...lead,
        campaignId: campaignId || null,
        status: 'new' as const,
        source: 'csv_upload',
        clientId: req.clientId
      }));

      const createdLeads = await storage.createLeads(leadsData);

      // Send WebSocket notification
      webSocketService.broadcast('leadsUploaded', {
        count: createdLeads.length,
        campaignId,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: `Successfully uploaded ${createdLeads.length} leads`,
        leads: createdLeads,
        validationReport: CSVValidationService.generateValidationReport(validationResult),
        stats: validationResult.stats
      });

    } catch (error) {
      console.error('CSV upload error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to process CSV upload",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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

  // Execution monitoring routes
  app.get("/api/executions", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor');
      const executions = executionMonitor.getActiveExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active executions" });
    }
  });

  app.get("/api/executions/history", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor');
      const limit = parseInt(req.query.limit as string) || 20;
      const history = executionMonitor.getExecutionHistory(limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution history" });
    }
  });

  app.get("/api/executions/stats", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor');
      const stats = executionMonitor.getExecutionStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution statistics" });
    }
  });

  app.get("/api/executions/:id", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor');
      const execution = executionMonitor.getExecutionStatus(req.params.id);
      if (!execution) {
        return res.status(404).json({ message: "Execution not found" });
      }
      res.json(execution);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution details" });
    }
  });

  app.post("/api/executions/:id/cancel", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor');
      const cancelled = executionMonitor.cancelExecution(req.params.id);
      if (!cancelled) {
        return res.status(400).json({ message: "Execution cannot be cancelled" });
      }
      res.json({ message: "Execution cancelled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel execution" });
    }
  });

  // User notification system routes
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/deliverability', deliverabilityRoutes);
  app.use('/api/ai', aiConversationRoutes);
  
  // Health check routes
  const healthRoutes = await import('./routes/health');
  app.use('/api/health', healthRoutes.default);
  
  // IMAP health check
  const imapHealthRoutes = await import('./routes/health-imap');
  app.use('/api/health', imapHealthRoutes.default);

  // Agent runtime routes
  const agentRoutes = await import('./routes/agent');
  app.use('/api/agent', agentRoutes.default);

  // SMS Integration Routes
  app.post("/api/sms/opt-in", async (req, res) => {
    try {
      const { leadId, campaignId, optInMessage } = req.body;
      const success = await smsIntegration.sendOptInRequest(leadId, campaignId, optInMessage);
      res.json({ success });
    } catch (error) {
      console.error('SMS opt-in error:', error);
      res.status(500).json({ message: "Failed to send SMS opt-in" });
    }
  });

  app.post("/api/sms/opt-in-response", async (req, res) => {
    try {
      const { phoneNumber, response } = req.body;
      const optedIn = await smsIntegration.processOptInResponse(phoneNumber, response);
      res.json({ optedIn });
    } catch (error) {
      console.error('SMS opt-in response error:', error);
      res.status(500).json({ message: "Failed to process SMS opt-in response" });
    }
  });

  app.get("/api/leads/:id/sms-status", async (req, res) => {
    try {
      const status = await smsIntegration.getSMSStatus(req.params.id);
      res.json(status);
    } catch (error) {
      console.error('SMS status error:', error);
      res.status(500).json({ message: "Failed to get SMS status" });
    }
  });

  // Campaign Scheduling Routes
  app.post("/api/campaigns/:id/schedule", async (req, res) => {
    try {
      const { scheduleType, scheduledStart, recurringPattern, recurringDays, recurringTime } = req.body;
      
      const scheduleConfig = {
        scheduleType,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : undefined,
        recurringPattern,
        recurringDays,
        recurringTime
      };

      const nextExecution = await campaignScheduler.scheduleCampaign(req.params.id, scheduleConfig);
      res.json({ success: true, nextExecution });
    } catch (error) {
      console.error('Campaign scheduling error:', error);
      res.status(500).json({ message: "Failed to schedule campaign" });
    }
  });

  app.get("/api/campaigns/:id/schedule", async (req, res) => {
    try {
      const schedule = await campaignScheduler.getCampaignSchedule(req.params.id);
      res.json(schedule);
    } catch (error) {
      console.error('Get campaign schedule error:', error);
      res.status(500).json({ message: "Failed to get campaign schedule" });
    }
  });

  app.delete("/api/campaigns/:id/schedule", async (req, res) => {
    try {
      await campaignScheduler.cancelScheduledCampaign(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Cancel campaign schedule error:', error);
      res.status(500).json({ message: "Failed to cancel campaign schedule" });
    }
  });

  app.post("/api/campaigns/:id/execute-now", async (req, res) => {
    try {
      const result = await campaignScheduler.executeCampaign(req.params.id);
      res.json(result);
    } catch (error) {
      console.error('Execute campaign error:', error);
      res.status(500).json({ message: "Failed to execute campaign" });
    }
  });

  // Intelligence System API Routes
  
  // Lead Scoring Routes
  app.get("/api/intelligence/lead-scoring/:leadId", async (req: TenantRequest, res) => {
    try {
      const { leadId } = req.params;
      const { profileId } = req.query;
      
      const score = await leadScoringService.calculateLeadScore(leadId, profileId as string);
      res.json(score);
    } catch (error) {
      console.error('Lead scoring error:', error);
      res.status(500).json({ message: "Failed to calculate lead score" });
    }
  });

  app.post("/api/intelligence/lead-scoring/bulk", async (req: TenantRequest, res) => {
    try {
      const { profileId } = req.body;
      
      const scores = await leadScoringService.bulkScoreLeads(profileId);
      res.json(scores);
    } catch (error) {
      console.error('Bulk lead scoring error:', error);
      res.status(500).json({ message: "Failed to calculate bulk lead scores" });
    }
  });

  // List scoring profiles for UI
  app.get("/api/intelligence/scoring-profiles", async (_req: TenantRequest, res) => {
    try {
      const profiles = leadScoringService.getScoringProfiles();
      res.json(profiles);
    } catch (error) {
      console.error('List scoring profiles error:', error);
      res.status(500).json({ message: "Failed to list scoring profiles" });
    }
  });

  app.post("/api/intelligence/scoring-profiles", async (req: TenantRequest, res) => {
    try {
      const profileData = req.body;

      const profile = await leadScoringService.createScoringProfile(profileData);
      res.json(profile);
    } catch (error) {
      console.error('Create scoring profile error:', error);
      res.status(500).json({ message: "Failed to create scoring profile" });
    }
  });

  // Predictive Optimization Routes
  app.get("/api/intelligence/predictive/insights", async (req: TenantRequest, res) => {
    try {
      const insights = await predictiveOptimizationService.getPredictiveInsights();
      res.json(insights);
    } catch (error) {
      console.error('Predictive insights error:', error);
      res.status(500).json({ message: "Failed to get predictive insights" });
    }
  });

  app.get("/api/intelligence/predictive/recommendations", async (req: TenantRequest, res) => {
    try {
      const { campaignId } = req.query;
      
      const recommendations = await predictiveOptimizationService.generateOptimizationRecommendations(campaignId as string);
      res.json(recommendations);
    } catch (error) {
      console.error('Predictive recommendations error:', error);
      res.status(500).json({ message: "Failed to generate optimization recommendations" });
    }
  });

  app.get("/api/intelligence/predictive/performance", async (req: TenantRequest, res) => {
    try {
      const performanceData = await predictiveOptimizationService.analyzeHistoricalPerformance();
      res.json(performanceData);
    } catch (error) {
      console.error('Performance analysis error:', error);
      res.status(500).json({ message: "Failed to analyze performance data" });
    }
  });

  // Dynamic Response Intelligence Routes
  app.get("/api/intelligence/conversation/:conversationId/analysis", async (req: TenantRequest, res) => {
    try {
      const { conversationId } = req.params;
      
      const analysis = await dynamicResponseIntelligenceService.analyzeConversation(conversationId);
      res.json(analysis);
    } catch (error) {
      console.error('Conversation analysis error:', error);
      res.status(500).json({ message: "Failed to analyze conversation" });
    }
  });

  app.get("/api/intelligence/conversation/active-analysis", async (req: TenantRequest, res) => {
    try {
      const analyses = await dynamicResponseIntelligenceService.analyzeAllActiveConversations();
      res.json(analyses);
    } catch (error) {
      console.error('Active conversations analysis error:', error);
      res.status(500).json({ message: "Failed to analyze active conversations" });
    }
  });

  app.get("/api/intelligence/conversation/escalation-candidates", async (req: TenantRequest, res) => {
    try {
      const candidates = await dynamicResponseIntelligenceService.getEscalationCandidates();
      res.json(candidates);
    } catch (error) {
      console.error('Escalation candidates error:', error);
      res.status(500).json({ message: "Failed to get escalation candidates" });
    }
  });

  app.post("/api/intelligence/conversation/learn", async (req: TenantRequest, res) => {
    try {
      await dynamicResponseIntelligenceService.learnFromSuccessfulConversations();
      res.json({ success: true, message: "Learning completed successfully" });
    } catch (error) {
      console.error('Conversation learning error:', error);
      res.status(500).json({ message: "Failed to learn from conversations" });
    }
  });

  // Combined Intelligence Dashboard Route
  app.get("/api/intelligence/dashboard", async (req: TenantRequest, res) => {
    try {
      const [
        leadScores,
        predictiveInsights,
        conversationAnalyses,
        escalationCandidates
      ] = await Promise.all([
        leadScoringService.bulkScoreLeads(),
        predictiveOptimizationService.getPredictiveInsights(),
        dynamicResponseIntelligenceService.analyzeAllActiveConversations(),
        dynamicResponseIntelligenceService.getEscalationCandidates()
      ]);

      const dashboard = {
        leadScoring: {
          totalLeads: leadScores.length,
          hotLeads: leadScores.filter(s => s.priority === 'hot').length,
          warmLeads: leadScores.filter(s => s.priority === 'warm').length,
          coldLeads: leadScores.filter(s => s.priority === 'cold').length,
          averageScore: leadScores.reduce((acc, s) => acc + s.totalScore, 0) / leadScores.length || 0,
          topScores: leadScores.slice(0, 10)
        },
        predictiveOptimization: {
          insights: predictiveInsights,
          recommendationCount: (await predictiveOptimizationService.generateOptimizationRecommendations()).length
        },
        conversationIntelligence: {
          totalConversations: conversationAnalyses.length,
          escalationCount: escalationCandidates.length,
          highUrgency: conversationAnalyses.filter(a => a.urgency === 'high' || a.urgency === 'critical').length,
          readyToBuy: conversationAnalyses.filter(a => a.intent === 'ready_to_buy').length,
          averageConfidence: conversationAnalyses.reduce((acc, a) => acc + a.confidence, 0) / conversationAnalyses.length || 0
        }
      };

      res.json(dashboard);
    } catch (error) {
      console.error('Intelligence dashboard error:', error);
      res.status(500).json({ message: "Failed to generate intelligence dashboard" });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  webSocketService.initialize(httpServer);

  return httpServer;
}
