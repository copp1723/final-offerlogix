/**
 * Client-side telemetry service for tracking V2 bridge events
 * 
 * Provides structured event tracking for V2 UI bridge functionality
 * with development debugging and production analytics support.
 */

import { FeatureFlags } from '@/config/featureFlags';

export interface TelemetryEvent {
  event: string;
  timestamp: string;
  data: Record<string, any>;
  sessionId?: string;
  userId?: string;
}

export interface V2ReplyEvent {
  conversationId: string;
  messageId: string;
  handover: boolean;
  agentId?: string;
  responseTime?: number;
}

export interface V2ConversationLoadEvent {
  conversationId: string;
  agentId?: string;
  status: string;
  loadTime?: number;
}

export interface V2HandoverEvent {
  conversationId: string;
  messageId: string;
  agentId?: string;
  reason?: string;
}

class TelemetryService {
  private sessionId: string;
  private events: TelemetryEvent[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEvent(event: string, data: Record<string, any>): TelemetryEvent {
    return {
      event,
      timestamp: new Date().toISOString(),
      data,
      sessionId: this.sessionId,
      userId: this.getCurrentUserId()
    };
  }

  private getCurrentUserId(): string | undefined {
    // In a real implementation, this would get the current user ID
    // For now, return undefined or get from auth context
    return undefined;
  }

  private logEvent(telemetryEvent: TelemetryEvent): void {
    // Store event locally
    this.events.push(telemetryEvent);

    // Development logging
    if (FeatureFlags.isDev()) {
      console.log(`[Telemetry] ${telemetryEvent.event}:`, telemetryEvent.data);
    }

    // In production, this would send to analytics service
    // For now, we'll just log to console in development
    this.sendToAnalytics(telemetryEvent);
  }

  private async sendToAnalytics(event: TelemetryEvent): Promise<void> {
    try {
      // In a real implementation, this would send to your analytics service
      // e.g., Google Analytics, Mixpanel, PostHog, etc.
      
      if (FeatureFlags.isDev()) {
        console.log('[Telemetry] Would send to analytics:', event);
        return;
      }

      // Example production implementation:
      // await fetch('/api/analytics/track', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // });
    } catch (error) {
      if (FeatureFlags.isDev()) {
        console.warn('[Telemetry] Failed to send event:', error);
      }
    }
  }

  /**
   * Track V2 reply sent event
   */
  trackV2ReplySent(data: V2ReplyEvent): void {
    const event = this.createEvent('v2_reply_sent', {
      conversationId: data.conversationId,
      messageId: data.messageId,
      handover: data.handover,
      agentId: data.agentId,
      responseTime: data.responseTime,
      timestamp: new Date().toISOString()
    });

    this.logEvent(event);
  }

  /**
   * Track V2 conversation load event
   */
  trackV2ConversationLoad(data: V2ConversationLoadEvent): void {
    const event = this.createEvent('v2_conversation_load', {
      conversationId: data.conversationId,
      agentId: data.agentId,
      status: data.status,
      loadTime: data.loadTime,
      timestamp: new Date().toISOString()
    });

    this.logEvent(event);
  }

  /**
   * Track V2 handover event
   */
  trackV2Handover(data: V2HandoverEvent): void {
    const event = this.createEvent('v2_handover_triggered', {
      conversationId: data.conversationId,
      messageId: data.messageId,
      agentId: data.agentId,
      reason: data.reason,
      timestamp: new Date().toISOString()
    });

    this.logEvent(event);
  }

  /**
   * Track V2 bridge activation
   */
  trackV2BridgeActivation(conversationId: string, agentId?: string): void {
    const event = this.createEvent('v2_bridge_activated', {
      conversationId,
      agentId,
      featureFlagEnabled: FeatureFlags.V2_UI,
      timestamp: new Date().toISOString()
    });

    this.logEvent(event);
  }

  /**
   * Track V1 fallback usage
   */
  trackV1Fallback(conversationId: string, reason: string, agentId?: string): void {
    const event = this.createEvent('v1_fallback_used', {
      conversationId,
      reason,
      agentId,
      featureFlagEnabled: FeatureFlags.V2_UI,
      timestamp: new Date().toISOString()
    });

    this.logEvent(event);
  }

  /**
   * Get all tracked events (for debugging)
   */
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Clear all tracked events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string): TelemetryEvent[] {
    return this.events.filter(event => event.event === eventType);
  }
}

// Export singleton instance
export const telemetry = new TelemetryService();

// Export convenience functions
export const trackV2ReplySent = (data: V2ReplyEvent) => telemetry.trackV2ReplySent(data);
export const trackV2ConversationLoad = (data: V2ConversationLoadEvent) => telemetry.trackV2ConversationLoad(data);
export const trackV2Handover = (data: V2HandoverEvent) => telemetry.trackV2Handover(data);
export const trackV2BridgeActivation = (conversationId: string, agentId?: string) => 
  telemetry.trackV2BridgeActivation(conversationId, agentId);
export const trackV1Fallback = (conversationId: string, reason: string, agentId?: string) => 
  telemetry.trackV1Fallback(conversationId, reason, agentId);

// Development helpers
export const getTelemetryEvents = () => telemetry.getEvents();
export const clearTelemetryEvents = () => telemetry.clearEvents();
export const getV2ReplyEvents = () => telemetry.getEventsByType('v2_reply_sent');
