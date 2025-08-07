import { storage } from '../../storage';
import { webSocketService } from '../websocket';
import type { Lead, Campaign, Conversation } from '@shared/schema';

export interface AssignmentRule {
  id: string;
  name: string;
  enabled: boolean;
  criteria: {
    vehicleInterest?: string[];
    budget?: { min?: number; max?: number };
    timeframe?: string[];
    source?: string[];
    location?: string[];
  };
  priority: number; // Higher number = higher priority
  assignTo?: string; // User ID or team
  campaignId?: string;
}

export interface AssignmentResult {
  success: boolean;
  assignedLeads: number;
  skippedLeads: number;
  errors: string[];
  assignments: Array<{
    leadId: string;
    campaignId?: string;
    conversationId?: string;
    assignedTo?: string;
  }>;
}

export class LeadAssignmentService {
  private assignmentRules: AssignmentRule[] = [
    {
      id: 'high_value_leads',
      name: 'High Value Leads',
      enabled: true,
      criteria: {
        budget: { min: 50000 },
        timeframe: ['immediate', 'within_month']
      },
      priority: 10,
      assignTo: 'senior_sales'
    },
    {
      id: 'luxury_vehicles',
      name: 'Luxury Vehicle Interest',
      enabled: true,
      criteria: {
        vehicleInterest: ['BMW', 'Mercedes', 'Audi', 'Lexus', 'Tesla']
      },
      priority: 8,
      assignTo: 'luxury_specialist'
    },
    {
      id: 'quick_conversion',
      name: 'Quick Conversion Potential',
      enabled: true,
      criteria: {
        timeframe: ['immediate', 'within_week']
      },
      priority: 7,
      assignTo: 'conversion_team'
    }
  ];

  /**
   * Assign leads to campaigns based on intelligent rules
   */
  async assignLeadsToCampaigns(
    leads: Lead[],
    availableCampaigns: Campaign[]
  ): Promise<AssignmentResult> {
    const result: AssignmentResult = {
      success: true,
      assignedLeads: 0,
      skippedLeads: 0,
      errors: [],
      assignments: []
    };

    try {
      for (const lead of leads) {
        try {
          const assignment = await this.assignSingleLead(lead, availableCampaigns);
          
          if (assignment.campaignId) {
            // Update lead with campaign assignment
            await storage.updateLead(lead.id, {
              campaignId: assignment.campaignId,
              status: 'assigned'
            });

            // Create conversation if needed
            if (assignment.createConversation) {
              const conversation = await storage.createConversation({
                subject: `Lead Assignment: ${lead.firstName} ${lead.lastName}`,
                leadId: lead.id,
                status: 'active',
                priority: assignment.priority || 'normal',
                campaignId: assignment.campaignId,
                lastActivity: new Date(),
              });

              assignment.conversationId = conversation.id;
            }

            result.assignments.push({
              leadId: lead.id,
              campaignId: assignment.campaignId,
              conversationId: assignment.conversationId,
              assignedTo: assignment.assignedTo
            });

            result.assignedLeads++;

            // Send real-time notification
            webSocketService.broadcast('leadAssigned', {
              leadId: lead.id,
              campaignId: assignment.campaignId,
              assignmentReason: assignment.reason,
              timestamp: new Date()
            });

          } else {
            result.skippedLeads++;
          }

        } catch (leadError) {
          result.errors.push(`Failed to assign lead ${lead.id}: ${leadError instanceof Error ? leadError.message : 'Unknown error'}`);
          result.skippedLeads++;
        }
      }

      result.success = result.errors.length === 0 || result.assignedLeads > 0;

    } catch (error) {
      result.success = false;
      result.errors.push(`Assignment process failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Assign a single lead to the most appropriate campaign
   */
  private async assignSingleLead(
    lead: Lead, 
    availableCampaigns: Campaign[]
  ): Promise<{
    campaignId?: string;
    assignedTo?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    reason?: string;
    createConversation?: boolean;
    conversationId?: string;
  }> {
    
    // Skip if lead already has a campaign
    if (lead.campaignId) {
      return { reason: 'Lead already assigned to campaign' };
    }

    // Find best matching rule
    const matchingRule = this.findBestMatchingRule(lead);
    
    if (!matchingRule) {
      // Default assignment to general campaign
      const generalCampaign = availableCampaigns.find(c => 
        c.status === 'active' && 
        (c.name.toLowerCase().includes('general') || c.name.toLowerCase().includes('default'))
      );

      return {
        campaignId: generalCampaign?.id,
        priority: 'normal',
        reason: 'Default assignment - no specific rules matched',
        createConversation: true
      };
    }

    // Find campaign matching the rule
    let targetCampaign: Campaign | undefined;

    if (matchingRule.campaignId) {
      targetCampaign = availableCampaigns.find(c => c.id === matchingRule.campaignId);
    } else {
      // Find campaign based on criteria
      targetCampaign = this.findMatchingCampaign(lead, availableCampaigns, matchingRule);
    }

    if (!targetCampaign) {
      // Fall back to any active campaign
      targetCampaign = availableCampaigns.find(c => c.status === 'active');
    }

    const priority = this.determinePriority(matchingRule.priority);

    return {
      campaignId: targetCampaign?.id,
      assignedTo: matchingRule.assignTo,
      priority,
      reason: `Matched rule: ${matchingRule.name}`,
      createConversation: true
    };
  }

  /**
   * Find the best matching assignment rule for a lead
   */
  private findBestMatchingRule(lead: Lead): AssignmentRule | null {
    const activeRules = this.assignmentRules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)

    for (const rule of activeRules) {
      if (this.leadMatchesRule(lead, rule)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if a lead matches a specific rule
   */
  private leadMatchesRule(lead: Lead, rule: AssignmentRule): boolean {
    const { criteria } = rule;

    // Check vehicle interest
    if (criteria.vehicleInterest && criteria.vehicleInterest.length > 0) {
      if (!lead.vehicleInterest || 
          !criteria.vehicleInterest.some(interest => 
            lead.vehicleInterest!.toLowerCase().includes(interest.toLowerCase())
          )) {
        return false;
      }
    }

    // Check budget range
    if (criteria.budget) {
      const leadBudget = this.parseBudget(lead.budget);
      if (leadBudget !== null) {
        if (criteria.budget.min && leadBudget < criteria.budget.min) return false;
        if (criteria.budget.max && leadBudget > criteria.budget.max) return false;
      } else if (criteria.budget.min || criteria.budget.max) {
        return false; // Budget criteria specified but lead has no valid budget
      }
    }

    // Check timeframe
    if (criteria.timeframe && criteria.timeframe.length > 0) {
      if (!lead.timeframe || 
          !criteria.timeframe.includes(lead.timeframe.toLowerCase())) {
        return false;
      }
    }

    // Check source
    if (criteria.source && criteria.source.length > 0) {
      if (!lead.source || 
          !criteria.source.includes(lead.source.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find matching campaign based on lead and rule criteria
   */
  private findMatchingCampaign(
    lead: Lead, 
    campaigns: Campaign[], 
    rule: AssignmentRule
  ): Campaign | undefined {
    
    const activeCampaigns = campaigns.filter(c => c.status === 'active');

    // Look for campaigns with relevant context/content
    if (lead.vehicleInterest) {
      const vehicleSpecificCampaign = activeCampaigns.find(c => 
        c.context?.toLowerCase().includes(lead.vehicleInterest!.toLowerCase()) ||
        c.name.toLowerCase().includes(lead.vehicleInterest!.toLowerCase())
      );
      if (vehicleSpecificCampaign) return vehicleSpecificCampaign;
    }

    // Look for timeframe-specific campaigns
    if (lead.timeframe) {
      const timeframeCampaign = activeCampaigns.find(c => 
        c.context?.toLowerCase().includes(lead.timeframe!.toLowerCase()) ||
        c.name.toLowerCase().includes(lead.timeframe!.toLowerCase())
      );
      if (timeframeCampaign) return timeframeCampaign;
    }

    // Return first active campaign as fallback
    return activeCampaigns[0];
  }

  /**
   * Parse budget string to number
   */
  private parseBudget(budget?: string): number | null {
    if (!budget) return null;

    // Remove non-numeric characters except decimal points and commas
    const cleaned = budget.replace(/[^\d.,]/g, '');
    
    // Handle common formats
    if (cleaned.includes('k') || cleaned.includes('K')) {
      return parseFloat(cleaned.replace(/[kK]/g, '')) * 1000;
    }
    
    const parsed = parseFloat(cleaned.replace(/,/g, ''));
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Determine conversation priority based on rule priority
   */
  private determinePriority(rulePriority: number): 'low' | 'normal' | 'high' | 'urgent' {
    if (rulePriority >= 10) return 'urgent';
    if (rulePriority >= 7) return 'high';
    if (rulePriority >= 4) return 'normal';
    return 'low';
  }

  /**
   * Get current assignment rules
   */
  getAssignmentRules(): AssignmentRule[] {
    return [...this.assignmentRules];
  }

  /**
   * Update assignment rules
   */
  updateAssignmentRules(rules: AssignmentRule[]): void {
    this.assignmentRules = rules;
    console.log(`Updated ${rules.length} assignment rules`);
  }

  /**
   * Add new assignment rule
   */
  addAssignmentRule(rule: AssignmentRule): void {
    this.assignmentRules.push(rule);
    console.log(`Added new assignment rule: ${rule.name}`);
  }

  /**
   * Remove assignment rule
   */
  removeAssignmentRule(ruleId: string): boolean {
    const initialLength = this.assignmentRules.length;
    this.assignmentRules = this.assignmentRules.filter(rule => rule.id !== ruleId);
    const removed = this.assignmentRules.length < initialLength;
    
    if (removed) {
      console.log(`Removed assignment rule: ${ruleId}`);
    }
    
    return removed;
  }
}

export const leadAssignmentService = new LeadAssignmentService();