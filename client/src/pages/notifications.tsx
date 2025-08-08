import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Mail, AlertTriangle, TrendingUp, Settings, Send, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface NotificationPreferences {
  emailNotifications: boolean;
  campaignAlerts: boolean;
  leadAlerts: boolean;
  systemAlerts: boolean;
  monthlyReports: boolean;
  highEngagementAlerts: boolean;
  quotaWarnings: boolean;
}

interface NotificationType {
  type: string;
  name: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
}

export default function NotificationsPage() {
  const [testNotificationType, setTestNotificationType] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user ID (in real app, this would come from auth context)
  const userId = "075f86dc-d36e-4ef2-ab61-2919f9468515"; // Default user ID for demo

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: [`/api/notifications/preferences/${userId}`],
  });

  const { data: notificationTypes, isLoading: typesLoading } = useQuery({
    queryKey: ["/api/notifications/types"],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: NotificationPreferences) => {
      return await apiRequest(`/api/notifications/preferences/${userId}`, "PUT", newPreferences);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notification preferences updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/preferences/${userId}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notification preferences",
        variant: "destructive",
      });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (type: string) => {
      return await apiRequest(`/api/notifications/test/${userId}`, "POST", { type });
    },
    onSuccess: (data) => {
      toast({
        title: "Test Notification Sent",
        description: `${data.type} notification sent successfully to your email`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive",
      });
    },
  });

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences?.preferences) return;
    
    const newPreferences = {
      ...preferences.preferences,
      [key]: value,
    };
    updatePreferencesMutation.mutate(newPreferences);
  };

  const handleSendTest = () => {
    if (!testNotificationType) {
      toast({
        title: "Error",
        description: "Please select a notification type to test",
        variant: "destructive",
      });
      return;
    }
    sendTestMutation.mutate(testNotificationType);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Bell className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  if (preferencesLoading || typesLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Bell className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Notification Settings
        </h1>
      </div>

      <Alert>
        <Mail className="h-4 w-4" />
        <AlertTitle>Email Notifications</AlertTitle>
        <AlertDescription>
          Manage your email notification preferences for campaigns, leads, and system alerts.
          All notifications will be sent to your registered email address.
        </AlertDescription>
      </Alert>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Notification Preferences</span>
          </CardTitle>
          <CardDescription>
            Configure which notifications you want to receive via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            {[
              {
                key: 'emailNotifications' as keyof NotificationPreferences,
                label: 'Email Notifications',
                description: 'Master switch for all email notifications'
              },
              {
                key: 'campaignAlerts' as keyof NotificationPreferences,
                label: 'Campaign Alerts',
                description: 'Notifications when campaigns are executed or completed'
              },
              {
                key: 'leadAlerts' as keyof NotificationPreferences,
                label: 'Lead Alerts',
                description: 'Notifications when new leads are assigned to campaigns'
              },
              {
                key: 'systemAlerts' as keyof NotificationPreferences,
                label: 'System Alerts',
                description: 'Important system notifications and maintenance alerts'
              },
              {
                key: 'monthlyReports' as keyof NotificationPreferences,
                label: 'Monthly Reports',
                description: 'Monthly performance summaries and analytics'
              },
              {
                key: 'highEngagementAlerts' as keyof NotificationPreferences,
                label: 'High Engagement Alerts',
                description: 'Notifications when campaigns show exceptional performance'
              },
              {
                key: 'quotaWarnings' as keyof NotificationPreferences,
                label: 'Quota Warnings',
                description: 'Alerts when approaching usage limits'
              }
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <h4 className="font-medium">{item.label}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                </div>
                <Switch
                  checked={preferences?.preferences?.[item.key] || false}
                  onCheckedChange={(checked) => handlePreferenceChange(item.key, checked)}
                  disabled={updatePreferencesMutation.isPending}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Available Notification Types</span>
          </CardTitle>
          <CardDescription>
            Overview of all notification types and their purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {notificationTypes?.notificationTypes?.map((type: NotificationType) => (
              <div key={type.type} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{type.name}</h4>
                  <Badge className={getUrgencyColor(type.urgency)}>
                    <span className="flex items-center space-x-1">
                      {getUrgencyIcon(type.urgency)}
                      <span className="capitalize">{type.urgency}</span>
                    </span>
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{type.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Test Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Send className="h-5 w-5" />
            <span>Test Notifications</span>
          </CardTitle>
          <CardDescription>
            Send a test notification to verify your email configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <Select value={testNotificationType} onValueChange={setTestNotificationType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select notification type to test" />
                </SelectTrigger>
                <SelectContent>
                  {notificationTypes?.notificationTypes?.map((type: NotificationType) => (
                    <SelectItem key={type.type} value={type.type}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSendTest}
              disabled={!testNotificationType || sendTestMutation.isPending}
            >
              {sendTestMutation.isPending ? "Sending..." : "Send Test"}
            </Button>
          </div>
          
          {testNotificationType && notificationTypes?.notificationTypes && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Test Preview:</strong>{' '}
                {notificationTypes.notificationTypes.find((t: NotificationType) => t.type === testNotificationType)?.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}