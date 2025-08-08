import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Target, 
  Car, 
  Building, 
  Crown,
  Save,
  Plus,
  Trash2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ScoringProfile {
  id: string;
  name: string;
  type: 'dealership' | 'luxury' | 'commercial';
  description: string;
  weights: {
    response_speed: number;
    message_quality: number;
    vehicle_specificity: number;
    urgency_indicators: number;
    financial_readiness: number;
    engagement_frequency: number;
    contact_completeness: number;
    timing_patterns: number;
  };
  thresholds: {
    hot: number;
    warm: number;
  };
}

const defaultProfiles: ScoringProfile[] = [
  {
    id: 'dealership-standard',
    name: 'Standard Dealership',
    type: 'dealership',
    description: 'Balanced scoring for general automotive dealerships',
    weights: {
      response_speed: 20,
      message_quality: 15,
      vehicle_specificity: 25,
      urgency_indicators: 15,
      financial_readiness: 10,
      engagement_frequency: 5,
      contact_completeness: 5,
      timing_patterns: 5
    },
    thresholds: { hot: 70, warm: 40 }
  },
  {
    id: 'luxury-dealership',
    name: 'Luxury Dealership',
    type: 'luxury',
    description: 'Premium focus with emphasis on financial readiness and engagement quality',
    weights: {
      response_speed: 15,
      message_quality: 25,
      vehicle_specificity: 20,
      urgency_indicators: 10,
      financial_readiness: 20,
      engagement_frequency: 5,
      contact_completeness: 3,
      timing_patterns: 2
    },
    thresholds: { hot: 75, warm: 50 }
  },
  {
    id: 'commercial-fleet',
    name: 'Commercial Fleet',
    type: 'commercial',
    description: 'Volume-focused scoring for commercial and fleet sales',
    weights: {
      response_speed: 25,
      message_quality: 10,
      vehicle_specificity: 30,
      urgency_indicators: 20,
      financial_readiness: 5,
      engagement_frequency: 5,
      contact_completeness: 3,
      timing_patterns: 2
    },
    thresholds: { hot: 65, warm: 35 }
  },
  {
    id: 'subprime-automotive',
    name: 'Sub-Prime Automotive',
    type: 'dealership',
    description: 'Optimized scoring for sub-prime automotive customers with focus on engagement and urgency',
    weights: {
      response_speed: 30,
      message_quality: 10,
      vehicle_specificity: 15,
      urgency_indicators: 25,
      financial_readiness: 5,
      engagement_frequency: 10,
      contact_completeness: 3,
      timing_patterns: 2
    },
    thresholds: { hot: 60, warm: 30 }
  }
];

export default function ScoringConfigPage() {
  const [selectedProfile, setSelectedProfile] = useState<ScoringProfile>(defaultProfiles[0]);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles = defaultProfiles } = useQuery({
    queryKey: ['/api/intelligence/scoring-profiles']
  });

  const saveMutation = useMutation({
    mutationFn: async (profile: ScoringProfile) => {
      return apiRequest(`/api/intelligence/scoring-profiles`, 'POST', profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/intelligence/scoring-profiles'] });
      toast({ title: "Success", description: "Scoring profile saved successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save scoring profile", variant: "destructive" });
    }
  });

  const handleWeightChange = (criterion: string, value: number[]) => {
    setSelectedProfile(prev => ({
      ...prev,
      weights: {
        ...prev.weights,
        [criterion]: value[0]
      }
    }));
  };

  const handleThresholdChange = (threshold: 'hot' | 'warm', value: number[]) => {
    setSelectedProfile(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [threshold]: value[0]
      }
    }));
  };

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'luxury': return <Crown className="h-4 w-4" />;
      case 'commercial': return <Building className="h-4 w-4" />;
      default: return <Car className="h-4 w-4" />;
    }
  };

  const getProfileColor = (type: string) => {
    switch (type) {
      case 'luxury': return 'bg-purple-100 text-purple-800';
      case 'commercial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Settings className="h-8 w-8 mr-3 text-blue-600" />
            Lead Scoring Configuration
          </h1>
          <p className="text-gray-600">Configure scoring weights and thresholds for different automotive use cases</p>
        </div>
        <Button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Selection */}
        <div className="space-y-4">
          <h3 className="font-medium">Scoring Profiles</h3>
          {(profiles as ScoringProfile[]).map((profile: ScoringProfile) => (
            <Card 
              key={profile.id} 
              className={`cursor-pointer transition-colors ${selectedProfile.id === profile.id ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelectedProfile(profile)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-2">
                  {getProfileIcon(profile.type)}
                  <span className="font-medium">{profile.name}</span>
                </div>
                <Badge className={getProfileColor(profile.type)} variant="outline">
                  {profile.type}
                </Badge>
                <p className="text-xs text-gray-500 mt-2">{profile.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="weights" className="space-y-4">
            <TabsList>
              <TabsTrigger value="weights">Scoring Weights</TabsTrigger>
              <TabsTrigger value="thresholds">Priority Thresholds</TabsTrigger>
              <TabsTrigger value="preview">Preview & Test</TabsTrigger>
            </TabsList>

            <TabsContent value="weights" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    {selectedProfile.name} - Scoring Weights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(selectedProfile.weights).map(([criterion, weight]) => (
                    <div key={criterion} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium capitalize">
                          {criterion.replace('_', ' ')}
                        </Label>
                        <span className="text-sm text-gray-500">{weight}%</span>
                      </div>
                      <Input
                        type="range"
                        min="0"
                        max="50"
                        step="5"
                        value={weight}
                        onChange={(e) => handleWeightChange(criterion, [parseInt(e.target.value)])}
                        disabled={!isEditing}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500">
                        {criterion === 'response_speed' && 'How quickly the lead responds to initial contact'}
                        {criterion === 'message_quality' && 'Quality and detail level of lead messages'}
                        {criterion === 'vehicle_specificity' && 'Specific interest in particular vehicles or features'}
                        {criterion === 'urgency_indicators' && 'Language indicating immediate purchase intent'}
                        {criterion === 'financial_readiness' && 'Evidence of financing or budget preparation'}
                        {criterion === 'engagement_frequency' && 'How often the lead initiates contact'}
                        {criterion === 'contact_completeness' && 'Completeness of contact information provided'}
                        {criterion === 'timing_patterns' && 'Contact timing indicating serious interest'}
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Total Weight: {Object.values(selectedProfile.weights).reduce((a, b) => a + b, 0)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="thresholds" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Priority Thresholds</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium">Hot Lead Threshold</Label>
                        <span className="text-sm text-gray-500">{selectedProfile.thresholds.hot}%</span>
                      </div>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={selectedProfile.thresholds.hot}
                        onChange={(e) => handleThresholdChange('hot', [parseInt(e.target.value)])}
                        disabled={!isEditing}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">Leads scoring above this threshold are marked as "Hot"</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium">Warm Lead Threshold</Label>
                        <span className="text-sm text-gray-500">{selectedProfile.thresholds.warm}%</span>
                      </div>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={selectedProfile.thresholds.warm}
                        onChange={(e) => handleThresholdChange('warm', [parseInt(e.target.value)])}
                        disabled={!isEditing}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">Leads scoring above this threshold are marked as "Warm"</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Priority Classification</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                          Hot Leads
                        </span>
                        <span>{selectedProfile.thresholds.hot}%+ score</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                          Warm Leads
                        </span>
                        <span>{selectedProfile.thresholds.warm}% - {selectedProfile.thresholds.hot - 1}% score</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                          Cold Leads
                        </span>
                        <span>Below {selectedProfile.thresholds.warm}% score</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuration Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Profile Summary</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          {getProfileIcon(selectedProfile.type)}
                          <span className="font-medium">{selectedProfile.name}</span>
                          <Badge className={getProfileColor(selectedProfile.type)}>
                            {selectedProfile.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{selectedProfile.description}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Top Weighted Criteria</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedProfile.weights)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([criterion, weight]) => (
                            <div key={criterion} className="flex justify-between items-center">
                              <span className="text-sm capitalize">{criterion.replace('_', ' ')}</span>
                              <span className="text-sm font-medium">{weight}%</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="pt-4">
                        <Button 
                          onClick={() => saveMutation.mutate(selectedProfile)}
                          disabled={saveMutation.isPending}
                          className="w-full"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}