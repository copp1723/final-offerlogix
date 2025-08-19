import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { 
  knowledgeBases, 
  kbDocuments, 
  kbDocumentChunks,
  campaignKnowledgeBases,
  type InsertKnowledgeBase,
  type InsertKbDocument,
  type InsertKbDocumentChunk
} from '../../shared/schema';
import { supermemory, isRAGEnabled } from '../integrations/supermemory';
import crypto from 'crypto';

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  clientId: string;
  settings?: Record<string, any>;
}

export interface AddDocumentRequest {
  knowledgeBaseId: string;
  title: string;
  content: string;
  url?: string;
  documentType?: 'note' | 'webpage' | 'pdf' | 'google_doc' | 'notion_doc' | 'image' | 'video';
  tags?: string[];
  containerTags?: string[];
  metadata?: Record<string, any>;
  clientId?: string; // Optional, can be derived from knowledge base
}

export interface SearchKnowledgeBaseRequest {
  query: string;
  knowledgeBaseIds?: string[];
  clientId: string;
  limit?: number;
  threshold?: number;
  onlyMatchingChunks?: boolean;
  filters?: Record<string, any>;
}

class KnowledgeBaseService {
  private static instance: KnowledgeBaseService | null = null;

  private constructor() {}

  static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
    }
    return KnowledgeBaseService.instance;
  }

  /**
   * Create a new knowledge base
   */
  async createKnowledgeBase(request: CreateKnowledgeBaseRequest) {
    try {
      const kbData: InsertKnowledgeBase = {
        name: request.name,
        description: request.description,
        clientId: request.clientId,
        settings: request.settings || {},
        metadata: {},
        status: 'active',
        indexStatus: 'pending',
        documentCount: 0,
        totalChunks: 0,
        version: 1
      };

      const [knowledgeBase] = await db.insert(knowledgeBases).values(kbData).returning();
      
      console.log(`Created knowledge base: ${knowledgeBase.name} (${knowledgeBase.id})`);
      return knowledgeBase;
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      throw new Error(`Failed to create knowledge base: ${error}`);
    }
  }

  /**
   * Get knowledge bases for a client
   */
  async getKnowledgeBases(clientId: string) {
    try {
      return await db
        .select()
        .from(knowledgeBases)
        .where(and(
          eq(knowledgeBases.clientId, clientId),
          eq(knowledgeBases.status, 'active')
        ))
        .orderBy(desc(knowledgeBases.createdAt));
    } catch (error) {
      console.error('Failed to get knowledge bases:', error);
      throw new Error(`Failed to get knowledge bases: ${error}`);
    }
  }

  /**
   * Add a document to a knowledge base
   */
  async addDocument(request: AddDocumentRequest) {
    try {
      // Get clientId from knowledge base if not provided
      let clientId = request.clientId;
      if (!clientId) {
        const [kb] = await db
          .select({ clientId: knowledgeBases.clientId })
          .from(knowledgeBases)
          .where(eq(knowledgeBases.id, request.knowledgeBaseId))
          .limit(1);
        
        if (!kb) {
          throw new Error('Knowledge base not found');
        }
        clientId = kb.clientId;
      }

      // Generate content hash for deduplication
      const contentHash = crypto.createHash('sha256').update(request.content).digest('hex');
      
      // Check if document with same hash already exists in this KB
      const existingDoc = await db
        .select()
        .from(kbDocuments)
        .where(and(
          eq(kbDocuments.kbId, request.knowledgeBaseId),
          eq(kbDocuments.contentHash, contentHash)
        ))
        .limit(1);

      if (existingDoc.length > 0) {
        console.log('Document with same content already exists, returning existing document');
        return existingDoc[0];
      }

      const docData: InsertKbDocument = {
        kbId: request.knowledgeBaseId,
        title: request.title,
        sourceType: request.documentType || 'note',
        sourceUri: request.url,
        contentHash,
        rawContent: request.content,
        processedContent: request.content,
        containerTags: request.containerTags || [],
        metadata: request.metadata || {},
        processingStatus: 'pending',
        chunkCount: 0,
        fileSizeBytes: Buffer.byteLength(request.content, 'utf8'),
        version: 1
      };

      const [document] = await db.insert(kbDocuments).values(docData).returning();
      
      // Process document asynchronously
      this.processDocumentAsync(document, clientId);
      
      // Update knowledge base document count
      await this.updateKnowledgeBaseStats(request.knowledgeBaseId);
      
      console.log(`Added document: ${document.title} (${document.id})`);
      return document;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw new Error(`Failed to add document: ${error}`);
    }
  }

  /**
   * Process document asynchronously (chunking + Supermemory ingestion)
   */
  private async processDocumentAsync(document: any, clientId: string) {
    try {
      // Update status to processing
      await db
        .update(kbDocuments)
        .set({ 
          processingStatus: 'processing',
          supermemoryStatus: 'queued'
        })
        .where(eq(kbDocuments.id, document.id));

      // Chunk the document
      const chunks = this.chunkDocument(document.processedContent || document.rawContent);
      
      // Store chunks in database
      const chunkData: InsertKbDocumentChunk[] = chunks.map((chunk, index) => ({
        documentId: document.id,
        kbId: document.kbId,
        chunkIndex: index,
        content: chunk.content,
        summary: null, // Optional summary field
        tokenCount: this.estimateTokenCount(chunk.content),
        supermemoryId: null, // Will be updated after Supermemory ingestion
        embeddingStatus: 'pending',
        metadata: {}
      }));

      if (chunkData.length > 0) {
        await db.insert(kbDocumentChunks).values(chunkData);
      }

      // Ingest to Supermemory if enabled
      let supermemoryId: string | undefined;
      if (isRAGEnabled()) {
        try {
          const supermemoryData = {
            content: document.processedContent || document.rawContent,
            metadata: {
              title: document.title,
              sourceType: document.sourceType,
              sourceUri: document.sourceUri,
              documentId: document.id,
              knowledgeBaseId: document.kbId,
              clientId: clientId,
              ...document.metadata
            },
            containerTags: [
              `client_${clientId}`,
              `kb_${document.kbId}`,
              `doc_${document.id}`,
              ...(document.containerTags || [])
            ]
          };

          const result = await supermemory.add(supermemoryData);
          supermemoryId = result.id;
          
          console.log(`Ingested document to Supermemory: ${supermemoryId}`);
        } catch (error) {
          console.warn('Failed to ingest document to Supermemory:', error);
        }
      }

      // Update document with final status
      await db
        .update(kbDocuments)
        .set({
          processingStatus: 'indexed',
          supermemoryStatus: supermemoryId ? 'done' : 'failed',
          supermemoryId: supermemoryId,
          chunkCount: chunks.length,
          processedAt: new Date()
        })
        .where(eq(kbDocuments.id, document.id));

      // Update knowledge base stats
      await this.updateKnowledgeBaseStats(document.kbId);

      console.log(`Processed document: ${document.title} (${chunks.length} chunks)`);
    } catch (error) {
      console.error('Failed to process document:', error);
      
      // Update document with error status
      await db
        .update(kbDocuments)
        .set({
          processingStatus: 'failed',
          supermemoryStatus: 'failed',
          processingError: String(error)
        })
        .where(eq(kbDocuments.id, document.id));
    }
  }

  /**
   * Simple document chunking strategy
   */
  private chunkDocument(content: string, maxChunkSize: number = 1000, overlap: number = 100) {
    if (!content) return [];
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: Array<{content: string, startIndex: number, endIndex: number}> = [];
    
    let currentChunk = '';
    let startIndex = 0;
    let currentIndex = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim() + '.';
      
      if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          content: currentChunk.trim(),
          startIndex: startIndex,
          endIndex: currentIndex
        });
        
        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + ' ' + trimmedSentence;
        startIndex = currentIndex - overlap;
      } else {
        if (currentChunk.length === 0) {
          startIndex = currentIndex;
        }
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + trimmedSentence;
      }
      
      currentIndex += trimmedSentence.length + 1;
    }
    
    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        startIndex: startIndex,
        endIndex: currentIndex
      });
    }
    
    return chunks;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Update knowledge base statistics
   */
  private async updateKnowledgeBaseStats(knowledgeBaseId: string) {
    try {
      // Count documents
      const docCountResult = await db
        .select()
        .from(kbDocuments)
        .where(eq(kbDocuments.kbId, knowledgeBaseId));
      
      // Count chunks
      const chunkCountResult = await db
        .select()
        .from(kbDocumentChunks)
        .where(eq(kbDocumentChunks.kbId, knowledgeBaseId));

      await db
        .update(knowledgeBases)
        .set({
          documentCount: docCountResult.length,
          totalChunks: chunkCountResult.length,
          lastIndexedAt: new Date()
        })
        .where(eq(knowledgeBases.id, knowledgeBaseId));
    } catch (error) {
      console.warn('Failed to update knowledge base stats:', error);
    }
  }

  /**
   * Search across knowledge bases
   */
  async searchKnowledgeBase(request: SearchKnowledgeBaseRequest) {
    try {
      if (!isRAGEnabled()) {
        console.warn('Supermemory not enabled, falling back to database search');
        return this.searchDatabase(request);
      }

      // Build container tags for filtering
      const containerTags = [
        `client_${request.clientId}`,
        ...(request.knowledgeBaseIds?.map(kbId => `kb_${kbId}`) || [])
      ];

      // Search via Supermemory
      const searchParams = {
        q: request.query,
        limit: request.limit || 10,
        documentThreshold: request.threshold || 0.5,
        onlyMatchingChunks: request.onlyMatchingChunks || false,
        containerTags: containerTags,
        filters: request.filters
      };

      const results = await supermemory.search(searchParams);
      
      return {
        results: results.results || [],
        total: results.total || 0,
        source: 'supermemory'
      };
    } catch (error) {
      console.error('Failed to search knowledge base:', error);
      
      // Fallback to database search
      console.log('Falling back to database search');
      return this.searchDatabase(request);
    }
  }

  /**
   * Fallback database search using simple text matching
   */
  private async searchDatabase(request: SearchKnowledgeBaseRequest) {
    try {
      // Simple text search in chunks
      const query = `%${request.query.toLowerCase()}%`;
      
      // This would need raw SQL for proper text search
      // For now, return empty results as fallback
      return {
        results: [],
        total: 0,
        source: 'database'
      };
    } catch (error) {
      console.error('Database search failed:', error);
      return {
        results: [],
        total: 0,
        source: 'database'
      };
    }
  }

  /**
   * Link a knowledge base to a campaign
   */
  async linkCampaignToKnowledgeBase(campaignId: string, knowledgeBaseId: string) {
    try {
      const linkData = {
        campaignId,
        knowledgeBaseId
      };

      await db.insert(campaignKnowledgeBases).values(linkData);
      console.log(`Linked campaign ${campaignId} to knowledge base ${knowledgeBaseId}`);
    } catch (error) {
      console.error('Failed to link campaign to knowledge base:', error);
      throw new Error(`Failed to link campaign to knowledge base: ${error}`);
    }
  }

  /**
   * Get knowledge bases linked to a campaign
   */
  async getCampaignKnowledgeBases(campaignId: string) {
    try {
      return await db
        .select({
          knowledgeBase: knowledgeBases,
          link: campaignKnowledgeBases
        })
        .from(campaignKnowledgeBases)
        .leftJoin(knowledgeBases, eq(campaignKnowledgeBases.knowledgeBaseId, knowledgeBases.id))
        .where(eq(campaignKnowledgeBases.campaignId, campaignId));
    } catch (error) {
      console.error('Failed to get campaign knowledge bases:', error);
      throw new Error(`Failed to get campaign knowledge bases: ${error}`);
    }
  }

  /**
   * Get documents in a knowledge base
   */
  async getDocuments(knowledgeBaseId: string, limit: number = 50, offset: number = 0) {
    try {
      return await db
        .select()
        .from(kbDocuments)
        .where(eq(kbDocuments.kbId, knowledgeBaseId))
        .orderBy(desc(kbDocuments.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Failed to get documents:', error);
      throw new Error(`Failed to get documents: ${error}`);
    }
  }

  /**
   * Delete a document from knowledge base
   */
  async deleteDocument(documentId: string) {
    try {
      // Get document info first
      const [document] = await db
        .select()
        .from(kbDocuments)
        .where(eq(kbDocuments.id, documentId))
        .limit(1);

      if (!document) {
        throw new Error('Document not found');
      }

      // Delete chunks first (foreign key constraint)
      await db.delete(kbDocumentChunks).where(eq(kbDocumentChunks.documentId, documentId));
      
      // Delete document
      await db.delete(kbDocuments).where(eq(kbDocuments.id, documentId));
      
      // Update knowledge base stats
      await this.updateKnowledgeBaseStats(document.kbId);
      
      console.log(`Deleted document: ${documentId}`);
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw new Error(`Failed to delete document: ${error}`);
    }
  }
}

export const knowledgeBaseService = KnowledgeBaseService.getInstance();