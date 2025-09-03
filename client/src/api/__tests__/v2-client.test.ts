/**
 * V2 API Client Usage Examples & Type Checking
 * 
 * Demonstrates proper usage of V2 client methods and validates TypeScript types.
 */

import { describe, it, expect } from '@jest/globals';
import type { V2Conversation, V2ReplyResult } from '@/types/api';
import { getV2Conversation, replyV2Conversation } from '../client';
import { ENABLE_V2_UI } from '@/config/featureFlags';

// Mock fetch for testing
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('V2 API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getV2Conversation', () => {
    it('should fetch conversation with proper types', async () => {
      const mockResponse: V2Conversation = {
        id: 'conv-123',
        agentId: 'agent-456',
        leadEmail: 'customer@example.com',
        subject: 'Vehicle inquiry',
        status: 'active',
        lastMessageId: '<msg@example.com>',
        updatedAt: '2025-08-28T04:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          conversation: mockResponse
        })
      } as Response);

      const result = await getV2Conversation('conv-123');
      
      expect(result.success).toBe(true);
      expect(result.conversation.id).toBe('conv-123');
      expect(result.conversation.agentId).toBe('agent-456');
      expect(result.conversation.status).toBe('active');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/conversations/conv-123'),
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
    });

    it('should handle 404 errors properly', async () => {
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
  });

  describe('replyV2Conversation', () => {
    it('should trigger reply with proper types', async () => {
      const mockResponse: V2ReplyResult = {
        success: true,
        messageId: '<reply@example.com>',
        conversationId: 'conv-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await replyV2Conversation('conv-123');
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<reply@example.com>');
      expect(result.conversationId).toBe('conv-123');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/conversations/conv-123/reply'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: '{}' // body ignored per spec
        })
      );
    });

    it('should handle 409 handover errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({
          success: false,
          error: 'Conversation already handed over'
        })
      } as Response);

      await expect(replyV2Conversation('conv-123'))
        .rejects.toThrow('Conversation already handed over');
    });
  });

  describe('Feature Flag Integration', () => {
    it('should export ENABLE_V2_UI flag', () => {
      expect(typeof ENABLE_V2_UI).toBe('boolean');
    });

    it('should demonstrate conditional usage pattern', () => {
      // Example usage pattern for components
      const useV2 = ENABLE_V2_UI && true; // && agent?.useV2 in real usage
      
      expect(typeof useV2).toBe('boolean');
      
      // TypeScript should infer proper types
      const exampleUsage = async (conversationId: string) => {
        if (useV2) {
          // V2 path - TypeScript knows these return typed objects
          const conversation = await getV2Conversation(conversationId);
          const reply = await replyV2Conversation(conversationId);
          
          // Type checking - these should not cause TS errors
          const id: string = conversation.conversation.id;
          const messageId: string = reply.messageId;
          const success: boolean = reply.success;
          
          return { id, messageId, success };
        } else {
          // V1 fallback path would go here
          return null;
        }
      };

      expect(exampleUsage).toBeDefined();
    });
  });
});

// Type-only exports for documentation
export type { V2Conversation, V2ReplyResult };