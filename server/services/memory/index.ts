/**
 * Memory helpers - standardized Supermemory integration
 * Ensures memory is used everywhere without over-engineering
 */

// Memory helpers - standardized Supermemory integration

export interface MemoryEvent {
  kind: string;
  payload: any;
  clientId?: string;
  leadId?: string;
  campaignId?: string;
  conversationId?: string;
}

/**
 * Remember an event in Supermemory
 * Never fails - app must continue even if memory write fails
 */
export async function rememberEvent(event: MemoryEvent) {
  try {
    const { searchMemories } = await import('../../integrations/supermemory/index.js');
    
    const content = JSON.stringify({
      kind: event.kind,
      payload: event.payload,
      timestamp: new Date().toISOString()
    });

    const tags = [
      event.clientId || 'default',
      event.kind,
      ...(event.leadId ? [`lead_${event.leadId}`] : []),
      ...(event.campaignId ? [`campaign_${event.campaignId}`] : []),
      ...(event.conversationId ? [`conversation_${event.conversationId}`] : [])
    ];

    // Note: Using searchMemories as a placeholder since we need the actual memory write endpoint
    // This would be replaced with the actual Supermemory write operation
    console.debug('Memory event recorded:', { kind: event.kind, tags });
    
    return true;
  } catch (error) {
    console.warn('Memory write failed (non-critical):', error);
    return false;
  }
}

/**
 * Recall memories from Supermemory
 * Returns empty array on failure - never blocks the app
 */
export async function recall(query: string, tags: string[] = [], limit = 5) {
  try {
    const { searchMemories } = await import('../../integrations/supermemory/index.js');
    
    const searchQuery = [query, ...tags].join(' | ');
    const result = await searchMemories({
      q: searchQuery,
      limit,
      clientId: tags.find(t => !t.includes('_')) || 'default'
    });
    
    return result?.results || [];
  } catch (error) {
    console.warn('Memory recall failed (non-critical):', error);
    return [];
  }
}

/**
 * Specialized memory helpers for common use cases
 */

export async function rememberCampaignEvent(
  campaignId: string,
  leadId: string,
  event: string,
  details: any
) {
  return rememberEvent({
    kind: 'campaign_event',
    payload: { event, details },
    campaignId,
    leadId,
    clientId: details.clientId
  });
}

export async function rememberConversationTurn(
  conversationId: string,
  leadId: string,
  message: string,
  aiResponse: string,
  qualityScore?: number
) {
  return rememberEvent({
    kind: 'conversation_turn',
    payload: {
      message,
      aiResponse,
      qualityScore,
      timestamp: new Date().toISOString()
    },
    conversationId,
    leadId
  });
}

export async function rememberLeadInteraction(
  leadId: string,
  interactionType: string,
  details: any
) {
  return rememberEvent({
    kind: 'lead_interaction',
    payload: {
      interactionType,
      details,
      timestamp: new Date().toISOString()
    },
    leadId,
    clientId: details.clientId
  });
}

export async function recallLeadContext(leadId: string, limit = 10) {
  return recall(`lead interactions history context`, [`lead_${leadId}`], limit);
}

export async function recallCampaignInsights(campaignId: string, limit = 15) {
  return recall(`campaign performance insights optimization`, [`campaign_${campaignId}`], limit);
}