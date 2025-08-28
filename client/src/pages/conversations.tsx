import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock, User, CheckCircle, AlertCircle } from "lucide-react";
import type { Conversation, ConversationMessage } from "@shared/schema";

export default function ConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  // Fetch conversations
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  // Show all conversations, newest first
  const visibleConversations = conversations.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Fetch selected conversation messages
  const { data: messages = [] } = useQuery<ConversationMessage[]>({
    queryKey: ["/api/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
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

  return (
    <div className="p-6 h-[calc(100vh-3rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations (Read-Only)</h1>
          <p className="text-gray-600 mt-1">View conversation transcripts from email campaigns</p>
        </div>
        
        <div className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
          📖 Read-Only View
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Conversations List */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 min-h-0">
          <h2 className="text-lg font-semibold text-gray-900">Conversation History</h2>
          
          {visibleConversations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No conversations yet</p>
                <p className="text-sm text-gray-400 mt-2">Conversations will appear here when campaigns generate responses</p>
              </CardContent>
            </Card>
          ) : (
            visibleConversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedConversationId === conversation.id ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(conversation.status)}
                      <h3 className="font-medium text-gray-900 truncate">{conversation.subject}</h3>
                    </div>
                    <Badge className={getPriorityColor(conversation.priority)}>{conversation.priority}</Badge>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>Contact</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Conversation View */}
        <div className="lg:col-span-2 h-full min-h-0 flex flex-col">
          {selectedConversationId ? (
            <ConversationTranscript
              conversationId={selectedConversationId}
              messages={messages}
            />
          ) : (
            <Card className="flex-1 flex flex-col">
              <CardContent className="p-6 flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Conversation</h3>
                  <p className="text-gray-500">Choose a conversation from the list to view the transcript</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationTranscript({
  conversationId,
  messages,
}: {
  conversationId: string;
  messages: ConversationMessage[];
}) {
  return (
    <Card className="flex-1 min-h-0 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Conversation Transcript</CardTitle>
        <p className="text-sm text-gray-500">Read-only view of conversation messages</p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No messages in this conversation yet.</p>
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
                  <div className="flex items-center text-xs mb-1 opacity-70">
                    {message.isFromAI ? "🤖 AI Assistant" : "👤 Contact"}
                  </div>
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}