import { knowledgeBaseService } from './knowledge-base';
import { supermemory, isRAGEnabled } from '../integrations/supermemory';
import { storage } from '../storage';
import { aiPersonaManagementService } from './ai-persona-management';
import type { ConversationContext, ResponseGenerationOptions } from './enhanced-conversation-ai';

/**
 * Knowledge Base AI Integration Service
 * 
 * Integrates the knowledge base system with existing AI agents to provide
 * context-aware responses using campaign-specific knowledge bases.
 */

export interface KBContextOptions {
  campaignId?: string;
  clientId: string;
  query: string;
  maxResults?: number;
  threshold?: number;
  includeGeneral?: boolean; // Include general knowledge bases
  personaId?: string; // Filter by persona-specific knowledge bases
  personaFiltered?: boolean; // Whether to apply persona filtering
}

export interface KBContextResult {
  context: string;
  sources: Array<{
    title: string;
    source: string;
    relevance: number;
    knowledgeBaseId?: string;
  }>;
  isEmpty: boolean;
  usedKnowledgeBases: string[];
}

class KnowledgeBaseAIIntegration {
  private static instance: KnowledgeBaseAIIntegration | null = null;

  private constructor() {}

  static getInstance(): KnowledgeBaseAIIntegration {
    if (!KnowledgeBaseAIIntegration.instance) {
      KnowledgeBaseAIIntegration.instance = new KnowledgeBaseAIIntegration();
    }
    return KnowledgeBaseAIIntegration.instance;
  }

  /**
   * Get knowledge base context for AI agents with persona filtering support
   */
  async getKBContext(options: KBContextOptions): Promise<KBContextResult> {
    const result: KBContextResult = {
      context: '',
      sources: [],
      isEmpty: true,
      usedKnowledgeBases: []
    };

    try {
      // Get knowledge bases linked to the campaign
      let knowledgeBaseIds: string[] = [];
      
      if (options.campaignId) {
        const campaignKBs = await knowledgeBaseService.getCampaignKnowledgeBases(options.campaignId);
        knowledgeBaseIds = campaignKBs
          .map(link => link.knowledgeBase?.id)
          .filter((id): id is string => !!id);
      }

      // Apply persona filtering if specified
      if (options.personaFiltered && options.personaId) {
        const personaKBs = await aiPersonaManagementService.getPersonaKnowledgeBases(options.personaId);
        const personaKBIds = personaKBs.map(kb => kb.id);
        
        // If we have campaign KBs, intersect with persona KBs, otherwise use persona KBs
        if (knowledgeBaseIds.length > 0) {
          knowledgeBaseIds = knowledgeBaseIds.filter(id => personaKBIds.includes(id));
        } else {
          knowledgeBaseIds = personaKBIds;
        }
      }

      // If no campaign-specific KBs or includeGeneral is true, get client's general KBs
      if (knowledgeBaseIds.length === 0 || options.includeGeneral) {
        const clientKBs = await knowledgeBaseService.getKnowledgeBases(options.clientId);
        let generalKBIds = clientKBs.map(kb => kb.id);
        
        // Apply persona filtering to general KBs if specified
        if (options.personaFiltered && options.personaId) {
          const personaKBs = await aiPersonaManagementService.getPersonaKnowledgeBases(options.personaId);
          const personaKBIds = personaKBs.map(kb => kb.id);
          generalKBIds = generalKBIds.filter(id => personaKBIds.includes(id));
        }
        
        knowledgeBaseIds = Array.from(new Set([...knowledgeBaseIds, ...generalKBIds]));
      }

      if (knowledgeBaseIds.length === 0) {
        console.log('No knowledge bases found for context generation');
        return result;
      }

      result.usedKnowledgeBases = knowledgeBaseIds;

      // Search across knowledge bases
      const searchResult = await knowledgeBaseService.searchKnowledgeBase({
        query: options.query,
        knowledgeBaseIds,
        clientId: options.clientId,
        limit: options.maxResults || 5,
        threshold: options.threshold || 0.7,
        onlyMatchingChunks: true
      });

      if (searchResult.results && searchResult.results.length > 0) {
        result.isEmpty = false;
        
        // Build context from search results
        const contextParts: string[] = [];
        
        for (const item of searchResult.results) {
          // Extract relevant information from search result
          const title = item.metadata?.title || 'Knowledge Base Document';
          const content = item.content || '';
          const relevance = item.score || 0;
          
          // Add to sources
          result.sources.push({
            title,
            source: searchResult.source || 'knowledge_base',
            relevance,
            knowledgeBaseId: item.metadata?.knowledgeBaseId
          });

          // Add to context (limit content length)
          const snippet = content.length > 300 ? content.slice(0, 300) + '...' : content;
          contextParts.push(`**${title}**: ${snippet}`);
        }

        result.context = contextParts.join('\n\n');
      }

      console.log(`KB Context generated: ${result.sources.length} sources from ${knowledgeBaseIds.length} knowledge bases`);
      return result;

    } catch (error) {
      console.error('Failed to get KB context:', error);
      return result;
    }
  }

  /**
   * Enhanced context for campaign chat with KB integration and persona support
   */
  async getCampaignChatContextWithKB(args: {
    clientId: string;
    campaignId?: string;
    userTurn: string;
    context?: string;
    goals?: string;
    personaId?: string;
  }) {
    try {
      // Get KB context based on user input and campaign context
      const query = `${args.userTurn} ${args.context || ''} ${args.goals || ''}`.trim();
      
      // Determine persona filtering if personaId is provided
      let personaFiltered = false;
      if (args.personaId) {
        try {
          const persona = await aiPersonaManagementService.getPersona(args.personaId);
          personaFiltered = persona?.knowledgeBaseAccessLevel === 'persona_filtered';
        } catch (error) {
          console.warn('Could not get persona for filtering:', error);
        }
      }
      
      const kbContext = await this.getKBContext({
        campaignId: args.campaignId,
        clientId: args.clientId,
        query,
        maxResults: 3,
        includeGeneral: true,
        personaId: args.personaId,
        personaFiltered
      });

      return {
        kbContext: kbContext.context,
        kbSources: kbContext.sources,
        hasKBData: !kbContext.isEmpty,
        usedKnowledgeBases: kbContext.usedKnowledgeBases
      };
    } catch (error) {
      console.error('Failed to get campaign chat KB context:', error);
      return {
        kbContext: '',
        kbSources: [],
        hasKBData: false,
        usedKnowledgeBases: []
      };
    }
  }

  /**
   * Enhanced conversation context with KB integration and persona filtering
   */
  async getConversationContextWithKB(
    context: ConversationContext,
    options: ResponseGenerationOptions
  ) {
    try {
      // Build query from conversation context
      const query = [
        context.currentAnalysis.intent || '',
        context.leadProfile.vehicleInterest || '',
        options.responseType,
        ...context.conversationHistory.slice(-3).map(msg => msg.content)
      ].filter(Boolean).join(' ');

      // Get campaign info to find linked knowledge bases
      let campaignId: string | undefined;
      try {
        const conversations = await storage.getConversations();
        const conversation = conversations.find(c => c.id === context.conversationId);
        campaignId = conversation?.campaignId || context.campaignId;
      } catch (error) {
        console.warn('Could not get campaign ID for conversation:', error);
        campaignId = context.campaignId;
      }

      // Determine if persona filtering should be applied
      const shouldApplyPersonaFiltering = context.persona && 
        context.persona.knowledgeBaseAccessLevel === 'persona_filtered';

      const kbContext = await this.getKBContext({
        campaignId,
        clientId: context.leadProfile.clientId || 'default',
        query,
        maxResults: 4,
        includeGeneral: true,
        personaId: context.persona?.id,
        personaFiltered: shouldApplyPersonaFiltering
      });

      return {
        kbContext: kbContext.context,
        kbSources: kbContext.sources,
        hasKBData: !kbContext.isEmpty,
        usedKnowledgeBases: kbContext.usedKnowledgeBases
      };
    } catch (error) {
      console.error('Failed to get conversation KB context:', error);
      return {
        kbContext: '',
        kbSources: [],
        hasKBData: false,
        usedKnowledgeBases: []
      };
    }
  }

  /**
   * Generate AI prompt with KB context
   */
  buildPromptWithKBContext(
    basePrompt: string,
    kbContext: string,
    sources: Array<{ title: string; source: string; relevance: number }>
  ): string {
    if (!kbContext) {
      return basePrompt;
    }

    const kbSection = `

## KNOWLEDGE BASE CONTEXT
The following information from your knowledge base may be relevant to this conversation:

${kbContext}

Source documents: ${sources.map(s => s.title).join(', ')}

Use this knowledge base information to provide more accurate and detailed responses. When referencing specific information from the knowledge base, you can mention that it comes from your knowledge base.

---

`;

    // Insert KB context before the main instructions
    return kbSection + basePrompt;
  }

  /**
   * Link a knowledge base to a campaign
   */
  async linkKnowledgeBaseToCampaign(campaignId: string, knowledgeBaseId: string) {
    try {
      await knowledgeBaseService.linkCampaignToKnowledgeBase(campaignId, knowledgeBaseId);
      console.log(`Linked knowledge base ${knowledgeBaseId} to campaign ${campaignId}`);
    } catch (error) {
      console.error('Failed to link KB to campaign:', error);
      throw error;
    }
  }

  /**
   * Get knowledge bases available for a client
   */
  async getAvailableKnowledgeBases(clientId: string) {
    try {
      return await knowledgeBaseService.getKnowledgeBases(clientId);
    } catch (error) {
      console.error('Failed to get available knowledge bases:', error);
      return [];
    }
  }

  /**
   * Add document to knowledge base from campaign chat
   */
  async addDocumentFromCampaign(
    knowledgeBaseId: string,
    title: string,
    content: string,
    metadata?: Record<string, any>
  ) {
    try {
      return await knowledgeBaseService.addDocument({
        knowledgeBaseId,
        title,
        content,
        documentType: 'note',
        metadata: {
          source: 'campaign_chat',
          ...metadata
        }
      });
    } catch (error) {
      console.error('Failed to add document from campaign:', error);
      throw error;
    }
  }
}

export const kbAIIntegration = KnowledgeBaseAIIntegration.getInstance();

// Helper functions for backward compatibility
export async function getKBContext(options: KBContextOptions): Promise<KBContextResult> {
  return kbAIIntegration.getKBContext(options);
}

export async function buildPromptWithKB(
  basePrompt: string,
  kbContext: KBContextResult
): Promise<string> {
  return kbAIIntegration.buildPromptWithKBContext(
    basePrompt,
    kbContext.context,
    kbContext.sources
  );
}