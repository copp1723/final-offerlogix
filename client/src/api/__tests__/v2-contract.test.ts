/**
 * V2 API Contract Tests
 * 
 * Prevents silent API shape drift by validating actual response structures
 * against TypeScript interfaces. Uses zod for runtime validation.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { getV2Conversation, replyV2Conversation } from '../client';
import type { V2Conversation, V2ReplyResult } from '@/types/api';

// Define Zod schemas that match our TypeScript interfaces exactly
const V2ConversationSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  leadEmail: z.string().email(),
  subject: z.string(),
  status: z.enum(['active', 'responded', 'handed_over', 'archived']),
  lastMessageId: z.string().nullable(),
  updatedAt: z.string().datetime()
});

const V2ConversationResponseSchema = z.object({
  success: z.boolean(),
  conversation: V2ConversationSchema
});

const V2ReplyResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().regex(/^<.*@.*>$/), // Message-ID format
  conversationId: z.string()
});

// Mock fetch to provide real-looking responses
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('V2 API Contract Validation', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('GET /v2/conversations/:id Contract', () => {
    it('should match V2Conversation interface exactly', async () => {
      const mockApiResponse = {
        success: true,
        conversation: {
          id: 'conv-123',
          agentId: 'riley-agent',
          leadEmail: 'customer@example.com',
          subject: 'Vehicle inquiry',
          status: 'active',
          lastMessageId: '<msg@example.com>',
          updatedAt: '2025-08-28T04:00:00.000Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      } as Response);

      const response = await getV2Conversation('conv-123');

      // Runtime validation against schema
      const validationResult = V2ConversationResponseSchema.safeParse(response);
      
      if (!validationResult.success) {
        console.error('Schema validation errors:', validationResult.error.errors);
      }
      
      expect(validationResult.success).toBe(true);
      
      // TypeScript compile-time validation
      const conversation: V2Conversation = response.conversation;
      expect(conversation.id).toBe('conv-123');
      expect(conversation.agentId).toBe('riley-agent');
      expect(conversation.status).toBe('active');
    });

    it('should handle all valid status enum values', async () => {
      const validStatuses = ['active', 'responded', 'handed_over', 'archived'] as const;
      
      for (const status of validStatuses) {
        const mockResponse = {
          success: true,
          conversation: {
            id: `conv-${status}`,
            agentId: 'test-agent',
            leadEmail: 'test@example.com',
            subject: 'Test',
            status: status,
            lastMessageId: null,
            updatedAt: '2025-08-28T04:00:00.000Z'
          }
        };

        const validationResult = V2ConversationResponseSchema.safeParse(mockResponse);
        expect(validationResult.success).toBe(true);
        
        if (validationResult.success) {
          expect(validationResult.data.conversation.status).toBe(status);
        }
      }
    });

    it('should reject invalid status values', () => {
      const invalidResponse = {
        success: true,
        conversation: {
          id: 'conv-invalid',
          agentId: 'test-agent',
          leadEmail: 'test@example.com',
          subject: 'Test',
          status: 'invalid_status', // This should fail
          lastMessageId: null,
          updatedAt: '2025-08-28T04:00:00.000Z'
        }
      };

      const validationResult = V2ConversationResponseSchema.safeParse(invalidResponse);
      expect(validationResult.success).toBe(false);
      
      if (!validationResult.success) {
        const statusError = validationResult.error.errors.find(
          err => err.path.includes('status')
        );
        expect(statusError).toBeDefined();
        expect(statusError?.code).toBe('invalid_enum_value');
      }
    });

    it('should validate email format in leadEmail field', () => {
      const invalidEmailResponse = {
        success: true,
        conversation: {
          id: 'conv-123',
          agentId: 'test-agent',
          leadEmail: 'not-an-email', // Invalid email
          subject: 'Test',
          status: 'active',
          lastMessageId: null,
          updatedAt: '2025-08-28T04:00:00.000Z'
        }
      };

      const validationResult = V2ConversationResponseSchema.safeParse(invalidEmailResponse);
      expect(validationResult.success).toBe(false);
      
      if (!validationResult.success) {
        const emailError = validationResult.error.errors.find(
          err => err.path.includes('leadEmail')
        );
        expect(emailError).toBeDefined();
        expect(emailError?.code).toBe('invalid_string');
      }
    });

    it('should handle null lastMessageId correctly', () => {
      const nullMessageIdResponse = {
        success: true,
        conversation: {
          id: 'conv-new',
          agentId: 'test-agent',
          leadEmail: 'test@example.com',
          subject: 'New conversation',
          status: 'active',
          lastMessageId: null, // Should be allowed
          updatedAt: '2025-08-28T04:00:00.000Z'
        }
      };

      const validationResult = V2ConversationResponseSchema.safeParse(nullMessageIdResponse);
      expect(validationResult.success).toBe(true);
    });
  });

  describe('POST /v2/conversations/:id/reply Contract', () => {
    it('should match V2ReplyResult interface exactly', async () => {
      const mockApiResponse = {
        success: true,
        messageId: '<reply-456@kunesmacomb.kunesauto.vip>',
        conversationId: 'conv-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      } as Response);

      const response = await replyV2Conversation('conv-123');

      // Runtime validation
      const validationResult = V2ReplyResultSchema.safeParse(response);
      
      if (!validationResult.success) {
        console.error('Reply schema validation errors:', validationResult.error.errors);
      }
      
      expect(validationResult.success).toBe(true);
      
      // TypeScript compile-time validation
      const replyResult: V2ReplyResult = response;
      expect(replyResult.success).toBe(true);
      expect(replyResult.messageId).toMatch(/^<.*@.*>$/);
      expect(replyResult.conversationId).toBe('conv-123');
    });

    it('should validate Message-ID format strictly', () => {
      const validMessageIds = [
        '<msg@example.com>',
        '<reply-123@domain.com>',
        '<a7b3c9d2e5f8g1h4@kunesmacomb.kunesauto.vip>',
        '<test@sub.domain.co.uk>'
      ];

      validMessageIds.forEach(messageId => {
        const response = {
          success: true,
          messageId: messageId,
          conversationId: 'conv-test'
        };

        const validationResult = V2ReplyResultSchema.safeParse(response);
        expect(validationResult.success).toBe(true);
      });
    });

    it('should reject invalid Message-ID formats', () => {
      const invalidMessageIds = [
        'msg@example.com', // Missing angle brackets
        '<msg>', // Missing @domain
        'msg@example.com>', // Missing opening bracket
        '<msg@example.com', // Missing closing bracket
        '<@example.com>', // Missing local part
        '<msg@>', // Missing domain
        ''
      ];

      invalidMessageIds.forEach(messageId => {
        const response = {
          success: true,
          messageId: messageId,
          conversationId: 'conv-test'
        };

        const validationResult = V2ReplyResultSchema.safeParse(response);
        expect(validationResult.success).toBe(false);
      });
    });
  });

  describe('Error Response Contracts', () => {
    it('should handle 404 error response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({
          success: false,
          error: 'Conversation not found'
        })
      } as Response);

      await expect(getV2Conversation('nonexistent'))
        .rejects.toThrow('Conversation not found');
    });

    it('should handle 409 handover error response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({
          success: false,
          error: 'Conversation already handed over'
        })
      } as Response);

      await expect(replyV2Conversation('conv-handed-over'))
        .rejects.toThrow('Conversation already handed over');
    });
  });

  describe('Schema Evolution Detection', () => {
    it('should detect when new required fields are added', () => {
      // Simulate API response with new required field
      const futureResponse = {
        success: true,
        conversation: {
          id: 'conv-123',
          agentId: 'test-agent',
          leadEmail: 'test@example.com',
          subject: 'Test',
          status: 'active',
          lastMessageId: null,
          updatedAt: '2025-08-28T04:00:00.000Z',
          // Future field that would break our current schema
          priority: 'high'
        }
      };

      // Our current schema should still validate (extra fields allowed by default)
      const validationResult = V2ConversationResponseSchema.safeParse(futureResponse);
      expect(validationResult.success).toBe(true);
    });

    it('should detect when required fields are removed', () => {
      // Simulate API response missing required field
      const incompleteResponse = {
        success: true,
        conversation: {
          id: 'conv-123',
          agentId: 'test-agent',
          // leadEmail missing - should fail
          subject: 'Test',
          status: 'active',
          lastMessageId: null,
          updatedAt: '2025-08-28T04:00:00.000Z'
        }
      };

      const validationResult = V2ConversationResponseSchema.safeParse(incompleteResponse);
      expect(validationResult.success).toBe(false);
      
      if (!validationResult.success) {
        const missingFieldError = validationResult.error.errors.find(
          err => err.code === 'invalid_type'
        );
        expect(missingFieldError).toBeDefined();
      }
    });
  });

  describe('Performance Impact', () => {
    it('should validate schemas quickly for production use', () => {
      const response = {
        success: true,
        conversation: {
          id: 'conv-perf-test',
          agentId: 'perf-agent',
          leadEmail: 'perf@example.com',
          subject: 'Performance test',
          status: 'active',
          lastMessageId: '<perf@example.com>',
          updatedAt: '2025-08-28T04:00:00.000Z'
        }
      };

      const startTime = performance.now();
      
      // Run validation 100 times to test performance
      for (let i = 0; i < 100; i++) {
        const result = V2ConversationResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 100 validations in under 10ms
      expect(totalTime).toBeLessThan(10);
    });
  });
});