import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Play, 
  Users, 
  Mail, 
  BarChart3, 
  Calendar, 
  TestTube,
  AlertCircle,
  CheckCircle,
  Clock,
  Send
} from "lucide-react";

import type { Campaign as ServerCampaign } from "@shared/schema";

interface CampaignLike extends Pick<ServerCampaign, 'id' | 'name' | 'status' | 'templates' | 'createdAt'> {
  templates: string; // normalized to string for this modal
  emailsSent?: number;
  lastExecuted?: Date;
}

type Campaign = CampaignLike;

interface CampaignExecutionModalProps {
  campaign: Campaign;
  children: React.ReactNode;
}

export default function CampaignExecutionModal({ campaign, children }: CampaignExecutionModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [executionResults, setExecutionResults] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  let templates: any[] = [];
  try {
    templates = JSON.parse(campaign.templates || '[]');
  } catch (error) {
    templates = [];
  }

  const executeCampaignMutation = useMutation({
    mutationFn: async (data: { scheduleAt?: string; testMode: boolean }) => {
      return await apiRequest(`/api/campaigns/${campaign.id}/execute`, "POST", data);
    },
    onSuccess: (result) => {
      setExecutionResults(result);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: testMode ? "Test Email Sent" : "Campaign Executed",
        description: result.message,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to execute campaign";
      toast({
        title: "Execution Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const sendFollowupMutation = useMutation({
    mutationFn: async (data: { templateIndex: number }) => {
      return await apiRequest(`/api/campaigns/${campaign.id}/send-followup`, "POST", data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Follow-up Sent",
        description: result.message,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to send follow-up";
      toast({
        title: "Follow-up Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleExecute = () => {
    executeCampaignMutation.mutate({
      scheduleAt: scheduleAt || undefined,
      testMode
    });
  };

  const handleFollowup = (templateIndex: number) => {
    sendFollowupMutation.mutate({ templateIndex });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "scheduled":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "draft":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Execute Campaign: {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Launch your automotive email campaign and track its performance
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="execute" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="execute">Execute</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="execute" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(campaign.status)}
                  Campaign Status
                </CardTitle>
                <CardDescription>
                  Current status and execution settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-sm font-medium">Emails Sent</p>
                    <p className="text-lg font-bold">{campaign.emailsSent || 0}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-sm font-medium">Templates</p>
                    <p className="text-lg font-bold">{templates.length}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="test-mode">Test Mode</Label>
                    <Switch
                      id="test-mode"
                      checked={testMode}
                      onCheckedChange={setTestMode}
                    />
                  </div>
                  
                  {testMode && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center gap-2">
                        <TestTube className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm text-yellow-800">
                          Test mode will send the first email template to only the first lead
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="schedule">Schedule for Later (Optional)</Label>
                    <Input
                      id="schedule"
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>

                  <Button 
                    onClick={handleExecute} 
                    disabled={executeCampaignMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {executeCampaignMutation.isPending ? (
                      "Executing..."
                    ) : scheduleAt ? (
                      <><Calendar className="h-4 w-4 mr-2" /> Schedule Campaign</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> {testMode ? "Send Test" : "Execute Now"}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {executionResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Execution Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{executionResults.successful || 0}</p>
                      <p className="text-sm text-gray-600">Successful</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{executionResults.failed || 0}</p>
                      <p className="text-sm text-gray-600">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{executionResults.total || 0}</p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {executionResults.total > 0 ? Math.round((executionResults.successful / executionResults.total) * 100) : 0}%
                      </p>
                      <p className="text-sm text-gray-600">Success Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Templates ({templates.length})
                </CardTitle>
                <CardDescription>
                  Manage and send follow-up emails from your campaign sequence
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No email templates found</p>
                    <p className="text-sm text-gray-400">Generate templates using AI to get started</p>
                  </div>
                ) : (
                  templates.map((template, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Template {index + 1}: {template.title || `Email ${index + 1}`}
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFollowup(index)}
                            disabled={sendFollowupMutation.isPending}
                          >
                            <Send className="h-3 w-3 mr-2" />
                            Send Follow-up
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Subject: {template.subject || 'No subject'}</p>
                          <div className="p-3 bg-gray-50 rounded text-xs max-h-32 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{ __html: template.content || 'No content' }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Campaign Analytics
                </CardTitle>
                <CardDescription>
                  Performance metrics and engagement data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Analytics coming soon</p>
                  <p className="text-sm text-gray-400">
                    Execute your campaign to start tracking performance metrics
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}