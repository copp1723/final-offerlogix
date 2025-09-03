/**
 * V1 ↔ V2 Data Bridge Service
 * 
 * Connects V1 leads with V2 conversations to provide unified data views.
 * This service bridges the gap between the legacy V1 system and the new V2 system.
 */

import { db } from '../db.js';
import { dbV2, v2schema } from '../v2/db.js';
import { leads } from '../../shared/schema.js';
import { eq, sql, desc, and } from 'drizzle-orm';

export interface BridgedLead {
  // V1 Lead data
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  vehicleInterest?: string;
  leadSource?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  
  // V2 Conversation data (enriched)
  v2ConversationId?: string;
  v2AgentId?: string;
  v2MessageCount?: number;
  v2LastMessageAt?: string;
  v2HasResponses?: boolean;
  v2Status?: string;
  v2Subject?: string;
}

export interface PriorityAlert {
  id: string;
  name: string;
  message: string;
  priority: 'High Priority' | 'Urgent';
  leadId: string;
  conversationId?: string;
  lastActivity?: string;
  messageCount?: number;
}

export class V1V2BridgeService {
  
  /**
   * Get enriched leads with V2 conversation data
   */
  async getBridgedLeads(limit = 50): Promise<BridgedLead[]> {
    const bridgedLeads = await db.execute(sql`
      SELECT 
        l.id,
        l.email,
        l.first_name as "firstName",
        l.last_name as "lastName", 
        l.phone,
        l.vehicle_interest as "vehicleInterest",
        l.lead_source as "leadSource",
        l.status,
        l.notes,
        l.created_at as "createdAt",
        l.updated_at as "updatedAt",
        
        -- V2 conversation data
        c.id as "v2ConversationId",
        c.agent_id as "v2AgentId",
        c.message_count as "v2MessageCount",
        c.updated_at as "v2LastMessageAt",
        c.status as "v2Status",
        c.subject as "v2Subject",
        CASE WHEN c.message_count > 1 THEN true ELSE false END as "v2HasResponses"
        
      FROM leads l
      LEFT JOIN conversations_v2 c ON LOWER(l.email) = LOWER(c.lead_email)
      ORDER BY 
        CASE WHEN c.updated_at IS NOT NULL THEN c.updated_at ELSE l.updated_at END DESC
      LIMIT ${limit}
    `);

    return bridgedLeads.rows as BridgedLead[];
  }

  /**
   * Get a specific bridged lead by ID
   */
  async getBridgedLead(leadId: string): Promise<BridgedLead | null> {
    const result = await db.execute(sql`
      SELECT 
        l.id,
        l.email,
        l.first_name as "firstName",
        l.last_name as "lastName", 
        l.phone,
        l.vehicle_interest as "vehicleInterest",
        l.lead_source as "leadSource",
        l.status,
        l.notes,
        l.created_at as "createdAt",
        l.updated_at as "updatedAt",
        
        -- V2 conversation data
        c.id as "v2ConversationId",
        c.agent_id as "v2AgentId",
        c.message_count as "v2MessageCount",
        c.updated_at as "v2LastMessageAt",
        c.status as "v2Status",
        c.subject as "v2Subject",
        CASE WHEN c.message_count > 1 THEN true ELSE false END as "v2HasResponses"
        
      FROM leads l
      LEFT JOIN conversations_v2 c ON LOWER(l.email) = LOWER(c.lead_email)
      WHERE l.id = ${leadId}
      LIMIT 1
    `);

    return result.rows[0] as BridgedLead || null;
  }

  /**
   * Get real priority alerts based on V2 conversation activity
   */
  async getRealPriorityAlerts(limit = 5): Promise<PriorityAlert[]> {
    const alerts = await db.execute(sql`
      SELECT 
        l.id,
        COALESCE(l.first_name || ' ' || l.last_name, l.email) as name,
        c.subject as message,
        c.id as "conversationId",
        c.updated_at as "lastActivity",
        c.message_count as "messageCount",
        
        -- Priority logic based on recent activity and message count
        CASE 
          WHEN c.updated_at > NOW() - INTERVAL '2 hours' AND c.message_count >= 3 THEN 'Urgent'
          WHEN c.updated_at > NOW() - INTERVAL '6 hours' AND c.message_count >= 2 THEN 'High Priority'
          WHEN c.message_count >= 4 THEN 'High Priority'
          ELSE 'High Priority'
        END as priority
        
      FROM conversations_v2 c
      LEFT JOIN leads l ON LOWER(c.lead_email) = LOWER(l.email)
      WHERE 
        c.status = 'active' 
        AND c.message_count > 1
        AND c.updated_at > NOW() - INTERVAL '24 hours'
      ORDER BY 
        c.updated_at DESC,
        c.message_count DESC
      LIMIT ${limit}
    `);

    return alerts.rows.map(row => ({
      id: row.id || `conv-${row.conversationId}`,
      name: row.name || 'Unknown Lead',
      message: row.message || 'Active conversation needs attention',
      priority: row.priority as 'High Priority' | 'Urgent',
      leadId: row.id || `conv-${row.conversationId}`,
      conversationId: row.conversationId,
      lastActivity: row.lastActivity,
      messageCount: row.messageCount
    }));
  }

  /**
   * Get V2 conversation metrics for dashboard
   */
  async getV2Metrics() {
    const metrics = await dbV2.execute(sql`
      SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
        COUNT(CASE WHEN status = 'handed_over' THEN 1 END) as handovers,
        COUNT(CASE WHEN message_count > 1 THEN 1 END) as conversations_with_responses,
        SUM(message_count) as total_messages,
        COUNT(DISTINCT agent_id) as active_agents
      FROM conversations_v2
      WHERE updated_at > NOW() - INTERVAL '30 days'
    `);

    const row = metrics.rows[0];
    return {
      liveCampaigns: row?.active_conversations || 0,
      handovers: row?.handovers || 0,
      conversationsWithResponses: row?.conversations_with_responses || 0,
      totalMessages: row?.total_messages || 0,
      activeAgents: row?.active_agents || 0
    };
  }

  /**
   * Create V1 lead from V2 conversation if missing
   */
  async createLeadFromV2Conversation(conversationId: string): Promise<string | null> {
    try {
      // Get V2 conversation data
      const [conversation] = await dbV2
        .select({
          leadEmail: v2schema.conversations.leadEmail,
          subject: v2schema.conversations.subject,
          agentId: v2schema.conversations.agentId
        })
        .from(v2schema.conversations)
        .where(eq(v2schema.conversations.id, conversationId))
        .limit(1);

      if (!conversation) return null;

      // Check if lead already exists
      const existingLead = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.email, conversation.leadEmail))
        .limit(1);

      if (existingLead.length > 0) {
        return existingLead[0].id;
      }

      // Create new lead
      const [newLead] = await db
        .insert(leads)
        .values({
          email: conversation.leadEmail,
          firstName: conversation.leadEmail.split('@')[0],
          status: 'active',
          leadSource: 'v2_conversation',
          notes: `Created from V2 conversation: ${conversation.subject}`,
          vehicleInterest: 'Unknown'
        })
        .returning({ id: leads.id });

      return newLead.id;
    } catch (error) {
      console.error('Error creating lead from V2 conversation:', error);
      return null;
    }
  }
}

export const bridgeService = new V1V2BridgeService();
