import { storage } from '../../storage';
import { webSocketService } from '../websocket';

interface AssignmentRule {
  id: string;
  name: string;
  enabled: boolean;
  criteria: {
    leadSource?: string[];
    vehicleInterest?: string[];
    priority?: string[];
    tags?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  assignment: {
    campaignId: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    addTags?: string[];
    assignToUser?: string;
  };
}

interface BulkAssignmentOptions {
  leadIds: string[];
  campaignId: string;
  priority?: string;
  tags?: string[];
  overwriteExisting?: boolean;
}

interface AssignmentResult {
  success: boolean;
  assignedCount: number;
  skippedCount: number;
  errors: string[];
  assignedLeads: any[];
}

export class LeadAssignmentService {
  private assignmentRules: AssignmentRule[] = [];

  constructor() {
    this.loadDefaultAssignmentRules();
  }

  async assignLeadToCampaign(leadId: string, campaignId: string, options?: {
    priority?: string;
    tags?: string[];
    notes?: string;
  }): Promise<boolean> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        console.error(`Lead not found: ${leadId}`);
        return false;
      }

      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        console.error(`Campaign not found: ${campaignId}`);
        return false;
      }

      // Check if lead is already assigned to this campaign
      if (lead.campaignId === campaignId) {
        console.log(`Lead ${leadId} already assigned to campaign ${campaignId}`);
        return true;
      }

      // Prepare update data
      const updateData: any = {
        campaignId,
        status: 'assigned'
      };

      if (options?.priority) {
        updateData.priority = options.priority;
      }

      if (options?.tags) {
        const existingTags = lead.tags ? JSON.parse(lead.tags) : [];
        const newTags = [...new Set([...existingTags, ...options.tags])];
        updateData.tags = JSON.stringify(newTags);
      }

      if (options?.notes) {
        const existingNotes = lead.notes || '';
        updateData.notes = existingNotes 
          ? `${existingNotes}\n\n[${new Date().toISOString()}] ${options.notes}`
          : options.notes;
      }

      // Update lead
      await storage.updateLead(leadId, updateData);

      console.log(`Assigned lead ${leadId} to campaign ${campaignId}`);

      // Create conversation for lead-campaign interaction
      await this.createLeadConversation(lead, campaign);

      // Broadcast assignment
      webSocketService.broadcast({
        type: 'lead_assigned',
        leadId,
        campaignId,
        lead: { ...lead, ...updateData }
      });

      return true;

    } catch (error) {
      console.error(`Error assigning lead to campaign:`, error);
      return false;
    }
  }

  async bulkAssignLeads(options: BulkAssignmentOptions): Promise<AssignmentResult> {
    const result: AssignmentResult = {
      success: true,
      assignedCount: 0,
      skippedCount: 0,
      errors: [],
      assignedLeads: []
    };

    try {
      const campaign = await storage.getCampaign(options.campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${options.campaignId}`);
      }

      for (const leadId of options.leadIds) {
        try {
          const lead = await storage.getLead(leadId);
          if (!lead) {
            result.errors.push(`Lead not found: ${leadId}`);
            continue;
          }

          // Skip if already assigned and not overwriting
          if (lead.campaignId && !options.overwriteExisting) {
            result.skippedCount++;
            continue;
          }

          // Assign lead
          const assigned = await this.assignLeadToCampaign(leadId, options.campaignId, {
            priority: options.priority,
            tags: options.tags,
            notes: `Bulk assigned to campaign: ${campaign.name}`
          });

          if (assigned) {
            result.assignedCount++;
            result.assignedLeads.push({ ...lead, campaignId: options.campaignId });
          } else {
            result.errors.push(`Failed to assign lead: ${leadId}`);
          }

        } catch (error) {
          result.errors.push(`Error processing lead ${leadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update campaign lead count
      await this.updateCampaignLeadCount(options.campaignId);

      // Broadcast bulk assignment completion
      webSocketService.broadcast({
        type: 'bulk_assignment_complete',
        campaignId: options.campaignId,
        result
      });

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown bulk assignment error');
    }

    return result;
  }

  async autoAssignLeadsByCriteria(campaignId: string): Promise<AssignmentResult> {
    const result: AssignmentResult = {
      success: true,
      assignedCount: 0,
      skippedCount: 0,
      errors: [],
      assignedLeads: []
    };

    try {
      // Get unassigned leads
      const allLeads = await storage.getLeads();
      const unassignedLeads = allLeads.filter(lead => !lead.campaignId);

      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Apply assignment rules
      for (const lead of unassignedLeads) {
        const shouldAssign = await this.evaluateLeadForCampaign(lead, campaign);
        
        if (shouldAssign) {
          const assigned = await this.assignLeadToCampaign(lead.id, campaignId, {
            notes: `Auto-assigned based on campaign criteria`
          });

          if (assigned) {
            result.assignedCount++;
            result.assignedLeads.push({ ...lead, campaignId });
          }
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Auto-assignment error');
    }

    return result;
  }

  private async evaluateLeadForCampaign(lead: any, campaign: any): Promise<boolean> {
    try {
      // Parse campaign context for assignment criteria
      const context = campaign.context || '';
      const handoverGoals = campaign.handoverGoals || '';
      
      // Check vehicle interest match
      if (lead.vehicleInterest && context) {
        const vehicleKeywords = this.extractVehicleKeywords(context);
        if (vehicleKeywords.length > 0) {
          const matchesVehicle = vehicleKeywords.some(keyword =>
            lead.vehicleInterest.toLowerCase().includes(keyword.toLowerCase())
          );
          if (matchesVehicle) return true;
        }
      }

      // Check lead source match
      if (lead.leadSource) {
        const sourceKeywords = ['website', 'referral', 'showroom', 'email'];
        if (context.toLowerCase().includes(lead.leadSource.toLowerCase())) {
          return true;
        }
      }

      // Check priority match
      if (campaign.priority && lead.priority) {
        if (campaign.priority === lead.priority) return true;
      }

      // Default criteria for new leads
      if (lead.status === 'new' && context.toLowerCase().includes('new')) {
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error evaluating lead for campaign:', error);
      return false;
    }
  }

  private extractVehicleKeywords(text: string): string[] {
    const vehiclePatterns = [
      /(Toyota|Honda|Ford|Chevrolet|BMW|Mercedes|Audi|Lexus|Nissan|Hyundai|Kia|Volkswagen|Subaru|Mazda|Volvo|Acura|Infiniti|Cadillac|Lincoln|Buick|GMC|Jeep|Chrysler|Dodge|Ram)/gi,
      /(Camry|Civic|F-150|Accord|Prius|Corolla|Silverado|Elantra|Altima|Sentra|Malibu|Equinox|Escape|Explorer|Pilot)/gi
    ];

    const keywords: string[] = [];
    
    for (const pattern of vehiclePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        keywords.push(...matches);
      }
    }

    return [...new Set(keywords)];
  }

  private async createLeadConversation(lead: any, campaign: any) {
    try {
      // Check if conversation already exists
      const existingConversations = await storage.getConversations(lead.id);
      
      const campaignConversation = existingConversations.find(conv =>
        conv.subject?.includes(campaign.name) || conv.subject?.includes('Campaign')
      );

      if (campaignConversation) {
        console.log(`Conversation already exists for lead ${lead.id} and campaign ${campaign.name}`);
        return campaignConversation;
      }

      // Create new conversation
      const conversation = await storage.createConversation({
        userId: lead.id,
        campaignId: campaign.id,
        subject: `Campaign Assignment: ${campaign.name}`,
        status: 'active',
        priority: 'normal'
      });

      // Add initial message
      await storage.createConversationMessage({
        conversationId: conversation.id,
        content: `Lead ${lead.firstName || lead.email} has been assigned to campaign "${campaign.name}".`,
        senderId: 'system',
        isFromAI: 1
      });

      console.log(`Created conversation for lead assignment: ${conversation.id}`);
      return conversation;

    } catch (error) {
      console.error('Error creating lead conversation:', error);
    }
  }

  private async updateCampaignLeadCount(campaignId: string) {
    try {
      const allLeads = await storage.getLeads();
      const campaignLeads = allLeads.filter(lead => lead.campaignId === campaignId);
      
      const campaign = await storage.getCampaign(campaignId);
      if (campaign) {
        const metrics = campaign.performanceMetrics 
          ? JSON.parse(campaign.performanceMetrics)
          : {};
        
        metrics.assignedLeads = campaignLeads.length;
        
        await storage.updateCampaign(campaignId, {
          performanceMetrics: JSON.stringify(metrics)
        });
      }
    } catch (error) {
      console.error('Error updating campaign lead count:', error);
    }
  }

  private loadDefaultAssignmentRules() {
    this.assignmentRules = [
      {
        id: 'new-lead-auto-assign',
        name: 'New Lead Auto Assignment',
        enabled: true,
        criteria: {
          leadSource: ['website', 'email_inquiry'],
          priority: ['normal', 'high']
        },
        assignment: {
          campaignId: 'default',
          priority: 'normal',
          addTags: ['auto_assigned']
        }
      },
      {
        id: 'urgent-priority-assign',
        name: 'Urgent Priority Assignment',
        enabled: true,
        criteria: {
          priority: ['urgent']
        },
        assignment: {
          campaignId: 'urgent-response',
          priority: 'urgent',
          addTags: ['urgent', 'priority']
        }
      }
    ];
  }

  // Public methods for rule management
  getAssignmentRules(): AssignmentRule[] {
    return [...this.assignmentRules];
  }

  addAssignmentRule(rule: AssignmentRule) {
    this.assignmentRules.push(rule);
  }

  removeAssignmentRule(ruleId: string): boolean {
    const initialLength = this.assignmentRules.length;
    this.assignmentRules = this.assignmentRules.filter(rule => rule.id !== ruleId);
    return this.assignmentRules.length < initialLength;
  }

  async getLeadsByCampaign(campaignId: string): Promise<any[]> {
    const allLeads = await storage.getLeads();
    return allLeads.filter(lead => lead.campaignId === campaignId);
  }

  async unassignLead(leadId: string): Promise<boolean> {
    try {
      await storage.updateLead(leadId, {
        campaignId: null,
        status: 'new',
        notes: `${new Date().toISOString()}: Unassigned from campaign`
      });

      webSocketService.broadcast({
        type: 'lead_unassigned',
        leadId
      });

      return true;
    } catch (error) {
      console.error('Error unassigning lead:', error);
      return false;
    }
  }
}

export const leadAssignmentService = new LeadAssignmentService();