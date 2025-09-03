/**
 * Telemetry Schema Validation Tests
 * 
 * Locks the exact shape of telemetry events to prevent silent drift.
 * Critical for production analytics and debugging.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TelemetryService } from '../telemetry';

describe('Telemetry Schema Validation', () => {
  let telemetryService: TelemetryService;
  let mockTrack: jest.Mock;

  beforeEach(() => {
    mockTrack = jest.fn();
    telemetryService = new TelemetryService();
    
    // Mock the underlying track method
    telemetryService.track = mockTrack;
  });

  describe('v2_conversation_load Event Schema', () => {
    it('MUST match exact schema shape', () => {
      const conversationId = 'conv-123';
      const agentId = 'riley-agent';
      const status = 'active';

      telemetryService.trackV2ConversationLoad(conversationId, agentId, status);

      expect(mockTrack).toHaveBeenCalledTimes(1);
      
      const [eventName, eventData] = mockTrack.mock.calls[0];
      
      // Validate event name
      expect(eventName).toBe('v2_conversation_load');
      
      // Validate exact schema shape
      expect(eventData).toEqual({
        conversationId: 'conv-123',
        agentId: 'riley-agent', 
        status: 'active',
        ts: expect.any(Number) // Unix timestamp
      });
      
      // Ensure no extra fields
      expect(Object.keys(eventData)).toEqual(['conversationId', 'agentId', 'status', 'ts']);
      
      // Validate timestamp is recent (within last 5 seconds)
      expect(eventData.ts).toBeGreaterThan(Date.now() - 5000);
      expect(eventData.ts).toBeLessThanOrEqual(Date.now());
    });

    it('should handle missing optional fields gracefully', () => {
      telemetryService.trackV2ConversationLoad('conv-456', null, 'archived');

      const [, eventData] = mockTrack.mock.calls[0];
      
      expect(eventData).toEqual({
        conversationId: 'conv-456',
        agentId: null,
        status: 'archived',
        ts: expect.any(Number)
      });
    });

    it('should validate status enum values', () => {
      const validStatuses = ['active', 'responded', 'handed_over', 'archived'];
      
      validStatuses.forEach(status => {
        mockTrack.mockClear();
        telemetryService.trackV2ConversationLoad('conv-test', 'agent-test', status);
        
        const [, eventData] = mockTrack.mock.calls[0];
        expect(eventData.status).toBe(status);
      });
    });
  });

  describe('v2_reply_sent Event Schema', () => {
    it('MUST match exact schema shape', () => {
      const conversationId = 'conv-123';
      const messageId = '<reply@example.com>';
      const handover = false;

      telemetryService.trackV2ReplySent(conversationId, messageId, handover);

      expect(mockTrack).toHaveBeenCalledTimes(1);
      
      const [eventName, eventData] = mockTrack.mock.calls[0];
      
      // Validate event name
      expect(eventName).toBe('v2_reply_sent');
      
      // Validate exact schema shape
      expect(eventData).toEqual({
        conversationId: 'conv-123',
        messageId: '<reply@example.com>',
        handover: false,
        ts: expect.any(Number)
      });
      
      // Ensure no extra fields
      expect(Object.keys(eventData)).toEqual(['conversationId', 'messageId', 'handover', 'ts']);
    });

    it('should handle handover=true scenario', () => {
      telemetryService.trackV2ReplySent('conv-456', '<final@example.com>', true);

      const [, eventData] = mockTrack.mock.calls[0];
      
      expect(eventData).toEqual({
        conversationId: 'conv-456',
        messageId: '<final@example.com>',
        handover: true,
        ts: expect.any(Number)
      });
    });

    it('should validate messageId format', () => {
      // Test valid message ID formats
      const validMessageIds = [
        '<msg@example.com>',
        '<reply-123@domain.com>',
        '<a7b3c9d2e5f8g1h4@kunesmacomb.kunesauto.vip>'
      ];

      validMessageIds.forEach(messageId => {
        mockTrack.mockClear();
        telemetryService.trackV2ReplySent('conv-test', messageId, false);
        
        const [, eventData] = mockTrack.mock.calls[0];
        expect(eventData.messageId).toBe(messageId);
        expect(eventData.messageId).toMatch(/^<.*@.*>$/);
      });
    });
  });

  describe('v2_handover_triggered Event Schema', () => {
    it('MUST match exact schema shape', () => {
      const conversationId = 'conv-789';

      telemetryService.trackV2HandoverTriggered(conversationId);

      expect(mockTrack).toHaveBeenCalledTimes(1);
      
      const [eventName, eventData] = mockTrack.mock.calls[0];
      
      // Validate event name
      expect(eventName).toBe('v2_handover_triggered');
      
      // Validate exact schema shape
      expect(eventData).toEqual({
        conversationId: 'conv-789',
        ts: expect.any(Number)
      });
      
      // Ensure only expected fields
      expect(Object.keys(eventData)).toEqual(['conversationId', 'ts']);
    });

    it('should include reason when provided', () => {
      telemetryService.trackV2HandoverTriggered('conv-789', 'customer requested pricing');

      const [, eventData] = mockTrack.mock.calls[0];
      
      expect(eventData).toEqual({
        conversationId: 'conv-789',
        reason: 'customer requested pricing',
        ts: expect.any(Number)
      });
      
      expect(Object.keys(eventData)).toEqual(['conversationId', 'reason', 'ts']);
    });
  });

  describe('Development vs Production Behavior', () => {
    it('should log to console in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      telemetryService.trackV2ConversationLoad('conv-dev', 'agent-dev', 'active');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Telemetry] v2_conversation_load',
        expect.objectContaining({
          conversationId: 'conv-dev',
          agentId: 'agent-dev',
          status: 'active'
        })
      );

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should NOT log to console in production', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      telemetryService.trackV2ConversationLoad('conv-prod', 'agent-prod', 'active');

      expect(consoleSpy).not.toHaveBeenCalled();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });
  });

  describe('Timestamp Consistency', () => {
    it('should use consistent timestamp format across all events', () => {
      const beforeTimestamp = Date.now();
      
      telemetryService.trackV2ConversationLoad('conv-1', 'agent-1', 'active');
      telemetryService.trackV2ReplySent('conv-1', '<msg@example.com>', false);
      telemetryService.trackV2HandoverTriggered('conv-1');
      
      const afterTimestamp = Date.now();
      
      // All events should have timestamps in the same format
      mockTrack.mock.calls.forEach(([eventName, eventData]) => {
        expect(typeof eventData.ts).toBe('number');
        expect(eventData.ts).toBeGreaterThanOrEqual(beforeTimestamp);
        expect(eventData.ts).toBeLessThanOrEqual(afterTimestamp);
      });
    });
  });

  describe('Error Resilience', () => {
    it('should not throw errors for invalid inputs', () => {
      expect(() => {
        telemetryService.trackV2ConversationLoad(null as any, undefined as any, 'invalid' as any);
        telemetryService.trackV2ReplySent('', null as any, 'not-boolean' as any);
        telemetryService.trackV2HandoverTriggered(undefined as any);
      }).not.toThrow();
    });
  });
});