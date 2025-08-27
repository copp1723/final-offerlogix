import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock, User, CheckCircle, AlertCircle, Bot, UserIcon } from "lucide-react";
import type { Conversation, ConversationMessage } from "@shared/schema";

// Safe HTML rendering helper
function sanitizeAndRenderHTML(htmlString: string) {
  if (!htmlString) return '';
  
  // Basic HTML sanitization - remove script tags and dangerous attributes
  const cleanHtml = htmlString
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
    
  return cleanHtml;
}

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
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case "closed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "archived":
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <MessageCircle className="h-4 w-4 text-primary" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "normal":
        return "bg-primary/10 text-primary";
      case "low":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-primary/10 text-primary";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/3 via-white to-accent/3">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/3 via-white to-accent/3">
      <div className="p-6 h-[calc(100vh-3rem)] flex flex-col">
        <div className="flex justify-between items-center mb-6 animate-fadeIn">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Conversations</h1>
            <p className="text-muted-foreground mt-2">View conversation transcripts from email campaigns</p>
          </div>
          
          <div className="text-sm text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
            📖 Read-Only View
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 animate-slideUp">
          {/* Conversations List */}
          <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 min-h-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversation History</h2>
            
            {visibleConversations.length === 0 ? (
              <Card className="shadow-glow border-primary/20">
                <CardContent className="p-6 text-center">
                  <MessageCircle className="h-12 w-12 text-primary/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Conversations will appear here when campaigns generate responses</p>
                </CardContent>
              </Card>
            ) : (
              visibleConversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  className={`cursor-pointer transition-all hover:shadow-glow duration-300 border-primary/10 ${
                    selectedConversationId === conversation.id 
                      ? "ring-2 ring-primary shadow-glow" 
                      : "hover:shadow-lg hover:-translate-y-0.5"
                  }`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {getStatusIcon(conversation.status)}
                        <h3 className="font-semibold text-gray-900 truncate">{conversation.subject}</h3>
                      </div>
                      <Badge className={getPriorityColor(conversation.priority)}>{conversation.priority}</Badge>
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground space-x-4">
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
              <Card className="flex-1 flex flex-col shadow-glow border-primary/20">
                <CardContent className="p-6 flex items-center justify-center h-full">
                  <div className="text-center animate-float">
                    <div className="p-6 bg-gradient-primary rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                      <MessageCircle className="h-12 w-12 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Conversation</h3>
                    <p className="text-muted-foreground">Choose a conversation from the list to view the transcript</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
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
    <Card className="flex-1 min-h-0 flex flex-col shadow-glow border-primary/20">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-primary/10">
        <CardTitle className="text-xl text-primary">Conversation Transcript</CardTitle>
        <p className="text-sm text-muted-foreground">Read-only view of conversation messages</p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-primary/50" />
              <p>No messages in this conversation yet.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.isFromAI ? "justify-start" : "justify-end"} animate-fadeIn`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`flex items-start space-x-3 max-w-[80%] ${message.isFromAI ? "" : "flex-row-reverse space-x-reverse"}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.isFromAI 
                      ? "bg-gradient-primary text-white" 
                      : "bg-gradient-secondary text-white"
                  }`}>
                    {message.isFromAI ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                  </div>
                  
                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                    message.isFromAI
                      ? "bg-white border border-primary/20 text-gray-900"
                      : "bg-primary text-white"
                  }`}>
                    {/* Sender Label */}
                    <div className={`text-xs font-medium mb-2 ${
                      message.isFromAI ? "text-primary" : "text-white/80"
                    }`}>
                      {message.isFromAI ? "🤖 Brittany Simpson" : "👤 Contact"}
                    </div>
                    
                    {/* Message Content - Render HTML properly */}
                    <div 
                      className={`text-sm leading-relaxed prose prose-sm max-w-none ${
                        message.isFromAI ? "prose-primary" : "prose-invert"
                      }`}
                      dangerouslySetInnerHTML={{ 
                        __html: sanitizeAndRenderHTML(message.content || '') 
                      }}
                    />
                    
                    {/* Timestamp */}
                    <div className={`text-xs mt-2 ${
                      message.isFromAI ? "text-muted-foreground" : "text-white/70"
                    }`}>
                      {new Date(message.createdAt).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}