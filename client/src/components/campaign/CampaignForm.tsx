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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Lightbulb, Sparkles, Mail, Type, MessageSquare, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { SMSIntegration } from "@/components/SMSIntegration";
import { CampaignScheduler } from "@/components/CampaignScheduler";
import { z } from "zod";

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
  agentConfigId: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CampaignFormProps {
  onClose: () => void;
  currentStep: number;
  onStepChange: (step: number) => void;
}

export default function CampaignForm({ onClose, currentStep, onStepChange }: CampaignFormProps) {
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [generatedTemplates, setGeneratedTemplates] = useState<string[]>([]);
  const [numberOfTemplates, setNumberOfTemplates] = useState(5);
  const [daysBetweenMessages, setDaysBetweenMessages] = useState(3);
  const [communicationType, setCommunicationType] = useState<'email' | 'email_sms' | 'sms'>('email');
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
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
    },
  });

  const { data: agentConfigs } = useQuery({ queryKey: ['/api/ai-agent-configs'] });

  const createCampaign = useMutation({
    mutationFn: (data: FormData) => apiRequest('/api/campaigns', 'POST', data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: "Campaign created successfully!" });
      setCreatedCampaignId(response.id);
      onStepChange(2); // Move to next step for scheduling
    },
    onError: () => {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    },
  });

  const generateGoals = useMutation({
    mutationFn: (context: string) =>
      apiRequest('/api/ai/suggest-goals', 'POST', { context }),
    onSuccess: (response: any) => {
      const goals = response.json?.goals || [];
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
      const names = response.json?.names || [];
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
      const templates = response.json?.templates || [];
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

  {/* Campaign Name Field */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Campaign Name</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestNames}
                  disabled={generateNames.isPending || form.getValues('context').length < 10}
                  className="flex items-center space-x-1"
                >
                  {generateNames.isPending ? (
                    <>
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>AI Suggest</span>
                    </>
                  )}
                </Button>
              </div>
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

        {/* AI Name Suggestions */}
        {showNameSuggestions && nameSuggestions.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-blue-600" />
              AI Campaign Name Suggestions
            </h4>
            <div className="space-y-2">
              {nameSuggestions.map((name, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectName(name)}
                  className="w-full text-left p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-colors text-sm text-gray-700 hover:text-blue-900"
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowNameSuggestions(false)}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700"
            >
              Hide suggestions
            </button>
          </div>
        )}

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
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
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

        {/* Handover Goals Field */}
        <FormField
          control={form.control}
          name="handoverGoals"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Handover Goals</FormLabel>
              <div className="flex space-x-3">
                <FormControl>
                  <Input
                    placeholder="Define your campaign objectives..."
                    className="flex-1"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSuggestGoals}
                  disabled={generateGoals.isPending}
                  className="flex items-center space-x-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>AI Suggest</span>
                </Button>
              </div>

              {/* Goal Suggestions */}
              {showSuggestions && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600 mb-2">AI suggested goals for automotive campaigns:</p>
                  <div className="space-y-2">
                    {aiSuggestions.map((goal, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectGoal(goal)}
                        className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email Template Generation Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900">AI Email Templates</h3>
                <p className="text-sm text-blue-700">Generate email templates automatically based on your offer details and campaign goals.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                      <span className="text-xs text-gray-500">{template.length} characters</span>
                    </div>
                    <div className="text-xs text-gray-600 line-clamp-3">
                      {template.replace(/<[^>]*>/g, '').substring(0, 120)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">AI Response Mode</h4>
        {/* AI Agent Selector */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select AI Agent</h3>
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

                <p className="text-sm text-blue-700 leading-relaxed">
                  When a lead replies to any email, the remaining templated emails are cancelled. The AI agent takes over for personalized back-and-forth conversation until handover.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Enhancement Section */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Enhancement Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                const context = form.getValues('context');
                const name = form.getValues('name');
                if (!context || !name) {
                  toast({ title: "Please fill in campaign name and context first", variant: "destructive" });
                  return;
                }
                enhanceTemplates.mutate({ context, name });
              }}
              disabled={enhanceTemplates.isPending}
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">AI Enhance Templates</span>
              </div>
              <p className="text-sm text-gray-600">
                Generate automotive email templates with vehicle showcases, service reminders, and personalized follow-ups
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                const context = form.getValues('context');
                const name = form.getValues('name');
                if (!context || !name) {
                  toast({ title: "Please fill in campaign name and context first", variant: "destructive" });
                  return;
                }
                generateSubjects.mutate({ context, name });
              }}
              disabled={generateSubjects.isPending}
              className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all text-left"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Type className="w-4 h-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Generate Subject Lines</span>
              </div>
              <p className="text-sm text-gray-600">
                Create compelling subject lines optimized for automotive campaigns and customer engagement
              </p>
            </button>
          </div>
        </div>

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
