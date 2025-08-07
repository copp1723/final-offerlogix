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
import { Lightbulb, Sparkles, Mail, Type } from "lucide-react";
import { z } from "zod";

const formSchema = insertCampaignSchema.extend({
  name: z.string().min(1, "Campaign name is required"),
  context: z.string().min(10, "Please provide more detailed context"),
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      context: "",
      handoverGoals: "",
      status: "draft",
    },
  });

  const createCampaign = useMutation({
    mutationFn: (data: FormData) => apiRequest('POST', '/api/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: "Campaign created successfully!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    },
  });

  const generateGoals = useMutation({
    mutationFn: (context: string) => 
      apiRequest('POST', '/api/ai/suggest-goals', { context }),
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
      apiRequest('POST', '/api/ai/enhance-templates', { context, name }),
    onSuccess: () => {
      toast({ title: "Templates enhanced with AI!" });
      onStepChange(2);
    },
    onError: () => {
      toast({ title: "Failed to enhance templates", variant: "destructive" });
    },
  });

  const generateSubjects = useMutation({
    mutationFn: ({ context, name }: { context: string; name: string }) =>
      apiRequest('POST', '/api/ai/generate-subjects', { context, name }),
    onSuccess: () => {
      toast({ title: "Subject lines generated!" });
    },
    onError: () => {
      toast({ title: "Failed to generate subject lines", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    createCampaign.mutate(data);
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
    form.setValue('handoverGoals', goal);
    setShowSuggestions(false);
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
              onClick={() => form.setValue('status', 'draft')}
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
