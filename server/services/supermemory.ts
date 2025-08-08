/**
 * Supermemory Integration Service
 * Provides fast, multi-modal, persistent recall for AI agent
 */

import supermemory from 'supermemory';

let _client: ReturnType<typeof supermemory> | null = null;

export function getSupermemory() {
  if (!_client) {
    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (!apiKey) {
      console.warn('SUPERMEMORY_API_KEY is not set - memory features disabled');
      return null;
    }
    _client = supermemory({ apiKey });
  }
  return _client;
}

export async function addMemory({
  content,
  metadata = {},
  containerTags = [],
  userId,
}: {
  content: string;
  metadata?: Record<string, any>;
  containerTags?: string[];
  userId?: string;
}) {
  try {
    const client = getSupermemory();
    if (!client) {
      console.warn('Supermemory client not available - skipping memory add');
      return null;
    }
    
    return await client.memory.create({ 
      content, 
      metadata, 
      containerTags, 
      userId 
    });
  } catch (error) {
    console.warn('Failed to add memory to Supermemory:', error);
    return null;
  }
}

export async function searchMemories(q: string, opts: any = {}) {
  try {
    const client = getSupermemory();
    if (!client) {
      console.warn('Supermemory client not available - returning empty results');
      return { results: [] };
    }
    
    const defaults = {
      limit: 8,
      documentThreshold: 0.6,
      onlyMatchingChunks: true,
      rewriteQuery: true,
    };
    
    return await client.search.execute({ q, ...defaults, ...opts });
  } catch (error) {
    console.warn('Failed to search memories in Supermemory:', error);
    return { results: [] };
  }
}

/**
 * Helper to extract content from search results
 */
export function extractMemoryContent(searchResults: any): string[] {
  try {
    return searchResults.results?.flatMap((r: any) => 
      r.chunks?.map((c: any) => c.content) || []
    ).slice(0, 6) || [];
  } catch (error) {
    console.warn('Failed to extract memory content:', error);
    return [];
  }
}

/**
 * Memory ingestion wrapper with error handling and logging
 */
export async function ingestMemory(type: string, data: any, options: {
  clientId?: string;
  campaignId?: string;
  leadEmail?: string;
  leadId?: string;
}) {
  const { clientId, campaignId, leadEmail, leadId } = options;
  
  const containerTags = [
    clientId ? `client:${clientId}` : 'client:default',
    campaignId ? `campaign:${campaignId}` : undefined,
    leadEmail ? `lead:${leadEmail}` : undefined,
    leadId ? `leadId:${leadId}` : undefined,
    `type:${type}`
  ].filter(Boolean) as string[];

  return await addMemory({
    content: typeof data === 'string' ? data : JSON.stringify(data),
    metadata: {
      type,
      clientId,
      campaignId,
      leadEmail,
      leadId,
      timestamp: new Date().toISOString()
    },
    containerTags,
    userId: clientId
  });
}