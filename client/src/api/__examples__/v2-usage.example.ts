/**
 * V2 API Usage Examples
 * 
 * Real-world usage patterns for the V2 client methods.
 * These examples demonstrate proper TypeScript usage and error handling.
 */

import { getV2Conversation, replyV2Conversation } from '../client';
import { ENABLE_V2_UI } from '@/config/featureFlags';
import type { V2Conversation, V2ReplyResult } from '@/types/api';

// ============================================================================
// EXAMPLE 1: BASIC CONVERSATION FETCHING
// ============================================================================

export async function fetchConversationExample(conversationId: string): Promise<V2Conversation | null> {
  try {
    if (!ENABLE_V2_UI) {
      console.log('V2 UI not enabled, falling back to V1');
      return null;
    }

    const response = await getV2Conversation(conversationId);
    
    if (response.success) {
      const conversation = response.conversation;
      
      // TypeScript knows the exact shape:
      console.log(`Conversation ${conversation.id} with ${conversation.leadEmail}`);
      console.log(`Status: ${conversation.status}, Last updated: ${conversation.updatedAt}`);
      
      return conversation;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch V2 conversation:', error);
    return null;
  }
}

// ============================================================================
// EXAMPLE 2: REPLY WITH HANDOVER DETECTION
// ============================================================================

export async function replyWithHandoverExample(conversationId: string): Promise<{
  success: boolean;
  handover?: boolean;
  messageId?: string;
}> {
  try {
    if (!ENABLE_V2_UI) {
      return { success: false };
    }

    const response = await replyV2Conversation(conversationId);
    
    if (response.success) {
      console.log(`Reply sent: ${response.messageId}`);
      
      // Note: handover detection would come from separate endpoint
      // or additional response fields in the future
      return {
        success: true,
        messageId: response.messageId
      };
    }
    
    return { success: false };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('handed over')) {
        return { success: false, handover: true };
      }
      if (error.message.includes('not found')) {
        console.warn('Conversation not found:', conversationId);
      }
    }
    
    console.error('Reply failed:', error);
    return { success: false };
  }
}

// ============================================================================
// EXAMPLE 3: CONDITIONAL USAGE PATTERN
// ============================================================================

export async function conditionalUsageExample(
  conversationId: string, 
  agent?: { useV2?: boolean }
) {
  // Combined feature flag + agent flag check
  const useV2 = ENABLE_V2_UI && agent?.useV2 === true;
  
  if (useV2) {
    console.log('Using V2 endpoints for conversation:', conversationId);
    
    // V2 path: typed responses, structured error handling
    try {
      const conversation = await getV2Conversation(conversationId);
      
      if (conversation.success && conversation.conversation.status === 'active') {
        const reply = await replyV2Conversation(conversationId);
        
        return {
          version: 'v2' as const,
          conversation: conversation.conversation,
          reply: reply.success ? reply : null
        };
      }
    } catch (error) {
      console.error('V2 flow failed, could fallback to V1:', error);
    }
  }
  
  console.log('Using V1 endpoints for conversation:', conversationId);
  
  // V1 fallback would go here
  return {
    version: 'v1' as const,
    conversation: null,
    reply: null
  };
}

// ============================================================================
// EXAMPLE 4: TYPE-SAFE INTEGRATION WITH REACT
// ============================================================================

export function useV2ConversationExample() {
  // This would typically be a React hook, but showing the pattern
  
  const loadConversation = async (id: string): Promise<V2Conversation | null> => {
    if (!ENABLE_V2_UI) return null;
    
    try {
      const response = await getV2Conversation(id);
      return response.success ? response.conversation : null;
    } catch {
      return null;
    }
  };
  
  const triggerReply = async (id: string): Promise<V2ReplyResult | null> => {
    if (!ENABLE_V2_UI) return null;
    
    try {
      const result = await replyV2Conversation(id);
      
      if (result.success) {
        // Track successful V2 reply
        console.log('v2_reply_sent', { 
          conversationId: result.conversationId, 
          messageId: result.messageId 
        });
      }
      
      return result;
    } catch (error) {
      console.error('V2 reply failed:', error);
      return null;
    }
  };
  
  return { loadConversation, triggerReply };
}

// ============================================================================
// TYPE EXPORTS FOR EXTERNAL USAGE
// ============================================================================

export type { V2Conversation, V2ReplyResult };
export { ENABLE_V2_UI };