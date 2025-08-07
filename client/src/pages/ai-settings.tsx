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
import { Plus, Edit, Trash2, Check, Settings, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmailValidationPanel from "@/components/campaigns/EmailValidationPanel";
import AutomotivePromptTester from "@/components/ai/AutomotivePromptTester";
import type { AiAgentConfig } from "@shared/schema";
import { insertAiAgentConfigSchema } from "@shared/schema";

const formSchema = insertAiAgentConfigSchema.extend({
  dosList: z.array(z.string()).default([]),
  dontsList: z.array(z.string()).default([]),
});

export default function AiSettingsPage() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<AiAgentConfig | null>(null);
  const [newDo, setNewDo] = useState("");
  const [newDont, setNewDont] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["/api/ai-agent-configs"],
  });

  const { data: activeConfig } = useQuery({
    queryKey: ["/api/ai-agent-configs/active"],
  });

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
    form.setValue("dosList", currentDos.filter((_, i) => i !== index));
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
    form.setValue("dontsList", currentDonts.filter((_, i) => i !== index));
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">AI Agent Settings</h1>
        <Button onClick={() => handleEdit()}>
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </div>

      {/* Active Configuration Card */}
      {activeConfig && (
        <Card className="mb-6 border-green-200 bg-green-50">{/* Fixed type assertion */}
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Active Configuration: {(activeConfig as any)?.name || 'Default'}
                </CardTitle>
                <CardDescription>
                  Currently controlling AI agent behavior
                </CardDescription>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Tonality:</strong> {(activeConfig as any)?.tonality || 'Professional'}
              </div>
              <div>
                <strong>Response Style:</strong> {(activeConfig as any)?.responseStyle || 'Conversational'}
              </div>
              <div>
                <strong>Industry:</strong> {(activeConfig as any)?.industry || 'Automotive'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.isArray(configs) && configs.map((config: AiAgentConfig) => (
          <Card key={config.id} className={`hover:shadow-md transition-shadow ${config.isActive ? 'ring-2 ring-green-200' : ''}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{config.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {config.personality || "No description"}
                  </CardDescription>
                </div>
                {config.isActive && (
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <div><strong>Tonality:</strong> {config.tonality}</div>
                  <div><strong>Style:</strong> {config.responseStyle}</div>
                  <div><strong>Industry:</strong> {config.industry}</div>
                  <div><strong>Do's:</strong> {(config.dosList as string[])?.length || 0} rules</div>
                  <div><strong>Don'ts:</strong> {(config.dontsList as string[])?.length || 0} rules</div>
                </div>
                
                <div className="flex gap-2">
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
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDo())}
                  />
                  <Button type="button" onClick={addDo} size="sm">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.watch("dosList").map((item, index) => (
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
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDont())}
                  />
                  <Button type="button" onClick={addDont} size="sm">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.watch("dontsList").map((item, index) => (
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
    </div>
  );
}