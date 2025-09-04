import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from 'wouter';
import { Plus, Edit, Trash2, Check, Settings, Shield, Brain, Zap, Target, Mail, Users, Calendar, TestTube, Send, Loader2, X, CreditCard, Sparkles, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Campaign } from "@shared/schema";
// (EmailValidationPanel removed in favor of Campaigns management inside this center)
import AutomotivePromptTester from "@/components/ai/AutomotivePromptTester";
import type { AiAgentConfig } from "@shared/schema";

import { insertAiAgentConfigSchema } from "@shared/schema";

const formSchema = insertAiAgentConfigSchema.extend({
  dosList: z.array(z.string()).default([]),
  dontsList: z.array(z.string()).default([]),
  agentEmailDomain: z.string()
    .min(3, 'Mailgun subdomain is required')
    .transform(v => v.trim())
    .refine(v => !v.includes('@') || v.split('@').length === 2, 'Invalid format')
    .transform(v => (v.includes('@') ? v.split('@').pop() || '' : v))
    .refine(v => /^[a-zA-Z0-9.-]+$/.test(v), 'Use only letters, numbers, dots, and hyphens')
    .refine(v => !v.startsWith('.') && !v.endsWith('.'), 'Cannot start or end with a dot'),
});

export default function AiSettingsPage() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<AiAgentConfig | null>(null);
  const [newDo, setNewDo] = useState("");
  const [newDont, setNewDont] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Handler for campaign navigation
  const handleCampaignNavigation = () => {
    console.log('Navigating to campaigns page...');
    setLocation('/campaigns');
  };

  const { data: configs, isLoading } = useQuery({
    queryKey: ["/api/ai-agent-configs"],
  });

  const { data: activeConfig } = useQuery({
    queryKey: ["/api/ai-agent-configs/active"],
  });

  // Fetch real V2 campaigns data (Kunes dealership campaigns)
  const { data: campaigns } = useQuery({
    queryKey: ["/v2/campaigns"],
    queryFn: async () => {
      const response = await fetch('/v2/campaigns');
      if (!response.ok) throw new Error('Failed to fetch V2 campaigns');
      const data = await response.json();
      return data.campaigns || [];
    },
  });

  // Calculate real V2 campaign stats
  const activeCampaigns = campaigns?.filter((c: any) => c.status === 'active') || [];
  const totalEmailsSent = campaigns?.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0;
  const totalResponses = campaigns?.reduce((sum: number, c: any) => sum + (c.totalResponses || 0), 0) || 0;
  const successRate = totalEmailsSent > 0 ? Math.round((totalResponses / totalEmailsSent) * 100) : 0;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      tonality: "professional",
      personality: "",
      dosList: [],
      dontsList: [],
      industry: "automotive",
      responseStyle: "helpful",
      agentEmailDomain: '',
      isActive: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest("/api/ai-agent-configs", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "AI agent configuration created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent-configs"] });
      setEditDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create AI agent configuration",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof formSchema>> }) => {
      return await apiRequest(`/api/ai-agent-configs/${id}`, "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "AI agent configuration updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent-configs"] });
      setEditDialogOpen(false);
      form.reset();
      setSelectedConfig(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update AI agent configuration",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/ai-agent-configs/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "AI agent configuration deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent-configs"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete AI agent configuration",
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/ai-agent-configs/${id}/activate`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "AI agent configuration activated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent-configs/active"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to activate AI agent configuration",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (config: AiAgentConfig | null = null) => {
    setSelectedConfig(config);
    if (config) {
      form.reset({
        name: config.name,
        tonality: config.tonality,
        personality: config.personality || "",
        dosList: (config.dosList as string[]) || [],
        dontsList: (config.dontsList as string[]) || [],
        industry: config.industry || "automotive",
        responseStyle: config.responseStyle || "helpful",
        agentEmailDomain: (config as any).agentEmailDomain || "",
        isActive: config.isActive,
      });
    } else {
      form.reset();
    }
    setEditDialogOpen(true);
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (selectedConfig) {
      updateMutation.mutate({ id: selectedConfig.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addDo = () => {
    if (newDo.trim()) {
      const currentDos = form.getValues("dosList");
      form.setValue("dosList", [...currentDos, newDo.trim()]);
      setNewDo("");
    }
  };

  const removeDo = (index: number) => {
    const currentDos = form.getValues("dosList");
    form.setValue("dosList", currentDos.filter((_: string, i: number) => i !== index));
  };

  const addDont = () => {
    if (newDont.trim()) {
      const currentDonts = form.getValues("dontsList");
      form.setValue("dontsList", [...currentDonts, newDont.trim()]);
      setNewDont("");
    }
  };

  const removeDont = (index: number) => {
    const currentDonts = form.getValues("dontsList");
    form.setValue("dontsList", currentDonts.filter((_: string, i: number) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">AI Agent Settings</h1>
        </div>
        <div className="animate-pulse">
          <div className="bg-gray-200 rounded-lg h-32 mb-4"></div>
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-48"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // OfferLogix Agent Templates
  const agentTemplates = [
    {
      name: "OfferLogix Instant Credit Specialist",
      description: "Expert in instant credit decisions and dealership financing",
      tonality: "professional",
      personality: "Expert automotive financing specialist with deep knowledge of instant credit decisioning",
      responseStyle: "consultative",
      dosList: [
        "Emphasize instant approval capabilities",
        "Highlight ROI and profit margins",
        "Provide specific integration timelines",
        "Share success metrics from other dealerships"
      ],
      dontsList: [
        "Never make unrealistic promises about approval rates",
        "Avoid discussing specific customer credit scores",
        "Don't criticize competitor platforms directly"
      ],
      icon: CreditCard,
      color: "bg-blue-500"
    },
    {
      name: "OfferLogix Sales Engagement Specialist",
      description: "B2B outbound sales expert for dealership prospecting",
      tonality: "friendly",
      personality: "Enthusiastic B2B sales professional specializing in automotive dealership partnerships",
      responseStyle: "helpful",
      dosList: [
        "Research dealership background before outreach",
        "Personalize messages with dealership-specific insights",
        "Lead with value propositions",
        "Offer free trials and pilot programs"
      ],
      dontsList: [
        "Never send generic mass emails",
        "Don't call before 9am or after 6pm local time",
        "Avoid being pushy or aggressive"
      ],
      icon: Target,
      color: "bg-green-500"
    }
  ];

  const handleUseTemplate = (template: typeof agentTemplates[0]) => {
    form.reset({
      name: template.name,
      tonality: template.tonality,
      personality: template.personality,
      dosList: template.dosList,
      dontsList: template.dontsList,
      industry: "automotive_b2b",
      responseStyle: template.responseStyle,
      model: "openai/gpt-4",
      isActive: true
    });
    setEditDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section - V2 Style */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Management Center</h1>
          <p className="text-gray-600 mt-1">Configure AI agents, test prompts, and manage intelligent campaigns</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => handleEdit()} 
            className="shadow-sm relative z-10"
            type="button"
            style={{ pointerEvents: 'auto' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New AI Agent
          </Button>
        </div>
      </div>

      {/* AI Overview Stats - V2 Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{Array.isArray(configs) ? configs.length : 0}</div>
                <div className="text-sm text-gray-600">AI Agents</div>
              </div>
              <Brain className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">1</div>
                <div className="text-sm text-gray-600">Active Agent</div>
              </div>
              <Check className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">∞</div>
                <div className="text-sm text-gray-600">AI Campaigns</div>
              </div>
              <Zap className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">Live</div>
                <div className="text-sm text-gray-600">Status</div>
              </div>
              <Shield className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

    <Tabs defaultValue="agent-configs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-gray-100">
          <TabsTrigger value="agent-configs" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">AI Agents</TabsTrigger>
          <TabsTrigger value="campaigns" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">AI Campaigns</TabsTrigger>
          <TabsTrigger value="prompt-tester" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Prompt Tester</TabsTrigger>
        </TabsList>

        <TabsContent value="agent-configs" className="space-y-6">
          {/* Active Configuration Card - V2 Style */}
          {activeConfig && activeConfig !== null ? (
            <Card className="border border-green-200 shadow-sm bg-green-50">
              <CardHeader className="border-b border-green-200">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <Settings className="h-4 w-4 text-green-600" />
                      </div>
                      Active AI Agent: {(activeConfig as any)?.name || 'Default'}
                    </CardTitle>
                    <CardDescription className="text-green-700">
                      Currently controlling all AI agent behavior and responses
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-green-300 shadow-sm">
                    ● Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">Tonality:</span>
                    <span className="font-medium text-gray-900">{(activeConfig as any)?.tonality || 'Professional'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Style:</span>
                    <span className="font-medium text-gray-900">{(activeConfig as any)?.responseStyle || 'Helpful'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-600">Industry:</span>
                    <span className="font-medium text-gray-900">{(activeConfig as any)?.industry || 'Automotive'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* OfferLogix Agent Templates */}
          {(!configs || configs.length === 0) && (
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-lg font-semibold text-gray-900">Quick Start Templates</CardTitle>
                <CardDescription>Use pre-configured OfferLogix agents to get started quickly</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {agentTemplates.map((template) => {
                    const IconComponent = template.icon;
                    return (
                      <Card key={template.name} className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                            onClick={() => handleUseTemplate(template)}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 ${template.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <CardTitle className="text-base font-semibold text-gray-900">{template.name}</CardTitle>
                              <p className="text-sm text-gray-600">{template.description}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2 text-xs">
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">{template.dosList[0]}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">{template.dosList[1]}</span>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUseTemplate(template);
                            }}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Use This Template
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Agent Configurations Grid - V2 Style */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="text-lg font-semibold text-gray-900">AI Agent Configurations</CardTitle>
              <CardDescription>Manage and configure your AI agents for different scenarios</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.isArray(configs) && configs.map((config: AiAgentConfig) => (
                  <Card key={config.id} className={`border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 ${config.isActive ? 'ring-2 ring-green-200 bg-green-50' : 'hover:border-gray-300'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-semibold text-gray-900">{config.name}</CardTitle>
                          <CardDescription className="text-sm line-clamp-2">
                            {config.personality || "No description provided"}
                          </CardDescription>
                        </div>
                        {config.isActive && (
                          <Badge className="bg-green-100 text-green-800 border-green-300 shadow-sm">
                            Active
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-gray-600">{config.tonality}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="text-gray-600">{config.responseStyle}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span className="text-gray-600">{(config.dosList as string[])?.length || 0} rules</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-gray-600">{(config.dontsList as string[])?.length || 0} don'ts</span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                  {!config.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => activateMutation.mutate(config.id)}
                      disabled={activateMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(config)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={Boolean(config.isActive)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{config.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(config.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

          {/* Edit/Create Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedConfig ? "Edit" : "Create"} AI Agent Configuration
                </DialogTitle>
                <DialogDescription>
                  Configure how the AI agent behaves and responds to users.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Configuration Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Professional Automotive Agent" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tonality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tonality</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select tonality" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="responseStyle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Response Style</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select response style" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="helpful">Helpful</SelectItem>
                              <SelectItem value="consultative">Consultative</SelectItem>
                              <SelectItem value="direct">Direct</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                  {/* Agents Mailgun Subdomain */}
                  <FormField
                    control={form.control}
                    name="agentEmailDomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agents Email Subdomain (Mailgun)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., mg.dealership.com"
                            value={field.value || ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              // Live strip whitespace and local-part if pasted email
                              const cleaned = raw.includes('@') ? raw.split('@').pop()! : raw;
                              field.onChange(cleaned.trim());
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val.includes('@')) {
                                const domain = val.split('@').pop()!;
                                field.onChange(domain);
                              }
                              field.onBlur();
                            }}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormDescription>
                          Bare Mailgun domain or subdomain only (no email address). Overrides default MAILGUN_DOMAIN.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>

                  <FormField
                    control={form.control}
                    name="personality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personality Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the agent's personality and approach..."
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a brief description of how the agent should behave.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Do's Section */}
                  <div className="space-y-2">
                    <FormLabel>Do's - What the agent should always do</FormLabel>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a do..."
                        value={newDo}
                        onChange={(e) => setNewDo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDo())}
                      />
                      <Button type="button" onClick={addDo} size="sm">
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.watch("dosList").map((item: string, index: number) => (
                        <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeDo(index)}>
                          {item} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Don'ts Section */}
                  <div className="space-y-2">
                    <FormLabel>Don'ts - What the agent should never do</FormLabel>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a don't..."
                        value={newDont}
                        onChange={(e) => setNewDont(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDont())}
                      />
                      <Button type="button" onClick={addDont} size="sm">
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.watch("dontsList").map((item: string, index: number) => (
                        <Badge key={index} variant="destructive" className="cursor-pointer" onClick={() => removeDont(index)}>
                          {item} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {selectedConfig
                        ? (updateMutation.isPending ? "Updating..." : "Update Configuration")
                        : (createMutation.isPending ? "Creating..." : "Create Configuration")
                      }
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          {/* AI Campaign Management - V2 Style */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Zap className="h-4 w-4 text-purple-600" />
                    </div>
                    AI Campaign Management
                  </CardTitle>
                  <CardDescription>Intelligent campaigns powered by your AI agents</CardDescription>
                </div>
                <Button 
                  className="shadow-sm relative z-10"
                  onClick={handleCampaignNavigation}
                  type="button"
                  style={{ pointerEvents: 'auto' }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New AI Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Campaign Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{activeCampaigns.length}</div>
                      <div className="text-sm text-blue-700">Active Campaigns</div>
                    </div>
                    <Target className="h-8 w-8 text-blue-400" />
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{totalEmailsSent}</div>
                      <div className="text-sm text-green-700">Emails Sent</div>
                    </div>
                    <Mail className="h-8 w-8 text-green-400" />
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{successRate}%</div>
                      <div className="text-sm text-orange-700">Success Rate</div>
                    </div>
                    <Check className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{totalResponses}</div>
                      <div className="text-sm text-purple-700">Total Responses</div>
                    </div>
                    <Users className="h-8 w-8 text-purple-400" />
                  </div>
                </div>
              </div>

              {/* Campaign List */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900">Active AI Campaigns</h3>

                {/* Real Campaign Cards */}
                <div className="grid gap-4">
                  {activeCampaigns.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <Target className="w-6 h-6 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No active campaigns</h4>
                      <p className="text-gray-500">Create your first AI-powered campaign to get started</p>
                    </div>
                  ) : (
                    activeCampaigns.map((campaign: any, index: number) => {
                      const iconColors = [
                        { bg: 'bg-blue-100', icon: 'text-blue-600', iconComponent: Brain },
                        { bg: 'bg-purple-100', icon: 'text-purple-600', iconComponent: Target },
                        { bg: 'bg-orange-100', icon: 'text-orange-600', iconComponent: Calendar },
                        { bg: 'bg-green-100', icon: 'text-green-600', iconComponent: Mail },
                      ];
                      const colorSet = iconColors[index % iconColors.length];
                      const IconComponent = colorSet.iconComponent;

                      return (
                        <Card key={campaign.id} className="border border-gray-200 shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 ${colorSet.bg} rounded-lg flex items-center justify-center`}>
                                  <IconComponent className={`h-5 w-5 ${colorSet.icon}`} />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{campaign.name}</div>
                                  <div className="text-sm text-gray-600">Kunes dealership AI campaign</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-900">{campaign.totalSent || 0} emails sent</div>
                                  <div className="text-xs text-gray-600">{campaign.totalResponses || 0} responses</div>
                                </div>
                                <Badge
                                  className={
                                    campaign.status === 'active'
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : "bg-gray-100 text-gray-800 border-gray-300"
                                  }
                                >
                                  {campaign.status}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>

                {/* Campaign Creation CTA */}
                <Card className="border border-dashed border-gray-300 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Plus className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Your First AI Campaign</h3>
                    <p className="text-gray-600 mb-4">Set up intelligent campaigns that automatically respond to leads using your configured AI agents.</p>
                    <Button 
                      className="shadow-sm relative z-10"
                      onClick={handleCampaignNavigation}
                      type="button"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Create AI Campaign
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt-tester" className="space-y-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TestTube className="h-4 w-4 text-blue-600" />
                </div>
                AI Prompt Tester
              </CardTitle>
              <CardDescription>
                Test and refine AI responses for automotive scenarios using your active configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <AutomotivePromptTester />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


