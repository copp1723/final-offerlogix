import { Router } from 'express';
import { z } from 'zod';
import { aiPersonaManagementService, type PersonaConfig } from '../services/ai-persona-management';
import { validateRequest } from '../middleware/validation';
import { db } from '../db';
import { clients, aiPersonas } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * AI Persona Management API Routes
 * 
 * Provides REST API endpoints for managing AI personas in the multi-persona
 * OfferLogix system, including CRUD operations, campaign assignment, and
 * knowledge base associations.
 */

// Validation schemas
const createPersonaSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().optional(),
    targetAudience: z.string().min(1, 'Target audience is required').max(255),
    industry: z.string().max(100).default('automotive'),
    tonality: z.string().default('professional'),
    personality: z.string().optional(),
    communicationStyle: z.string().default('helpful'),
    model: z.string().default('openai/gpt-4o'),
    temperature: z.number().min(0).max(100).default(70),
    maxTokens: z.number().min(50).max(2000).default(300),
    systemPrompt: z.string().optional(),
    responseGuidelines: z.array(z.string()).default([]),
    escalationCriteria: z.array(z.string()).default([]),
    preferredChannels: z.array(z.string()).default(['email']),
    handoverSettings: z.record(z.any()).default({}),
    knowledgeBaseAccessLevel: z.enum(['campaign_only', 'client_all', 'persona_filtered']).default('campaign_only'),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    priority: z.number().default(100),
    metadata: z.record(z.any()).default({})
  })
});

const updatePersonaSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    targetAudience: z.string().min(1).max(255).optional(),
    industry: z.string().max(100).optional(),
    tonality: z.string().optional(),
    personality: z.string().optional(),
    communicationStyle: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(100).optional(),
    maxTokens: z.number().min(50).max(2000).optional(),
    systemPrompt: z.string().optional(),
    responseGuidelines: z.array(z.string()).optional(),
    escalationCriteria: z.array(z.string()).optional(),
    preferredChannels: z.array(z.string()).optional(),
    handoverSettings: z.record(z.any()).optional(),
    knowledgeBaseAccessLevel: z.enum(['campaign_only', 'client_all', 'persona_filtered']).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    priority: z.number().optional(),
    metadata: z.record(z.any()).optional()
  })
});

const linkKnowledgeBaseSchema = z.object({
  body: z.object({
    knowledgeBaseId: z.string().uuid('Invalid knowledge base ID'),
    accessLevel: z.enum(['read', 'write', 'admin']).default('read'),
    priority: z.number().default(100)
  })
});

const searchPersonasSchema = z.object({
  query: z.object({
    targetAudience: z.string().optional(),
    industry: z.string().optional(),
    isActive: z.string().transform(val => val === 'true').optional(),
    includeKnowledgeBases: z.string().transform(val => val === 'true').default('false'),
    includeCampaignCounts: z.string().transform(val => val === 'true').default('false')
  })
});

/**
 * GET /api/personas
 * Get all personas for a client with optional filtering
 */
router.get('/', validateRequest(searchPersonasSchema), async (req, res) => {
  try {
    // Get client ID from header or look up default client
    let clientId = req.headers['x-client-id'] as string;
    
    if (!clientId || clientId === 'default') {
      // Look up the default client's actual UUID
      const [defaultClient] = await db
        .select()
        .from(clients)
        .where(eq(clients.name, 'Default Client'))
        .limit(1);
      
      if (!defaultClient) {
        // If no default client exists, create one
        const [newClient] = await db
          .insert(clients)
          .values({
            name: 'Default Client',
            brandingConfig: {},
            settings: {},
            active: true
          })
          .returning();
        clientId = newClient.id;
      } else {
        clientId = defaultClient.id;
      }
    }

    const { 
      targetAudience, 
      industry, 
      isActive,
      includeKnowledgeBases,
      includeCampaignCounts
    } = req.query as any;

    const personas = await aiPersonaManagementService.getPersonas({
      clientId,
      targetAudience,
      industry,
      isActive,
      includeKnowledgeBases,
      includeCampaignCounts
    });

    res.json({
      success: true,
      data: personas,
      total: personas.length
    });
  } catch (error) {
    console.error('Get personas error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Request query:', JSON.stringify(req.query, null, 2));
    console.error('Client ID:', req.headers['x-client-id'] || 'default');
    res.status(500).json({
      success: false,
      error: 'Failed to get personas',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
        clientId: req.headers['x-client-id'] || 'default'
      } : undefined
    });
  }
});

/**
 * GET /api/personas/:id
 * Get a specific persona by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Persona ID is required'
      });
    }

    const persona = await aiPersonaManagementService.getPersona(id);
    
    if (!persona) {
      return res.status(404).json({
        success: false,
        error: 'Persona not found'
      });
    }

    res.json({
      success: true,
      data: persona
    });
  } catch (error) {
    console.error('Get persona error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get persona',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/personas
 * Create a new persona
 */
router.post('/', validateRequest(createPersonaSchema), async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string || 'default';
    const personaConfig = req.body as PersonaConfig;

    const persona = await aiPersonaManagementService.createPersona(clientId, personaConfig);

    res.status(201).json({
      success: true,
      data: persona,
      message: 'Persona created successfully'
    });
  } catch (error) {
    console.error('Create persona error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create persona',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/personas/:id
 * Update a persona
 */
router.put('/:id', validateRequest(updatePersonaSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Persona ID is required'
      });
    }

    const persona = await aiPersonaManagementService.updatePersona(id, updates);

    res.json({
      success: true,
      data: persona,
      message: 'Persona updated successfully'
    });
  } catch (error) {
    console.error('Update persona error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update persona',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/personas/:id
 * Delete (deactivate) a persona
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Persona ID is required'
      });
    }

    await aiPersonaManagementService.deletePersona(id);

    res.json({
      success: true,
      message: 'Persona deactivated successfully'
    });
  } catch (error) {
    console.error('Delete persona error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete persona',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/personas/default
 * Get the default persona for a client
 */
router.get('/client/default', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string || 'default';

    const persona = await aiPersonaManagementService.getDefaultPersona(clientId);

    if (!persona) {
      return res.status(404).json({
        success: false,
        error: 'No default persona found'
      });
    }

    res.json({
      success: true,
      data: persona
    });
  } catch (error) {
    console.error('Get default persona error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get default persona',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/personas/:id/knowledge-bases
 * Link a persona to a knowledge base
 */
router.post('/:id/knowledge-bases', validateRequest(linkKnowledgeBaseSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { knowledgeBaseId, accessLevel, priority } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Persona ID is required'
      });
    }

    await aiPersonaManagementService.linkPersonaToKnowledgeBase(
      id, 
      knowledgeBaseId, 
      accessLevel, 
      priority
    );

    res.json({
      success: true,
      message: 'Knowledge base linked to persona successfully'
    });
  } catch (error) {
    console.error('Link knowledge base error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link knowledge base',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/personas/:id/knowledge-bases/:kbId
 * Unlink a persona from a knowledge base
 */
router.delete('/:id/knowledge-bases/:kbId', async (req, res) => {
  try {
    const { id, kbId } = req.params;

    if (!id || !kbId) {
      return res.status(400).json({
        success: false,
        error: 'Persona ID and Knowledge Base ID are required'
      });
    }

    await aiPersonaManagementService.unlinkPersonaFromKnowledgeBase(id, kbId);

    res.json({
      success: true,
      message: 'Knowledge base unlinked from persona successfully'
    });
  } catch (error) {
    console.error('Unlink knowledge base error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink knowledge base',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/personas/:id/knowledge-bases
 * Get knowledge bases associated with a persona
 */
router.get('/:id/knowledge-bases', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Persona ID is required'
      });
    }

    const knowledgeBases = await aiPersonaManagementService.getPersonaKnowledgeBases(id);

    res.json({
      success: true,
      data: knowledgeBases,
      total: knowledgeBases.length
    });
  } catch (error) {
    console.error('Get persona knowledge bases error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get persona knowledge bases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/personas/defaults
 * Create default personas for a client
 */
router.post('/create-defaults', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string || 'default';

    const personas = await aiPersonaManagementService.createDefaultPersonas(clientId);

    res.status(201).json({
      success: true,
      data: personas,
      message: `Created ${personas.length} default personas successfully`
    });
  } catch (error) {
    console.error('Create default personas error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create default personas',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/personas/:id/system-prompt
 * Generate system prompt for a persona with context
 */
router.get('/:id/system-prompt', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetAudience, campaignContext } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Persona ID is required'
      });
    }

    const persona = await aiPersonaManagementService.getPersona(id);
    if (!persona) {
      return res.status(404).json({
        success: false,
        error: 'Persona not found'
      });
    }

    const systemPrompt = aiPersonaManagementService.generatePersonaSystemPrompt(persona, {
      targetAudience: targetAudience as string,
      campaignContext: campaignContext as string
    });

    res.json({
      success: true,
      data: {
        systemPrompt,
        persona: persona.name,
        aiSettings: aiPersonaManagementService.getPersonaAISettings(persona)
      }
    });
  } catch (error) {
    console.error('Generate system prompt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate system prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/personas/health
 * Health check for personas API
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connection and table access
    const testQuery = await db.select().from(aiPersonas).limit(1);
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ai-personas-api',
      database: 'connected',
      personasTable: 'accessible',
      samplePersonasCount: testQuery.length
    });
  } catch (error) {
    console.error('Personas API health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'ai-personas-api',
      database: error instanceof Error && error.message.includes('does not exist') ? 'table_missing' : 'connection_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;