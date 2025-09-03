import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Mail, AlertTriangle, Save } from 'lucide-react';

interface EmailSettings {
  campaignSenderName: string;
  handoverSenderName: string;
  fromEmail: string;
}

export function EmailSettingsPanel() {
  const [settings, setSettings] = useState<EmailSettings>({
    campaignSenderName: 'OneKeel Swarm',
    handoverSenderName: 'OneKeel Swarm Sales Alert',
    fromEmail: 'swarm@mg.watchdogai.us'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/email');
      if (response.ok) {
        const data = await response.json();
        setSettings({
          campaignSenderName: data.campaignSenderName || 'OneKeel Swarm',
          handoverSenderName: data.handoverSenderName || 'OneKeel Swarm Sales Alert',
          fromEmail: data.fromEmail || 'swarm@mg.watchdogai.us'
        });
      }
    } catch (error) {
      console.error('Failed to load email settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Email settings updated successfully'
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save email settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof EmailSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6">
            Loading settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Settings
        </CardTitle>
        <CardDescription>
          Configure how your emails appear to recipients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campaign Email Sender */}
        <div className="space-y-2">
          <Label htmlFor="campaignSenderName">Campaign Email Sender Name</Label>
          <Input
            id="campaignSenderName"
            value={settings.campaignSenderName}
            onChange={(e) => handleInputChange('campaignSenderName', e.target.value)}
            placeholder="e.g. ATS Global Sales Team"
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            Name shown when sending campaign emails to leads
          </p>
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            Preview: <span className="font-mono">{settings.campaignSenderName} &lt;{settings.fromEmail}&gt;</span>
          </div>
        </div>

        <Separator />

        {/* Handover Alert Sender */}
        <div className="space-y-2">
          <Label htmlFor="handoverSenderName">Sales Alert Sender Name</Label>
          <Input
            id="handoverSenderName"
            value={settings.handoverSenderName}
            onChange={(e) => handleInputChange('handoverSenderName', e.target.value)}
            placeholder="e.g. ATS Global Lead Alert System"
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            Name shown when sending handover alerts to sales team
          </p>
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            Preview: <span className="font-mono">{settings.handoverSenderName} &lt;{settings.fromEmail}&gt;</span>
          </div>
        </div>

        <Separator />

        {/* From Email Address (Read-only info) */}
        <div className="space-y-2">
          <Label>From Email Address</Label>
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
            <Mail className="h-4 w-4" />
            <span className="font-mono">{settings.fromEmail}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            This is configured by your system administrator
          </p>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Email Delivery Settings</p>
            <p className="text-blue-700 mt-1">
              Changes take effect immediately for new emails. Existing queued emails will use the previous settings.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}