/**
 * V2 Conversation Hook with Query Invalidation
 * 
 * Manages V2 conversation state and ensures UI updates immediately
 * after replies, especially for handover status changes.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getV2Conversation, replyV2Conversation } from '@/api/client';
import { TelemetryService } from '@/services/telemetry';
import { toast } from '@/hooks/use-toast';
import type { V2Conversation } from '@/types/api';

const telemetry = new TelemetryService();

interface UseV2ConversationOptions {
  conversationId: string;
  agentId?: string;
  enabled?: boolean;
}

export function useV2Conversation({ 
  conversationId, 
  agentId, 
  enabled = true 
}: UseV2ConversationOptions) {
  const queryClient = useQueryClient();
  
  // Query key that matches V1 pattern for consistent invalidation
  const conversationQueryKey = ['conversation', conversationId];
  const conversationsListKey = ['conversations']; // List view
  
  // Fetch conversation data
  const {
    data: conversationData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: conversationQueryKey,
    queryFn: async () => {
      const response = await getV2Conversation(conversationId);
      
      if (response.success) {
        // Track successful load
        telemetry.trackV2ConversationLoad(
          conversationId, 
          response.conversation.agentId, 
          response.conversation.status
        );
        
        return response.conversation;
      }
      
      throw new Error('Failed to load conversation');
    },
    enabled: enabled && !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 404 or 401
      if (error?.status === 404 || error?.status === 401) return false;
      return failureCount < 3;
    }
  });

  // Reply mutation with query invalidation
  const replyMutation = useMutation({
    mutationFn: () => replyV2Conversation(conversationId),
    onSuccess: (result) => {
      if (result.success) {
        // Track successful reply
        telemetry.trackV2ReplySent(
          conversationId, 
          result.messageId, 
          false // handover detection happens via status change
        );
        
        // CRITICAL: Invalidate the exact same keys V1 uses
        // This ensures handover badge updates without refresh
        queryClient.invalidateQueries({ queryKey: conversationQueryKey });
        queryClient.invalidateQueries({ queryKey: conversationsListKey });
        
        // Also invalidate any dashboard/stats queries
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        
        // Show success feedback
        toast.success('Reply sent successfully');
        
        // Refetch immediately to get latest status
        refetch();
      }
    },
    onError: (error: any) => {
      if (error?.status === 409 && error.message?.includes('handed over')) {
        // Handle handover scenario
        toast.info('Conversation was handed off to a human. We\'ll follow up soon.');
        
        // Track handover
        telemetry.trackV2HandoverTriggered(conversationId, 'reply attempt on handed over conversation');
        
        // Invalidate queries to update UI
        queryClient.invalidateQueries({ queryKey: conversationQueryKey });
        queryClient.invalidateQueries({ queryKey: conversationsListKey });
        
      } else if (error?.status === 404) {
        toast.error('Conversation not found');
      } else if (error?.status >= 500) {
        toast.error('Server error. Please try again.', {
          action: {
            label: 'Retry',
            onClick: () => replyMutation.mutate()
          }
        });
      } else {
        toast.error('Failed to send reply. Please try again.');
      }
    }
  });

  // Trigger reply with loading state
  const triggerReply = useCallback(() => {
    if (replyMutation.isPending) return; // Prevent double-clicks
    replyMutation.mutate();
  }, [replyMutation]);

  // Status checks
  const isHandedOver = conversationData?.status === 'handed_over';
  const isActive = conversationData?.status === 'active';
  
  return {
    // Data
    conversation: conversationData,
    isLoading,
    error,
    
    // Actions
    triggerReply,
    refetch,
    
    // Status
    isReplying: replyMutation.isPending,
    replyError: replyMutation.error,
    isHandedOver,
    isActive,
    
    // Utilities
    canReply: isActive && !replyMutation.isPending && !isLoading
  };
}

// Test utility to verify query invalidation
export function __testQueryInvalidation() {
  const queryClient = useQueryClient();
  
  const simulateReplySuccess = (conversationId: string) => {
    const conversationQueryKey = ['conversation', conversationId];
    const conversationsListKey = ['conversations'];
    
    // Same invalidation pattern as the hook
    queryClient.invalidateQueries({ queryKey: conversationQueryKey });
    queryClient.invalidateQueries({ queryKey: conversationsListKey });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  
  return { simulateReplySuccess };
}