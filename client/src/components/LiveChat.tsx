import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Clock } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  senderType: 'lead' | 'agent' | 'ai';
  content: string;
  timestamp: string;
}

interface LiveChatProps {
  leadId: string;
  conversationId: string;
  leadName?: string;
  onClose?: () => void;
}

export function LiveChat({ leadId, conversationId, leadName, onClose }: LiveChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/conversations?leadId=${leadId}&conversationId=${conversationId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('Chat session established');
            break;
            
          case 'new_message':
          case 'ai_response':
          case 'agent_message':
            setMessages(prev => [...prev, data.message]);
            if (data.type === 'ai_response') {
              setIsTyping(false);
            }
            break;
            
          case 'error':
            console.error('WebSocket error:', data.message);
            break;
            
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [leadId, conversationId]);

  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current || !isConnected) return;

    const message = {
      content: newMessage.trim(),
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    wsRef.current.send(JSON.stringify(message));
    setNewMessage('');
    setIsTyping(true); // Show AI is thinking
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'ai':
        return <Bot className="h-4 w-4 text-blue-600" />;
      case 'agent':
        return <User className="h-4 w-4 text-green-600" />;
      case 'lead':
        return <User className="h-4 w-4 text-gray-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSenderName = (senderType: string, senderId: string) => {
    switch (senderType) {
      case 'ai':
        return 'AI Assistant';
      case 'agent':
        return 'Agent';
      case 'lead':
        return leadName || 'Customer';
      default:
        return senderId;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <span>Live Chat - {leadName || 'Customer'}</span>
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardTitle>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Bot className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No messages yet. Start a conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.senderType === 'lead' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.senderType !== 'lead' && (
                    <div className="flex-shrink-0">
                      {getSenderIcon(message.senderType)}
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.senderType === 'lead'
                        ? 'bg-blue-600 text-white ml-auto'
                        : message.senderType === 'ai'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-green-100 text-green-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium opacity-75">
                        {getSenderName(message.senderType, message.senderId)}
                      </span>
                      <span className="text-xs opacity-75 ml-2">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {message.senderType === 'lead' && (
                    <div className="flex-shrink-0">
                      {getSenderIcon(message.senderType)}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* AI Typing Indicator */}
            {isTyping && (
              <div className="flex items-start space-x-3">
                <Bot className="h-4 w-4 text-blue-600 mt-1" />
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">AI is typing</span>
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t p-4">
          <div className="flex items-center space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type your message..." : "Connecting..."}
              disabled={!isConnected}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!isConnected || !newMessage.trim()}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {!isConnected && (
            <div className="flex items-center justify-center mt-2 text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-1" />
              Connecting to chat server...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}