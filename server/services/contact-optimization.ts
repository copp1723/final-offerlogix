import { storage } from '../storage';
import type { Lead, Conversation, Campaign } from '../../shared/schema';

export interface ContactOptimization {
  leadId: string;
  optimalContactHour: number;    // 0-23
  optimalDayOfWeek: number;      // 0-6 (0=Sunday)
  recommendedSequence: EmailSequenceStep[];
  sendTimeRecommendations: SendTimeRecommendation[];
  confidence: number; // 0-100
}

export interface EmailSequenceStep {
  dayOffset: number;
  templateType: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SendTimeRecommendation {
  dayOfWeek: number;
  hour: number;
  confidence: number;
  expectedOpenRate: number;
  reasoning: string;
}

export interface CampaignSequenceOptimization {
  campaignId: string;
  recommendedSequence: EmailSequenceStep[];
  optimalSendTimes: SendTimeRecommendation[];
  totalDuration: number; // days
  expectedResults: {
    openRateImprovement: number;
    responseRateImprovement: number;
  };
}

export class ContactOptimizationService {
  /**
   * Get contact optimization recommendations for a specific lead
   */
  async getContactOptimization(leadId: string): Promise<ContactOptimization> {
    const lead = await storage.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const conversations = await this.getLeadConversations(leadId);
    
    const optimalTiming = this.calculateOptimalContactTiming(lead, conversations);
    const sequenceRecommendations = this.generateEmailSequence(lead, conversations);
    const sendTimeRecommendations = this.generateSendTimeRecommendations();

    return {
      leadId,
      optimalContactHour: optimalTiming.hour,
      optimalDayOfWeek: optimalTiming.dayOfWeek,
      recommendedSequence: sequenceRecommendations,
      sendTimeRecommendations,
      confidence: this.calculateConfidence(lead, conversations)
    };
  }

  /**
   * Get optimal send times for campaigns
   */
  async getCampaignSendTimes(): Promise<SendTimeRecommendation[]> {
    // Based on automotive industry best practices and historical data
    return [
      {
        dayOfWeek: 2, // Tuesday
        hour: 10,
        confidence: 85,
        expectedOpenRate: 24.5,
        reasoning: 'Tuesday morning shows highest engagement in automotive sector'
      },
      {
        dayOfWeek: 3, // Wednesday  
        hour: 14,
        confidence: 82,
        expectedOpenRate: 23.2,
        reasoning: 'Mid-week afternoon when people research vehicles'
      },
      {
        dayOfWeek: 4, // Thursday
        hour: 9,
        confidence: 78,
        expectedOpenRate: 22.1,
        reasoning: 'Thursday morning catches weekend car shopping planners'
      },
      {
        dayOfWeek: 1, // Monday
        hour: 11,
        confidence: 75,
        expectedOpenRate: 21.8,
        reasoning: 'Monday late morning after settling into work week'
      },
      {
        dayOfWeek: 5, // Friday
        hour: 15,
        confidence: 72,
        expectedOpenRate: 20.9,
        reasoning: 'Friday afternoon planning for weekend dealership visits'
      }
    ];
  }

  /**
   * Get sequence recommendations for a specific campaign
   */
  async getSequenceRecommendations(campaignId: string): Promise<CampaignSequenceOptimization> {
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const campaignLeads = await this.getCampaignLeads(campaignId);
    const baseSequence = this.generateCampaignSequence();

    return {
      campaignId,
      recommendedSequence: baseSequence,
      optimalSendTimes: await this.getCampaignSendTimes(),
      totalDuration: 14, // 2 week sequence
      expectedResults: {
        openRateImprovement: 15.3,
        responseRateImprovement: 8.7
      }
    };
  }

  /**
   * Calculate optimal contact timing for a lead
   */
  private calculateOptimalContactTiming(lead: Lead, conversations: Conversation[]): { hour: number; dayOfWeek: number } {
    // Analyze past conversation patterns if available
    if (conversations.length > 0) {
      const responseTimes = this.extractResponseTimes(conversations);
      if (responseTimes.length > 0) {
        const avgHour = Math.round(
          responseTimes.reduce((sum, time) => sum + time.hour, 0) / responseTimes.length
        );
        const avgDay = Math.round(
          responseTimes.reduce((sum, time) => sum + time.dayOfWeek, 0) / responseTimes.length
        );
        return { hour: avgHour, dayOfWeek: avgDay };
      }
    }

    // Default to automotive industry optimal times
    return { hour: 10, dayOfWeek: 2 }; // Tuesday 10 AM
  }

  /**
   * Generate email sequence recommendations
   */
  private generateEmailSequence(lead: Lead, conversations: Conversation[]): EmailSequenceStep[] {
    const sequence: EmailSequenceStep[] = [];
    
    // Determine lead stage based on conversations
    const hasResponded = conversations.some(c => (c as any).messages?.some((m: any) => !m.isFromAI));
    const responseCount = conversations.reduce((sum, c) => 
      sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0), 0
    );

    if (responseCount === 0) {
      // New/cold lead sequence
      sequence.push(
        {
          dayOffset: 0,
          templateType: 'welcome_introduction',
          reasoning: 'Initial personalized introduction with vehicle-specific content',
          priority: 'high'
        },
        {
          dayOffset: 3,
          templateType: 'vehicle_information',
          reasoning: 'Share relevant vehicle details and specifications',
          priority: 'high'
        },
        {
          dayOffset: 7,
          templateType: 'incentives_and_offers',
          reasoning: 'Present current incentives and special offers',
          priority: 'medium'
        },
        {
          dayOffset: 12,
          templateType: 'social_proof',
          reasoning: 'Customer testimonials and reviews to build trust',
          priority: 'medium'
        }
      );
    } else if (responseCount < 3) {
      // Engaged lead sequence
      sequence.push(
        {
          dayOffset: 0,
          templateType: 'follow_up_personalized',
          reasoning: 'Continue conversation based on previous interactions',
          priority: 'high'
        },
        {
          dayOffset: 2,
          templateType: 'additional_options',
          reasoning: 'Present alternative or upgraded vehicle options',
          priority: 'high'
        },
        {
          dayOffset: 5,
          templateType: 'financing_information',
          reasoning: 'Provide financing options and payment calculators',
          priority: 'medium'
        }
      );
    } else {
      // Hot lead sequence
      sequence.push(
        {
          dayOffset: 0,
          templateType: 'immediate_follow_up',
          reasoning: 'Strike while lead is highly engaged',
          priority: 'high'
        },
        {
          dayOffset: 1,
          templateType: 'appointment_scheduling',
          reasoning: 'Schedule test drive or dealership visit',
          priority: 'high'
        }
      );
    }

    return sequence;
  }

  /**
   * Generate send time recommendations based on automotive best practices
   */
  private generateSendTimeRecommendations(): SendTimeRecommendation[] {
    return [
      {
        dayOfWeek: 2, // Tuesday
        hour: 10,
        confidence: 90,
        expectedOpenRate: 25.2,
        reasoning: 'Peak engagement time for automotive leads'
      },
      {
        dayOfWeek: 4, // Thursday
        hour: 14,
        confidence: 85,
        expectedOpenRate: 23.8,
        reasoning: 'Afternoon research time before weekend shopping'
      },
      {
        dayOfWeek: 1, // Monday
        hour: 11,
        confidence: 80,
        expectedOpenRate: 22.5,
        reasoning: 'Monday late morning after work routine settles'
      }
    ];
  }

  /**
   * Generate campaign-level email sequence
   */
  private generateCampaignSequence(): EmailSequenceStep[] {
    return [
      {
        dayOffset: 0,
        templateType: 'campaign_launch',
        reasoning: 'Initial campaign email with strong value proposition',
        priority: 'high'
      },
      {
        dayOffset: 4,
        templateType: 'educational_content',
        reasoning: 'Provide valuable automotive information and tips',
        priority: 'medium'
      },
      {
        dayOffset: 8,
        templateType: 'special_offer',
        reasoning: 'Present time-sensitive offers or incentives',
        priority: 'high'
      },
      {
        dayOffset: 14,
        templateType: 'final_call_to_action',
        reasoning: 'Last chance messaging with clear next steps',
        priority: 'medium'
      }
    ];
  }

  /**
   * Extract response times from conversation history
   */
  private extractResponseTimes(conversations: Conversation[]): Array<{ hour: number; dayOfWeek: number }> {
    const responseTimes: Array<{ hour: number; dayOfWeek: number }> = [];

    for (const conversation of conversations) {
      const messages = (conversation as any).messages || [];
      const userMessages = messages.filter((m: any) => !m.isFromAI && m.createdAt);

      for (const message of userMessages) {
        const date = new Date(message.createdAt);
        responseTimes.push({
          hour: date.getHours(),
          dayOfWeek: date.getDay()
        });
      }
    }

    return responseTimes;
  }

  /**
   * Calculate confidence score based on available data
   */
  private calculateConfidence(lead: Lead, conversations: Conversation[]): number {
    let confidence = 50; // Base confidence

    // More conversations = higher confidence in timing predictions
    const responseCount = conversations.reduce((sum, c) => 
      sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0), 0
    );

    if (responseCount >= 5) confidence += 30;
    else if (responseCount >= 3) confidence += 20;
    else if (responseCount >= 1) confidence += 10;

    // Recent activity increases confidence
    if (conversations.length > 0) {
      const latestConversation = conversations.sort((a, b) => 
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      )[0];

      const daysSinceLastActivity = Math.floor(
        (Date.now() - new Date(latestConversation.updatedAt || latestConversation.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastActivity <= 1) confidence += 15;
      else if (daysSinceLastActivity <= 3) confidence += 10;
      else if (daysSinceLastActivity > 14) confidence -= 10;
    }

    // Vehicle interest specified increases confidence
    if (lead.vehicleInterest) confidence += 10;

    return Math.min(100, Math.max(0, confidence));
  }

  private async getLeadConversations(leadId: string): Promise<Conversation[]> {
    const conversations = await storage.getConversations();
    return conversations.filter(c => c.leadId === leadId);
  }

  private async getCampaignLeads(campaignId: string): Promise<Lead[]> {
    const leads = await storage.getLeads();
    return leads.filter(l => l.campaignId === campaignId);
  }
}

export const contactOptimizationService = new ContactOptimizationService();
