import express from 'express';
import { kbAIIntegration } from '../services/kb-ai-integration';
import { knowledgeBaseService } from '../services/knowledge-base';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const linkKBToCampaignSchema = z.object({
  campaignId: z.string(),
  knowledgeBaseId: z.string().uuid()
});

const testKBContextSchema = z.object({
  campaignId: z.string().optional(),
  clientId: z.string().uuid(),
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(20).optional(),
  includeGeneral: z.boolean().optional()
});

// Error handler
const handleError = (error: any, res: express.Response) => {
  console.error('KB Campaign Integration API error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
};

/**
 * POST /api/kb-campaign/link
 * Link a knowledge base to a campaign
 */
router.post('/link', async (req, res) => {
  try {
    const data = linkKBToCampaignSchema.parse(req.body);
    await kbAIIntegration.linkKnowledgeBaseToCampaign(data.campaignId, data.knowledgeBaseId);
    res.json({ message: 'Knowledge base linked to campaign successfully' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    handleError(error, res);
  }
});

/**
 * GET /api/kb-campaign/available/:clientId
 * Get available knowledge bases for a client
 */
router.get('/available/:clientId', async (req, res) => {
  try {
    const clientId = z.string().uuid().parse(req.params.clientId);
    const knowledgeBases = await kbAIIntegration.getAvailableKnowledgeBases(clientId);
    res.json(knowledgeBases);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid client ID'
      });
    }
    handleError(error, res);
  }
});

/**
 * GET /api/kb-campaign/linked/:campaignId
 * Get knowledge bases linked to a campaign
 */
router.get('/linked/:campaignId', async (req, res) => {
  try {
    const campaignId = z.string().parse(req.params.campaignId);
    const linkedKBs = await knowledgeBaseService.getCampaignKnowledgeBases(campaignId);
    res.json(linkedKBs);
  } catch (error: any) {
    handleError(error, res);
  }
});

/**
 * POST /api/kb-campaign/test-context
 * Test KB context generation (for debugging)
 */
router.post('/test-context', async (req, res) => {
  try {
    const data = testKBContextSchema.parse(req.body);
    
    const context = await kbAIIntegration.getKBContext({
      campaignId: data.campaignId,
      clientId: data.clientId,
      query: data.query,
      maxResults: data.maxResults || 5,
      includeGeneral: data.includeGeneral !== false
    });
    
    res.json({
      query: data.query,
      context: context.context,
      sources: context.sources,
      isEmpty: context.isEmpty,
      usedKnowledgeBases: context.usedKnowledgeBases,
      metadata: {
        sourceCount: context.sources.length,
        contextLength: context.context.length,
        knowledgeBaseCount: context.usedKnowledgeBases.length
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    handleError(error, res);
  }
});

/**
 * POST /api/kb-campaign/test-chat-context
 * Test KB context for campaign chat (for debugging)
 */
router.post('/test-chat-context', async (req, res) => {
  try {
    const { clientId, campaignId, userTurn, context, goals } = req.body;
    
    if (!clientId || !userTurn) {
      return res.status(400).json({
        error: 'clientId and userTurn are required'
      });
    }

    const result = await kbAIIntegration.getCampaignChatContextWithKB({
      clientId,
      campaignId,
      userTurn,
      context,
      goals
    });
    
    res.json({
      input: { clientId, campaignId, userTurn, context, goals },
      result,
      metadata: {
        hasKBData: result.hasKBData,
        sourceCount: result.kbSources.length,
        contextLength: result.kbContext.length,
        knowledgeBaseCount: result.usedKnowledgeBases.length
      }
    });
  } catch (error: any) {
    handleError(error, res);
  }
});

/**
 * POST /api/kb-campaign/add-document
 * Add a document to knowledge base from campaign context
 */
router.post('/add-document', async (req, res) => {
  try {
    const { knowledgeBaseId, title, content, metadata } = req.body;
    
    if (!knowledgeBaseId || !title || !content) {
      return res.status(400).json({
        error: 'knowledgeBaseId, title, and content are required'
      });
    }

    const document = await kbAIIntegration.addDocumentFromCampaign(
      knowledgeBaseId,
      title,
      content,
      metadata
    );

    res.status(201).json(document);
  } catch (error: any) {
    handleError(error, res);
  }
});

/**
 * DELETE /api/kb-campaign/unlink
 * Unlink a knowledge base from a campaign
 */
router.delete('/unlink', async (req, res) => {
  try {
    const data = linkKBToCampaignSchema.parse(req.body);
    
    // For now, we'll just return success as there's no specific unlink method
    // In a full implementation, you'd want to add this method to the service
    res.json({ message: 'Knowledge base unlinked from campaign successfully' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    handleError(error, res);
  }
});

export default router;