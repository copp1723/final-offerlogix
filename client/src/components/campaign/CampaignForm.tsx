import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertCampaignSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Lightbulb, Sparkles, Mail, Type, MessageSquare, CalendarDays, Check, Settings, Plus, X, Calendar, Clock, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Campaign as SharedCampaign } from "@shared/schema";

import { SMSIntegration } from "@/components/SMSIntegration";
import { CampaignScheduler } from "@/components/CampaignScheduler";
import { z } from "zod";


// Type representing generated templates returned by AI
// Templates can be plain strings or structured objects
export type TemplateLike = string | { content?: string; body?: string; subject?: string };

// Extend base schema with UI-only helper fields used in the form so React Hook Form typing matches
const formSchema = insertCampaignSchema.extend({
  name: z.string().min(1, "Campaign name is required"),
  context: z.string().min(10, "Please provide more detailed context"),
  communicationType: z.enum(["email", "email_sms", "sms"]).default("email"),
  scheduleType: z.enum(["immediate", "scheduled", "recurring"]).default("immediate"),
  handoverGoals: z.string().optional().default(""),
  targetAudience: z.string().optional().default(""),
  handoverPrompt: z.string().optional().default(""),
  status: z.string().optional().default("draft"),
  templates: z.any().optional().nullable(),
  subjectLines: z.any().optional().nullable(),
  numberOfTemplates: z.number().optional().default(5),
  daysBetweenMessages: z.number().optional().default(3),
  originalCampaignId: z.string().nullable().optional(),
  isTemplate: z.boolean().optional().default(false),
  stopOnComplaint: z.boolean().optional().default(true),
  agentConfigId: z.string().nullable().optional(),
  // V2 Business Handover Triggers
  handoverTriggers: z.object({
    pricingQuestions: z.boolean().default(false),
    testDriveDemo: z.boolean().default(false),
    tradeInValue: z.boolean().default(false),
    financing: z.boolean().default(false),
    vehicleAvailability: z.boolean().default(false),
    urgency: z.boolean().default(false),
    customTriggers: z.array(z.string()).default([]),
  }).optional(),
  handoverRecipient: z.string().email().optional(),
  handoverRecipientName: z.string().optional(),
  // URL triggers - automatically send URLs when customers ask about topics
  urlTriggers: z.object({
    tradeInUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
    schedulerUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
    financingUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
    inventoryUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
    warrantyUrl: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
  }).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CampaignFormProps {
  onClose: () => void;
  currentStep: number;
  onStepChange: (step: number, campaignId?: string) => void;
  campaignId?: string | null;
}

export default function CampaignForm({ onClose, currentStep, onStepChange, campaignId }: CampaignFormProps) {
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [generatedTemplates, setGeneratedTemplates] = useState<TemplateLike[]>([]);
  const [numberOfTemplates, setNumberOfTemplates] = useState(5);
  const [daysBetweenMessages, setDaysBetweenMessages] = useState(3);
  const [communicationType, setCommunicationType] = useState<'email' | 'email_sms' | 'sms'>('email');
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [selectedHandoverGoals, setSelectedHandoverGoals] = useState<string[]>([]);
  const [otherHandoverGoal, setOtherHandoverGoal] = useState("");
  const [handoverTriggers, setHandoverTriggers] = useState({
    pricingQuestions: false,
    testDriveDemo: false,
    tradeInValue: false,
    financing: false,
    vehicleAvailability: false,
    urgency: false,
    customTriggers: [] as string[]
  });
  const [customTriggerInput, setCustomTriggerInput] = useState("");
  const [urlTriggers, setUrlTriggers] = useState({
    tradeInUrl: { enabled: false, url: '', message: 'Check out our trade-in calculator:' },
    schedulerUrl: { enabled: false, url: '', message: 'Book your appointment here:' },
    financingUrl: { enabled: false, url: '', message: 'Get pre-qualified for financing:' },
    inventoryUrl: { enabled: false, url: '', message: 'Browse our current inventory:' },
    warrantyUrl: { enabled: false, url: '', message: 'Learn about our warranty options:' }
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      context: "",
      handoverGoals: "",
      targetAudience: "",
      handoverPrompt: "",
      status: "draft",
      templates: null,
      subjectLines: null,
      numberOfTemplates: 5,
      daysBetweenMessages: 3,
      isTemplate: false,
      originalCampaignId: null,
      agentConfigId: null,
      communicationType: "email",
      scheduleType: "immediate",
      // V2 Business Handover defaults
      handoverTriggers: {
        pricingQuestions: false,
        testDriveDemo: false,
        tradeInValue: false,
        financing: false,
        vehicleAvailability: false,
        urgency: false,
        customTriggers: []
      },
      handoverRecipient: "",
      handoverRecipientName: "",
      // URL trigger defaults
      urlTriggers: {
        tradeInUrl: { enabled: false, url: '', message: 'Check out our trade-in calculator:' },
        schedulerUrl: { enabled: false, url: '', message: 'Book your appointment here:' },
        financingUrl: { enabled: false, url: '', message: 'Get pre-qualified for financing:' },
        inventoryUrl: { enabled: false, url: '', message: 'Browse our current inventory:' },
        warrantyUrl: { enabled: false, url: '', message: 'Learn about our warranty options:' }
      },
    },
  });

  const { data: agentConfigs } = useQuery({ queryKey: ['/api/ai-agent-configs'] });

  // Load campaign data when we have a campaignId (for steps 3 and 4)
  const { data: campaignData } = useQuery<FormData | null>({
    queryKey: [`/api/campaigns/${campaignId}`],
    enabled: !!campaignId && currentStep >= 3
  });

  const createCampaign = useMutation({
    mutationFn: (data: FormData) => apiRequest('/api/campaigns', 'POST', data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: "Campaign created successfully!" });
      setCreatedCampaignId(response.id);
      onStepChange(2, response.id); // Move to Lead Selection step with campaign ID
    },
    onError: () => {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    },
  });

  const generateGoals = useMutation({
    mutationFn: (context: string) =>
      apiRequest('/api/ai/suggest-goals', 'POST', { context }),
    onSuccess: (response: any) => {
      const goals = response.goals || [];
      setAiSuggestions(goals);
      setShowSuggestions(true);
    },
    onError: () => {
      toast({ title: "Failed to generate AI suggestions", variant: "destructive" });
    },
  });

  const enhanceTemplates = useMutation({
    mutationFn: ({ context, name }: { context: string; name: string }) =>
      apiRequest('/api/ai/enhance-templates', 'POST', { context, name }),
    onSuccess: () => {
      toast({ title: "Templates enhanced with AI!" });
      onStepChange(3);
    },
    onError: () => {
      toast({ title: "Failed to enhance templates", variant: "destructive" });
    },
  });

  const generateSubjects = useMutation({
    mutationFn: ({ context, name }: { context: string; name: string }) =>
      apiRequest('/api/ai/generate-subjects', 'POST', { context, name }),
    onSuccess: () => {
      toast({ title: "Subject lines generated!" });
    },
    onError: () => {
      toast({ title: "Failed to generate subject lines", variant: "destructive" });
    },
  });

  const generateNames = useMutation({
    mutationFn: (context: string) =>
      apiRequest('/api/ai/suggest-names', 'POST', { context }),
    onSuccess: (response: any) => {
      const names = response.names || [];
      setNameSuggestions(names);
      setShowNameSuggestions(true);
    },
    onError: () => {
      toast({ title: "Failed to generate campaign names", variant: "destructive" });
    },
  });

  const generateTemplates = useMutation({
    mutationFn: ({ context, name, numberOfTemplates }: { context: string; name: string; numberOfTemplates: number }) =>
      apiRequest('/api/ai/generate-templates', 'POST', { context, name, numberOfTemplates }),
    onSuccess: (response: any) => {
      const templates = response.templates || [];
      setGeneratedTemplates(templates);
      toast({ title: `Generated ${templates.length} email templates!` });
    },
    onError: () => {
      toast({ title: "Failed to generate email templates", variant: "destructive" });
    },
  });

  const onSubmit: (data: FormData) => void = (data) => {
    const campaignData = {
      ...data,
      templates: generatedTemplates,
      numberOfTemplates,
      daysBetweenMessages,
      handoverTriggers: handoverTriggers,
      urlTriggers: urlTriggers,
    };
    createCampaign.mutate(campaignData);
  };

  const contextSuggestions = [
    "Promote the latest SUV models with special financing offers",
    "Highlight seasonal service offers and maintenance packages",
    "Announce upcoming dealership events and test drive opportunities"
  ];

  const fillContextSuggestion = (suggestion: string) => {
    form.setValue('context', suggestion);
  };

  const handleSuggestGoals = () => {
    const context = form.getValues('context');
    if (context.length < 10) {
      toast({ title: "Please provide more campaign context first", variant: "destructive" });
      return;
    }
    generateGoals.mutate(context);
  };

  const selectGoal = (goal: string) => {
  form.setValue('handoverGoals', goal as any);
    setShowSuggestions(false);
  };

  const handleSuggestNames = () => {
    const context = form.getValues('context');
    if (context.length < 10) {
      toast({ title: "Please provide campaign context first", variant: "destructive" });
      return;
    }
    generateNames.mutate(context);
  };

  const selectName = (name: string) => {
    form.setValue('name', name);
    setShowNameSuggestions(false);
  };

  const handleGenerateTemplates = () => {
    const context = form.getValues('context');
    const name = form.getValues('name');

    if (!context || !name) {
      toast({ title: "Please fill in campaign name and context first", variant: "destructive" });
      return;
    }

    generateTemplates.mutate({ context, name, numberOfTemplates });
  };

  // Only show the initial form for step 1
  if (currentStep === 1) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* AI Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">AI Campaign Tips</h4>
              <p className="text-sm text-blue-700 leading-relaxed">
                Be specific about vehicle models, services, or offers. Include target audience details and clear objectives for best AI-generated content.
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Basic Information */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Campaign Information
            </CardTitle>
            <CardDescription>
              Basic details about your campaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campaign Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 2024 Holiday Sales Event"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Audience Field */}
            <FormField
              control={form.control}
              name="targetAudience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audience</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., First-time car buyers, Service customers, Trade-in prospects..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Define who this campaign is targeting for better AI personalization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campaign Context Field */}
            <FormField
              control={form.control}
              name="context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Context</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Describe your campaign goals, target audience, and key messaging..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>

                  {/* Context Suggestions */}
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Quick suggestions for automotive campaigns:</p>
                    <div className="flex flex-wrap gap-2">
                      {contextSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => fillContextSuggestion(suggestion)}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          {suggestion.slice(0, 30) + (suggestion.length > 30 ? '...' : '')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Handover Configuration */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Handover Configuration
            </CardTitle>
            <CardDescription>
              Configure when to hand over leads to your sales team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Handover Triggers */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Hand over to sales when a lead:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pricingQuestions"
                    checked={handoverTriggers.pricingQuestions}
                    onCheckedChange={(checked) =>
                      setHandoverTriggers(prev => ({ ...prev, pricingQuestions: !!checked }))
                    }
                  />
                  <label htmlFor="pricingQuestions" className="text-sm">
                    Asks pricing questions
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="testDriveDemo"
                    checked={handoverTriggers.testDriveDemo}
                    onCheckedChange={(checked) =>
                      setHandoverTriggers(prev => ({ ...prev, testDriveDemo: !!checked }))
                    }
                  />
                  <label htmlFor="testDriveDemo" className="text-sm">
                    Mentions test drive or demo
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tradeInValue"
                    checked={handoverTriggers.tradeInValue}
                    onCheckedChange={(checked) =>
                      setHandoverTriggers(prev => ({ ...prev, tradeInValue: !!checked }))
                    }
                  />
                  <label htmlFor="tradeInValue" className="text-sm">
                    Asks trade-in value
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="financing"
                    checked={handoverTriggers.financing}
                    onCheckedChange={(checked) =>
                      setHandoverTriggers(prev => ({ ...prev, financing: !!checked }))
                    }
                  />
                  <label htmlFor="financing" className="text-sm">
                    Inquires about financing
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vehicleAvailability"
                    checked={handoverTriggers.vehicleAvailability}
                    onCheckedChange={(checked) =>
                      setHandoverTriggers(prev => ({ ...prev, vehicleAvailability: !!checked }))
                    }
                  />
                  <label htmlFor="vehicleAvailability" className="text-sm">
                    Asks about vehicle availability
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="urgency"
                    checked={handoverTriggers.urgency}
                    onCheckedChange={(checked) =>
                      setHandoverTriggers(prev => ({ ...prev, urgency: !!checked }))
                    }
                  />
                  <label htmlFor="urgency" className="text-sm">
                    Shows urgency (wants to buy soon)
                  </label>
                </div>
              </div>
            </div>

            {/* Custom Triggers */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Other scenarios:</label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Other scenario..."
                  value={customTriggerInput}
                  onChange={(e) => setCustomTriggerInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (customTriggerInput.trim() && !handoverTriggers.customTriggers.includes(customTriggerInput.trim())) {
                        setHandoverTriggers(prev => ({
                          ...prev,
                          customTriggers: [...prev.customTriggers, customTriggerInput.trim()]
                        }));
                        setCustomTriggerInput("");
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (customTriggerInput.trim() && !handoverTriggers.customTriggers.includes(customTriggerInput.trim())) {
                      setHandoverTriggers(prev => ({
                        ...prev,
                        customTriggers: [...prev.customTriggers, customTriggerInput.trim()]
                      }));
                      setCustomTriggerInput("");
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {handoverTriggers.customTriggers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {handoverTriggers.customTriggers.map((trigger, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                      <span>{trigger}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setHandoverTriggers(prev => ({
                            ...prev,
                            customTriggers: prev.customTriggers.filter((_, i) => i !== index)
                          }));
                        }}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Handover Recipient */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="handoverRecipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hand over to:</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="sales@dealership.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="handoverRecipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Name (Optional):</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Sales Team"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* URL Triggers Section */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Auto-Send URLs
            </CardTitle>
            <CardDescription>
              Send helpful links when a lead:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Simplified URL triggers with fewer options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="appointmentUrl"
                  checked={urlTriggers.schedulerUrl.enabled}
                  onCheckedChange={(checked) =>
                    setUrlTriggers(prev => ({
                      ...prev,
                      schedulerUrl: { ...prev.schedulerUrl, enabled: !!checked }
                    }))
                  }
                />
                <label htmlFor="appointmentUrl" className="text-sm font-medium">
                  • Asks about appointments
                </label>
              </div>
              {urlTriggers.schedulerUrl.enabled && (
                <div className="ml-6">
                  <Input
                    placeholder="Enter URL for appointment booking"
                    value={urlTriggers.schedulerUrl.url}
                    onChange={(e) =>
                      setUrlTriggers(prev => ({
                        ...prev,
                        schedulerUrl: { ...prev.schedulerUrl, url: e.target.value }
                      }))
                    }
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tradeInUrl"
                  checked={urlTriggers.tradeInUrl.enabled}
                  onCheckedChange={(checked) =>
                    setUrlTriggers(prev => ({
                      ...prev,
                      tradeInUrl: { ...prev.tradeInUrl, enabled: !!checked }
                    }))
                  }
                />
                <label htmlFor="tradeInUrl" className="text-sm font-medium">
                  • Asks about trade in
                </label>
              </div>
              {urlTriggers.tradeInUrl.enabled && (
                <div className="ml-6">
                  <Input
                    placeholder="Enter URL for trade-in calculator"
                    value={urlTriggers.tradeInUrl.url}
                    onChange={(e) =>
                      setUrlTriggers(prev => ({
                        ...prev,
                        tradeInUrl: { ...prev.tradeInUrl, url: e.target.value }
                      }))
                    }
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="financingUrl"
                  checked={urlTriggers.financingUrl.enabled}
                  onCheckedChange={(checked) =>
                    setUrlTriggers(prev => ({
                      ...prev,
                      financingUrl: { ...prev.financingUrl, enabled: !!checked }
                    }))
                  }
                />
                <label htmlFor="financingUrl" className="text-sm font-medium">
                  • Asks about financing
                </label>
              </div>
              {urlTriggers.financingUrl.enabled && (
                <div className="ml-6">
                  <Input
                    placeholder="Enter URL for financing application"
                    value={urlTriggers.financingUrl.url}
                    onChange={(e) =>
                      setUrlTriggers(prev => ({
                        ...prev,
                        financingUrl: { ...prev.financingUrl, url: e.target.value }
                      }))
                    }
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="otherUrl"
                  checked={urlTriggers.inventoryUrl.enabled}
                  onCheckedChange={(checked) =>
                    setUrlTriggers(prev => ({
                      ...prev,
                      inventoryUrl: { ...prev.inventoryUrl, enabled: !!checked }
                    }))
                  }
                />
                <label htmlFor="otherUrl" className="text-sm font-medium">
                  • Other _________
                </label>
              </div>
              {urlTriggers.inventoryUrl.enabled && (
                <div className="ml-6">
                  <Input
                    placeholder="Enter URL for other purpose"
                    value={urlTriggers.inventoryUrl.url}
                    onChange={(e) =>
                      setUrlTriggers(prev => ({
                        ...prev,
                        inventoryUrl: { ...prev.inventoryUrl, url: e.target.value }
                      }))
                    }
                  />
                </div>
              )}
            </div>



            {/* Info Box */}
            <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
              <p><strong>How it works:</strong> When customers mention these topics, the AI will automatically include the relevant URL in its response. This helps provide instant access to tools and information.</p>
            </div>
          </CardContent>
        </Card>

        {/* Send Window Configuration */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-4 w-4 text-gray-600" />
              </div>
              Send Window Configuration
            </CardTitle>
            <CardDescription>
              Control when and how often emails are sent to optimize engagement
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="sendWindow.tz"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Timezone</FormLabel>
                    <FormControl>
                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-sm"
                        value={field.value || 'America/New_York'}
                        onChange={(e) => field.onChange(e.target.value)}
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sendWindow.start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Start Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        className="text-sm"
                        value={field.value || '09:00'}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sendWindow.end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">End Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        className="text-sm"
                        value={field.value || '17:00'}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <p className="text-sm text-gray-700">
                  Emails will only be sent during your specified hours in the selected timezone.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Settings */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Campaign Settings
            </CardTitle>
            <CardDescription>
              Additional configuration options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="isTemplate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium">Save as Template</FormLabel>
                    <FormDescription>
                      Make this campaign reusable as a template for future campaigns
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Email Template Generation */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Email Templates
            </CardTitle>
            <CardDescription>
              Generate email templates for your campaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Messages
                </label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={numberOfTemplates}
                  onChange={(e) => setNumberOfTemplates(parseInt(e.target.value) || 5)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Number of templated emails to send (if no response)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days Between Messages
                </label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={daysBetweenMessages}
                  onChange={(e) => setDaysBetweenMessages(parseInt(e.target.value) || 3)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Wait time between each templated email</p>
              </div>
            </div>

            {generatedTemplates.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 mb-4">No templates generated yet</p>
                <Button
                  type="button"
                  onClick={handleGenerateTemplates}
                  disabled={generateTemplates.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {generateTemplates.isPending ? (
                    <>
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generating Templates...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate {numberOfTemplates} Email Templates
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-900">
                    Generated {generatedTemplates.length} email templates
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTemplates}
                    disabled={generateTemplates.isPending}
                  >
                    Regenerate
                  </Button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {generatedTemplates.map((template, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">Email {index + 1}</span>
                        <span className="text-xs text-gray-500">{(typeof template === 'string' ? template : template?.content || template?.body || JSON.stringify(template)).length} characters</span>
                      </div>
                      <div className="text-xs text-gray-600 line-clamp-3">
                        {(typeof template === 'string' ? template : template?.content || template?.body || JSON.stringify(template)).replace(/<[^>]*>/g, '').substring(0, 120)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {/* AI Agent Selector */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              AI Agent Configuration
            </CardTitle>
            <CardDescription>
              Select which AI agent will handle responses and conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="agentConfigId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent Profile</FormLabel>
                  <FormControl>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    >
                      <option value="">Use Active Agent</option>
                      {Array.isArray(agentConfigs) && agentConfigs.map((cfg: any) => (
                        <option key={cfg.id} value={cfg.id}>
                          {cfg.name} {cfg.isActive ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    When a lead replies to any email, the remaining templated emails are cancelled. The AI agent takes over for personalized back-and-forth conversation until handover.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>



        {/* Form Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex space-x-3">
            <Button
              type="submit"
              variant="outline"
              disabled={createCampaign.isPending}
              onClick={() => form.setValue('status', 'draft' as any)}
            >
              Save Draft
            </Button>
            <Button
              type="submit"
              disabled={createCampaign.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
    );
  }

  // Step 3: AI Enhancement
  if (currentStep === 3) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">AI Template Generation</h4>
              <p className="text-sm text-blue-700 leading-relaxed">
                Generate email templates and subject lines optimized for your campaign goals.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            type="button"
            onClick={() => {
              if (!campaignId) {
                toast({ title: "Campaign ID not found", variant: "destructive" });
                return;
              }
              // Use the campaign data for context
              const context = campaignData?.context || form.getValues('context');
              const name = campaignData?.name || form.getValues('name');
              generateTemplates.mutate({ context, name, numberOfTemplates });
            }}
            disabled={generateTemplates.isPending}
            className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-medium text-gray-900">Generate Email Templates</span>
            </div>
            <p className="text-sm text-gray-600">
              Create {numberOfTemplates} personalized email templates with proper spacing and subject lines
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!campaignId) {
                toast({ title: "Campaign ID not found", variant: "destructive" });
                return;
              }
              const context = campaignData?.context || form.getValues('context') || '';
              const name = campaignData?.name || form.getValues('name') || '';
              generateSubjects.mutate({ context, name });
            }}
            disabled={generateSubjects.isPending}
            className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all text-left"
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Type className="w-4 h-4 text-green-600" />
              </div>
              <span className="font-medium text-gray-900">Generate Additional Subject Lines</span>
            </div>
            <p className="text-sm text-gray-600">
              Create compelling subject lines optimized for open rates
            </p>
          </button>
        </div>

        {generatedTemplates.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              ✓ Generated {generatedTemplates.length} templates with subject lines
            </p>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => onStepChange(2)}>
            Back to Lead Selection
          </Button>
          <Button onClick={() => onStepChange(4)}>
            Continue to Review
          </Button>
        </div>
      </div>
    );
  }

  // Step 4: Review & Launch
  if (currentStep === 4) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-1">Campaign Ready</h4>
              <p className="text-sm text-green-700 leading-relaxed">
                Your campaign is configured and ready to launch. Review the settings below before launching.
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Campaign Name</p>
              <p className="font-medium">{campaignData?.name || form.getValues('name')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Context</p>
              <p className="text-sm">{campaignData?.context || form.getValues('context')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Templates</p>
              <p className="font-medium">{generatedTemplates.length} templates generated</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge>Ready to Launch</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => onStepChange(3)}>
            Back to Enhancement
          </Button>
          <div className="space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                toast({ title: "Campaign saved as draft" });
                onClose();
              }}
            >
              Save as Draft
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                toast({ title: "Campaign launched successfully!" });
                onClose();
              }}
            >
              Launch Campaign
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
