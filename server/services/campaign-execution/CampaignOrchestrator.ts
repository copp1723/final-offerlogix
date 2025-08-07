import { storage } from '../../storage';
import { webSocketService } from '../websocket';

export interface CampaignExecutionOptions {
  campaignId: string;
  testMode?: boolean;
  scheduleAt?: Date;
  selectedLeadIds?: string[];
  maxLeadsPerBatch?: number;
}

export interface CampaignExecutionResult {
  success: boolean;
  message: string;
  emailsSent?: number;
  emailsFailed?: number;
  totalLeads?: number;
  errors?: string[];
  executionId?: string;
  testMode?: boolean;
  error?: string;
}

export interface ScheduledExecution {
  id: string;
  campaignId: string;
  options: CampaignExecutionOptions;
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
      try {
        if (webSocketService.broadcast) {
          webSocketService.broadcast('campaignExecuted', {
            campaignId,
            emailsSent: processingResult.emailsSent,
            emailsFailed: processingResult.emailsFailed,
            testMode,
            timestamp: new Date()
          });
        }
      } catch (wsError) {
        console.error('WebSocket broadcast error:', wsError);
      }

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

  /**
   * Schedule campaign execution for later
   */
  async scheduleCampaign(options: CampaignExecutionOptions): Promise<{ success: boolean; scheduledId?: string; message: string }> {
    try {
      if (!options.scheduleAt) {
        return { success: false, message: 'Schedule date is required' };
      }

      const scheduledId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // In a production system, you would store this in a job queue like Bull/Redis
      // For now, we'll just validate and return success
      
      await storage.updateCampaign(options.campaignId, {
        status: 'scheduled'
      });

      return {
        success: true,
        scheduledId,
        message: `Campaign scheduled for ${options.scheduleAt.toISOString()}`
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to schedule campaign'
      };
    }
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): any[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Cancel active execution
   */
  cancelExecution(executionId: string): boolean {
    if (this.activeExecutions.has(executionId)) {
      this.activeExecutions.delete(executionId);
      console.log(`Cancelled execution: ${executionId}`);
      return true;
    }
    return false;
  }
}

export const campaignOrchestrator = new CampaignOrchestrator();