/**
 * Bounce/Complaint Suppression List Manager
 * Auto-quarantine problematic addresses and integrate with Supermemory
 */



import { MemoryMapper } from '../../integrations/supermemory';
import { storage } from '../../storage';

const HARD_BOUNCES = new Set(['bounce', 'suppress-bounce', 'failed']);
const COMPLAINTS = new Set(['complained']);

export class SuppressionManager {
  
  /**
   * Process Mailgun webhook event and update suppression status
   */
  static async processWebhookEvent(event: any): Promise<void> {
    try {
      const { event: eventType, recipient, 'message-id': messageId } = event;
      
      if (!eventType || !recipient) return;

      // Check if this is a suppression-worthy event
      const shouldSuppress = HARD_BOUNCES.has(eventType) || COMPLAINTS.has(eventType);
      
      if (shouldSuppress) {
        await this.suppressLead(recipient, eventType, messageId);
      }

    } catch (error) {
      console.error('Failed to process suppression event:', error);
    }
  }

  /**
   * Suppress a lead and log to Supermemory
   */
  static async suppressLead(email: string, reason: string, messageId?: string): Promise<void> {
    try {
      // Find and update the lead using storage interface
      const allLeads = await storage.getLeads();
      const lead = allLeads.find(l => l.email === email);

      if (!lead) {
        console.warn(`Lead not found for suppression: ${email}`);
        return;
      }

      const currentTags = lead.tags || [];
      const newTags = [...currentTags];
      
      if (!newTags.includes('suppress')) {
        newTags.push('suppress');
      }

      // Update lead status and tags
      await storage.updateLead(lead.id, {
        status: 'delivery_failed',
        tags: newTags
      });

      // Log to Supermemory for future reference
      await MemoryMapper.writeMailEvent({
        type: 'mail_event',
        clientId: lead.clientId || 'default',
        leadEmail: email,
        content: `Suppressed ${email} due to ${reason}`,
        meta: { 
          reason, 
          messageId: messageId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });

      console.log(`✓ Suppressed lead ${email} due to ${reason}`);

    } catch (error) {
      console.error(`Failed to suppress lead ${email}:`, error);
    }
  }

  /**
   * Check if a lead is suppressed before sending
   */
  static isSuppressed(lead: { tags?: string[]; status?: string }): boolean {
    if (!lead) return true;
    
    const tags = lead.tags || [];
    const status = lead.status;
    
    return tags.includes('suppress') || 
           status === 'delivery_failed' || 
           status === 'unsubscribed';
  }

  /**
   * Get suppression statistics
   */
  static async getSuppressionStats(clientId?: string): Promise<{
    totalSuppressed: number;
    byReason: Record<string, number>;
    recentSuppressions: any[];
  }> {
    try {
      const allLeads = await storage.getLeads();
      const suppressedLeads = allLeads.filter(lead => 
        lead.status === 'delivery_failed' && 
        (!clientId || lead.clientId === clientId)
      );
      
      const byReason: Record<string, number> = {};
      suppressedLeads.forEach((lead: any) => {
        // Would need to track reason in lead record or via Supermemory
        byReason['bounce'] = (byReason['bounce'] || 0) + 1;
      });

      return {
        totalSuppressed: suppressedLeads.length,
        byReason,
        recentSuppressions: suppressedLeads.slice(0, 10)
      };

    } catch (error) {
      console.error('Failed to get suppression stats:', error);
      return {
        totalSuppressed: 0,
        byReason: {},
        recentSuppressions: []
      };
    }
  }

  /**
   * Remove from suppression list (manual override)
   */
  static async removeSuppression(email: string): Promise<void> {
    try {
      const allLeads = await storage.getLeads();
      const lead = allLeads.find(l => l.email === email);

      if (!lead) return;

      const currentTags = lead.tags || [];
      const newTags = currentTags.filter((tag: string) => tag !== 'suppress');

      await storage.updateLead(lead.id, {
        status: 'active',
        tags: newTags
      });

      console.log(`✓ Removed suppression for ${email}`);

    } catch (error) {
      console.error(`Failed to remove suppression for ${email}:`, error);
    }
  }
}