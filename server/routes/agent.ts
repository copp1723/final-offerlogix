/**
 * Agent Runtime API Routes - Multi-tenant AI agent management
 */

import { Router } from 'express';
import { AgentRuntime } from '../services/agent-runtime';
import { storage } from '../storage';
import { aiAgentConfig } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';

export const agentRouter = Router();

/**
 * POST /api/agent/reply
 * Generate AI reply using active agent configuration
 */
agentRouter.post('/reply', async (req, res) => {
  try {
    // For now, use a default client ID - in production this would come from auth
    const clientId = req.body.clientId || 'default-client';
    const { message, leadId, conversationId, topic, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Ensure default config exists
    await AgentRuntime.ensureDefaultConfig(clientId);

    const result = await AgentRuntime.reply({
      clientId,
      message,
      leadId,
      conversationId,
      topic,
      model
    });

    res.json(result);
  } catch (error) {
    console.error('Agent reply error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate reply' 
    });
  }
});

/**
 * GET /api/agent/config/active
 * Get active agent configuration for client
 */
agentRouter.get('/config/active', async (req, res) => {
  try {
    const clientId = req.query.clientId as string || 'default-client';
    
    const config = await AgentRuntime.getActiveConfig(clientId);
    if (!config) {
      // Create default config
      const configId = await AgentRuntime.ensureDefaultConfig(clientId);
      const newConfig = await AgentRuntime.getActiveConfig(clientId);
      return res.json(newConfig);
    }

    res.json(config);
  } catch (error) {
    console.error('Get active config error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get active config' 
    });
  }
});

/**
 * PUT /api/agent/config/active
 * Update active agent configuration
 */
agentRouter.put('/config/active', async (req, res) => {
  try {
    const clientId = req.body.clientId || 'default-client';
    const { 
      name, 
      personality, 
      tonality, 
      responseStyle, 
      dosList, 
      dontsList, 
      model, 
      systemPrompt 
    } = req.body;

    // Get current active config
    const currentConfig = await AgentRuntime.getActiveConfig(clientId);
    
    if (currentConfig) {
      // Update existing config
      await db
        .update(aiAgentConfig)
        .set({
          name: name || currentConfig.name,
          personality: personality || currentConfig.personality,
          tonality: tonality || currentConfig.tonality,
          responseStyle: responseStyle || currentConfig.responseStyle,
          dosList: dosList || currentConfig.dosList,
          dontsList: dontsList || currentConfig.dontsList,
          model: model || currentConfig.model,
          systemPrompt: systemPrompt || currentConfig.systemPrompt,
          updatedAt: new Date()
        })
        .where(eq(aiAgentConfig.id, currentConfig.id));

      res.json({ success: true, configId: currentConfig.id });
    } else {
      // Create new config
      const configId = await AgentRuntime.ensureDefaultConfig(clientId);
      res.json({ success: true, configId });
    }
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to update config' 
    });
  }
});

/**
 * GET /api/agent/health
 * Health check for agent system
 */
agentRouter.get('/health', async (req, res) => {
  try {
    const clientId = req.query.clientId as string || 'default-client';
    
    // Test agent config loading
    const config = await AgentRuntime.getActiveConfig(clientId);
    
    // Test basic reply generation
    const testReply = await AgentRuntime.reply({
      clientId,
      message: 'Hello, this is a health check',
      maxTokens: 50
    });

    res.json({
      ok: true,
      details: {
        hasActiveConfig: !!config,
        configId: config?.id || 'none',
        model: config?.model || 'default',
        replyGeneration: !!testReply.reply,
        openrouterConfigured: !!process.env.OPENROUTER_API_KEY
      }
    });
  } catch (error) {
    console.error('Agent health check error:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

export default agentRouter;