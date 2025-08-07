import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { 
  MessageSquare, 
  Brain, 
  User, 
  Car, 
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from "lucide-react";

interface ConversationContext {
  leadName?: string;
  vehicleInterest?: string;
  urgencyLevel?: 'low' | 'medium' | 'high';
  detectedIntents?: string[];
  customerMood?: 'interested' | 'frustrated' | 'urgent' | 'hesitant';
}

export default function AutomotivePromptTester() {
  const [testMessage, setTestMessage] = useState("");
  const [leadName, setLeadName] = useState("John");
  const [vehicleInterest, setVehicleInterest] = useState("2025 Toyota Prius");
  const [analysisResult, setAnalysisResult] = useState<{
    context: ConversationContext;
    guidelines: string;
  } | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  const analyzeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/ai/analyze-conversation", "POST", data);
    },
    onSuccess: (result) => {
      setAnalysisResult(result);
    },
  });

  const promptMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/ai/generate-prompt", "POST", data);
    },
    onSuccess: (result) => {
      setGeneratedPrompt(result.systemPrompt);
    },
  });

  const handleAnalyze = () => {
    if (testMessage.trim()) {
      analyzeMutation.mutate({
        messageContent: testMessage,
        leadName,
        vehicleInterest,
        previousMessages: []
      });
    }
  };

  const handleGeneratePrompt = () => {
    const conversationContext = analysisResult?.context || undefined;
    promptMutation.mutate({
      dealershipConfig: null, // Will use default
      conversationContext
    });
  };

  const getMoodColor = (mood?: string) => {
    switch (mood) {
      case 'interested': return 'bg-green-100 text-green-800';
      case 'frustrated': return 'bg-red-100 text-red-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      case 'hesitant': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyIcon = (urgency?: string) => {
    switch (urgency) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const sampleMessages = [
    "Hi, I'm interested in scheduling a test drive for the Toyota Prius. What financing options do you have?",
    "I'm frustrated with my current car breaking down again. I need something reliable urgently!",
    "I'm thinking about maybe getting a new car, but not sure if now is the right time.",
    "What's the trade-in value for my 2018 Honda Civic? And can I get 0% APR financing?"
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Automotive AI Prompt System</h2>
      </div>

      <Tabs defaultValue="tester" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tester">Conversation Analyzer</TabsTrigger>
          <TabsTrigger value="prompt">System Prompt Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="tester" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Test Customer Message
                </CardTitle>
                <CardDescription>
                  Enter a customer message to analyze automotive intent and context
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lead-name">Customer Name</Label>
                    <Input
                      id="lead-name"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicle-interest">Vehicle Interest</Label>
                    <Input
                      id="vehicle-interest"
                      value={vehicleInterest}
                      onChange={(e) => setVehicleInterest(e.target.value)}
                      placeholder="2025 Toyota Prius"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="test-message">Customer Message</Label>
                  <Textarea
                    id="test-message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Enter customer message to analyze..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Sample Messages</Label>
                  <div className="space-y-2 mt-2">
                    {sampleMessages.map((message, index) => (
                      <button
                        key={index}
                        onClick={() => setTestMessage(message)}
                        className="w-full text-left p-2 text-sm border rounded hover:bg-gray-50 transition-colors"
                      >
                        {message}
                      </button>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending || !testMessage.trim()}
                  className="w-full"
                >
                  <Target className="h-4 w-4 mr-2" />
                  {analyzeMutation.isPending ? "Analyzing..." : "Analyze Message"}
                </Button>
              </CardContent>
            </Card>

            {/* Analysis Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Analysis Results
                </CardTitle>
                <CardDescription>
                  AI-powered automotive conversation analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!analysisResult ? (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No analysis yet</p>
                    <p className="text-sm text-gray-400">Enter a message and click analyze</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Customer Context */}
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2 mb-3">
                        <User className="h-4 w-4" />
                        Customer Context
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Mood:</span>
                          <Badge className={getMoodColor(analysisResult.context.customerMood)}>
                            {analysisResult.context.customerMood}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Urgency:</span>
                          <div className="flex items-center gap-1">
                            {getUrgencyIcon(analysisResult.context.urgencyLevel)}
                            <Badge variant="outline">
                              {analysisResult.context.urgencyLevel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detected Intents */}
                    {analysisResult.context.detectedIntents && analysisResult.context.detectedIntents.length > 0 && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium flex items-center gap-2 mb-3">
                          <Target className="h-4 w-4" />
                          Detected Intents ({analysisResult.context.detectedIntents.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.context.detectedIntents.map((intent) => (
                            <Badge key={intent} variant="secondary">
                              {intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Response Guidelines */}
                    {analysisResult.guidelines && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>AI Response Guidelines:</strong><br />
                          {analysisResult.guidelines}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      onClick={handleGeneratePrompt}
                      disabled={promptMutation.isPending}
                      className="w-full"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      {promptMutation.isPending ? "Generating..." : "Generate AI Prompt"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Generated System Prompt
              </CardTitle>
              <CardDescription>
                Complete automotive-specific AI system prompt ready for deployment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!generatedPrompt ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No prompt generated yet</p>
                  <p className="text-sm text-gray-400">Analyze a conversation first, then generate a prompt</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Textarea
                    value={generatedPrompt}
                    readOnly
                    rows={20}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => navigator.clipboard.writeText(generatedPrompt)}
                      variant="outline"
                    >
                      Copy Prompt
                    </Button>
                    <Button 
                      onClick={handleGeneratePrompt}
                      disabled={promptMutation.isPending}
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}