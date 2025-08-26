import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertConversationSchema, insertConversationMessageSchema, insertLeadSchema, insertAiAgentConfigSchema, insertClientSchema, type AiAgentConfig, type Client } from "@shared/schema";

import { sendCampaignEmail, sendBulkEmails, validateEmailAddresses } from "./services/mailgun";
// NOTE: There are two Mailgun integrations in this codebase:
//  1) ./services/mailgun (returns { success, sent, failed, errors })
//  2) ./services/email/mailgun-service (class-based, returns { sent, failed, errors } for bulk)
// Be careful not to mix return shapes across endpoints.
import { mailgunService } from "./services/email/mailgun-service";
import { campaignScheduler } from "./services/campaign-scheduler";
import { tenantMiddleware, type TenantRequest } from "./tenant";
import { db } from "./db";
import { clients } from "@shared/schema";
import { eq } from "drizzle-orm";
import { webSocketService } from "./services/websocket";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { CSVValidationService } from "./services/csv/csv-validation";


export async function registerRoutes(app: Express): Promise<Server> {


  // Apply tenant middleware to all API routes
  app.use('/api', tenantMiddleware);

  // DIAGNOSTIC: Basic server test (no database, no dependencies)
  app.get('/api/debug/ping', (req, res) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      databaseUrl: process.env.DATABASE_URL ? 'present' : 'missing',
      renderEnvironment: process.env.RENDER ? 'true' : 'false'
    });
  });

  // DIAGNOSTIC: Test database connection
  app.get('/api/debug/database', async (req, res) => {
    try {
      const testQuery = await db.select().from(clients).limit(1);
      res.json({
        status: 'connected',
        timestamp: new Date().toISOString(),
        clientsTable: 'accessible',
        sampleRecordCount: testQuery.length
      });
    } catch (error) {
      console.error('Database diagnostic error:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

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
          name: 'OfferLogix',
          brandingConfig: {
            primaryColor: '#009CA6',
            secondaryColor: '#F58220',
            logoUrl: '',
            companyName: 'OfferLogix',
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
  const insertedClients = await db.insert(clients).values(clientData).returning();
  const client = Array.isArray(insertedClients) ? insertedClients[0] : insertedClients as any;
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

      // Normalize templates into { subject, content }
      let normalized = templates as any[];
      if (normalized.length && typeof normalized[0] === 'string') {
        normalized = (normalized as string[]).map((s) => ({ subject: String(s).slice(0, 80), content: String(s) }));
      } else if (normalized.length && typeof normalized[0] === 'object') {
        normalized = (normalized as any[]).map((t) => ({
          subject: typeof t.subject === 'string' && t.subject.trim()
            ? String(t.subject).slice(0, 140)
            : typeof t.title === 'string' && t.title.trim()
              ? String(t.title).slice(0, 140)
              : 'Untitled',
          content: typeof t.content === 'string' && t.content.trim()
            ? String(t.content)
            : typeof t.html === 'string' && t.html.trim()
              ? String(t.html)
              : typeof t.body === 'string' && t.body.trim()
                ? String(t.body)
                : typeof t.text === 'string' && t.text.trim()
                  ? String(t.text)
                  : ''
        }));
      }

      const campaign = await storage.updateCampaign(req.params.id, {
        templates: normalized as any,
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
      const { CampaignOrchestrator } = await import('./services/campaign-execution/CampaignOrchestrator.js');
      const orchestrator = new CampaignOrchestrator();
      const result = await orchestrator.executeCampaign({ campaignId, testMode: false });
      res.json({ message: 'Campaign launched', execution: result });
    } catch (error) {
      console.error('Launch campaign error:', error);
      res.status(500).json({ message: 'Failed to launch campaign' });
    }
  });



  // Templates generation
  const templateRoutes = await import('./routes/templates');
  app.use('/api/templates', templateRoutes.default);

  // Unsubscribe routes (for email deliverability compliance)
  const unsubscribeRoutes = await import('./routes/unsubscribe');
  app.use('/', unsubscribeRoutes.default);

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
        fromName || 'OfferLogix'
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

      const { emailWatchdog } = await import('./services/email-validator.js');
      const validation = await emailWatchdog.validateOutboundEmail(emailData);

      res.json(validation);
    } catch (error) {
      console.error('Email content validation error:', error);
      res.status(500).json({ message: "Failed to validate email content" });
    }
  });

  app.get("/api/email/validation-stats", async (req, res) => {
    try {
      const { emailWatchdog } = await import('./services/email-validator.js');
      const stats = emailWatchdog.getValidationStats();
      res.json(stats);
    } catch (error) {
      console.error('Email validation stats error:', error);
      res.status(500).json({ message: "Failed to get validation stats" });
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

  // Advanced Lead Import - Analyze CSV structure
  app.post('/api/leads/import/analyze', basicUpload.single('file'), async (req: TenantRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const content = req.file.buffer.toString('utf-8');
      const rows = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (rows.length === 0) return res.status(400).json({ message: 'Empty file' });
      const headers = rows[0].split(',').map(h => h.trim());
      const previewRows = rows.slice(1, 6).map(line => {
        const cols = line.split(',');
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = cols[i]);
        return obj;
      });
      const suggestedMappings = headers.map(h => ({
        csvColumn: h,
        leadField: (/email/i.test(h) ? 'email' : /first.?name/i.test(h) ? 'firstName' : /last.?name/i.test(h) ? 'lastName' : /phone/i.test(h) ? 'phone' : /vehicle|interest/i.test(h) ? 'vehicleInterest' : '')
      }));
      res.json({ headers, totalRows: rows.length - 1, previewRows, suggestedMappings });
    } catch (e) {
      console.error('Lead import analyze error:', e);
      res.status(500).json({ message: 'Failed to analyze CSV' });
    }
  });

  // Advanced Lead Import - Perform import with mappings
  app.post('/api/leads/import', basicUpload.single('file'), async (req: TenantRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const mappings = (() => { try { return JSON.parse(req.body.mappings || '[]'); } catch { return []; } })();
      const campaignId = req.body.campaignId || null;
      const content = req.file.buffer.toString('utf-8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return res.status(400).json({ message: 'No data rows found' });
      const headers = lines[0].split(',').map(h => h.trim());
      const mapDict: Record<string,string> = {};
      for (const m of mappings) if (m.leadField) mapDict[m.csvColumn] = m.leadField;
      const results: any[] = [];
      const errors: any[] = [];
      for (let i=1;i<lines.length;i++) {
        const cols = lines[i].split(',');
        if (cols.length === 1 && cols[0].trim()==='') continue;
        const record: any = {};
        headers.forEach((h, idx) => {
          const lf = mapDict[h];
          if (lf) record[lf] = cols[idx];
        });
        if (!record.email) {
          errors.push({ row: i+1, error: 'Missing email' });
          continue;
        }
        results.push({
          email: record.email.trim(),
          firstName: record.firstName?.trim() || null,
            lastName: record.lastName?.trim() || null,
            phone: record.phone?.trim() || null,
            vehicleInterest: record.vehicleInterest?.trim() || null,
            source: record.source || 'csv_import',
            status: 'new',
            campaignId,
            clientId: req.clientId
        });
      }
      let created: any[] = [];
      if (results.length) {
        created = await storage.createLeads(results);
        created.forEach(lead => webSocketService.broadcastNewLead(lead));
      }
      res.json({ total: results.length + errors.length, successful: created.length, failed: errors.length, errors, leads: created });
    } catch (e) {
      console.error('Lead import process error:', e);
      res.status(500).json({ message: 'Failed to import leads' });
    }
  });

  // Simple webhook endpoints
  app.post("/api/webhooks/mailgun/inbound", async (req, res) => {
    try {
      const { InboundEmailService } = await import('./services/inbound-email.js');
      await InboundEmailService.handleInboundEmail(req, res);
    } catch (error) {
      console.error('Mailgun inbound webhook error:', error);
      res.status(500).json({ error: 'Failed to process inbound email' });
    }
  });

  // Mailgun delivery webhooks (bounces, complaints, etc.)
  const mailgunWebhookRoutes = await import('./routes/mailgun-webhooks');
  app.use('/api', mailgunWebhookRoutes.default);




  // Campaign Execution Routes
  // Execute campaign (Enhanced with Orchestrator)
  app.post("/api/campaigns/:id/execute", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { scheduleAt, testMode = false, selectedLeadIds, maxLeadsPerBatch = 50 } = req.body;

      const { CampaignOrchestrator } = await import('./services/campaign-execution/CampaignOrchestrator.js');
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
  const emails = (targetLeads as any[]).map((lead: any) => ({
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

      // NOTE: The following fields are placeholders only – emailsSent and lastExecuted are not
      // persisted in the current schema. TODO: add execution metrics storage if needed.
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


  // User management routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers(100); // Get all users for management
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { username, password, role, email, clientId } = req.body;
      
      if (!username || !password || !role) {
        return res.status(400).json({ message: "Username, password, and role are required" });
      }

      if (!["admin", "manager", "user"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }

      // TODO: Hash password in production
      const newUser = await storage.createUser({
        username,
        password, // In production, this should be hashed
        role,
        email: email || null,
        clientId: clientId || null
      });

      // Don't return password in response
      const { password: _, ...userResponse } = newUser;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error('Create user error:', error);
      if ((error as any)?.message?.includes('unique')) {
        res.status(409).json({ message: "Username already exists" });
      } else {
        res.status(500).json({ message: "Failed to create user" });
      }
    }
  });

  app.put("/api/users/:id/role", async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["admin", "manager", "user"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }

      const user = await storage.updateUserRole(req.params.id, role);
      // Don't return password in response
      const { password: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const { userId } = req.query;
      const conversations = await storage.getConversations(userId as string);
      res.json(conversations || []);
    } catch (error) {
      console.error('Conversations fetch error:', error);
      res.status(200).json([]); // be tolerant on dashboard load
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

  // Delete a conversation (and its messages)
  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      await storage.deleteConversation(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete conversation', error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });


  // Conversation message routes
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error(`Failed to fetch messages for conversation ${req.params.id}:`, error);
      res.status(500).json({
        message: "Failed to fetch messages",
        conversationId: req.params.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
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
      console.error(`Failed to create message for conversation ${req.params.id}:`, error);
      const statusCode = error instanceof Error && error.message.includes("validation") ? 400 : 500;
      res.status(statusCode).json({
        message: statusCode === 400 ? "Invalid message data" : "Failed to create message",
        conversationId: req.params.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
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
  app.get("/api/leads", async (req: TenantRequest, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      // For now, get all leads regardless of client since we're in single-tenant mode
      // In future multi-tenant setup, filter by req.clientId
      const leads = await storage.getLeads(campaignId);
      res.json(leads);
    } catch (error) {
      console.error('Get leads error:', error);
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

  // Download CSV template for lead upload
  app.get("/api/leads/template", (req, res) => {
    const csvTemplate = `email,firstName,lastName,phoneNumber,vehicleInterest,leadSource,notes
john.doe@example.com,John,Doe,555-1234,Toyota Camry,Website,Interested in test drive
jane.smith@example.com,Jane,Smith,555-5678,Honda Civic,Walk-in,Looking for financing options
bob.johnson@example.com,Bob,Johnson,555-9012,Ford F-150,Referral,Wants trade-in evaluation`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="lead-template.csv"');
    res.send(csvTemplate);
  });



  // Create a new lead
  app.post("/api/leads", async (req: TenantRequest, res) => {
    try {
      const leadData = insertLeadSchema.parse({
        ...req.body,
        clientId: req.clientId // Ensure client ID is assigned from tenant middleware
      });
      const lead = await storage.createLead(leadData);

      // Broadcast new lead via WebSocket
      webSocketService.broadcastNewLead(lead);

      res.json(lead);
    } catch (error) {
      console.error('Create lead error:', error);
      res.status(400).json({
        message: "Invalid lead data",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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


  // Lead conversations (support Lead Details drawer)
  app.get("/api/leads/:id/conversations", async (req, res) => {
    try {
      const convs = await storage.getConversationsByLead(req.params.id);
      res.json(convs || []);
    } catch (error) {
      console.error('Lead conversations fetch error:', error);
      res.status(500).json({ message: "Failed to fetch lead conversations" });
    }
  });

  app.get("/api/leads/:id/conversations/latest/messages", async (req, res) => {
    try {
      const convs = await storage.getConversationsByLead(req.params.id);
      if (!convs || convs.length === 0) return res.json([]);
      const messages = await storage.getConversationMessages(convs[0].id);
      res.json(messages || []);
    } catch (error) {
      console.error(`Failed to fetch latest messages for lead ${req.params.id}:`, error);
      res.status(500).json({
        message: "Failed to fetch conversation messages",
        leadId: req.params.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
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
        leadSource: lead.source || 'csv_upload', // Map to correct field name
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
      // Sanitize / validate agentEmailDomain if present
      if (req.body.agentEmailDomain) {
        let val = String(req.body.agentEmailDomain).trim();
        if (val.includes('@')) {
          // if user pasted an email like user@domain, keep only domain to align with Mailgun expectation
            val = val.split('@').pop()!.trim();
        }
        const domainRegex = /^[a-zA-Z0-9.-]+$/;
        if (!domainRegex.test(val)) {
          return res.status(400).json({ message: "agentEmailDomain must be a bare domain/subdomain (no protocol, no spaces)" });
        }
        req.body.agentEmailDomain = val.toLowerCase();
      }
      const configData = insertAiAgentConfigSchema.parse(req.body);
      const config = await storage.createAiAgentConfig(configData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid AI agent configuration data" });
    }
  });

  app.put("/api/ai-agent-configs/:id", async (req, res) => {
    try {
      if (req.body.agentEmailDomain !== undefined) {
        let val = String(req.body.agentEmailDomain || '').trim();
        if (val.length === 0) {
          // allow clearing
          req.body.agentEmailDomain = null;
        } else {
          if (val.includes('@')) val = val.split('@').pop()!.trim();
          const domainRegex = /^[a-zA-Z0-9.-]+$/;
          if (!domainRegex.test(val)) {
            return res.status(400).json({ message: "agentEmailDomain must be a bare domain/subdomain (no '@' or invalid chars)" });
          }
          req.body.agentEmailDomain = val.toLowerCase();
        }
      }
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
      const { executionMonitor } = await import('./services/execution-monitor.js');
      const executions = executionMonitor.getActiveExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active executions" });
    }
  });

  app.get("/api/executions/history", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor.js');
      const limit = parseInt(req.query.limit as string) || 20;
      const history = executionMonitor.getExecutionHistory(limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution history" });
    }
  });

  app.get("/api/executions/stats", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor.js');
      const stats = executionMonitor.getExecutionStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch execution statistics" });
    }
  });

  app.get("/api/executions/:id", async (req, res) => {
    try {
      const { executionMonitor } = await import('./services/execution-monitor.js');
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
      const { executionMonitor } = await import('./services/execution-monitor.js');
      const cancelled = executionMonitor.cancelExecution(req.params.id);
      if (!cancelled) {
        return res.status(400).json({ message: "Execution cannot be cancelled" });
      }
      res.json({ message: "Execution cancelled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel execution" });
    }
  });

  // Handover minimal routes
  const handoverRoutes = await import('./routes/handovers');
  app.use('/api/handovers', handoverRoutes.default);



  // Health check routes
  const healthRoutes = await import('./routes/health');
  app.use('/api/health', healthRoutes.default);

  // IMAP health check
  const imapHealthRoutes = await import('./routes/health-imap');
  app.use('/api/health', imapHealthRoutes.default);

  // Agent runtime routes
  const agentRoutes = await import('./routes/agent');
  app.use('/api/agent', agentRoutes.default);

  // AI Personas routes
  const personaRoutes = await import('./routes/ai-persona');
  app.use('/api/personas', personaRoutes.default);

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

  // Simplified Dashboard Route
  app.get("/api/dashboard", async (req: TenantRequest, res) => {
    try {
      const leads = await storage.getLeads();
      const campaigns = await storage.getCampaigns();
      const conversations = await storage.getConversations();

      // Basic dashboard data without complex intelligence
      const dashboardData = {
        leads: leads.slice(0, 50).map(lead => ({
          id: lead.id,
          name: (lead as any).name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
          email: lead.email,
          phone: lead.phone,
          company: (lead as any).company || 'Unknown',
          score: (lead as any).score || 0,
          status: lead.status || 'new',
          createdAt: lead.createdAt
        })),
        summary: {
          totalLeads: leads.length,
          totalCampaigns: campaigns.length,
          totalConversations: conversations.length,
          hotLeads: leads.filter(l => (l as any).score && (l as any).score > 80).length,
          activeConversations: conversations.filter(c => c.status === 'active').length
        },
        recentActivity: [
          "New leads imported successfully",
          "Email campaigns running normally",
          "AI agents responding to conversations"
        ]
      };

      res.json(dashboardData);
    } catch (error) {
      console.error('Dashboard API error:', error);
      res.status(500).json({ message: "Failed to load dashboard data" });
    }
  });

  // Missing AI endpoints (stubs for now)
  app.post("/api/ai/suggest-goals", async (req, res) => {
    res.status(501).json({ 
      message: "AI goal suggestion not yet implemented",
      suggestions: ["Generate leads", "Increase conversions", "Build relationships"]
    });
  });

  app.post("/api/ai/enhance-templates", async (req, res) => {
    res.status(501).json({ 
      message: "AI template enhancement not yet implemented",
      templates: []
    });
  });

  app.post("/api/ai/generate-subjects", async (req, res) => {
    res.status(501).json({ 
      message: "AI subject generation not yet implemented",
      subjects: []
    });
  });

  app.post("/api/ai/suggest-names", async (req, res) => {
    res.status(501).json({ 
      message: "AI name suggestion not yet implemented",
      names: []
    });
  });

  app.post("/api/ai/generate-templates", async (req, res) => {
    try {
      const templateRoutes = await import('./routes/templates');
      // Manually call the template generation endpoint
      const { context, campaignId } = req.body;
      
      // Create a mock request with required properties
      const mockReq = { body: { context, campaignId } } as any;
      const mockRes = {
        json: (data: any) => res.json(data),
        status: (code: number) => ({ json: (data: any) => res.status(code).json(data) })
      } as any;

      // Import and call the template generation function directly
      const { callOpenRouterJSON } = await import('./services/call-openrouter');
      const { storage } = await import('./storage');
      
      let templateContext = context;
      
      // If campaignId is provided but no context, build context from campaign data
      if (campaignId && !context) {
        try {
          const campaign = await storage.getCampaign(campaignId);
          if (campaign) {
            templateContext = `Campaign: ${campaign.name}. Goals: ${campaign.handoverGoals || 'Generate leads and drive conversions'}. Target: ${campaign.targetAudience || 'potential customers'}`;
          } else {
            templateContext = 'General marketing campaign focused on lead generation and customer engagement';
          }
        } catch (error) {
          console.error('Error fetching campaign for context:', error);
          templateContext = 'General marketing campaign focused on lead generation and customer engagement';
        }
      }
      
      if (!templateContext) {
        return res.status(400).json({ message: 'context or campaignId required' });
      }

      const system = `System Prompt: The Straight-Talking Sales Pro
Core Identity:
You are an experienced sales professional. You're knowledgeable, direct, and genuinely helpful. You talk like a real person who knows the industry and understands that picking a vendor is a big decision.
Communication Style:

Be real. Talk like you would to a friend who's asking for advice
Be direct. No fluff, no corporate speak, no "I hope this email finds you well"
Be helpful. Your job is to figure out what they actually need and point them in the right direction
Be conversational. Short sentences. Natural flow. Like you're texting a friend

Your Goal:
Have a normal conversation that helps them figure out what they actually want. If they're ready to move forward, make it easy. If they're not, give them something useful and stay in touch.

Return only JSON.`;
      const json = await callOpenRouterJSON<{ subject_lines: string[]; templates: string[] }>({
        model: 'openai/gpt-5-chat',
        system,
        messages: [
          { role: 'user', content: `Generate 3 subject lines and 3 short HTML templates (no external images).
Context: ${templateContext}
Respond JSON: { "subject_lines": string[], "templates": string[] }` }
        ],
        temperature: 0.5,
        maxTokens: 1200,
      });

      res.json({ subject_lines: json.subject_lines || [], templates: json.templates || [] });
    } catch (e) {
      console.error('Template generation error:', e);
      res.status(500).json({ message: 'Failed to generate templates' });
    }
  });

  app.post("/api/ai/analyze-conversation", async (req, res) => {
    res.status(501).json({ 
      message: "AI conversation analysis not yet implemented",
      analysis: null
    });
  });

  app.post("/api/ai/generate-prompt", async (req, res) => {
    res.status(501).json({ 
      message: "AI prompt generation not yet implemented",
      prompt: ""
    });
  });

  app.post("/api/ai/chat-campaign", async (req, res) => {
    res.status(501).json({ 
      message: "AI chat campaign not yet implemented",
      response: null
    });
  });

  // Missing Email Monitor endpoints (stubs for now)
  app.get("/api/email-monitor/status", async (req, res) => {
    res.json({
      status: "not_implemented",
      message: "Email monitoring not yet implemented",
      isRunning: false,
      lastCheck: null,
      totalEmails: 0,
      unreadEmails: 0
    });
  });

  app.get("/api/email-monitor/rules", async (req, res) => {
    res.json({
      rules: [],
      message: "Email monitoring rules not yet implemented"
    });
  });

  app.post("/api/email-monitor/start", async (req, res) => {
    res.status(501).json({ 
      message: "Email monitor start not yet implemented",
      status: "not_started"
    });
  });

  app.post("/api/email-monitor/stop", async (req, res) => {
    res.status(501).json({ 
      message: "Email monitor stop not yet implemented",
      status: "not_stopped"
    });
  });

  app.delete("/api/email-monitor/rules/:id", async (req, res) => {
    res.status(501).json({ 
      message: "Email monitor rule deletion not yet implemented"
    });
  });

  app.post("/api/email-monitor/rules", async (req, res) => {
    res.status(501).json({ 
      message: "Email monitor rule creation not yet implemented"
    });
  });



  const httpServer = createServer(app);

  // Initialize WebSocket server
  webSocketService.initialize(httpServer);

  return httpServer;
}
