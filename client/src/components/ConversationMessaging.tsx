import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  content: string;
  senderId: string;
  isFromAI: number;
  createdAt: string;
}

interface ConversationMessagingProps {
  conversationId: string;
  userId?: string;
}

export function ConversationMessaging({ conversationId, userId = "current-user" }: ConversationMessagingProps) {
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Load conversation messages
  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    enabled: !!conversationId
  });

  // Initialize messages from API
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket connection for real-time messaging
  const { isConnected, sendChatMessage, joinConversation } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'new_message' && message.message) {
        setMessages(prev => [...prev, message.message]);
      } else if (message.type === 'conversation_history') {
        setMessages(message.messages || []);
      }
    },
    onConnect: () => {
      // Join the conversation room when connected
      joinConversation(conversationId, userId);
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          senderId: userId,
          isFromAI: 0
        })
      });
    },
    onSuccess: (newMessage) => {
      // Update UI immediately if WebSocket is not connected
      if (!isConnected) {
        setMessages(prev => [...prev, newMessage]);
      }
      
      // Invalidate conversation queries
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    }
  });

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    const messageContent = messageInput.trim();
    setMessageInput('');

    try {
      if (isConnected) {
        // Send via WebSocket for real-time delivery
        sendChatMessage(messageContent);
      } else {
        // Fallback to API if WebSocket is not connected
        sendMessageMutation.mutate(messageContent);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading conversation...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Live Conversation</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Offline"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col flex-1 p-6 pt-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 mb-4 border rounded-lg p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.isFromAI ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {message.isFromAI && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.isFromAI
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <div className="text-sm">{message.content}</div>
                    <div className={`text-xs mt-1 ${
                      message.isFromAI ? 'text-gray-500' : 'text-blue-100'
                    }`}>
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  {!message.isFromAI && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={sendMessageMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || sendMessageMutation.isPending}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}