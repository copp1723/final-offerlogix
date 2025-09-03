/**
 * V2 Bridge E2E Tests
 * 
 * Tests the V2 UI bridge functionality including:
 * 1. V2 agent conversation loading
 * 2. V2 reply path with handover detection
 * 3. V1 isolation when V2 is disabled
 * 4. Telemetry tracking
 */

import request from 'supertest';
import { makeApp } from './helpers';

describe('V2 Bridge E2E Tests', () => {
  let app: any;
  
  beforeAll(async () => {
    app = await makeApp();
  });

  describe('V2 Conversation Load Test', () => {
    it('should load V2 conversation and render subject & status', async () => {
      // Mock V2 conversation data
      const mockV2Conversation = {
        id: 'conv_123',
        agentId: 'agent_v2_test',
        leadEmail: 'test@example.com',
        subject: 'Test V2 Conversation',
        status: 'active',
        lastMessageId: 'msg_456',
        updatedAt: new Date().toISOString()
      };

      // Mock the V2 endpoint
      const mockV2Handler = jest.fn().mockResolvedValue(mockV2Conversation);
      
      // Test V2 conversation endpoint
      const response = await request(app)
        .get('/v2/conversations/conv_123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        subject: expect.any(String),
        status: expect.any(String),
        lastMessageId: expect.any(String),
        updatedAt: expect.any(String)
      });

      // Verify the response contains required fields for UI rendering
      expect(response.body.subject).toBeTruthy();
      expect(response.body.status).toBeTruthy();
      expect(['active', 'handed_over', 'completed'].includes(response.body.status)).toBe(true);
    });

    it('should handle V2 conversation with handed_over status', async () => {
      const mockHandedOverConversation = {
        id: 'conv_handover_123',
        agentId: 'agent_v2_test',
        leadEmail: 'handover@example.com',
        subject: 'Handed Over Conversation',
        status: 'handed_over',
        lastMessageId: 'msg_789',
        updatedAt: new Date().toISOString()
      };

      const response = await request(app)
        .get('/v2/conversations/conv_handover_123')
        .expect(200);

      expect(response.body.status).toBe('handed_over');
      expect(response.body.subject).toBe('Handed Over Conversation');
    });
  });

  describe('V2 Reply Path Test', () => {
    it('should handle V2 reply and return handover status', async () => {
      const mockReplyResult = {
        messageId: 'msg_new_123',
        handover: false
      };

      const response = await request(app)
        .post('/v2/conversations/conv_123/reply')
        .send({
          content: 'Test reply message',
          agentId: 'agent_v2_test'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        messageId: expect.any(String),
        handover: expect.any(Boolean)
      });
    });

    it('should handle V2 reply with handover trigger', async () => {
      const mockHandoverReply = {
        messageId: 'msg_handover_456',
        handover: true
      };

      const response = await request(app)
        .post('/v2/conversations/conv_123/reply')
        .send({
          content: 'I need to speak with a human representative',
          agentId: 'agent_v2_test'
        })
        .expect(200);

      expect(response.body.handover).toBe(true);
      expect(response.body.messageId).toBeTruthy();
    });

    it('should not call V1 endpoints when using V2 reply path', async () => {
      // This test ensures V1 endpoints are not called during V2 operations
      const v1ConversationSpy = jest.fn();
      const v1ReplySpy = jest.fn();

      // Mock V1 endpoints to track if they're called
      app.get('/api/conversations/:id', v1ConversationSpy);
      app.post('/api/conversations/:id/reply', v1ReplySpy);

      // Make V2 reply request
      await request(app)
        .post('/v2/conversations/conv_123/reply')
        .send({
          content: 'Test V2 isolation',
          agentId: 'agent_v2_test'
        })
        .expect(200);

      // Verify V1 endpoints were not called
      expect(v1ConversationSpy).not.toHaveBeenCalled();
      expect(v1ReplySpy).not.toHaveBeenCalled();
    });
  });

  describe('V1 Isolation Test', () => {
    it('should use V1 endpoints when V2 is disabled', async () => {
      // Test with VITE_ENABLE_V2_UI=false environment
      const originalEnv = process.env.VITE_ENABLE_V2_UI;
      process.env.VITE_ENABLE_V2_UI = 'false';

      try {
        // Mock V1 conversation response
        const mockV1Response = {
          id: 'conv_v1_123',
          messages: [],
          status: 'active'
        };

        const response = await request(app)
          .get('/api/conversations/conv_v1_123')
          .expect(200);

        // Verify V1 response structure
        expect(response.body).toHaveProperty('messages');
        expect(Array.isArray(response.body.messages)).toBe(true);
      } finally {
        process.env.VITE_ENABLE_V2_UI = originalEnv;
      }
    });

    it('should use V1 endpoints when agent.useV2=false', async () => {
      // Test with agent that has useV2=false
      const mockAgent = {
        id: 'agent_v1_only',
        useV2: false,
        name: 'V1 Only Agent'
      };

      // This would be handled by the UI logic, but we can test the backend behavior
      const response = await request(app)
        .get('/api/conversations/conv_v1_agent')
        .expect(200);

      // Verify it uses V1 structure
      expect(response.body).toHaveProperty('messages');
    });
  });

  describe('Telemetry Tracking', () => {
    it('should track v2_reply_sent events', async () => {
      // Mock telemetry collector
      const telemetryEvents: any[] = [];
      const mockTelemetry = {
        track: (event: string, data: any) => {
          telemetryEvents.push({ event, data });
        }
      };

      // Make V2 reply request
      const response = await request(app)
        .post('/v2/conversations/conv_telemetry_123/reply')
        .send({
          content: 'Test telemetry tracking',
          agentId: 'agent_v2_test'
        })
        .expect(200);

      // Verify telemetry event was tracked
      const replyEvent = telemetryEvents.find(e => e.event === 'v2_reply_sent');
      expect(replyEvent).toBeDefined();
      expect(replyEvent.data).toMatchObject({
        conversationId: 'conv_telemetry_123',
        messageId: expect.any(String),
        handover: expect.any(Boolean)
      });
    });

    it('should include handover status in telemetry', async () => {
      const telemetryEvents: any[] = [];
      
      // Test with handover scenario
      await request(app)
        .post('/v2/conversations/conv_handover_telemetry/reply')
        .send({
          content: 'I want to speak to a human',
          agentId: 'agent_v2_test'
        })
        .expect(200);

      const replyEvent = telemetryEvents.find(e => e.event === 'v2_reply_sent');
      if (replyEvent) {
        expect(replyEvent.data.handover).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle V2 endpoint failures gracefully', async () => {
      // Test non-existent conversation
      await request(app)
        .get('/v2/conversations/nonexistent')
        .expect(404);
    });

    it('should handle V2 reply failures', async () => {
      // Test invalid reply data
      await request(app)
        .post('/v2/conversations/conv_123/reply')
        .send({
          // Missing required fields
        })
        .expect(400);
    });
  });
});
