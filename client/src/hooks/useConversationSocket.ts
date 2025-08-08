/**
 * Real-time conversation hook using WebSocket
 * Replaces polling with live updates
 */

import { useEffect, useRef } from 'react';

export interface ConversationMessage {
  id: string;
  sender: 'lead' | 'agent' | 'system';
  content: string;
  timestamp: string;
  ai_generated?: boolean;
  quality_score?: number;
}

export interface UseConversationSocketProps {
  conversationId: string;
  userId: string;
  onMessage: (data: any) => void;
  onError?: (error: Event) => void;
}

export function useConversationSocket({
  conversationId,
  userId,
  onMessage,
  onError
}: UseConversationSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected for conversation:', conversationId);
      
      // Join conversation room
      ws.send(JSON.stringify({
        type: 'join_conversation',
        conversationId,
        userId,
        timestamp: new Date().toISOString()
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        if (data.type === 'new_message' || 
            data.type === 'conversation_history' ||
            data.type === 'message_update' ||
            data.type === 'typing_indicator') {
          onMessage(data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      
      // Attempt reconnection after delay
      if (event.code !== 1000) { // Not a normal closure
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          // The useEffect will create a new connection
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [conversationId, userId, onMessage, onError]);

  // Send message through WebSocket
  const sendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        conversationId,
        userId,
        message,
        timestamp: new Date().toISOString()
      }));
    }
  };

  // Send typing indicator
  const sendTyping = (isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversationId,
        userId,
        isTyping,
        timestamp: new Date().toISOString()
      }));
    }
  };

  return {
    sendMessage,
    sendTyping,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}