import { eq, and, desc, asc } from 'drizzle-orm';
import { storage } from '../storage';
import { 
  aiPersonas, 
  personaKnowledgeBases, 
  kbDocumentPersonaTags,
  campaigns,
  knowledgeBases,
  type InsertAiPersona,
  type AiPersona,
  type InsertPersonaKnowledgeBase,
  type PersonaKnowledgeBase,
  type InsertKbDocumentPersonaTag
} from '@shared/schema';

/**
 * AI Persona Management Service
 * 
 * Manages multiple AI personas for OfferLogix, allowing different personas
 * for different target audiences (dealers, vendors, customers).
 * 
 * Features:
 * - CRUD operations for AI personas
 * - Persona-specific configuration management
 * - Knowledge base association management
 * - Persona assignment to campaigns
 * - Default persona creation and management
 */

export interface PersonaConfig {
  name: string;
  description: string;
  targetAudience: string;
  industry: string;
  tonality: string;
  personality: string;
  communicationStyle: string;
  model: string;
  temperature: number; // 0-100 (converted to 0.0-1.0)
  maxTokens: number;
  systemPrompt?: string;
  responseGuidelines: string[];
  escalationCriteria: string[];
  preferredChannels: string[];
  handoverSettings: Record<string, any>;
  knowledgeBaseAccessLevel: 'campaign_only' | 'client_all' | 'persona_filtered';
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  metadata: Record<string, any>;
}

export interface PersonaWithKBs extends AiPersona {
  knowledgeBases?: Array<{
    id: string;
    name: string;
    accessLevel: string;
    priority: number;
  }>;
  campaignCount?: number;
}

export interface PersonaSearchOptions {
  clientId: string;
  targetAudience?: string;
  industry?: string;
  isActive?: boolean;
  includeKnowledgeBases?: boolean;
  includeCampaignCounts?: boolean;
}

class AIPersonaManagementService {
  private static instance: AIPersonaManagementService | null = null;

  private constructor() {}

  static getInstance(): AIPersonaManagementService {
    if (!AIPersonaManagementService.instance) {
      AIPersonaManagementService.instance = new AIPersonaManagementService();
    }
    return AIPersonaManagementService.instance;
  }

  /**
   * Create a new AI persona
   */
  async createPersona(clientId: string, config: PersonaConfig): Promise<AiPersona> {
    try {
      // Validate configuration
      this.validatePersonaConfig(config);

      // If this is set as default, unset other defaults for this client
      if (config.isDefault) {
        await this.unsetDefaultPersonas(clientId);
      }

      const personaData: InsertAiPersona = {
        clientId,
        name: config.name,
        description: config.description,
        targetAudience: config.targetAudience,
        industry: config.industry,
        tonality: config.tonality,
        personality: config.personality,
        communicationStyle: config.communicationStyle,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPrompt: config.systemPrompt,
        responseGuidelines: config.responseGuidelines,
        escalationCriteria: config.escalationCriteria,
        preferredChannels: config.preferredChannels,
        handoverSettings: config.handoverSettings,
        knowledgeBaseAccessLevel: config.knowledgeBaseAccessLevel,
        isActive: config.isActive,
        isDefault: config.isDefault,
        priority: config.priority,
        metadata: config.metadata
      };

      const [persona] = await storage.db
        .insert(aiPersonas)
        .values(personaData)
        .returning();

      console.log(`Created AI persona: ${persona.name} for client ${clientId}`);
      return persona;
    } catch (error) {
      console.error('Failed to create persona:', error);
      throw new Error(`Failed to create persona: ${error}`);
    }
  }

  /**
   * Get all personas for a client
   */
  async getPersonas(options: PersonaSearchOptions): Promise<PersonaWithKBs[]> {
    try {
      let query = storage.db
        .select()
        .from(aiPersonas)
        .where(eq(aiPersonas.clientId, options.clientId));

      // Apply filters
      if (options.targetAudience) {
        query = query.where(
          and(
            eq(aiPersonas.clientId, options.clientId),
            eq(aiPersonas.targetAudience, options.targetAudience)
          )
        );
      }

      if (options.industry) {
        query = query.where(
          and(
            eq(aiPersonas.clientId, options.clientId),
            eq(aiPersonas.industry, options.industry)
          )
        );
      }

      if (options.isActive !== undefined) {
        query = query.where(
          and(
            eq(aiPersonas.clientId, options.clientId),
            eq(aiPersonas.isActive, options.isActive)
          )
        );
      }

      const personas = await query.orderBy(desc(aiPersonas.priority), asc(aiPersonas.name));

      // Enhance with additional data if requested
      const enhancedPersonas: PersonaWithKBs[] = [];
      
      for (const persona of personas) {
        const enhanced: PersonaWithKBs = { ...persona };

        if (options.includeKnowledgeBases) {
          enhanced.knowledgeBases = await this.getPersonaKnowledgeBases(persona.id);
        }

        if (options.includeCampaignCounts) {
          enhanced.campaignCount = await this.getPersonaCampaignCount(persona.id);
        }

        enhancedPersonas.push(enhanced);
      }

      return enhancedPersonas;
    } catch (error) {
      console.error('Failed to get personas:', error);
      throw new Error(`Failed to get personas: ${error}`);
    }
  }

  /**
   * Get a specific persona by ID
   */
  async getPersona(personaId: string): Promise<PersonaWithKBs | null> {
    try {
      const [persona] = await storage.db
        .select()
        .from(aiPersonas)
        .where(eq(aiPersonas.id, personaId))
        .limit(1);

      if (!persona) return null;

      const enhanced: PersonaWithKBs = {
        ...persona,
        knowledgeBases: await this.getPersonaKnowledgeBases(persona.id),
        campaignCount: await this.getPersonaCampaignCount(persona.id)
      };

      return enhanced;
    } catch (error) {
      console.error('Failed to get persona:', error);
      throw new Error(`Failed to get persona: ${error}`);
    }
  }

  /**
   * Update a persona
   */
  async updatePersona(personaId: string, updates: Partial<PersonaConfig>): Promise<AiPersona> {
    try {
      // If updating to default, unset other defaults
      if (updates.isDefault) {
        const persona = await storage.db
          .select({ clientId: aiPersonas.clientId })
          .from(aiPersonas)
          .where(eq(aiPersonas.id, personaId))
          .limit(1);

        if (persona.length > 0) {
          await this.unsetDefaultPersonas(persona[0].clientId);
        }
      }

      const [updatedPersona] = await storage.db
        .update(aiPersonas)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(aiPersonas.id, personaId))
        .returning();

      console.log(`Updated persona: ${updatedPersona.name}`);
      return updatedPersona;
    } catch (error) {
      console.error('Failed to update persona:', error);
      throw new Error(`Failed to update persona: ${error}`);
    }
  }

  /**
   * Delete a persona (soft delete by deactivating)
   */
  async deletePersona(personaId: string): Promise<void> {
    try {
      // Check if persona is assigned to any active campaigns
      const activeCampaigns = await storage.db
        .select({ id: campaigns.id, name: campaigns.name })
        .from(campaigns)
        .where(and(
          eq(campaigns.personaId, personaId),
          eq(campaigns.status, 'active')
        ));

      if (activeCampaigns.length > 0) {
        throw new Error(`Cannot delete persona: it is assigned to ${activeCampaigns.length} active campaigns`);
      }

      // Soft delete by deactivating
      await storage.db
        .update(aiPersonas)
        .set({ 
          isActive: false, 
          updatedAt: new Date()
        })
        .where(eq(aiPersonas.id, personaId));

      console.log(`Deactivated persona: ${personaId}`);
    } catch (error) {
      console.error('Failed to delete persona:', error);
      throw error;
    }
  }

  /**
   * Get the default persona for a client
   */
  async getDefaultPersona(clientId: string): Promise<AiPersona | null> {
    try {
      const [defaultPersona] = await storage.db
        .select()
        .from(aiPersonas)
        .where(and(
          eq(aiPersonas.clientId, clientId),
          eq(aiPersonas.isDefault, true),
          eq(aiPersonas.isActive, true)
        ))
        .orderBy(desc(aiPersonas.priority))
        .limit(1);

      return defaultPersona || null;
    } catch (error) {
      console.error('Failed to get default persona:', error);
      return null;
    }
  }

  /**
   * Associate a persona with a knowledge base
   */
  async linkPersonaToKnowledgeBase(
    personaId: string, 
    knowledgeBaseId: string,
    accessLevel: 'read' | 'write' | 'admin' = 'read',
    priority: number = 100
  ): Promise<void> {
    try {
      // Check if association already exists
      const existing = await storage.db
        .select()
        .from(personaKnowledgeBases)
        .where(and(
          eq(personaKnowledgeBases.personaId, personaId),
          eq(personaKnowledgeBases.knowledgeBaseId, knowledgeBaseId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing association
        await storage.db
          .update(personaKnowledgeBases)
          .set({ accessLevel, priority })
          .where(and(
            eq(personaKnowledgeBases.personaId, personaId),
            eq(personaKnowledgeBases.knowledgeBaseId, knowledgeBaseId)
          ));
      } else {
        // Create new association
        await storage.db
          .insert(personaKnowledgeBases)
          .values({
            personaId,
            knowledgeBaseId,
            accessLevel,
            priority
          });
      }

      console.log(`Linked persona ${personaId} to knowledge base ${knowledgeBaseId}`);
    } catch (error) {
      console.error('Failed to link persona to knowledge base:', error);
      throw new Error(`Failed to link persona to knowledge base: ${error}`);
    }
  }

  /**
   * Remove persona-knowledge base association
   */
  async unlinkPersonaFromKnowledgeBase(personaId: string, knowledgeBaseId: string): Promise<void> {
    try {
      await storage.db
        .delete(personaKnowledgeBases)
        .where(and(
          eq(personaKnowledgeBases.personaId, personaId),
          eq(personaKnowledgeBases.knowledgeBaseId, knowledgeBaseId)
        ));

      console.log(`Unlinked persona ${personaId} from knowledge base ${knowledgeBaseId}`);
    } catch (error) {
      console.error('Failed to unlink persona from knowledge base:', error);
      throw new Error(`Failed to unlink persona from knowledge base: ${error}`);
    }
  }

  /**
   * Get knowledge bases associated with a persona
   */
  async getPersonaKnowledgeBases(personaId: string): Promise<Array<{
    id: string;
    name: string;
    accessLevel: string;
    priority: number;
  }>> {
    try {
      const associations = await storage.db
        .select({
          id: knowledgeBases.id,
          name: knowledgeBases.name,
          accessLevel: personaKnowledgeBases.accessLevel,
          priority: personaKnowledgeBases.priority
        })
        .from(personaKnowledgeBases)
        .innerJoin(knowledgeBases, eq(personaKnowledgeBases.knowledgeBaseId, knowledgeBases.id))
        .where(eq(personaKnowledgeBases.personaId, personaId))
        .orderBy(desc(personaKnowledgeBases.priority), asc(knowledgeBases.name));

      return associations;
    } catch (error) {
      console.error('Failed to get persona knowledge bases:', error);
      return [];
    }
  }

  /**
   * Get campaign count for a persona
   */
  async getPersonaCampaignCount(personaId: string): Promise<number> {
    try {
      const result = await storage.db
        .select({ count: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.personaId, personaId));

      return result.length;
    } catch (error) {
      console.error('Failed to get persona campaign count:', error);
      return 0;
    }
  }

  /**
   * Generate persona-specific system prompt
   */
  generatePersonaSystemPrompt(persona: AiPersona, context?: {
    targetAudience?: string;
    campaignContext?: string;
    leadInfo?: any;
  }): string {
    const basePrompt = persona.systemPrompt || this.getDefaultSystemPrompt(persona);
    
    let enhancedPrompt = `${basePrompt}

PERSONA CONFIGURATION:
- Name: ${persona.name}
- Target Audience: ${persona.targetAudience}
- Industry Focus: ${persona.industry}
- Communication Style: ${persona.communicationStyle}
- Tonality: ${persona.tonality}

PERSONALITY: ${persona.personality}

RESPONSE GUIDELINES:
${persona.responseGuidelines.map(guideline => `- ${guideline}`).join('\n')}

ESCALATION CRITERIA:
${persona.escalationCriteria.map(criteria => `- ${criteria}`).join('\n')}

PREFERRED CHANNELS: ${persona.preferredChannels.join(', ')}
`;

    // Add context-specific information
    if (context?.targetAudience) {
      enhancedPrompt += `\nCURRENT TARGET AUDIENCE: ${context.targetAudience}`;
    }

    if (context?.campaignContext) {
      enhancedPrompt += `\nCAMPAIGN CONTEXT: ${context.campaignContext}`;
    }

    return enhancedPrompt;
  }

  /**
   * Get AI generation settings for persona
   */
  getPersonaAISettings(persona: AiPersona): {
    model: string;
    temperature: number;
    maxTokens: number;
  } {
    return {
      model: persona.model || 'openai/gpt-4o',
      temperature: persona.temperature / 100, // Convert from 0-100 to 0.0-1.0
      maxTokens: persona.maxTokens || 300
    };
  }

  /**
   * Create default personas for OfferLogix
   */
  async createDefaultPersonas(clientId: string): Promise<AiPersona[]> {
    try {
      const defaultPersonas: PersonaConfig[] = [
        // Credit Solutions AI Persona for dealers
        {
          name: 'Credit Solutions AI',
          description: 'Specialized AI persona for dealer outreach focusing on credit decision technology and instant approvals',
          targetAudience: 'dealers',
          industry: 'automotive',
          tonality: 'professional',
          personality: 'Technical expert with deep understanding of credit solutions, focused on ROI and business impact. Speaks in terms of efficiency gains, approval rates, and competitive advantages.',
          communicationStyle: 'technical',
          model: 'openai/gpt-4o',
          temperature: 60, // Slightly more conservative for technical discussions
          maxTokens: 350,
          responseGuidelines: [
            'Focus on technical specifications and implementation details',
            'Emphasize ROI and business impact metrics',
            'Use industry-specific terminology confidently',
            'Provide specific examples of efficiency gains',
            'Address integration concerns proactively',
            'Highlight competitive advantages and market positioning'
          ],
          escalationCriteria: [
            'Technical integration questions beyond basic scope',
            'Pricing discussions for enterprise solutions',
            'Requests for custom implementation demos',
            'Compliance and security requirement discussions',
            'Multi-location rollout planning'
          ],
          preferredChannels: ['email', 'phone'],
          handoverSettings: {
            triggerOnTechnicalQuestions: true,
            escalateOnPricingDiscussion: true,
            requireManagerForEnterprise: true
          },
          knowledgeBaseAccessLevel: 'persona_filtered',
          isActive: true,
          isDefault: false,
          priority: 150,
          metadata: {
            focusAreas: ['credit_technology', 'dealer_integration', 'roi_analysis'],
            expertise: ['instant_approvals', 'dealership_workflow', 'competitive_analysis']
          }
        },
        
        // Payments AI Persona for vendors
        {
          name: 'Payments AI',
          description: 'Specialized AI persona for vendor outreach focusing on payment calculation tools and implementation',
          targetAudience: 'vendors',
          industry: 'automotive',
          tonality: 'consultative',
          personality: 'Business-focused consultant who understands vendor pain points and solution implementation. Emphasizes practical benefits, ease of integration, and business value.',
          communicationStyle: 'consultative',
          model: 'openai/gpt-4o',
          temperature: 70, // More conversational for consultative approach
          maxTokens: 300,
          responseGuidelines: [
            'Take a consultative, solution-oriented approach',
            'Focus on practical implementation benefits',
            'Address common vendor concerns proactively',
            'Provide clear implementation timelines',
            'Emphasize ease of integration and support',
            'Use business impact language over technical jargon'
          ],
          escalationCriteria: [
            'Custom pricing structure requests',
            'Complex integration requirement discussions',
            'Multi-vendor implementation planning',
            'Compliance and audit requirement questions',
            'Long-term partnership discussions'
          ],
          preferredChannels: ['email', 'sms'],
          handoverSettings: {
            escalateOnPricingInquiry: true,
            requireSpecialistForComplexIntegration: true,
            handoverOnPartnershipInterest: true
          },
          knowledgeBaseAccessLevel: 'persona_filtered',
          isActive: true,
          isDefault: false,
          priority: 140,
          metadata: {
            focusAreas: ['payment_calculations', 'vendor_solutions', 'implementation'],
            expertise: ['pricing_tools', 'vendor_integration', 'business_consulting']
          }
        }
      ];

      const createdPersonas: AiPersona[] = [];
      
      for (const personaConfig of defaultPersonas) {
        const persona = await this.createPersona(clientId, personaConfig);
        createdPersonas.push(persona);
      }

      // Set Credit Solutions AI as default if no other default exists
      const existingDefault = await this.getDefaultPersona(clientId);
      if (!existingDefault && createdPersonas.length > 0) {
        await this.updatePersona(createdPersonas[0].id, { isDefault: true });
      }

      console.log(`Created ${createdPersonas.length} default personas for client ${clientId}`);
      return createdPersonas;
    } catch (error) {
      console.error('Failed to create default personas:', error);
      throw new Error(`Failed to create default personas: ${error}`);
    }
  }

  /**
   * Private helper methods
   */
  private validatePersonaConfig(config: PersonaConfig): void {
    if (!config.name?.trim()) {
      throw new Error('Persona name is required');
    }
    if (!config.targetAudience?.trim()) {
      throw new Error('Target audience is required');
    }
    if (config.temperature < 0 || config.temperature > 100) {
      throw new Error('Temperature must be between 0 and 100');
    }
    if (config.maxTokens < 50 || config.maxTokens > 2000) {
      throw new Error('Max tokens must be between 50 and 2000');
    }
  }

  private async unsetDefaultPersonas(clientId: string): Promise<void> {
    await storage.db
      .update(aiPersonas)
      .set({ isDefault: false })
      .where(and(
        eq(aiPersonas.clientId, clientId),
        eq(aiPersonas.isDefault, true)
      ));
  }

  private getDefaultSystemPrompt(persona: AiPersona): string {
    return `You are a professional AI agent specializing in ${persona.industry} industry communication. Your primary role is to engage with ${persona.targetAudience} in a ${persona.tonality} and ${persona.communicationStyle} manner.

Your expertise includes:
- Deep knowledge of ${persona.industry} industry practices
- Understanding of ${persona.targetAudience} needs and pain points
- Professional communication that builds trust and rapport
- Solution-focused approach to customer inquiries

Always maintain professionalism while adapting your communication style to be ${persona.tonality} and ${persona.communicationStyle}.`;
  }
}

export const aiPersonaManagementService = AIPersonaManagementService.getInstance();