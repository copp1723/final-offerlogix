import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient as globalQueryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Plus, Clock, User, CheckCircle, AlertCircle, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { Conversation, ConversationMessage } from "@shared/schema";
import { ENABLE_V2_UI, DEV_MODE } from "@/config/featureFlags";
import { getV2Conversation, replyV2Conversation, listV2Conversations, getV2Messages } from "@/api/client";
import type { V2Conversation } from "@/types/api";
import { ConversationsErrorBoundary } from "@/components/ConversationsErrorBoundary";

// Enhanced type definitions for V2 API responses
interface V2ConversationResponse {
  id: string;
  campaignId?: string | null;
  leadId?: string | null;
  userId?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface V2MessageResponse {
  id: string;
  content: string;
  sender: string;
  createdAt?: string | null;
}

// Utility functions for safe data handling
const parseDate = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date(0);
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date(0) : date;
};

const sanitizeString = (input: string | null | undefined, fallback: string = ''): string => {
  if (!input || typeof input !== 'string') return fallback;
  return input.trim();
};

function ConversationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [, navigate] = useLocation();

  // Performance monitoring - start timer
  useEffect(() => {
    const startTime = performance.now();
    console.log('[Performance] Conversations page started loading');

    return () => {
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      console.log(`[Performance] Conversations page load time: ${loadTime.toFixed(2)}ms`);
    };
  }, []);

  // Data validation functions
  const isValidConversation = (conv: any): conv is Conversation => {
    return (
      conv &&
      typeof conv === 'object' &&
      typeof conv.id === 'string' &&
      conv.id.length > 0 &&
      typeof conv.subject === 'string' &&
      typeof conv.status === 'string' &&
      typeof conv.priority === 'string' &&
      (conv.createdAt instanceof Date || typeof conv.createdAt === 'string') &&
      (conv.updatedAt instanceof Date || typeof conv.updatedAt === 'string')
    );
  };

  const isValidCampaign = (campaign: any): boolean => {
    return (
      campaign &&
      typeof campaign === 'object' &&
      typeof campaign.id === 'string' &&
      campaign.id.length > 0 &&
      typeof campaign.name === 'string'
    );
  };

  const isValidLead = (lead: any): boolean => {
    return (
      lead &&
      typeof lead === 'object' &&
      typeof lead.id === 'string' &&
      lead.id.length > 0 &&
      typeof lead.email === 'string'
    );
  };

  // In a fuller implementation, agent comes from context or route-hydrated data
  // For the bridge, we gate by the global flag and optional per-agent override when available
  const agentUseV2: boolean | undefined = undefined;
  const useV2 = ENABLE_V2_UI && (agentUseV2 === true || agentUseV2 === undefined);
  
  // Fetch conversations data - V2-first with automatic V1 fallback
  const { data: conversations = [], isLoading, error: conversationsError } = useQuery({
    queryKey: useV2 ? ["/v2/conversations"] : ["/api/conversations"],
    queryFn: async () => {
      let lastError: Error | null = null;

      // Try V2 first if enabled
      if (useV2) {
        try {
          console.log('[V2] Fetching conversations from V2 API');
          const res = await listV2Conversations();
          if (!res.success) {
            throw new Error(`V2 API error: ${res.error || 'Unknown error'}`);
          }

          // Validate and map V2 conversations with proper type safety
          const validConversations = res.conversations
            ?.filter((conv): conv is V2ConversationResponse => {
              return (
                conv &&
                typeof conv === 'object' &&
                typeof conv.id === 'string' &&
                conv.id.trim().length > 0 &&
                (typeof conv.subject === 'string' || conv.subject == null) &&
                (typeof conv.status === 'string' || conv.status == null)
              );
            })
            ?.map((conv): Conversation => ({
              id: sanitizeString(conv.id),
              campaignId: sanitizeString(conv.campaignId) || null,
              leadId: sanitizeString(conv.leadId) || null,
              userId: sanitizeString(conv.userId) || null,
              subject: sanitizeString(conv.subject, 'Untitled Conversation'),
              status: sanitizeString(conv.status, 'active'),
              priority: sanitizeString(conv.priority, 'normal'),
              createdAt: conv.createdAt || new Date().toISOString(),
              updatedAt: conv.updatedAt || new Date().toISOString(),
            })) || [];

          console.log(`[V2] Successfully loaded ${validConversations.length} conversations`);
          return validConversations;
        } catch (v2Error) {
          lastError = v2Error as Error;
          console.warn('[V2] Failed to fetch from V2 API, attempting V1 fallback:', v2Error);
          
          // Don't fallback on 4xx errors (except 404) as they indicate client issues
          if (v2Error?.status && v2Error.status >= 400 && v2Error.status < 500 && v2Error.status !== 404) {
            throw v2Error;
          }
        }
      }

      // V1 fallback (either by default or after V2 failure)
      try {
        console.log('[V1] Fetching conversations from V1 API');
        const v1Conversations = await globalQueryClient.fetchQuery({ queryKey: ["/api/conversations"] });
        console.log(`[V1] Successfully loaded ${v1Conversations?.length || 0} conversations`);
        return v1Conversations || [];
      } catch (v1Error) {
        console.error('[V1] V1 API also failed:', v1Error);
        // If both V2 and V1 failed, throw the most recent error
        throw lastError || v1Error;
      }
    },
    retry: (failureCount, error) => {
      // Enhanced retry logic
      const status = error?.status;
      
      // Don't retry on client errors (4xx) except for 408 (timeout) and 429 (rate limit)
      if (status && status >= 400 && status < 500) {
        if (status === 408 || status === 429) {
          return failureCount < 2; // Limited retries for timeout/rate limit
        }
        return false;
      }
      
      // Don't retry on authentication errors
      if (status === 401 || status === 403) {
        return false;
      }
      
      // Retry server errors and network errors with exponential backoff
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  // Group conversations by campaign and lead to remove duplicates
  // This improves UX by showing one conversation per campaign-lead pair
  // while preserving all conversation data for detailed views
  const groupedConversations = conversations.reduce((acc, conv) => {
    // Create unique key for campaign-lead pair
    const key = `${conv.campaignId || 'no-campaign'}-${conv.leadId || 'no-lead'}`;
    
    // Keep the most recent conversation for each pair using safe date parsing
    if (!acc[key] || parseDate(conv.updatedAt) > parseDate(acc[key].updatedAt)) {
      acc[key] = conv;
    }
    
    return acc;
  }, {} as Record<string, Conversation>);
  
  // Convert back to array and sort by most recent with safe date parsing
  const visibleConversations = Object.values(groupedConversations)
    .sort((a, b) => parseDate(b.updatedAt).getTime() - parseDate(a.updatedAt).getTime());

  // Fetch selected conversation messages with V2 to V1 fallback
  const { data: messages = [], error: messagesError } = useQuery<ConversationMessage[]>({
    queryKey: useV2 ? ["/v2/conversations", selectedConversationId, "messages"] : ["/api/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
    queryFn: async () => {
      if (!selectedConversationId) return [] as ConversationMessage[];
      
      let lastError: Error | null = null;

      // Try V2 first if enabled
      if (useV2) {
        try {
          const res = await getV2Messages(selectedConversationId);
          if (!res.success || !res.messages) {
            throw new Error('V2 messages fetch failed');
          }
          
          // Validate and map V2 messages with proper type safety
          const validMessages = res.messages
            .filter((m): m is V2MessageResponse => {
              return (
                m &&
                typeof m === 'object' &&
                typeof m.id === 'string' &&
                m.id.trim().length > 0 &&
                typeof m.content === 'string' &&
                typeof m.sender === 'string'
              );
            })
            .map((m): ConversationMessage => ({
              id: sanitizeString(m.id),
              conversationId: selectedConversationId,
              senderId: null,
              leadId: null,
              content: sanitizeString(m.content),
              messageType: 'text' as const,
              isFromAI: m.sender === 'agent' ? 1 : 0,
              providerMessageId: null,
              createdAt: m.createdAt || new Date().toISOString(),
            }));

          console.log(`[V2] Successfully loaded ${validMessages.length} messages for conversation ${selectedConversationId}`);
          return validMessages;
        } catch (v2Error) {
          lastError = v2Error as Error;
          console.warn('[V2] Failed to fetch messages from V2, attempting V1 fallback:', v2Error);
        }
      }

      // V1 fallback (either by default or after V2 failure)
      try {
        const v1Messages = await globalQueryClient.fetchQuery<ConversationMessage[]>({ 
          queryKey: ["/api/conversations", selectedConversationId, "messages"] 
        });
        console.log(`[V1] Successfully loaded ${v1Messages?.length || 0} messages for conversation ${selectedConversationId}`);
        return v1Messages || [];
      } catch (v1Error) {
        console.error('[V1] V1 messages API also failed:', v1Error);
        throw lastError || v1Error;
      }
    },
    retry: (failureCount, error) => {
      const status = error?.status;
      if (status && status >= 400 && status < 500 && status !== 404) {
        return false;
      }
      return failureCount < 2;
    }
  });

  // When V2 bridge is active, fetch V2 conversation details for header/status
  const { data: v2ConversationResult } = useQuery<{ success: boolean; conversation: V2Conversation } | undefined>({
    queryKey: ["/v2/conversations", selectedConversationId],
    enabled: useV2 && !!selectedConversationId,
    queryFn: async () => {
      if (!selectedConversationId) return undefined;
      return getV2Conversation(selectedConversationId);
    }
  });
  const v2Conversation = v2ConversationResult?.conversation;

  // Fetch campaigns and leads for context
  const { data: campaigns = [] } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      try {
        const campaigns = await globalQueryClient.fetchQuery({ queryKey: ["/api/campaigns"] });
        // Validate campaigns data
        const validCampaigns = campaigns?.filter(isValidCampaign) || [];
        console.log(`[Data] Loaded ${validCampaigns.length} valid campaigns`);
        return validCampaigns;
      } catch (error) {
        console.error('[Conversations] Error fetching campaigns:', error);
        return [];
      }
    }
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["/api/leads"],
    queryFn: async () => {
      try {
        const leads = await globalQueryClient.fetchQuery({ queryKey: ["/api/leads"] });
        // Validate leads data
        const validLeads = leads?.filter(isValidLead) || [];
        console.log(`[Data] Loaded ${validLeads.length} valid leads`);
        return validLeads;
      } catch (error) {
        console.error('[Conversations] Error fetching leads:', error);
        return [];
      }
    }
  });

  // Optimized conversation filtering with memoized campaign/lead lookup
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return visibleConversations;

    // Pre-compute lookups for better performance
    const campaignMap = new Map(campaigns.map(c => [c.id, c]));
    const leadMap = new Map(leads.map(l => [l.id, l]));
    const searchLower = searchTerm.toLowerCase();

    return visibleConversations.filter((conversation) => {
      // Quick text search on conversation fields first (most common)
      if (
        conversation.subject?.toLowerCase().includes(searchLower) ||
        conversation.status?.toLowerCase().includes(searchLower) ||
        conversation.priority?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // More expensive lookups only if needed
      const campaign = conversation.campaignId ? campaignMap.get(conversation.campaignId) : null;
      if (campaign?.name?.toLowerCase().includes(searchLower)) {
        return true;
      }

      const lead = conversation.leadId ? leadMap.get(conversation.leadId) : null;
      return !!(
        lead?.email?.toLowerCase().includes(searchLower) ||
        lead?.firstName?.toLowerCase().includes(searchLower) ||
        lead?.lastName?.toLowerCase().includes(searchLower)
      );
    });
  }, [visibleConversations, campaigns, leads, searchTerm]);

  // Optimized message counts - only fetch for visible conversations with proper cleanup
  const { data: messageCounts = {} } = useQuery({
    queryKey: ["/api/conversations/message-counts", filteredConversations.map(c => c.id).sort().join(',')],
    queryFn: async ({ signal }) => {
      if (filteredConversations.length === 0) return {};
      
      // Limit to first 20 conversations for performance
      const conversationsToFetch = filteredConversations.slice(0, 20);
      const counts: Record<string, number> = {};

      // Batch fetch only visible conversation message counts with abort signal
      const messagePromises = conversationsToFetch.map(async (conv) => {
        try {
          // Check for cancellation before each fetch
          if (signal?.aborted) return;
          
          const messages = await globalQueryClient.fetchQuery({
            queryKey: ["/api/conversations", conv.id, "messages"]
          });
          
          // Check again after async operation
          if (signal?.aborted) return;
          
          counts[conv.id] = messages?.length || 0;
        } catch (error) {
          // Don't log errors if query was cancelled
          if (!signal?.aborted) {
            console.warn(`[Performance] Failed to fetch message count for conversation ${conv.id}:`, error);
          }
          counts[conv.id] = 0;
        }
      });

      await Promise.all(messagePromises);
      return counts;
    },
    enabled: filteredConversations.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (renamed from cacheTime)
  });

  // Performance metrics logging - after data is loaded
  useEffect(() => {
    if (DEV_MODE && conversations.length > 0) {
      console.log('[Performance] Data loaded:', {
        conversationsCount: conversations.length,
        campaignsCount: campaigns.length,
        leadsCount: leads.length,
        timestamp: new Date().toISOString()
      });
    }
  }, [conversations.length, campaigns.length, leads.length]);

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (data: { subject: string; priority: string; campaignId?: string }) => {
      return apiRequest("/api/conversations", "POST", {
        subject: data.subject,
        priority: data.priority,
        campaignId: data.campaignId || null,
        userId: "current-user", // In real app, get from auth context
      });
    },
    onSuccess: () => {
      globalQueryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewConversationOpen(false);
      toast({
        title: "Conversation Created",
        description: "New conversation has been started successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create conversation.",
        variant: "destructive",
      });
    },
  });

  // Send message mutation with enhanced error handling
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string }) => {
      // Validate input data
      const sanitizedContent = sanitizeString(data.content);
      if (!sanitizedContent) {
        throw new Error('Message content cannot be empty');
      }
      if (sanitizedContent.length > 10000) {
        throw new Error('Message content too long (max 10,000 characters)');
      }

      let lastError: Error | null = null;

      if (useV2) {
        // V2 path: hit reply endpoint (content may be ignored per current spec)
        try {
          const res = await replyV2Conversation(data.conversationId);
          console.log('v2_reply_sent', { 
            conversationId: data.conversationId, 
            messageId: res.messageId, 
            handover: false 
          });
          return res;
        } catch (error) {
          lastError = error as Error;
          const status = (error as any)?.status;
          
          // Handle specific V2 error cases
          if (status === 409) {
            toast({ 
              title: "Handed over", 
              description: "Conversation has been handed off to a human. We'll follow up." 
            });
            throw error;
          } else if (status === 403) {
            toast({ 
              title: "Access Denied", 
              description: "You do not have permission to reply to this conversation." 
            });
            throw error;
          } else if (status === 404) {
            console.warn('[V2] Conversation not found, attempting V1 fallback');
            // Continue to V1 fallback
          } else if (status >= 500) {
            console.warn('[V2] Server error, attempting V1 fallback:', error);
            // Continue to V1 fallback
          } else {
            // For other client errors, don't fallback
            throw error;
          }
        }
      }

      // V1 fallback path
      try {
        if (DEV_MODE && useV2) {
          console.warn('[V2 bridge] Falling back to V1 endpoint');
        }
        return await apiRequest(`/api/conversations/${data.conversationId}/messages`, "POST", {
          content: sanitizedContent,
          senderId: "current-user", // In real app, get from auth context
          isFromAI: 0,
        });
      } catch (v1Error) {
        console.error('[V1] V1 message API also failed:', v1Error);
        throw lastError || v1Error;
      }
    },
    onSuccess: () => {
      // Refresh messages and conversation lists/status
      queryClient.invalidateQueries({ queryKey: useV2 ? ["/v2/conversations", selectedConversationId, "messages"] : ["/api/conversations", selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: useV2 ? ["/v2/conversations"] : ["/api/conversations"] });
      if (useV2) queryClient.invalidateQueries({ queryKey: ["/v2/conversations", selectedConversationId] });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "closed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "archived":
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "normal":
        return "bg-blue-100 text-blue-800";
      case "low":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Handle conversations loading error
  if (conversationsError) {
    console.error('[Conversations] Failed to load conversations:', conversationsError);
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Conversations</h3>
            <p className="text-gray-500 mb-4">
              There was an error loading your conversations. Please try refreshing the page.
            </p>
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: useV2 ? ["/v2/conversations"] : ["/api/conversations"] })}
              >
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-3rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-gray-600 mt-1">Manage customer conversations and support requests</p>
        </div>
        
        <div className="text-sm text-gray-500">
          Conversations are created automatically when campaigns are launched
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0"> {/* min-h-0 allows children flex overflow */}
        {/* Conversations List */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 min-h-0"> {/* scrollable list */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Active Conversations</h2>
            <Badge variant="secondary" className="text-xs">
              {filteredConversations.length}
            </Badge>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                {visibleConversations.length === 0 ? (
                  <>
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No conversations yet</p>
                    <p className="text-sm text-gray-400 mt-2">Start a new conversation to get started</p>
                  </>
                ) : (
                  <>
                    <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No conversations match your search</p>
                    <p className="text-sm text-gray-400 mt-2">Try adjusting your search terms</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setSearchTerm("")}
                    >
                      Clear Search
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredConversations.map((conversation) => {
              const campaign = campaigns.find(c => c.id === conversation.campaignId);
              const lead = leads.find(l => l.id === conversation.leadId);
              
              return (
              <Card
                key={conversation.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedConversationId === conversation.id ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(conversation.status)}
                      <h3 className="font-medium text-gray-900 truncate max-w-[200px]">
                        {conversation.subject || 'Untitled Conversation'}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getPriorityColor(conversation.priority)}>
                        {conversation.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {messageCounts[conversation.id] || 0} {messageCounts[conversation.id] === 1 ? 'msg' : 'msgs'}
                      </Badge>
                    </div>
                  </div>

                  {/* Campaign and Lead Context */}
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 w-16">Campaign:</span>
                      <span className="font-medium text-gray-900 truncate ml-2">
                        {campaign?.name || 'Unknown Campaign'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 w-16">Lead:</span>
                      <span className="text-gray-700 truncate ml-2">
                        {lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email : 'Unknown Lead'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{parseDate(conversation.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-xs capitalize">
                        {conversation.status}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => navigate(`/conversations/${conversation.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })
          )}
        </div>

        {/* Conversation View */}
        <div className="lg:col-span-2 h-full min-h-0 flex flex-col">
          {selectedConversationId ? (
            <ConversationView
              conversationId={selectedConversationId}
              messages={messages}
              onSendMessage={(content) =>
                sendMessageMutation.mutate({ conversationId: selectedConversationId, content })
              }
              isLoading={sendMessageMutation.isPending}
              // V2 bridge props for header rendering
              useV2={useV2}
              v2Status={v2Conversation?.status}
              v2Subject={v2Conversation?.subject}
            />
          ) : (
      <Card className="flex-1 flex flex-col">
              <CardContent className="p-6 flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Conversation</h3>
                  <p className="text-gray-500">Choose a conversation from the list to view messages</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationView({
  conversationId,
  messages,
  onSendMessage,
  isLoading,
  // V2 bridge props
  useV2 = false,
  v2Status,
  v2Subject,
}: {
  conversationId: string;
  messages: ConversationMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  useV2?: boolean;
  v2Status?: string;
  v2Subject?: string;
}) {
  const [newMessage, setNewMessage] = useState("");
  const handedOver = useMemo(() => useV2 && v2Status === 'handed_over', [useV2, v2Status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  return (
    <Card className="flex-1 min-h-0 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">
            {useV2 && v2Subject ? v2Subject : 'Conversation Messages'}
          </CardTitle>
          {useV2 && handedOver && (
            <Badge variant="secondary" className="text-xs">Handed over</Badge>
          )}
          {useV2 && DEV_MODE && (
            <Badge variant="outline" className="text-[10px] opacity-70">V2</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4 min-h-0"> {/* min-h-0 to allow scroll area to size */}
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1"> {/* scrollable messages */}
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isFromAI ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                    message.isFromAI
                      ? "bg-gray-100 text-gray-900"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {parseDate(message.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-h-[60px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !newMessage.trim()}>
            {isLoading ? "..." : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Wrap the main component with Error Boundary
function ConversationsPageWithBoundary() {
  return (
    <ConversationsErrorBoundary>
      <ConversationsPage />
    </ConversationsErrorBoundary>
  );
}

export default ConversationsPageWithBoundary;
