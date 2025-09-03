import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Users, 
  Plus, 
  X, 
  Settings, 
  Target, 
  Clock,
  TrendingUp,
  AlertTriangle,
  Phone
} from "lucide-react";

interface HandoverRecipient {
  name: string;
  email: string;
  role: string;
}

interface HandoverCriteria {
  qualificationThreshold: number;
  intentScore: number;
  engagementThreshold: number;
  messageCount: number;
  timeSpentMinutes: number;
  goalCompletionRequired: string[];
  handoverRecipients: HandoverRecipient[];
  automotiveKeywords: string[];
  urgentKeywords: string[];
}

interface HandoverConfigProps {
  handoverCriteria?: HandoverCriteria;
  onHandoverCriteriaChange?: (criteria: HandoverCriteria) => void;
  campaignGoals?: string[];
}

const defaultHandoverCriteria: HandoverCriteria = {
  qualificationThreshold: 75,
  intentScore: 70,
  engagementThreshold: 60,
  messageCount: 5,
  timeSpentMinutes: 10,
  goalCompletionRequired: ['test_drive_interest', 'pricing_inquiry', 'financing_discussion'],
  handoverRecipients: [
    { name: 'Sales Manager', email: 'sales@dealership.com', role: 'sales' },
    { name: 'Service Manager', email: 'service@dealership.com', role: 'service' },
    { name: 'Finance Manager', email: 'finance@dealership.com', role: 'finance' }
  ],
  automotiveKeywords: [
    'test drive', 'financing', 'trade-in', 'lease', 'warranty',
    'maintenance', 'service appointment', 'parts', 'insurance'
  ],
  urgentKeywords: [
    'urgent', 'ASAP', 'today', 'immediately', 'emergency', 'breakdown'
  ]
};

export default function HandoverConfig({
  handoverCriteria = defaultHandoverCriteria,
  onHandoverCriteriaChange,
  campaignGoals = ['test_drive_interest', 'pricing_inquiry', 'financing_discussion', 'service_booking']
}: HandoverConfigProps) {
  const [newRecipient, setNewRecipient] = useState<HandoverRecipient>({
    name: '',
    email: '',
    role: 'sales'
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [keywordType, setKeywordType] = useState<'automotive' | 'urgent'>('automotive');
  const [isRecipientDialogOpen, setIsRecipientDialogOpen] = useState(false);
  const [isKeywordDialogOpen, setIsKeywordDialogOpen] = useState(false);

  const updateCriteria = (key: keyof HandoverCriteria, value: any) => {
    const updated = { ...handoverCriteria, [key]: value };
    onHandoverCriteriaChange?.(updated);
  };

  const addRecipient = () => {
    if (newRecipient.name && newRecipient.email) {
      updateCriteria('handoverRecipients', [
        ...handoverCriteria.handoverRecipients,
        newRecipient,
      ]);
      setNewRecipient({ name: '', email: '', role: 'sales' });
      setIsRecipientDialogOpen(false);
    }
  };

  const removeRecipient = (index: number) => {
    updateCriteria('handoverRecipients', 
      handoverCriteria.handoverRecipients.filter((_, i) => i !== index)
    );
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      const targetArray = keywordType === 'automotive' 
        ? handoverCriteria.automotiveKeywords 
        : handoverCriteria.urgentKeywords;
      
      const targetKey = keywordType === 'automotive' 
        ? 'automotiveKeywords' 
        : 'urgentKeywords';
        
      updateCriteria(targetKey, [...targetArray, newKeyword.trim().toLowerCase()]);
      setNewKeyword('');
      setIsKeywordDialogOpen(false);
    }
  };

  const removeKeyword = (keyword: string, type: 'automotive' | 'urgent') => {
    const targetArray = type === 'automotive' 
      ? handoverCriteria.automotiveKeywords 
      : handoverCriteria.urgentKeywords;
    
    const targetKey = type === 'automotive' 
      ? 'automotiveKeywords' 
      : 'urgentKeywords';
      
    updateCriteria(targetKey, targetArray.filter(k => k !== keyword));
  };

  const toggleGoalRequirement = (goal: string) => {
    const current = handoverCriteria.goalCompletionRequired;
    updateCriteria(
      'goalCompletionRequired',
      current.includes(goal)
        ? current.filter(g => g !== goal)
        : [...current, goal]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'sales': return 'bg-blue-100 text-blue-800';
      case 'service': return 'bg-green-100 text-green-800';
      case 'finance': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-6 w-6 text-blue-600" />
        <h3 className="text-2xl font-bold">Handover Configuration</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threshold Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Qualification Thresholds
            </CardTitle>
            <CardDescription>
              Configure when conversations should be handed over to human agents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-medium">
                Qualification Threshold: {handoverCriteria.qualificationThreshold}%
              </Label>
              <Slider
                value={[handoverCriteria.qualificationThreshold]}
                onValueChange={([value]) => updateCriteria('qualificationThreshold', value)}
                max={100}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                Lead qualification score required for handover
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Intent Score: {handoverCriteria.intentScore}%
              </Label>
              <Slider
                value={[handoverCriteria.intentScore]}
                onValueChange={([value]) => updateCriteria('intentScore', value)}
                max={100}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                Purchase intent indicator threshold
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Engagement Level: {handoverCriteria.engagementThreshold}%
              </Label>
              <Slider
                value={[handoverCriteria.engagementThreshold]}
                onValueChange={([value]) => updateCriteria('engagementThreshold', value)}
                max={100}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                Conversation engagement threshold
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Message Count</Label>
                <Input
                  type="number"
                  value={handoverCriteria.messageCount}
                  onChange={(e) => updateCriteria('messageCount', parseInt(e.target.value) || 0)}
                  min={1}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Time Spent (minutes)</Label>
                <Input
                  type="number"
                  value={handoverCriteria.timeSpentMinutes}
                  onChange={(e) => updateCriteria('timeSpentMinutes', parseInt(e.target.value) || 0)}
                  min={1}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goal Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Goal Requirements
            </CardTitle>
            <CardDescription>
              Select which campaign goals trigger handover when detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaignGoals.map((goal) => (
                <div key={goal} className="flex items-center justify-between">
                  <Label className="text-sm font-medium cursor-pointer">
                    {goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Label>
                  <Switch
                    checked={handoverCriteria.goalCompletionRequired.includes(goal)}
                    onCheckedChange={() => toggleGoalRequirement(goal)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Handover Recipients
            </CardTitle>
            <CardDescription>
              Configure who receives handover notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {handoverCriteria.handoverRecipients.map((recipient, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{recipient.name}</span>
                      <Badge className={getRoleColor(recipient.role)}>
                        {recipient.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{recipient.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRecipient(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Dialog open={isRecipientDialogOpen} onOpenChange={setIsRecipientDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Recipient
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Handover Recipient</DialogTitle>
                    <DialogDescription>
                      Add a new recipient for handover notifications
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="recipient-name">Name</Label>
                      <Input
                        id="recipient-name"
                        value={newRecipient.name}
                        onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Sales Manager"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipient-email">Email</Label>
                      <Input
                        id="recipient-email"
                        type="email"
                        value={newRecipient.email}
                        onChange={(e) => setNewRecipient(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="sales@dealership.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipient-role">Role</Label>
                      <Select 
                        value={newRecipient.role} 
                        onValueChange={(value) => setNewRecipient(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addRecipient} className="flex-1">Add Recipient</Button>
                      <Button variant="outline" onClick={() => setIsRecipientDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Detection Keywords
            </CardTitle>
            <CardDescription>
              Keywords that trigger different handover behaviors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Automotive Keywords */}
              <div>
                <Label className="text-sm font-medium">Automotive Keywords</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {handoverCriteria.automotiveKeywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="text-xs">
                      {keyword}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() => removeKeyword(keyword, 'automotive')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Urgent Keywords */}
              <div>
                <Label className="text-sm font-medium">Urgent Keywords</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {handoverCriteria.urgentKeywords.map((keyword) => (
                    <Badge key={keyword} variant="destructive" className="text-xs">
                      {keyword}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1 text-red-100 hover:text-red-200"
                        onClick={() => removeKeyword(keyword, 'urgent')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>

              <Dialog open={isKeywordDialogOpen} onOpenChange={setIsKeywordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Keyword
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Detection Keyword</DialogTitle>
                    <DialogDescription>
                      Add a new keyword for conversation analysis
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="keyword-type">Keyword Type</Label>
                      <Select value={keywordType} onValueChange={(value: 'automotive' | 'urgent') => setKeywordType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="automotive">Automotive</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="new-keyword">Keyword</Label>
                      <Input
                        id="new-keyword"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder="Enter keyword..."
                        onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addKeyword} className="flex-1">Add Keyword</Button>
                      <Button variant="outline" onClick={() => setIsKeywordDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}