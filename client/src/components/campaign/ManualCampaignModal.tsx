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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, X, Plus, Trash2 } from "lucide-react";
import { z } from "zod";

const formSchema = insertCampaignSchema.extend({
  name: z.string().min(1, "Campaign name is required"),
  context: z.string().min(10, "Please provide more detailed context"),
  communicationType: z.enum(["email", "email_sms", "sms"]).default("email"),
  handoverGoals: z.string().optional().default(""),
  targetAudience: z.string().optional().default(""),
  status: z.string().optional().default("draft"),
  templates: z.array(z.string()).default([]),
  subjectLines: z.array(z.string()).default([]),
  numberOfTemplates: z.number().min(1).max(10).default(3),
  daysBetweenMessages: z.number().min(1).max(30).default(3),
});

type FormData = z.infer<typeof formSchema>;

interface ManualCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ManualCampaignModal({ isOpen, onClose }: ManualCampaignModalProps) {
  const [templates, setTemplates] = useState<string[]>([""]);
  const [subjectLines, setSubjectLines] = useState<string[]>([""]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      context: "",
      handoverGoals: "",
      targetAudience: "",
      status: "draft",
      templates: [""],
      subjectLines: [""],
      numberOfTemplates: 3,
      daysBetweenMessages: 3,
      communicationType: "email",
    },
  });

  const createCampaign = useMutation({
    mutationFn: (data: FormData) => {
      const campaignData = {
        ...data,
        templates: templates.filter(t => t.trim()),
        subjectLines: subjectLines.filter(s => s.trim()),
      };
      return apiRequest('/api/campaigns', 'POST', campaignData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: "Campaign created successfully!" });
      onClose();
      form.reset();
      setTemplates([""]);
      setSubjectLines([""]);
    },
    onError: () => {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    createCampaign.mutate(data);
  };

  const addTemplate = () => {
    setTemplates([...templates, ""]);
  };

  const removeTemplate = (index: number) => {
    if (templates.length > 1) {
      setTemplates(templates.filter((_, i) => i !== index));
    }
  };

  const updateTemplate = (index: number, value: string) => {
    const newTemplates = [...templates];
    newTemplates[index] = value;
    setTemplates(newTemplates);
  };

  const addSubjectLine = () => {
    setSubjectLines([...subjectLines, ""]);
  };

  const removeSubjectLine = (index: number) => {
    if (subjectLines.length > 1) {
      setSubjectLines(subjectLines.filter((_, i) => i !== index));
    }
  };

  const updateSubjectLine = (index: number, value: string) => {
    const newSubjectLines = [...subjectLines];
    newSubjectLines[index] = value;
    setSubjectLines(newSubjectLines);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <DialogTitle className="text-xl font-semibold">Manual Campaign Setup</DialogTitle>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Spring Sales Campaign" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="context"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your campaign goals, target audience, and key messaging..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="targetAudience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Audience</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., SUV buyers, service customers" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="communicationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Communication Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="email">Email Only</SelectItem>
                            <SelectItem value="email_sms">Email + SMS</SelectItem>
                            <SelectItem value="sms">SMS Only</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="numberOfTemplates"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Templates</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="daysBetweenMessages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days Between Messages</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 5, 7, 14].map(days => (
                              <SelectItem key={days} value={days.toString()}>{days} days</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
      </DialogContent>
    </Dialog>
  );
}
