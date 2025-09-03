import { storage } from '../storage';
import type { Lead, Conversation } from '../../shared/schema';

export interface CoreLeadScore {
  leadId: string;
  vehicleTypeScore: number;      // 0-100
  financialCapacityScore: number; // 0-100  
  engagementScore: number;       // 0-100
  overallScore: number;          // 0-100
  optimalContactTime: Date | null;
  scoreFactors: {
    vehicleType: string;
    financialIndicators: string[];
    engagementMetrics: string[];
  };
}

export class CoreLeadScoringService {
  /**
   * Calculate enhanced lead score with automotive-focused factors
   */
  async calculateEnhancedScore(leadId: string): Promise<CoreLeadScore> {
    const lead = await storage.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const conversations = await this.getLeadConversations(leadId);
    
    const vehicleTypeScore = this.assessVehicleType(lead);
    const financialCapacityScore = this.assessFinancialCapacity(lead, conversations);
    const engagementScore = this.assessEngagementQuality(conversations);
    const optimalContactTime = this.determineOptimalContactTime(lead);

    // Weighted overall score
    const overallScore = Math.round(
      vehicleTypeScore * 0.35 +
      financialCapacityScore * 0.35 +
      engagementScore * 0.30
    );

    return {
      leadId,
      vehicleTypeScore,
      financialCapacityScore,
      engagementScore,
      overallScore,
      optimalContactTime,
      scoreFactors: {
        vehicleType: this.getVehicleTypeDescription(lead),
        financialIndicators: this.getFinancialIndicators(lead, conversations),
        engagementMetrics: this.getEngagementMetrics(conversations)
      }
    };
  }

  /**
   * Calculate scores for multiple leads
   */
  async bulkCalculateScores(leadIds: string[]): Promise<CoreLeadScore[]> {
    const scores = await Promise.all(
      leadIds.map(id => this.calculateEnhancedScore(id).catch(() => null))
    );
    return scores.filter(Boolean) as CoreLeadScore[];
  }

  /**
   * Assess vehicle type value potential
   */
  private assessVehicleType(lead: Lead): number {
    const vehicleInfo = lead.vehicleInterest?.toLowerCase() || '';

    let score = 50; // Base score

    // Luxury/premium brands
    if (vehicleInfo.includes('bmw') || vehicleInfo.includes('mercedes') || 
        vehicleInfo.includes('audi') || vehicleInfo.includes('lexus') ||
        vehicleInfo.includes('cadillac') || vehicleInfo.includes('tesla')) {
      score += 30;
    }

    // High-value vehicle types
    if (vehicleInfo.includes('suv') || vehicleInfo.includes('truck') || 
        vehicleInfo.includes('pickup')) {
      score += 20;
    }

    // New vs used preference
    if (vehicleInfo.includes('new')) score += 15;
    else if (vehicleInfo.includes('used') || vehicleInfo.includes('pre-owned')) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Assess financial capacity indicators
   */
  private assessFinancialCapacity(lead: Lead, conversations: Conversation[]): number {
    let score = 50; // Base score

    // Conversation analysis for financial signals
    const allMessages = conversations.flatMap(c => (c as any).messages || []);
    const messageText = allMessages.map((m: any) => m.content?.toLowerCase() || '').join(' ');

    // Positive financial indicators
    if (messageText.includes('pre-approved') || messageText.includes('pre approved')) score += 25;
    if (messageText.includes('cash') && messageText.includes('buy')) score += 30;
    if (messageText.includes('financing') || messageText.includes('loan')) score += 15;
    if (messageText.includes('trade') && (messageText.includes('in') || messageText.includes('value'))) score += 10;
    if (messageText.includes('down payment')) score += 20;

    // Income/stability indicators
    if (messageText.includes('credit score') || messageText.includes('good credit')) score += 15;
    if (messageText.includes('steady job') || messageText.includes('employed')) score += 10;

    // Budget mentions in conversation
    if (messageText.includes('budget') || messageText.includes('price range')) score += 10;
    if (messageText.includes('afford')) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Assess engagement quality
   */
  private assessEngagementQuality(conversations: Conversation[]): number {
    if (!conversations.length) return 0;

    let score = 30; // Base engagement score

    const totalMessages = conversations.reduce((sum, c) => sum + ((c as any).messages?.length || 0), 0);
    const responseCount = conversations.reduce((sum, c) => {
      return sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0);
    }, 0);

    // Response frequency
    if (responseCount >= 5) score += 30;
    else if (responseCount >= 3) score += 20;
    else if (responseCount >= 1) score += 10;

    // Message depth (longer messages indicate higher engagement)
    const avgMessageLength = conversations.reduce((sum, c) => {
      const messages = (c as any).messages || [];
      const userMessages = messages.filter((m: any) => !m.isFromAI);
      const totalLength = userMessages.reduce((len: number, m: any) => len + (m.content?.length || 0), 0);
      return sum + (userMessages.length > 0 ? totalLength / userMessages.length : 0);
    }, 0) / Math.max(1, conversations.length);

    if (avgMessageLength > 100) score += 20;
    else if (avgMessageLength > 50) score += 10;

    // Recent activity
    const latestConversation = conversations.sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    )[0];

    if (latestConversation) {
      const daysSinceLastActivity = Math.floor(
        (Date.now() - new Date(latestConversation.updatedAt || latestConversation.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastActivity <= 1) score += 20;
      else if (daysSinceLastActivity <= 3) score += 15;
      else if (daysSinceLastActivity <= 7) score += 10;
      else if (daysSinceLastActivity > 14) score -= 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine optimal contact time based on lead behavior
   */
  private determineOptimalContactTime(lead: Lead): Date | null {
    // Basic implementation - can be enhanced with ML later
    const now = new Date();
    const optimalTime = new Date(now);

    // Business hours preference (9 AM - 6 PM)
    const currentHour = now.getHours();
    
    if (currentHour < 9) {
      optimalTime.setHours(9, 0, 0, 0);
    } else if (currentHour >= 18) {
      optimalTime.setDate(optimalTime.getDate() + 1);
      optimalTime.setHours(9, 0, 0, 0);
    } else {
      // Within business hours - suggest next available slot
      optimalTime.setHours(currentHour + 1, 0, 0, 0);
    }

    // Avoid weekends
    const dayOfWeek = optimalTime.getDay();
    if (dayOfWeek === 0) { // Sunday
      optimalTime.setDate(optimalTime.getDate() + 1);
      optimalTime.setHours(9, 0, 0, 0);
    } else if (dayOfWeek === 6) { // Saturday
      optimalTime.setDate(optimalTime.getDate() + 2);
      optimalTime.setHours(9, 0, 0, 0);
    }

    return optimalTime;
  }

  private getVehicleTypeDescription(lead: Lead): string {
    const vehicleInfo = lead.vehicleInterest || 'Not specified';
    
    if (vehicleInfo.toLowerCase().includes('bmw') || 
        vehicleInfo.toLowerCase().includes('mercedes') || 
        vehicleInfo.toLowerCase().includes('audi')) {
      return `Premium vehicle interest: ${vehicleInfo}`;
    }
    
    return `Vehicle interest: ${vehicleInfo}`;
  }

  private getFinancialIndicators(lead: Lead, conversations: Conversation[]): string[] {
    const indicators: string[] = [];

    const allMessages = conversations.flatMap(c => (c as any).messages || []);
    const messageText = allMessages.map((m: any) => m.content?.toLowerCase() || '').join(' ');

    if (messageText.includes('pre-approved')) indicators.push('Pre-approved financing');
    if (messageText.includes('cash') && messageText.includes('buy')) indicators.push('Cash buyer');
    if (messageText.includes('trade')) indicators.push('Trade-in available');
    if (messageText.includes('down payment')) indicators.push('Down payment ready');
    if (messageText.includes('budget') || messageText.includes('price range')) indicators.push('Budget discussed');

    return indicators.length ? indicators : ['Financial capacity assessment needed'];
  }

  private getEngagementMetrics(conversations: Conversation[]): string[] {
    const metrics: string[] = [];
    
    const responseCount = conversations.reduce((sum, c) => {
      return sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0);
    }, 0);

    metrics.push(`${responseCount} responses`);
    metrics.push(`${conversations.length} conversation threads`);

    if (conversations.length > 0) {
      const latestConversation = conversations.sort((a, b) => 
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      )[0];

      const daysSinceLastActivity = Math.floor(
        (Date.now() - new Date(latestConversation.updatedAt || latestConversation.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastActivity === 0) metrics.push('Active today');
      else if (daysSinceLastActivity <= 3) metrics.push('Recently active');
      else metrics.push(`Last active ${daysSinceLastActivity} days ago`);
    }

    return metrics;
  }

  private async getLeadConversations(leadId: string): Promise<Conversation[]> {
    const conversations = await storage.getConversations();
    return conversations.filter(c => c.leadId === leadId);
  }
}

export const coreLeadScoringService = new CoreLeadScoringService();
