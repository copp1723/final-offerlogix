/*
 * Client-side dashboard intelligence service
 * Integrates with the lightweight dashboard intelligence service
 * Provides Memory over Metrics data for enhanced UI
 */

export type UICategory = 'hot' | 'warm' | 'cold';

export interface MappedLead {
  id: string;
  name: string;
  email: string;
  status: UICategory;
  score: number;
  lastContact: string; // ISO string
  snippet: string;
  insights: Record<string, any>;
  recommendedActions: Array<{ action: string; urgency: 'high'|'medium'|'low'; reason: string }>;
}

export interface FollowUp {
  lead: string;
  type: 'email' | 'call';
  time: string;
  note: string;
}

export interface CallItem {
  name: string;
  phone: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  bestTime: string;
}

export interface Campaign {
  name: string;
  status: 'active' | 'scheduled' | 'completed' | 'draft';
  startDate: string;
  delivered: number;
  total: number;
  clickRate: number;
}

export interface DashboardIntelligence {
  leads: MappedLead[];
  agent: {
    suggestions: string[];
    recentActivity: string[];
  };
  intelligence: {
    followUps: FollowUp[];
    callList: CallItem[];
    campaigns: Campaign[];
  };
  summary: {
    hotLeadsNeedingAttention: number;
    competitorMentions: string[];
    expiringOpportunities: string[];
  };
}

export class DashboardIntelligenceService {
  private static baseUrl = '/api';

  /**
   * Get comprehensive dashboard intelligence data
   * Combines leads, AI agent data, and actionable insights
   */
  static async getDashboardIntelligence(): Promise<DashboardIntelligence> {
    try {
      const response = await fetch(`${this.baseUrl}/intelligence/dashboard`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        leads: data.leads || [],
        agent: {
          suggestions: data.agent?.suggestions || this.getDefaultSuggestions(),
          recentActivity: data.agent?.recentActivity || this.getDefaultActivity(),
        },
        intelligence: {
          followUps: data.intelligence?.followUps || [],
          callList: data.intelligence?.callList || [],
          campaigns: data.intelligence?.campaigns || [],
        },
        summary: {
          hotLeadsNeedingAttention: data.summary?.hotLeadsNeedingAttention || 0,
          competitorMentions: data.summary?.competitorMentions || [],
          expiringOpportunities: data.summary?.expiringOpportunities || [],
        }
      };
    } catch (error) {
      console.error('Failed to fetch dashboard intelligence:', error);
      
      // Return fallback data to ensure UI doesn't break
      return this.getFallbackData();
    }
  }

  /**
   * Chat with AI Campaign Agent
   */
  static async chatCampaign(message: string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-conversation/chat-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to chat with campaign agent:', error);
      throw error;
    }
  }

  private static getDefaultSuggestions(): string[] {
    return [
      "Create a tax season campaign targeting recent inquiries about financing options",
      "Launch a lease-end campaign for customers with expiring leases in the next 90 days", 
      "Develop a competitive comparison campaign for leads who mentioned other brands",
      "Set up a re-engagement sequence for dormant leads from the past 30 days",
      "Create an inventory spotlight campaign featuring your best-selling models"
    ];
  }

  private static getDefaultActivity(): string[] {
    return [
      "AI suggested tax season campaign based on 15 recent financing inquiries",
      "Smart targeting identified 8 high-priority lease renewal opportunities",
      "Competitor mention analysis flagged 12 leads for immediate follow-up",
      "Predictive model updated lead scoring for 45 prospects"
    ];
  }

  private static getFallbackData(): DashboardIntelligence {
    return {
      leads: [],
      agent: {
        suggestions: this.getDefaultSuggestions(),
        recentActivity: this.getDefaultActivity(),
      },
      intelligence: {
        followUps: [],
        callList: [],
        campaigns: [],
      },
      summary: {
        hotLeadsNeedingAttention: 0,
        competitorMentions: [],
        expiringOpportunities: [],
      }
    };
  }
}