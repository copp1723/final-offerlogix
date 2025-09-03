// API Types - What we actually care about
export interface Lead {
  id: string;
  name: string;
  email: string;
  status: 'hot' | 'warm' | 'cold';
  score: number;
  lastContact: string;
  
  // The good stuff - actual context
  snippet: string; // One-line context like "Has twins, needs 7-seater ASAP"
  
  insights: {
    situation?: string;
    preferences?: string[];
    budget?: string;
    timeline?: string;
    concerns?: string[];
    competitor?: string;
  };
  
  recommendedActions: Array<{
    action: string;
    urgency: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  
  conversation?: Array<{
    role: 'customer' | 'agent';
    message: string;
    timestamp: string;
  }>;
}

export interface FollowUp {
  // Align with usage in InsightsPanel
  type?: 'email' | 'call';
  lead?: string;
  time?: string;
  note?: string;
  leadName?: string;
  reason?: string; // "Said 'call me in 3 months' (90 days ago)"
  overdue?: boolean;
}

export interface CallPriority {
  leadName: string;
  score: number;
  reasons: string[]; // ["Opened last 5 emails", "Mentioned competitor"]
}

export interface CampaignOpportunity {
  type: string;
  description: string; // "8 leads mentioned tax refunds"
  count: number;
  suggestedAction: string;
}

export interface DashboardResponse {
  leads: Lead[];
  
  intelligence: {
    followUps: FollowUp[];
    callList: CallPriority[];
    campaigns: CampaignOpportunity[];
  };
  
  agent: {
    suggestions: string[]; // Campaign suggestions for AI Agent
    recentActivity: string[];
  };
  
  summary: {
    hotLeadsNeedingAttention: number;
    competitorMentions: string[];
    expiringOpportunities: string[];
  };
}

// ============================================================================
// V2 API TYPES - MINIMAL UI BRIDGE
// ============================================================================

export interface V2Conversation {
  id: string;
  agentId: string;
  leadEmail: string;
  subject: string;
  status: string;
  lastMessageId: string | null;
  updatedAt: string;
}

export interface V2ReplyResult {
  success: boolean;
  messageId: string;
  conversationId: string;
}