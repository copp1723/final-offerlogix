import express from 'express';
import { knowledgeBaseService } from '../services/knowledge-base';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  settings: z.record(z.any()).optional()
});

const addDocumentSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  url: z.string().url().optional(),
  documentType: z.enum(['note', 'webpage', 'pdf', 'google_doc', 'notion_doc', 'image', 'video']).optional(),
  tags: z.array(z.string()).optional(),
  containerTags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const searchKnowledgeBaseSchema = z.object({
  query: z.string().min(1),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  clientId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional(),
  threshold: z.number().min(0).max(1).optional(),
  onlyMatchingChunks: z.boolean().optional(),
  filters: z.record(z.any()).optional()
});

const linkCampaignSchema = z.object({
  campaignId: z.string(),
  knowledgeBaseId: z.string().uuid()
});

// Error handler
const handleError = (error: any, res: express.Response) => {
  console.error('Knowledge base API error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
};

/**
 * POST /api/knowledge-base
 * Create a new knowledge base
 */
router.post('/', async (req, res) => {
  try {
    const data = createKnowledgeBaseSchema.parse(req.body);
    const knowledgeBase = await knowledgeBaseService.createKnowledgeBase(data);
    res.status(201).json(knowledgeBase);
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
 * GET /api/knowledge-base/:clientId
 * Get all knowledge bases for a client
 */
router.get('/:clientId', async (req, res) => {
  try {
    const clientId = z.string().uuid().parse(req.params.clientId);
    const knowledgeBases = await knowledgeBaseService.getKnowledgeBases(clientId);
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
 * POST /api/knowledge-base/documents
 * Add a document to a knowledge base
 */
router.post('/documents', async (req, res) => {
  try {
    const data = addDocumentSchema.parse(req.body);
    const document = await knowledgeBaseService.addDocument(data);
    res.status(201).json(document);
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
 * GET /api/knowledge-base/:knowledgeBaseId/documents
 * Get documents in a knowledge base
 */
router.get('/:knowledgeBaseId/documents', async (req, res) => {
  try {
    const knowledgeBaseId = z.string().uuid().parse(req.params.knowledgeBaseId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const documents = await knowledgeBaseService.getDocuments(knowledgeBaseId, limit, offset);
    res.json(documents);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid knowledge base ID'
      });
    }
    handleError(error, res);
  }
});

/**
 * DELETE /api/knowledge-base/documents/:documentId
 * Delete a document from knowledge base
 */
router.delete('/documents/:documentId', async (req, res) => {
  try {
    const documentId = z.string().uuid().parse(req.params.documentId);
    await knowledgeBaseService.deleteDocument(documentId);
    res.status(204).send();
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid document ID'
      });
    }
    handleError(error, res);
  }
});

/**
 * POST /api/knowledge-base/search
 * Search across knowledge bases
 */
router.post('/search', async (req, res) => {
  try {
    const data = searchKnowledgeBaseSchema.parse(req.body);
    const results = await knowledgeBaseService.searchKnowledgeBase(data);
    res.json(results);
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
 * POST /api/knowledge-base/link-campaign
 * Link a campaign to a knowledge base
 */
router.post('/link-campaign', async (req, res) => {
  try {
    const data = linkCampaignSchema.parse(req.body);
    await knowledgeBaseService.linkCampaignToKnowledgeBase(data.campaignId, data.knowledgeBaseId);
    res.status(201).json({ message: 'Campaign linked to knowledge base successfully' });
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
 * GET /api/knowledge-base/campaign/:campaignId
 * Get knowledge bases linked to a campaign
 */
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const campaignId = z.string().parse(req.params.campaignId);
    const knowledgeBases = await knowledgeBaseService.getCampaignKnowledgeBases(campaignId);
    res.json(knowledgeBases);
  } catch (error: any) {
    handleError(error, res);
  }
});

/**
 * POST /api/knowledge-base/ingest-url
 * Ingest content from a URL
 */
router.post('/ingest-url', async (req, res) => {
  try {
    const { knowledgeBaseId, url, title, tags, containerTags } = req.body;
    
    if (!knowledgeBaseId || !url) {
      return res.status(400).json({
        error: 'knowledgeBaseId and url are required'
      });
    }

    // For now, we'll use the URL as content
    // In a production system, you'd want to fetch and extract content from the URL
    const content = `URL: ${url}\\n\\nThis document was ingested from a URL. Content extraction would be implemented here.`;
    
    const document = await knowledgeBaseService.addDocument({
      knowledgeBaseId,
      title: title || `Document from ${url}`,
      content,
      url,
      documentType: 'webpage',
      tags,
      containerTags
    });

    res.status(201).json(document);
  } catch (error: any) {
    handleError(error, res);
  }
});

/**
 * POST /api/knowledge-base/bulk-ingest
 * Bulk ingest multiple documents
 */
router.post('/bulk-ingest', async (req, res) => {
  try {
    const { knowledgeBaseId, documents } = req.body;
    
    if (!knowledgeBaseId || !Array.isArray(documents)) {
      return res.status(400).json({
        error: 'knowledgeBaseId and documents array are required'
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < documents.length; i++) {
      try {
        const doc = documents[i];
        const result = await knowledgeBaseService.addDocument({
          knowledgeBaseId,
          ...doc
        });
        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          error: String(error)
        });
      }
    }

    res.status(201).json({
      success: results.length,
      errorCount: errors.length,
      results,
      errors
    });
  } catch (error: any) {
    handleError(error, res);
  }
});

export default router;