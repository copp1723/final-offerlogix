/**
 * V2 Conversation Hook Tests - Query Invalidation
 * 
 * Tests that query invalidation works correctly after replies,
 * ensuring handover badges update without page refresh.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useV2Conversation, __testQueryInvalidation } from '../useV2Conversation';
import { getV2Conversation, replyV2Conversation } from '@/api/client';
import React from 'react';

// Mock API functions
jest.mock('@/api/client');
const mockGetV2Conversation = getV2Conversation as jest.MockedFunction<typeof getV2Conversation>;
const mockReplyV2Conversation = replyV2Conversation as jest.MockedFunction<typeof replyV2Conversation>;

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }
}));

// Mock telemetry
jest.mock('@/services/telemetry', () => ({
  TelemetryService: class {
    trackV2ConversationLoad = jest.fn();
    trackV2ReplySent = jest.fn();
    trackV2HandoverTriggered = jest.fn();
  }
}));

describe('useV2Conversation Query Invalidation', () => {
  let queryClient: QueryClient;
  
  const createWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    jest.clearAllMocks();
    
    // Default successful conversation response
    mockGetV2Conversation.mockResolvedValue({
      success: true,
      conversation: {
        id: 'conv-123',
        agentId: 'riley-agent',
        leadEmail: 'customer@example.com',
        subject: 'Test Subject',
        status: 'active',
        lastMessageId: '<msg@example.com>',
        updatedAt: '2025-08-28T04:00:00.000Z'
      }
    });
  });

  describe('Query Key Consistency', () => {
    it('should use same query keys as V1 for consistent invalidation', async () => {
      const { result } = renderHook(
        () => useV2Conversation({ conversationId: 'conv-123' }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.conversation).toBeDefined();
      });

      // Check that query is stored with expected key format
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll();
      
      const conversationQuery = queries.find(query => 
        JSON.stringify(query.queryKey) === JSON.stringify(['conversation', 'conv-123'])
      );
      
      expect(conversationQuery).toBeDefined();
      expect(conversationQuery?.state.data).toEqual(
        expect.objectContaining({
          id: 'conv-123',
          status: 'active'
        })
      );
    });
  });

  describe('Reply Success - Query Invalidation', () => {
    it('should invalidate conversation queries after successful reply', async () => {
      mockReplyV2Conversation.mockResolvedValue({
        success: true,
        messageId: '<reply@example.com>',
        conversationId: 'conv-123'
      });

      const { result } = renderHook(
        () => useV2Conversation({ conversationId: 'conv-123' }),
        { wrapper: createWrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.conversation).toBeDefined();
      });

      // Spy on query invalidation
      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      // Trigger reply
      await act(async () => {
        result.current.triggerReply();
      });

      await waitFor(() => {
        expect(mockReplyV2Conversation).toHaveBeenCalledWith('conv-123');
      });

      // Verify specific query keys were invalidated
      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
          queryKey: ['conversation', 'conv-123'] 
        });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
          queryKey: ['conversations'] 
        });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
          queryKey: ['dashboard'] 
        });
      });
    });

    it('should refetch conversation data after reply to get latest status', async () => {
      mockReplyV2Conversation.mockResolvedValue({
        success: true,
        messageId: '<reply@example.com>',
        conversationId: 'conv-123'
      });

      // Mock updated conversation with handed_over status
      const updatedConversation = {
        success: true,
        conversation: {
          id: 'conv-123',
          agentId: 'riley-agent',
          leadEmail: 'customer@example.com',
          subject: 'Test Subject',
          status: 'handed_over', // Status changed!
          lastMessageId: '<reply@example.com>',
          updatedAt: '2025-08-28T04:05:00.000Z'
        }
      };

      const { result } = renderHook(
        () => useV2Conversation({ conversationId: 'conv-123' }),
        { wrapper: createWrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.conversation?.status).toBe('active');
      });

      // Update mock to return handed_over status on refetch
      mockGetV2Conversation.mockResolvedValueOnce(updatedConversation);

      // Trigger reply
      await act(async () => {
        result.current.triggerReply();
      });

      // Should automatically refetch and update status
      await waitFor(() => {
        expect(result.current.conversation?.status).toBe('handed_over');
        expect(result.current.isHandedOver).toBe(true);
      });
    });
  });

  describe('Handover Detection - Badge Updates', () => {
    it('should update handover badge immediately after 409 response', async () => {
      mockReplyV2Conversation.mockRejectedValue(
        new Error('Conversation already handed over') as any
      );
      
      // Mock the error object to include status
      Object.assign(mockReplyV2Conversation.mock.results[0].value, { status: 409 });

      const { result } = renderHook(
        () => useV2Conversation({ conversationId: 'conv-123' }),
        { wrapper: createWrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isHandedOver).toBe(false);
      });

      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      // Trigger reply that will get 409
      await act(async () => {
        result.current.triggerReply();
      });

      // Should invalidate queries even on 409 error
      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
          queryKey: ['conversation', 'conv-123'] 
        });
      });
    });
  });

  describe('Test Utilities', () => {
    it('should provide test utility for query invalidation testing', async () => {
      const { simulateReplySuccess } = __testQueryInvalidation();
      
      // Set up initial query state
      queryClient.setQueryData(['conversation', 'conv-test'], {
        id: 'conv-test',
        status: 'active'
      });

      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      // Simulate reply success
      simulateReplySuccess('conv-test');

      // Should invalidate the same queries as the hook
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
        queryKey: ['conversation', 'conv-test'] 
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
        queryKey: ['conversations'] 
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
        queryKey: ['dashboard'] 
      });
    });
  });

  describe('Double-click Prevention', () => {
    it('should prevent multiple reply calls when already pending', async () => {
      // Mock slow response
      mockReplyV2Conversation.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            messageId: '<reply@example.com>',
            conversationId: 'conv-123'
          }), 100)
        )
      );

      const { result } = renderHook(
        () => useV2Conversation({ conversationId: 'conv-123' }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.conversation).toBeDefined();
      });

      // Trigger multiple rapid replies
      act(() => {
        result.current.triggerReply();
        result.current.triggerReply();
        result.current.triggerReply();
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isReplying).toBe(false);
      });

      // Should only call API once
      expect(mockReplyV2Conversation).toHaveBeenCalledTimes(1);
    });
  });
});