// Legacy wrapper for backward compatibility
// New implementation uses the comprehensive integrations/supermemory system

import { 
  MemoryMapper, 
  searchMemories as newSearchMemories, 
  isRAGEnabled,
  searchForLeadSignals
} from '../integrations/supermemory';
import { storage } from '../storage';

// Lightweight interface for campaigns pulled from storage to enable safe optional template access
interface StoredCampaign {
  id: string;
  templates?: any[];
  [key: string]: any;
}

// Supermemory service for persistent AI memory
class SupermemoryService {
  private static instance: SupermemoryService | null = null;

  private constructor() {
    if (!isRAGEnabled()) {
      console.warn('Supermemory API key not found - memory features disabled');
    }
  }

  static getInstance(): SupermemoryService {
    if (!SupermemoryService.instance) {
      SupermemoryService.instance = new SupermemoryService();
    }
    return SupermemoryService.instance;
  }

  async ingestCampaign(campaignData: any, clientId: string = 'default'): Promise<void> {
    if (!isRAGEnabled()) return;
    
    try {
      const summary = `Campaign: ${campaignData.name}
Context: ${campaignData.context}
Goals: ${campaignData.handoverGoals}
Target Audience: ${campaignData.targetAudience}
Templates: ${campaignData.numberOfTemplates || 5}`;

      await MemoryMapper.writeCampaignSummary({
        type: 'campaign_summary',
        clientId,
        campaignId: campaignData.id,
        summary,
        meta: { name: campaignData.name }
      });
      
    } catch (error) {
      console.warn('Failed to ingest campaign to Supermemory:', error);
    }
  }

  async ingestEmailSend(emailData: any, clientId: string = 'default'): Promise<void> {
    if (!isRAGEnabled()) return;
    
    try {
      const content = `Email sent to ${emailData.recipient}
Campaign: ${emailData.campaignId}
Subject: ${emailData.subject}
Timestamp: ${new Date().toISOString()}`;

      await MemoryMapper.writeMailEvent({
        type: 'mail_event',
        clientId,
        campaignId: emailData.campaignId,
        leadEmail: emailData.recipient,
        content,
        meta: { event: 'sent', subject: emailData.subject }
      });
      
    } catch (error) {
      console.warn('Failed to ingest email send to Supermemory:', error);
    }
  }

  async ingestEmailEvent(event: any, clientId: string = 'default'): Promise<void> {
    if (!isRAGEnabled()) return;
    
    try {
      const content = `Email ${event.event}: ${event.recipient}
Message ID: ${event['message-id']}
Timestamp: ${event.timestamp}
${event.url ? `URL: ${event.url}` : ''}`;

      await MemoryMapper.writeMailEvent({
        type: 'mail_event',
        clientId,
        leadEmail: event.recipient,
        content,
        meta: { 
          event: event.event, 
          messageId: event['message-id'],
          timestamp: event.timestamp,
          url: event.url 
        }
      });
      
    } catch (error) {
      console.warn('Failed to ingest email event to Supermemory:', error);
    }
  }

  async ingestLeadMessage(message: any, clientId: string = 'default'): Promise<void> {
    if (!isRAGEnabled()) return;
    
    try {
      const content = `Lead message from ${message.leadEmail}
Content: ${message.content}
Timestamp: ${message.timestamp}
Campaign: ${message.campaignId || 'none'}`;

      await MemoryMapper.writeLeadMessage({
        type: 'lead_msg',
        clientId,
        campaignId: message.campaignId,
        leadEmail: message.leadEmail,
        content: message.content,
        meta: { timestamp: message.timestamp }
      });
      
    } catch (error) {
      console.warn('Failed to ingest lead message to Supermemory:', error);
    }
  }

  async searchMemories(query: string, options: any = {}): Promise<any[]> {
    if (!isRAGEnabled()) return [];
    
    try {
      const result = await newSearchMemories({
        q: query,
        clientId: options.userId || 'default',
        campaignId: options.campaignId,
        leadEmailHash: options.leadEmailHash,
        limit: options.limit || 8,
        timeoutMs: 300
      });
      
      return result.results || [];
      
    } catch (error) {
      console.warn('Failed to search Supermemory:', error);
      return [];
    }
  }
}

// Express-style handler outside the class
export async function getLeadMemorySummary(req: any, res: any) {
  try {
    const leadId = req.params.id;
    const lead = await storage.getLead(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const clientId = (lead as any).clientId || 'default';
    const email = (lead as any).email as string | undefined;
    let leadSignals: string[] = [];
    if (email) {
      try {
        const hash = MemoryMapper.hashEmail(email);
        const sig = await searchForLeadSignals({ clientId, leadEmailHash: hash });
        if (sig.results?.length) {
          leadSignals = sig.results.slice(0,4).map((r:any)=> (r.metadata?.title||'Signal') + ': ' + String(r.content||'').slice(0,90));
        }
        } catch {
          // ignore errors retrieving lead signals
        }
    }
    let priorCampaign: any = null;
    if ((lead as any).campaignId) {
      try {
        const camp = await storage.getCampaign((lead as any).campaignId) as StoredCampaign | undefined;
        if (camp) {
          const tLen = Array.isArray(camp.templates) ? camp.templates.length : 0;
          priorCampaign = { id: camp.id, performance: `Templates: ${tLen}` };
        }
        } catch {
          // ignore errors retrieving prior campaign
        }
    }
    let optimizationHint: string | undefined;
    if (leadSignals.length) {
      optimizationHint = 'Lead has prior engagement signals; prioritize timely personalized follow-up.';
    }
    return res.json({ leadSignals, priorCampaign, optimizationHint });
  } catch (e:any) {
    return res.status(500).json({ error: 'Failed to build memory summary', detail: e.message });
  }
}

export const supermemoryService = SupermemoryService.getInstance();

// Helper functions for compatibility
export async function searchMemories(query: string, options: any = {}): Promise<any[]> {
  return supermemoryService.searchMemories(query, options);
}

export function extractMemoryContent(results: any[]): string[] {
  return results.map(r => r.content || '').filter(Boolean);
}