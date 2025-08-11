import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User, Send, Sparkles, Settings, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TemplateReviewModal from '@/components/campaigns/TemplateReviewModal';
// import CampaignModal from "@/components/campaign/CampaignModal";

interface ChatMessage {
  id: string;
  content: string;
  isFromAI: boolean;
  timestamp: Date;
  memoryInfluence?: { rag: boolean; optimization: boolean; summary?: string };
}

interface CampaignData {
  name: string;
  context: string;
  handoverGoals: string;
  numberOfTemplates: number;
  daysBetweenMessages: number;
  leadList?: {
    total: number;
    sample: any[];
    columns: string[];
    fileName?: string;
  };
  templates?: { subject: string; content: string }[];
  subjectLines?: string[];
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
  const [editModalOpen, setEditModalOpen] = useState(false);
  // Inline preview toggle so users can see template subjects without opening modal
  const [showInlineTemplates, setShowInlineTemplates] = useState(true);

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
          memoryInfluence: response.memoryInfluence
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
    onError: (_err, variables) => {
      const lastInput = variables as string;
      // Detect simple intents locally to avoid dead-end UX when server hiccups
      if (/^launch$/i.test(lastInput) && currentStep === 'review_launch') {
        const pseudo: ChatMessage = {
          id: Date.now().toString(),
          content: 'Attempting launch… (server not responding). Please retry in a moment or go to Campaigns tab to launch manually.',
          isFromAI: true,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, pseudo]);
        return;
      }
      if (/^yes$/i.test(lastInput) && currentStep === 'content_generation') {
        const pseudo: ChatMessage = {
          id: Date.now().toString(),
          content: 'Generation request acknowledged locally but backend failed. I will retry automatically in a few seconds…',
          isFromAI: true,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, pseudo]);
        // naive retry after short delay
        setTimeout(() => chatMutation.mutate(lastInput), 2500);
        return;
      }
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: "I'm having trouble reaching the server. Rephrase or try again in a moment.",
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

  // Direct immediate send bypassing state race (used for programmatic buttons)
  const sendDirect = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setCurrentMessage("");
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: trimmed,
      isFromAI: false,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(trimmed);
  };

  const getStepIndicator = () => {
    const steps = [
      "context",
      "goals",
      "target_audience",
      "name",
      "handover_criteria",
  "handover_recipients",
      "email_templates",
      "lead_upload",
      "email_cadence",
      "content_generation",
      "review_launch"
    ];
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

      <Card className="flex flex-col h-[70vh] min-h-[520px] overflow-hidden">
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

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
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
                    {message.isFromAI && message.memoryInfluence && (
                      <div className="mt-1 flex items-center space-x-1 text-[10px] uppercase tracking-wide">
                        <span className={`px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium`}>Memory</span>
                        {message.memoryInfluence.summary && (
                          <span className="text-gray-500 normal-case">{message.memoryInfluence.summary}</span>
                        )}
                      </div>
                    )}
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

          {/* Step-specific UI augmentations */}
          {currentStep === 'lead_upload' && (
            <div className="border-t p-4 space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Upload Lead List (CSV)</p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      // Simple CSV parse (first 5 rows)
                      const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 6);
                      const [header, ...rows] = lines;
                      const columns = header.split(',').map(h => h.trim());
                      const sample = rows.map(r => {
                        const vals = r.split(',');
                        const obj: any = {};
                        columns.forEach((c, i) => obj[c] = vals[i]);
                        return obj;
                      });
                      const total = text.split(/\r?\n/).filter(l => l.trim()).length - 1;
                      setCampaignData(prev => ({
                        ...prev,
                        leadList: { total: total < 0 ? 0 : total, sample, columns, fileName: file.name }
                      }));
                      setMessages(prev => ([...prev, {
                        id: Date.now().toString(),
                        content: `Lead list parsed: ${total} leads. Columns: ${columns.join(', ')}. Sample preview captured. Type 'Uploaded' to continue.`,
                        isFromAI: true,
                        timestamp: new Date()
                      }]));
                    } catch (err) {
                      setMessages(prev => ([...prev, {
                        id: Date.now().toString(),
                        content: 'Failed to parse CSV. Please ensure it is a valid CSV file.',
                        isFromAI: true,
                        timestamp: new Date()
                      }]));
                    }
                  }}
                  className="block w-full text-sm"
                />
                {campaignData.leadList && (
                  <div className="mt-3 bg-gray-50 border rounded p-2 text-xs">
                    <div className="font-medium">Preview ({campaignData.leadList.sample.length} rows)</div>
                    <pre className="overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(campaignData.leadList.sample, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 'email_cadence' && (
            <div className="border-t p-4">
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  placeholder="Days between emails (1-30)"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  className="w-60"
                />
                <Button
                  disabled={chatMutation.isPending || !currentMessage.trim()}
                  onClick={handleSendMessage as any}
                >Save Cadence</Button>
              </div>
            </div>
          )}

          {currentStep === 'content_generation' && (
            <div className="border-t p-4 space-y-2">
              <p className="text-sm text-gray-600">Ready to generate full email content now.</p>
              <div className="flex space-x-2">
                <Button
                  onClick={() => sendDirect('Yes')}
                  disabled={chatMutation.isPending}
                  className="flex items-center"
                >
                  <Sparkles className="w-4 h-4 mr-1"/> Generate Templates
                </Button>
              </div>
              {campaignData.templates && campaignData.templates.length > 0 && (
                <div className="mt-3 max-h-60 overflow-auto border rounded p-2 text-xs bg-gray-50">
                  <div className="font-medium mb-1">Generated Templates</div>
                  {campaignData.templates.map((t, i) => (
                    <div key={i} className="mb-3">
                      <div className="font-semibold">{i+1}. {t.subject}</div>
                      <div className="whitespace-pre-wrap text-gray-700 text-xs">{t.content.slice(0,400)}{t.content.length>400?'...':''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'review_launch' && (
            <div className="border-t p-4 space-y-3 text-sm">
              <div className="font-medium">Review & Launch</div>
              <ul className="list-disc ml-5 space-y-1 text-gray-700">
                <li>Name: {campaignData.name || '—'}</li>
                <li>Context: {campaignData.context || '—'}</li>
                <li>Goals: {campaignData.handoverGoals || '—'}</li>
                <li>Audience: {(campaignData as any).targetAudience || '—'}</li>
                <li>Templates: {campaignData.numberOfTemplates || (campaignData as any).templateCount}</li>
                <li>Cadence (days): {campaignData.daysBetweenMessages || '—'}</li>
                <li>Leads: {campaignData.leadList?.total || 0}</li>
              </ul>

              {/* Guard: Missing templates warning and edit flow */}
              {(!campaignData.templates || (campaignData.templates?.length ?? 0) === 0) && (
                <div className="border border-amber-300 bg-amber-50 text-amber-900 p-3 rounded">
                  <div className="font-medium mb-1">No templates generated</div>
                  <p className="text-xs mb-2">We couldn’t find any email templates. Click Regenerate to create them now, or Edit to add them manually before launch.</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendDirect('Generate now')}
                      disabled={chatMutation.isPending}
                    >Regenerate</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditModalOpen(true)}
                    >Edit Templates</Button>
                  </div>
                </div>
              )}

              {/* Inline template preview for quick confidence before opening modal */}
              {campaignData.templates && campaignData.templates.length > 0 && (
                <div className="border rounded bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Template Subjects ({campaignData.templates.length})</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowInlineTemplates(v => !v)}>
                        {showInlineTemplates ? 'Hide' : 'Show'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setEditModalOpen(true)}>Open Editor</Button>
                    </div>
                  </div>
                  {showInlineTemplates && (
                    <ol className="list-decimal ml-5 space-y-1 text-xs text-gray-700">
                      {campaignData.templates.slice(0, 10).map((t, i) => (
                        <li key={i} className="truncate" title={t.subject}>{t.subject}</li>
                      ))}
                      {campaignData.templates.length > 10 && (
                        <li className="italic text-gray-500">…and {campaignData.templates.length - 10} more</li>
                      )}
                    </ol>
                  )}
                  {showInlineTemplates && campaignData.templates.length > 0 && (
                    <div className="mt-3 text-[11px] text-gray-500">
                      Subjects only shown here. Click Open Editor to read & edit full email bodies before launching.
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-2">
                <Button
                  onClick={() => sendDirect('Launch')}
                  disabled={chatMutation.isPending || (!campaignData.templates || campaignData.templates.length === 0)}
                >Launch Campaign</Button>
                {campaignData.templates && campaignData.templates.length > 0 && (
                  <Button variant="outline" onClick={() => setEditModalOpen(true)}>Review/Edit Templates</Button>
                )}
              </div>
            </div>
          )}

          {/* Default input (if not a special step) */}
          {!['lead_upload','email_cadence','content_generation','review_launch'].includes(currentStep) && (
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
          )}
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
              {campaignData.leadList && (
                <div>
                  <span className="font-medium text-gray-600">Leads Uploaded:</span>
                  <p className="text-gray-900">{campaignData.leadList.total} (sample shown above)</p>
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

      {/* Template editor modal (rendered globally so it opens regardless of Advanced Mode) */}
      <TemplateReviewModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initialTemplates={(campaignData.templates as any) || []}
        initialSubjectLines={(campaignData.subjectLines as any) || []}
        onSaved={(templates, subjects) => {
          setCampaignData(prev => ({ ...prev, templates, subjectLines: subjects, numberOfTemplates: templates.length }));
        }}
      />
    </div>
  );
}