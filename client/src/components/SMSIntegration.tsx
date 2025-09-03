import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Phone, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface SMSStatus {
  hasPhone: boolean;
  optInStatus: 'opted-in' | 'opted-out' | 'pending' | 'unknown';
}

interface SMSIntegrationProps {
  campaignId: string;
  leadId?: string;
  communicationType?: 'email' | 'email_sms' | 'sms';
  onCommunicationTypeChange?: (type: 'email' | 'email_sms' | 'sms') => void;
}

export function SMSIntegration({ 
  campaignId, 
  leadId, 
  communicationType = 'email',
  onCommunicationTypeChange 
}: SMSIntegrationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [customOptInMessage, setCustomOptInMessage] = useState('');

  // Get SMS status for lead if provided
  const { data: smsStatus, isLoading } = useQuery<SMSStatus>({
    queryKey: ['/api/leads', leadId, 'sms-status'],
    queryFn: () => apiRequest(`/api/leads/${leadId}/sms-status`, 'GET'),
    enabled: !!leadId,
  });

  // Send SMS opt-in mutation
  const optInMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/sms/opt-in', 'POST', {
        leadId,
        campaignId,
        optInMessage: customOptInMessage || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "SMS Opt-in Sent",
        description: "SMS opt-in request has been sent to the lead.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads', leadId, 'sms-status'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send SMS",
        description: "Could not send SMS opt-in request. Please try again.",
        variant: "destructive",
      });
      console.error('SMS opt-in error:', error);
    },
  });

  const getSMSStatusBadge = () => {
    if (!smsStatus) return null;

    if (!smsStatus.hasPhone) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          No Phone Number
        </Badge>
      );
    }

    switch (smsStatus.optInStatus) {
      case 'opted-in':
        return (
          <Badge className="flex items-center gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            SMS Enabled
          </Badge>
        );
      case 'opted-out':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            SMS Declined
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Waiting Response
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Not Requested
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communication Settings
          {leadId && getSMSStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Communication Type</Label>
            <Select 
              value={communicationType} 
              onValueChange={(value: 'email' | 'email_sms' | 'sms') => onCommunicationTypeChange?.(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email Only</SelectItem>
                <SelectItem value="email_sms">Email → SMS Handover</SelectItem>
                <SelectItem value="sms">SMS Only</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {communicationType === 'email' && "Campaign will use email communication only."}
              {communicationType === 'email_sms' && "Start with email, offer SMS option if customer shows interest."}
              {communicationType === 'sms' && "Campaign will use SMS communication only."}
            </div>
          </div>

          {communicationType === 'email_sms' && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="space-y-3">
                <div className="text-sm font-medium">Email → SMS Handover</div>
                <div className="text-sm text-muted-foreground">
                  When a customer responds positively to your emails or shows interest, 
                  the system will automatically offer SMS communication for faster responses.
                </div>
                <div className="text-xs text-muted-foreground">
                  Default message: &ldquo;Would you like to continue this conversation via text? 
                  Reply YES to receive SMS updates about your automotive interests.&rdquo;
                </div>
              </div>
            </div>
          )}

          {leadId && smsStatus && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Lead SMS Status</Label>
                <div className="p-3 border rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Phone Number:</span>
                      <div className="text-muted-foreground">
                        {smsStatus.hasPhone ? "Available" : "Not provided"}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">SMS Status:</span>
                      <div className="text-muted-foreground">
                        {smsStatus.optInStatus === 'opted-in' && "Customer opted in for SMS"}
                        {smsStatus.optInStatus === 'opted-out' && "Customer declined SMS"}
                        {smsStatus.optInStatus === 'pending' && "Waiting for customer response"}
                        {smsStatus.optInStatus === 'unknown' && "SMS not requested yet"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {smsStatus.hasPhone && smsStatus.optInStatus === 'unknown' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Custom Opt-in Message (Optional)</Label>
                    <Textarea
                      placeholder="Enter a custom SMS opt-in message or leave empty to use default"
                      value={customOptInMessage}
                      onChange={(e) => setCustomOptInMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    onClick={() => optInMutation.mutate()}
                    disabled={optInMutation.isPending}
                    className="w-full"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Send SMS Opt-in Request
                  </Button>
                </div>
              )}

              {smsStatus.optInStatus === 'pending' && (
                <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <Clock className="h-4 w-4 inline mr-1" />
                    SMS opt-in request sent. Waiting for customer response.
                  </div>
                </div>
              )}

              {smsStatus.optInStatus === 'opted-in' && (
                <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    Customer has opted in for SMS communication. Future messages can be sent via SMS.
                  </div>
                </div>
              )}

              {smsStatus.optInStatus === 'opted-out' && (
                <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                  <div className="text-sm text-red-700 dark:text-red-300">
                    <XCircle className="h-4 w-4 inline mr-1" />
                    Customer has declined SMS communication. Continue using email only.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}