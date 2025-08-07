import { storage } from '../../storage';
import { webSocketService } from '../websocket';

interface CampaignExecutionOptions {
  campaignId: string;
  testMode?: boolean;
  scheduleAt?: Date;
  selectedLeadIds?: string[];
  maxLeadsPerBatch?: number;
  delayBetweenBatches?: number;
}

interface ExecutionResult {
  success: boolean;
  campaignId: string;
  executionId: string;
  summary: {
    totalLeads: number;
    emailsSent: number;
    errors: number;
    batches: number;
  };
  errors?: string[];
  testMode: boolean;
}

interface ExecutionBatch {
  batchId: string;
  leads: any[];
  template: any;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class CampaignOrchestrator {
  private activeExecutions = new Map<string, any>();

  constructor() {
    // Services will be imported dynamically to avoid circular dependencies
  }

  async executeCampaign(options: CampaignExecutionOptions): Promise<CampaignExecutionResult> {
    const { campaignId, testMode = false, selectedLeadIds, maxLeadsPerBatch = 50 } = options;
    
    try {
      // Import services dynamically
      const { ExecutionProcessor } = await import('./ExecutionProcessor');
      const { LeadAssignmentService } = await import('./LeadAssignmentService');
      
      const executionProcessor = new ExecutionProcessor();
      const leadAssignmentService = new LeadAssignmentService();

      // Get campaign
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return {
          success: false,
          message: "Campaign not found",
          error: "Campaign not found"
        };
      }

      // Get leads
      let targetLeads: any[];
      if (selectedLeadIds && selectedLeadIds.length > 0) {
        targetLeads = await Promise.all(
          selectedLeadIds.map(id => storage.getLead(id))
        );
        targetLeads = targetLeads.filter(Boolean);
      } else {
        const allLeads = await storage.getLeads();
        targetLeads = allLeads.filter(lead => 
          !lead.campaignId || lead.campaignId === campaignId
        );
      }

      if (targetLeads.length === 0) {
        return {
          success: false,
          message: "No leads found for this campaign",
          error: "No leads available"
        };
      }

      // Assign unassigned leads to this campaign
      const unassignedLeads = targetLeads.filter(lead => !lead.campaignId);
      if (unassignedLeads.length > 0) {
        const assignmentResult = await leadAssignmentService.assignLeadsToCampaigns(
          unassignedLeads,
          [campaign]
        );
        console.log(`Assigned ${assignmentResult.assignedLeads} leads to campaign`);
      }

      // Update campaign status
      await storage.updateCampaign(campaignId, { 
        status: options.scheduleAt ? 'scheduled' : 'active',
        lastExecuted: options.scheduleAt ? null : new Date()
      });

      // If test mode, limit to first lead
      if (testMode) {
        targetLeads = targetLeads.slice(0, 1);
      }

      // Process email sequence
      const processingResult = await executionProcessor.processEmailSequence(
        campaign,
        targetLeads,
        0, // Start with first template
        {
          batchSize: maxLeadsPerBatch,
          testMode,
          delayBetweenEmails: testMode ? 0 : 1000
        }
      );

      // Create conversations for successful sends
      if (!testMode && processingResult.emailsSent > 0) {
        for (const lead of targetLeads.slice(0, processingResult.emailsSent)) {
          try {
            await storage.createConversation({
              subject: `Campaign: ${campaign.name}`,
              leadId: lead.id,
              status: 'active',
              priority: 'normal',
              campaignId: campaignId,
              lastActivity: new Date(),
            });
          } catch (convError) {
            console.error(`Failed to create conversation for lead ${lead.id}:`, convError);
          }
        }
      }

      // Broadcast execution update
      webSocketService.broadcast('campaignExecuted', {
        campaignId,
        emailsSent: processingResult.emailsSent,
        emailsFailed: processingResult.emailsFailed,
        testMode,
        timestamp: new Date()
      });

      return {
        success: processingResult.success,
        message: testMode 
          ? `Test email sent to ${processingResult.emailsSent} lead(s)`
          : `Campaign executed successfully`,
        emailsSent: processingResult.emailsSent,
        emailsFailed: processingResult.emailsFailed,
        totalLeads: targetLeads.length,
        errors: processingResult.errors,
        executionId: processingResult.executionId,
        testMode
      };

    } catch (error) {
      console.error('Campaign execution error:', error);
      return {
        success: false,
        message: "Failed to execute campaign",
        error: error instanceof Error ? error.message : 'Unknown error',
        emailsSent: 0,
        emailsFailed: 0,
        totalLeads: 0
      };
    }
  }
}

export const campaignOrchestrator = new CampaignOrchestrator();

  async executeCampaign(options: CampaignExecutionOptions): Promise<ExecutionResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`Starting campaign execution: ${executionId}`);

    try {
      // Validate campaign
      const campaign = await storage.getCampaign(options.campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${options.campaignId}`);
      }

      // Parse and validate email templates
      const templates = this.parseAndValidateTemplates(campaign.templates);
      if (templates.length === 0) {
        throw new Error('Campaign has no valid email templates');
      }

      // Get and assign leads
      const leads = await this.getExecutionLeads(options);
      if (leads.length === 0) {
        throw new Error('No leads available for campaign execution');
      }

      // Update campaign status
      await storage.updateCampaign(options.campaignId, {
        status: options.scheduleAt ? 'scheduled' : 'active',
        lastExecuted: options.scheduleAt ? null : new Date()
      });

      // Track execution
      this.activeExecutions.set(executionId, {
        campaignId: options.campaignId,
        status: 'processing',
        startTime: new Date(),
        totalLeads: leads.length,
        processedLeads: 0
      });

      // Execute based on mode
      const result = options.testMode 
        ? await this.executeTestMode(executionId, campaign, templates, leads, options)
        : await this.executeProductionMode(executionId, campaign, templates, leads, options);

      // Cleanup
      this.activeExecutions.delete(executionId);

      // Broadcast execution completion
      webSocketService.broadcast({
        type: 'campaign_execution_complete',
        executionId,
        campaignId: options.campaignId,
        result
      });

      return result;

    } catch (error) {
      console.error(`Campaign execution failed: ${executionId}`, error);
      this.activeExecutions.delete(executionId);
      
      return {
        success: false,
        campaignId: options.campaignId,
        executionId,
        summary: {
          totalLeads: 0,
          emailsSent: 0,
          errors: 1,
          batches: 0
        },
        errors: [error instanceof Error ? error.message : 'Unknown execution error'],
        testMode: options.testMode || false
      };
    }
  }

  private async getExecutionLeads(options: CampaignExecutionOptions): Promise<any[]> {
    let leads: any[];

    if (options.selectedLeadIds && options.selectedLeadIds.length > 0) {
      // Get specific leads
      leads = [];
      for (const leadId of options.selectedLeadIds) {
        const lead = await storage.getLead(leadId);
        if (lead) leads.push(lead);
      }
    } else {
      // Get all leads for campaign or unassigned leads
      const allLeads = await storage.getLeads();
      leads = allLeads.filter(lead => 
        !lead.campaignId || lead.campaignId === options.campaignId
      );
    }

    // Assign leads to campaign if not already assigned
    for (const lead of leads) {
      if (!lead.campaignId) {
        await this.leadAssignmentService.assignLeadToCampaign(lead.id, options.campaignId);
      }
    }

    return leads;
  }

  private parseAndValidateTemplates(templatesJson: string | null): any[] {
    if (!templatesJson) return [];

    try {
      const templates = JSON.parse(templatesJson);
      if (!Array.isArray(templates)) return [];

      return templates.filter(template => 
        template && 
        typeof template === 'object' && 
        (template.subject || template.content)
      );
    } catch (error) {
      console.error('Error parsing campaign templates:', error);
      return [];
    }
  }

  private async executeTestMode(
    executionId: string,
    campaign: any,
    templates: any[],
    leads: any[],
    options: CampaignExecutionOptions
  ): Promise<ExecutionResult> {
    console.log(`Executing campaign in TEST MODE: ${campaign.name}`);

    // Use first lead or first 3 leads for testing
    const testLeads = leads.slice(0, Math.min(3, leads.length));
    const testTemplate = templates[0];

    const results = await this.executionProcessor.processBatch({
      batchId: `test_${executionId}`,
      leads: testLeads,
      template: testTemplate,
      scheduledAt: new Date(),
      status: 'processing'
    }, campaign, true);

    return {
      success: results.success,
      campaignId: options.campaignId,
      executionId,
      summary: {
        totalLeads: testLeads.length,
        emailsSent: results.sentCount,
        errors: results.errors.length,
        batches: 1
      },
      errors: results.errors,
      testMode: true
    };
  }

  private async executeProductionMode(
    executionId: string,
    campaign: any,
    templates: any[],
    leads: any[],
    options: CampaignExecutionOptions
  ): Promise<ExecutionResult> {
    console.log(`Executing campaign in PRODUCTION MODE: ${campaign.name}`);

    const maxLeadsPerBatch = options.maxLeadsPerBatch || 50;
    const delayBetweenBatches = options.delayBetweenBatches || 300000; // 5 minutes
    
    const batches = this.createExecutionBatches(leads, templates, maxLeadsPerBatch, options.scheduleAt);
    
    let totalSent = 0;
    let totalErrors = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Wait for scheduled time or delay between batches
      if (i > 0 && !options.scheduleAt) {
        await this.delay(delayBetweenBatches);
      }

      try {
        const batchResult = await this.executionProcessor.processBatch(batch, campaign, false);
        totalSent += batchResult.sentCount;
        totalErrors += batchResult.errors.length;
        allErrors.push(...batchResult.errors);

        // Update execution progress
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
          execution.processedLeads += batch.leads.length;
          execution.batchesCompleted = i + 1;
        }

        // Broadcast progress
        webSocketService.broadcast({
          type: 'campaign_execution_progress',
          executionId,
          campaignId: options.campaignId,
          progress: {
            batchesCompleted: i + 1,
            totalBatches: batches.length,
            leadsProcessed: execution?.processedLeads || 0,
            totalLeads: leads.length
          }
        });

      } catch (error) {
        console.error(`Batch execution failed:`, error);
        totalErrors++;
        allErrors.push(`Batch ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update campaign metrics
    await this.updateCampaignMetrics(options.campaignId, {
      emailsSent: totalSent,
      leadsProcessed: leads.length,
      lastExecuted: new Date()
    });

    return {
      success: totalErrors === 0,
      campaignId: options.campaignId,
      executionId,
      summary: {
        totalLeads: leads.length,
        emailsSent: totalSent,
        errors: totalErrors,
        batches: batches.length
      },
      errors: allErrors.length > 0 ? allErrors : undefined,
      testMode: false
    };
  }

  private createExecutionBatches(
    leads: any[],
    templates: any[],
    batchSize: number,
    scheduleAt?: Date
  ): ExecutionBatch[] {
    const batches: ExecutionBatch[] = [];
    const baseTime = scheduleAt || new Date();

    // For multi-template campaigns, create sequence batches
    if (templates.length > 1) {
      for (let templateIndex = 0; templateIndex < templates.length; templateIndex++) {
        const template = templates[templateIndex];
        
        for (let i = 0; i < leads.length; i += batchSize) {
          const batchLeads = leads.slice(i, i + batchSize);
          const scheduledAt = new Date(baseTime.getTime() + (templateIndex * 24 * 60 * 60 * 1000)); // 1 day apart
          
          batches.push({
            batchId: `batch_${templateIndex}_${Math.floor(i / batchSize)}`,
            leads: batchLeads,
            template,
            scheduledAt,
            status: 'pending'
          });
        }
      }
    } else {
      // Single template campaign
      const template = templates[0];
      for (let i = 0; i < leads.length; i += batchSize) {
        const batchLeads = leads.slice(i, i + batchSize);
        
        batches.push({
          batchId: `batch_${Math.floor(i / batchSize)}`,
          leads: batchLeads,
          template,
          scheduledAt: baseTime,
          status: 'pending'
        });
      }
    }

    return batches;
  }

  private async updateCampaignMetrics(campaignId: string, metrics: any) {
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return;

      const currentMetrics = campaign.performanceMetrics 
        ? JSON.parse(campaign.performanceMetrics)
        : {};

      const updatedMetrics = {
        ...currentMetrics,
        totalEmailsSent: (currentMetrics.totalEmailsSent || 0) + metrics.emailsSent,
        totalLeadsProcessed: (currentMetrics.totalLeadsProcessed || 0) + metrics.leadsProcessed,
        lastExecutionDate: metrics.lastExecuted,
        executionCount: (currentMetrics.executionCount || 0) + 1
      };

      await storage.updateCampaign(campaignId, {
        performanceMetrics: JSON.stringify(updatedMetrics),
        lastExecuted: metrics.lastExecuted
      });
    } catch (error) {
      console.error('Error updating campaign metrics:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for execution monitoring
  getExecutionStatus(executionId: string) {
    return this.activeExecutions.get(executionId);
  }

  getAllActiveExecutions() {
    return Array.from(this.activeExecutions.entries()).map(([id, execution]) => ({
      executionId: id,
      ...execution
    }));
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return false;

    execution.status = 'cancelled';
    this.activeExecutions.delete(executionId);
    
    console.log(`Campaign execution cancelled: ${executionId}`);
    return true;
  }
}

export const campaignOrchestrator = new CampaignOrchestrator();