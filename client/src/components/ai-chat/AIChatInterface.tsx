import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User, Send, Sparkles, Settings, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// import CampaignModal from "@/components/campaign/CampaignModal";

interface ChatMessage {
  id: string;
  content: string;
  isFromAI: boolean;
  timestamp: Date;
}

interface CampaignData {
  name: string;
  context: string;
  handoverGoals: string;
  numberOfTemplates: number;
  daysBetweenMessages: number;
}

export default function AIChatInterface() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      content: "Hi! I'm your AI Campaign Agent for automotive marketing. I'll help you create a personalized email campaign by asking a few questions. What type of automotive campaign would you like to create today?",
      isFromAI: true,
      timestamp: new Date(),
    }
  ]);
  
  const [currentMessage, setCurrentMessage] = useState("");
  const [campaignData, setCampaignData] = useState<Partial<CampaignData>>({});
  const [currentStep, setCurrentStep] = useState("context");
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // AI Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch("/api/ai/chat-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          currentStep,
          campaignData,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (response: any) => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        content: response.message || "I understand. Let me help you with that.",
        isFromAI: true,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      if (response.campaignData) {
        setCampaignData(prev => ({ ...prev, ...response.campaignData }));
      }
      
      if (response.nextStep) {
        setCurrentStep(response.nextStep);
      }
      
      // Update suggestions from server
      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
      
      // Update progress from server if provided
      if (response.progress) {
        // Use server-provided progress for accuracy
      }
      
      if (response.isComplete) {
        // Campaign is ready to be created
        toast({
          title: "Campaign Ready!",
          description: "Your campaign information has been collected. Ready to generate templates?",
        });
      }
    },
    onError: () => {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: "I'm having trouble processing that. Could you try rephrasing your request?",
        isFromAI: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: currentMessage,
      isFromAI: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(currentMessage);
    setCurrentMessage("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCurrentMessage(suggestion);
    // Auto-send the suggestion
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: suggestion,
      isFromAI: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(suggestion);
  };

  const getStepIndicator = () => {
    const steps = ["context", "goals", "target_audience", "name", "handover_criteria", "email_templates"];
    const currentIndex = steps.indexOf(currentStep);
    const progress = ((currentIndex + 1) / steps.length) * 100;
    
    return (
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Campaign Setup Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bot className="w-8 h-8 text-blue-600 mr-3" />
            AI Campaign Agent
          </h2>
          <p className="text-gray-600 mt-1">Let's create your automotive email campaign together</p>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdvancedMode(true)}
            className="flex items-center"
          >
            <Settings className="w-4 h-4 mr-2" />
            Advanced Mode
          </Button>
        </div>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <MessageCircle className="w-5 h-5 mr-2 text-blue-600" />
              Campaign Chat
            </CardTitle>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered</span>
            </div>
          </div>
          {currentStep !== "complete" && getStepIndicator()}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isFromAI ? "justify-start" : "justify-end"}`}
              >
                <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md`}>
                  {message.isFromAI && (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                  
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      message.isFromAI
                        ? "bg-gray-100 text-gray-900"
                        : "bg-blue-500 text-white"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>

                  {!message.isFromAI && (
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          {suggestions.length > 0 && (
            <div className="border-t px-4 py-3">
              <div className="text-xs text-gray-500 mb-2">Quick responses:</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full border transition-colors"
                    disabled={chatMutation.isPending}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-4">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <Input
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
                disabled={chatMutation.isPending}
              />
              <Button 
                type="submit" 
                disabled={chatMutation.isPending || !currentMessage.trim()}
                className="flex items-center"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Data Summary */}
      {Object.keys(campaignData).length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Campaign Information Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 gap-4">
              {campaignData.name && (
                <div>
                  <span className="font-medium text-gray-600">Campaign Name:</span>
                  <p className="text-gray-900">{campaignData.name}</p>
                </div>
              )}
              {campaignData.context && (
                <div>
                  <span className="font-medium text-gray-600">Campaign Type:</span>
                  <p className="text-gray-900">{campaignData.context}</p>
                </div>
              )}
              {(campaignData.numberOfTemplates || (campaignData as any).templateCount) && (
                <div>
                  <span className="font-medium text-gray-600">Number of Templates:</span>
                  <p className="text-gray-900">{campaignData.numberOfTemplates || (campaignData as any).templateCount}</p>
                </div>
              )}
              {(campaignData as any).targetAudience && (
                <div>
                  <span className="font-medium text-gray-600">Target Audience:</span>
                  <p className="text-gray-900">{(campaignData as any).targetAudience}</p>
                </div>
              )}
              {(campaignData as any).handoverGoals && (
                <div>
                  <span className="font-medium text-gray-600">Handover Goals:</span>
                  <p className="text-gray-900">{(campaignData as any).handoverGoals}</p>
                </div>
              )}
              {campaignData.daysBetweenMessages && (
                <div>
                  <span className="font-medium text-gray-600">Days Between Messages:</span>
                  <p className="text-gray-900">{campaignData.daysBetweenMessages}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Mode Modal - Coming Soon */}
      {isAdvancedMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Advanced Mode</h3>
            <p className="text-gray-600 mb-4">
              Advanced form-based campaign creation will be available soon. 
              For now, please use the AI chat interface above.
            </p>
            <Button onClick={() => setIsAdvancedMode(false)}>
              Continue with AI Chat
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}