import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Play, Square, Settings, Plus, Trash2, Edit, Activity, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EmailTriggerRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    from?: string | string[];
    subject?: string;
    body?: string;
    hasAttachment?: boolean;
  };
  actions: {
    createLead: boolean;
    assignCampaign?: string;
    addTags?: string[];
    setSource?: string;
    setPriority?: 'low' | 'normal' | 'high' | 'urgent';
    autoRespond?: boolean;
  };
}

interface MonitorStatus {
  running: boolean;
  connected: boolean;
  ruleCount: number;
  enabledRules: number;
}

export function EmailMonitorDashboard() {
  const [status, setStatus] = useState<MonitorStatus>({ running: false, connected: false, ruleCount: 0, enabledRules: 0 });
  const [rules, setRules] = useState<EmailTriggerRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailTriggerRule | null>(null);

  useEffect(() => {
    loadStatus();
    loadRules();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/email-monitor/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load email monitor status:', error);
    }
  };

  const loadRules = async () => {
    try {
      const response = await fetch('/api/email-monitor/rules');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Failed to load email monitor rules:', error);
    }
  };

  const startMonitoring = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/email-monitor/start', { method: 'POST' });
      if (response.ok) {
        toast({ title: 'Success', description: 'Email monitoring started successfully' });
        await loadStatus();
      } else {
        throw new Error('Failed to start monitoring');
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to start email monitoring. Check IMAP configuration.',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const stopMonitoring = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/email-monitor/stop', { method: 'POST' });
      if (response.ok) {
        toast({ title: 'Success', description: 'Email monitoring stopped successfully' });
        await loadStatus();
      } else {
        throw new Error('Failed to stop monitoring');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to stop email monitoring', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/email-monitor/rules/${ruleId}`, { method: 'DELETE' });
      if (response.ok) {
        toast({ title: 'Success', description: 'Email rule deleted successfully' });
        await loadRules();
        await loadStatus();
      } else {
        throw new Error('Failed to delete rule');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete email rule', variant: 'destructive' });
    }
  };

  const saveRule = async (rule: Partial<EmailTriggerRule>) => {
    try {
      const response = await fetch('/api/email-monitor/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Email rule saved successfully' });
        await loadRules();
        await loadStatus();
        setShowRuleDialog(false);
        setEditingRule(null);
      } else {
        throw new Error('Failed to save rule');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save email rule', variant: 'destructive' });
    }
  };

  const getStatusBadge = () => {
    if (status.running && status.connected) {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Running</Badge>;
    } else if (status.running) {
      return <Badge className="bg-yellow-100 text-yellow-800"><Activity className="h-3 w-3 mr-1" />Starting</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Stopped</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Mail className="h-8 w-8 mr-3 text-blue-600" />
            Email Monitor Dashboard
          </h1>
          <p className="text-gray-600">Monitor incoming emails and automatically process leads</p>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Monitor Status</span>
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{status.ruleCount}</div>
              <div className="text-sm text-gray-600">Total Rules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{status.enabledRules}</div>
              <div className="text-sm text-gray-600">Active Rules</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${status.connected ? 'text-green-600' : 'text-red-600'}`}>
                {status.connected ? 'Online' : 'Offline'}
              </div>
              <div className="text-sm text-gray-600">Connection</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${status.running ? 'text-green-600' : 'text-gray-600'}`}>
                {status.running ? 'Active' : 'Inactive'}
              </div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!status.running ? (
              <Button 
                onClick={startMonitoring} 
                disabled={loading}
                className="flex items-center"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Monitoring
              </Button>
            ) : (
              <Button 
                onClick={stopMonitoring} 
                disabled={loading}
                variant="destructive"
                className="flex items-center"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Monitoring
              </Button>
            )}
            
            <Button 
              onClick={loadStatus} 
              variant="outline"
              className="flex items-center"
            >
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Email Processing Rules</span>
            <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingRule ? 'Edit Email Rule' : 'Add Email Rule'}
                  </DialogTitle>
                </DialogHeader>
                <EmailRuleForm 
                  rule={editingRule} 
                  onSave={saveRule}
                  onCancel={() => {
                    setShowRuleDialog(false);
                    setEditingRule(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No email rules configured</p>
              <p className="text-sm">Add rules to automatically process incoming emails</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      {rule.enabled ? (
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                        {rule.conditions.subject && (
                          <div>Subject: {typeof rule.conditions.subject === 'string' ? rule.conditions.subject : String(rule.conditions.subject)}</div>
                        )}
                        {rule.conditions.from && (
                          <div>From: {Array.isArray(rule.conditions.from) ? rule.conditions.from.join(', ') : rule.conditions.from}</div>
                        )}
                        {rule.conditions.body && (
                          <div>Body: {typeof rule.conditions.body === 'string' ? rule.conditions.body : String(rule.conditions.body)}</div>
                        )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.actions.createLead && <Badge variant="outline" className="mr-1">Create Lead</Badge>}
                      {rule.actions.autoRespond && <Badge variant="outline" className="mr-1">Auto Respond</Badge>}
                      {rule.actions.assignCampaign && <Badge variant="outline" className="mr-1">Assign Campaign</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingRule(rule);
                            setShowRuleDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Email Rule Form Component
function EmailRuleForm({ 
  rule, 
  onSave, 
  onCancel 
}: { 
  rule: EmailTriggerRule | null;
  onSave: (rule: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    id: rule?.id || `rule-${Date.now()}`,
    name: rule?.name || '',
    enabled: rule?.enabled ?? true,
    conditions: {
      subject: rule?.conditions.subject || '',
      from: Array.isArray(rule?.conditions.from) ? rule.conditions.from.join(', ') : rule?.conditions.from || '',
      body: rule?.conditions.body || '',
    },
    actions: {
      createLead: rule?.actions.createLead ?? true,
      setSource: rule?.actions.setSource || 'email-monitor',
      setPriority: rule?.actions.setPriority || 'normal',
      autoRespond: rule?.actions.autoRespond ?? true,
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const ruleData = {
      ...formData,
      conditions: {
        ...formData.conditions,
        from: formData.conditions.from ? formData.conditions.from.split(',').map(s => s.trim()) : undefined
      }
    };
    
    onSave(ruleData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Rule Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Automotive Inquiry"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={formData.enabled}
          onCheckedChange={(enabled) => setFormData(prev => ({ ...prev, enabled }))}
        />
        <Label>Rule Enabled</Label>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Conditions (at least one required)</h4>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="subject">Subject Contains</Label>
            <Input
              id="subject"
              value={formData.conditions.subject}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                conditions: { ...prev.conditions, subject: e.target.value }
              }))}
              placeholder="e.g., car|auto|vehicle|financing"
            />
          </div>

          <div>
            <Label htmlFor="from">From Email Contains</Label>
            <Input
              id="from"
              value={formData.conditions.from}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                conditions: { ...prev.conditions, from: e.target.value }
              }))}
              placeholder="e.g., gmail.com, customer@example.com"
            />
          </div>

          <div>
            <Label htmlFor="body">Body Contains</Label>
            <Input
              id="body"
              value={formData.conditions.body}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                conditions: { ...prev.conditions, body: e.target.value }
              }))}
              placeholder="e.g., interested|financing|loan"
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Actions</h4>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.actions.createLead}
              onCheckedChange={(createLead) => setFormData(prev => ({ 
                ...prev, 
                actions: { ...prev.actions, createLead }
              }))}
            />
            <Label>Create Lead</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.actions.autoRespond}
              onCheckedChange={(autoRespond) => setFormData(prev => ({ 
                ...prev, 
                actions: { ...prev.actions, autoRespond }
              }))}
            />
            <Label>Send AI Auto-Response</Label>
          </div>

          <div>
            <Label htmlFor="source">Lead Source</Label>
            <Input
              id="source"
              value={formData.actions.setSource}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                actions: { ...prev.actions, setSource: e.target.value }
              }))}
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select value={formData.actions.setPriority} onValueChange={(priority) => 
              setFormData(prev => ({ 
                ...prev, 
                actions: { ...prev.actions, setPriority: priority as any }
              }))
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Rule
        </Button>
      </div>
    </form>
  );
}