// Mock Supermemory client for development - replace with real client when available
export const supermemory = process.env.SUPERMEMORY_API_KEY ? {
  add: async (data: any) => {
    console.log('[Supermemory Mock] Adding memory:', data.content.slice(0, 100) + '...');
    return { id: 'mock-' + Date.now() };
  },
  search: async (params: any) => {
    console.log('[Supermemory Mock] Searching:', params.query);
    return { 
      results: [
        {
          content: `Previous automotive campaign achieved 25% open rate with ${params.query} strategy`,
          metadata: { type: 'campaign', clientId: params.userId }
        }
      ], 
      total: 1 
    };
  }
} : null;

export function isRAGEnabled() {
  return !!supermemory && process.env.SUPERMEMORY_RAG !== "off";
}