import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Users, Activity, Mail, Clock, CheckCircle, AlertCircle, Filter } from 'lucide-react';
import { getAuthHeaders } from '@/lib/queryClient';

// API Base URL
const API_BASE = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) || '';

// V2 Types
interface V2Agent {
  id: string;
  name: string;
  domain: string;
  localPart: string;
  variables: {
    role: string;
    dealership: string;
    handoverTriggers: string;
  };
  isActive: boolean;
  createdAt: string;
}

interface V2Conversation {
  id: string;
  agentId: string;
  leadEmail: string;
  subject: string;
  status: 'active' | 'handover' | 'closed' | 'handed_over';
  lastMessageId: string | null;
  updatedAt: string;
  messageCount?: number;
  agentMessages?: number;
  leadMessages?: number;
  hasResponses?: boolean;
}

interface V2Message {
  id: string;
  sender: 'agent' | 'lead';
  content: string;
  status: 'sent' | 'delivered' | 'opened' | 'failed';
  createdAt: string;
}

export default function ConversationsV2Page() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversationFilter, setConversationFilter] = useState<'all' | 'with-responses' | 'active-only'>('all');

  // Fetch V2 agents
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['/v2/agents'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/v2/agents`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      return data.agents as V2Agent[];
    },
  });

  // Fetch conversations for selected agent
  const { data: allConversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['/v2/conversations', selectedAgent],
    queryFn: async () => {
      if (!selectedAgent) return [];
      const response = await fetch(`${API_BASE}/v2/conversations?agentId=${selectedAgent}&limit=50&includeMessageCounts=true`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      return data.conversations as V2Conversation[];
    },
    enabled: !!selectedAgent,
  });

  // Filter conversations based on selected filter
  const conversations = allConversations?.filter(conv => {
    switch (conversationFilter) {
      case 'with-responses':
        // More lenient filtering - show conversations with multiple messages or any lead responses
        return (conv.messageCount && conv.messageCount > 1) ||
               (conv.leadMessages && conv.leadMessages > 0) ||
               conv.hasResponses;
      case 'active-only':
        return conv.status === 'active';
      case 'all':
      default:
        return true;
    }
  }) || [];

  // Fetch messages for selected conversation
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/v2/conversations', selectedConversation, 'messages'],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const response = await fetch(`${API_BASE}/v2/conversations/${selectedConversation}/messages`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.messages as V2Message[];
    },
    enabled: !!selectedConversation,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Activity className="w-4 h-4 text-green-500" />;
      case 'handover':
      case 'handed_over': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'closed': return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default: return <MessageSquare className="w-4 h-4 text-blue-500" />;
    }
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Mail className="w-3 h-3 text-blue-500" />;
      case 'delivered': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'opened': return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'failed': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return <Clock className="w-3 h-3 text-gray-500" />;
    }
  };

  const cleanMessageContent = (content: string) => {
    // Remove extra line breaks and clean up HTML
    return content
      .replace(/^<p><br><\/p>/g, '') // Remove leading empty paragraphs
      .replace(/<p><br><\/p>/g, '<br>') // Convert empty paragraphs to line breaks
      .replace(/<p>/g, '<div class="mb-2">') // Convert paragraphs to divs with margin
      .replace(/<\/p>/g, '</div>')
      .replace(/<br>/g, '<br class="mb-1">') // Add small margin to line breaks
      .trim();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">V2 Conversations</h1>
          <p className="text-gray-600">Manage conversations across all dealership agents</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          V2 System
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents?.filter(a => a.isActive).length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversations?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations?.filter(c => c.status === 'active').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Handovers</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations?.filter(c => c.status === 'handover').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents List */}
        <Card>
          <CardHeader>
            <CardTitle>Dealership Agents</CardTitle>
            <CardDescription>Select an agent to view their conversations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {agentsLoading ? (
              <div className="text-center py-4">Loading agents...</div>
            ) : agents?.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No agents found</div>
            ) : (
              agents?.map((agent) => (
                <Button
                  key={agent.id}
                  variant={selectedAgent === agent.id ? "default" : "ghost"}
                  className="w-full justify-start h-auto p-3"
                  onClick={() => {
                    setSelectedAgent(agent.id);
                    setSelectedConversation(null);
                  }}
                >
                  <div className="text-left">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.variables.dealership}</div>
                    <div className="text-xs text-gray-400">{agent.localPart}@{agent.domain}</div>
                  </div>
                </Button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Conversations List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Conversations</CardTitle>
                <CardDescription>
                  {selectedAgent ? 'Select a conversation to view messages' : 'Select an agent first'}
                </CardDescription>
              </div>
              {selectedAgent && (
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <Select value={conversationFilter} onValueChange={(value: any) => setConversationFilter(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="with-responses">With Responses</SelectItem>
                      <SelectItem value="active-only">Active Only</SelectItem>
                      <SelectItem value="all">All Conversations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedAgent ? (
              <div className="text-center py-4 text-gray-500">Select an agent to view conversations</div>
            ) : conversationsLoading ? (
              <div className="text-center py-4">Loading conversations...</div>
            ) : conversations?.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No conversations found</div>
            ) : (
              conversations?.map((conversation) => (
                <Button
                  key={conversation.id}
                  variant={selectedConversation === conversation.id ? "default" : "ghost"}
                  className="w-full justify-start h-auto p-3"
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{conversation.leadEmail}</div>
                      <div className="text-xs text-gray-500 truncate">{conversation.subject}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs text-gray-400">
                          {new Date(conversation.updatedAt).toLocaleDateString()}
                        </div>
                        {conversation.messageCount && (
                          <Badge variant="secondary" className="text-xs">
                            {conversation.messageCount} msgs
                          </Badge>
                        )}
                        {conversation.hasResponses && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            ↔ Active
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(conversation.status)}
                      <Badge variant="outline" className="text-xs">
                        {conversation.status === 'handed_over' ? 'handover' : conversation.status}
                      </Badge>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              {selectedConversation ? 'Conversation thread' : 'Select a conversation to view messages'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedConversation ? (
              <div className="text-center py-4 text-gray-500">Select a conversation to view messages</div>
            ) : messagesLoading ? (
              <div className="text-center py-4">Loading messages...</div>
            ) : messages?.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No messages found</div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages?.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg shadow-sm ${
                      message.sender === 'agent'
                        ? 'bg-blue-50 border border-blue-200 ml-4'
                        : 'bg-white border border-gray-200 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={message.sender === 'agent' ? 'default' : 'secondary'}>
                          {message.sender === 'agent' ? 'Agent' : 'Lead'}
                        </Badge>
                        {getMessageStatusIcon(message.status)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: cleanMessageContent(message.content)
                      }}
                      style={{
                        wordBreak: 'break-word',
                        lineHeight: '1.5'
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
