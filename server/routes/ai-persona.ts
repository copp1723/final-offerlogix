import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { aiPersonas } from '@shared/schema';
import type { InsertAiPersona, AiPersona } from '@shared/schema';
import { buildErrorResponse, createErrorContext } from '../utils/error-utils';

const router = Router();

/**
 * AI Persona Management API Routes
 * 
 * Provides REST API endpoints for managing AI personas.
 */

// Validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      schema.parse({ 
        body: req.body, 
        query: req.query, 
        params: req.params 
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse = buildErrorResponse(error);
        return res.status(400).json({
          success: false,
          ...errorResponse,
          details: error.errors
        });
      }
      next(error);
    }
  };
};

/**
 * GET /api/personas
 * Get all personas for a client with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string || '00000000-0000-0000-0000-000000000001';
    const {
      targetAudience,
      industry,
      isActive,
      includeKnowledgeBases,
      includeCampaignCounts
    } = req.query as any;

    // Build query conditions
    const conditions = [eq(aiPersonas.clientId, clientId)];

    if (targetAudience) {
      conditions.push(eq(aiPersonas.targetAudience, targetAudience));
    }
    if (industry) {
      conditions.push(eq(aiPersonas.industry, industry));
    }
    if (isActive !== undefined) {
      conditions.push(eq(aiPersonas.isActive, isActive === 'true'));
    }

    // Get personas from database
    const personas = await db
      .select()
      .from(aiPersonas)
      .where(and(...conditions))
      .orderBy(desc(aiPersonas.priority), desc(aiPersonas.createdAt));

    res.json({
      success: true,
      data: personas,
      total: personas.length
    });
  } catch (error) {
    const errorContext = createErrorContext(error, { operation: 'get_personas', clientId });
    console.error('Get personas error:', errorContext);
    const errorResponse = buildErrorResponse(error);
    res.status(500).json({
      success: false,
      ...errorResponse
    });
  }
});

/**
 * POST /api/personas/create-defaults
 * Create default personas for a client
 */
router.post('/create-defaults', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string || '00000000-0000-0000-0000-000000000001';

    // For now, return empty array since personas functionality is not fully implemented
    const personas: any[] = [];

    res.status(201).json({
      success: true,
      data: personas,
      message: `Personas feature is not yet fully implemented`
    });
  } catch (error) {
    const errorContext = createErrorContext(error, { operation: 'create_default_personas', clientId });
    console.error('Create default personas error:', errorContext);
    const errorResponse = buildErrorResponse(error);
    res.status(500).json({
      success: false,
      ...errorResponse
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
      const errorResponse = buildErrorResponse(new Error('Persona ID is required'));
      return res.status(400).json({
        success: false,
        ...errorResponse
      });
    }

    // For now, return 404 since personas functionality is not fully implemented
    const errorResponse = buildErrorResponse(new Error('Persona not found'));
    return res.status(404).json({
      success: false,
      ...errorResponse
    });
  } catch (error) {
    const errorContext = createErrorContext(error, { operation: 'get_persona', personaId: req.params.id });
    console.error('Get persona error:', errorContext);
    const errorResponse = buildErrorResponse(error);
    res.status(500).json({
      success: false,
      ...errorResponse
    });
  }
});

/**
 * POST /api/personas
 * Create a new persona
 */
router.post('/', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string || '00000000-0000-0000-0000-000000000001';
    const {
      name,
      description,
      targetAudience,
      industry = 'automotive',
      tonality = 'professional',
      personality,
      communicationStyle = 'helpful',
      model = 'openai/gpt-4o',
      temperature = 70,
      maxTokens = 300,
      systemPrompt,
      responseGuidelines = [],
      escalationCriteria = [],
      preferredChannels = ['email'],
      handoverSettings = {},
      knowledgeBaseAccessLevel = 'campaign_only',
      isActive = true,
      isDefault = false,
      priority = 0,
      metadata = {},
      emailSubdomain
    } = req.body;

    // Validate required fields
    if (!name || !targetAudience) {
      const errorResponse = buildErrorResponse(new Error('Name and target audience are required'));
      return res.status(400).json({
        success: false,
        ...errorResponse
      });
    }

    // Create persona in database
    const [newPersona] = await db.insert(aiPersonas).values({
      clientId,
      name,
      description,
      targetAudience,
      industry,
      tonality,
      personality,
      communicationStyle,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      responseGuidelines,
      escalationCriteria,
      preferredChannels,
      handoverSettings,
      knowledgeBaseAccessLevel,
      isActive,
      isDefault,
      priority,
      metadata,
      emailSubdomain
    }).returning();

    res.status(201).json({
      success: true,
      data: newPersona,
      message: 'Persona created successfully'
    });
  } catch (error) {
    const errorContext = createErrorContext(error, { 
      operation: 'create_persona', 
      clientId,
      personaData: { name, targetAudience, industry }
    });
    console.error('Create persona error:', errorContext);
    const errorResponse = buildErrorResponse(error);
    res.status(500).json({
      success: false,
      ...errorResponse
    });
  }
});

/**
 * PUT /api/personas/:id
 * Update a persona
 */
router.put('/:id', async (req, res) => {
  try {
    // For now, return not implemented
    const errorResponse = buildErrorResponse(new Error('Persona update not yet implemented'));
    res.status(501).json({
      success: false,
      ...errorResponse
    });
  } catch (error) {
    const errorContext = createErrorContext(error, { operation: 'update_persona', personaId: req.params.id });
    console.error('Update persona error:', errorContext);
    const errorResponse = buildErrorResponse(error);
    res.status(500).json({
      success: false,
      ...errorResponse
    });
  }
});

export default router;
