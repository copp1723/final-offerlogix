/**
 * V2 Agents API Routes
 * 
 * Handles agent management for the V2 system.
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { dbV2, v2schema } from '../db.js';

const router = Router();

// ============================================================================
// GET ALL AGENTS
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const agents = await dbV2
      .select({
        id: v2schema.agents.id,
        name: v2schema.agents.name,
        domain: v2schema.agents.domain,
        localPart: v2schema.agents.localPart,
        variables: v2schema.agents.variables,
        isActive: v2schema.agents.isActive,
        createdAt: v2schema.agents.createdAt,
        updatedAt: v2schema.agents.updatedAt,
      })
      .from(v2schema.agents)
      .orderBy(v2schema.agents.createdAt);

    res.json({
      success: true,
      agents: agents.map(agent => ({
        ...agent,
        // Ensure variables is properly typed
        variables: agent.variables as {
          role: string;
          dealership: string;
          handoverTriggers: string;
          [key: string]: unknown;
        }
      }))
    });
  } catch (error) {
    console.error('Error fetching V2 agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agents'
    });
  }
});

// ============================================================================
// GET SINGLE AGENT
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [agent] = await dbV2
      .select({
        id: v2schema.agents.id,
        name: v2schema.agents.name,
        domain: v2schema.agents.domain,
        localPart: v2schema.agents.localPart,
        variables: v2schema.agents.variables,
        isActive: v2schema.agents.isActive,
        createdAt: v2schema.agents.createdAt,
        updatedAt: v2schema.agents.updatedAt,
      })
      .from(v2schema.agents)
      .where(eq(v2schema.agents.id, id));
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    res.json({
      success: true,
      agent: {
        ...agent,
        variables: agent.variables as {
          role: string;
          dealership: string;
          handoverTriggers: string;
          [key: string]: unknown;
        }
      }
    });
  } catch (error) {
    console.error('Error fetching V2 agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent'
    });
  }
});

// ============================================================================
// GET AGENT STATS
// ============================================================================

router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get conversation counts by status
    const conversationStats = await dbV2
      .select({
        status: v2schema.conversations.status,
        count: v2schema.conversations.id,
      })
      .from(v2schema.conversations)
      .where(eq(v2schema.conversations.agentId, id));
    
    // Count total messages sent by this agent
    const messageStats = await dbV2
      .select({
        count: v2schema.messages.id,
      })
      .from(v2schema.messages)
      .innerJoin(v2schema.conversations, eq(v2schema.messages.conversationId, v2schema.conversations.id))
      .where(eq(v2schema.conversations.agentId, id));
    
    const stats = {
      totalConversations: conversationStats.length,
      activeConversations: conversationStats.filter(s => s.status === 'active').length,
      handoverConversations: conversationStats.filter(s => s.status === 'handover').length,
      closedConversations: conversationStats.filter(s => s.status === 'closed').length,
      totalMessages: messageStats.length,
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent stats'
    });
  }
});

// ============================================================================
// UPDATE AGENT STATUS
// ============================================================================

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean'
      });
    }
    
    const [updatedAgent] = await dbV2
      .update(v2schema.agents)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(v2schema.agents.id, id))
      .returning();
    
    if (!updatedAgent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    res.json({
      success: true,
      agent: updatedAgent
    });
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent status'
    });
  }
});

export default router;
