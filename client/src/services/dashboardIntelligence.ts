/*
 * Client-side dashboard intelligence service
 * Integrates with the lightweight dashboard intelligence service
 * Provides Memory over Metrics data for enhanced UI
 */

import { APIError } from '@/api/client';

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
      const response = await fetch(`${this.baseUrl}/dashboard`);
      
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
      throw new Error('Failed to load dashboard intelligence data');
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
        let message = response.statusText;
        let type = 'api';
        
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
          else if (data?.message) message = data.message;
          if (data?.type) type = data.type;
        } catch {
          try {
            message = await response.text() || message;
          } catch {
            // Use default statusText
          }
        }
        
        throw new APIError(message || 'Request failed', response.status, type);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) throw error;
      console.error('Failed to chat with campaign agent:', error);
      throw new APIError('Network error - please check your connection', undefined, 'network');
    }
  }

  /**
   * Get default AI suggestions when real data is unavailable
   */
  private static getDefaultSuggestions(): string[] {
    return [
      "Review hot leads requiring immediate follow-up",
      "Analyze competitor mentions in recent conversations",
      "Create targeted campaign for lease-end customers",
      "Schedule calls for high-priority prospects",
      "Update inventory matching for active leads"
    ];
  }

  /**
   * Get default recent activity when real data is unavailable
   */
  private static getDefaultActivity(): string[] {
    return [
      "Analyzed 12 new lead conversations",
      "Identified 3 high-intent prospects",
      "Generated 8 personalized follow-up recommendations",
      "Detected 2 competitor mentions requiring attention",
      "Optimized response templates based on recent performance"
    ];
  }

}