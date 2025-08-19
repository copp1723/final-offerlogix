import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Loader2, Plus, Settings, Users, Brain, MessageSquare, Star, Target, Zap } from "lucide-react";

/**
 * AI Personas Management Page
 * 
 * Provides a comprehensive interface for managing AI personas in the
 * multi-persona OfferLogix system. Allows users to:
 * - View all configured personas
 * - Create new personas
 * - Edit existing personas
 * - Manage knowledge base associations
 * - Set default personas
 * - Monitor persona performance
 */

interface Persona {
  id: string;
  name: string;
  description?: string;
  targetAudience: string;
  industry: string;
  tonality: string;
  personality?: string;
  communicationStyle: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  responseGuidelines: string[];
  escalationCriteria: string[];
  preferredChannels: string[];
  handoverSettings: Record<string, any>;
  knowledgeBaseAccessLevel: 'campaign_only' | 'client_all' | 'persona_filtered';
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  metadata: Record<string, any>;
  knowledgeBases?: Array<{
    id: string;
    name: string;
    accessLevel: string;
    priority: number;
  }>;
  campaignCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // Note: dialog state not currently used; model selection UI removed per request

  // Load personas on component mount
  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/personas?includeKnowledgeBases=true&includeCampaignCounts=true', {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': '00000000-0000-0000-0000-000000000001'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load personas');
      }

      const data = await response.json();
      setPersonas(data.data || []);
    } catch (error) {
      console.error('Error loading personas:', error);
      setError(error instanceof Error ? error.message : 'Failed to load personas');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPersonas = async () => {
    try {
      setIsCreating(true);
      setError(null);

      const response = await fetch('/api/personas/create-defaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': '00000000-0000-0000-0000-000000000001'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create default personas');
      }

      await loadPersonas();
    } catch (error) {
      console.error('Error creating default personas:', error);
      setError(error instanceof Error ? error.message : 'Failed to create default personas');
    } finally {
      setIsCreating(false);
    }
  };

  const togglePersonaStatus = async (personaId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/personas/${personaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': '00000000-0000-0000-0000-000000000001'
        },
        body: JSON.stringify({ isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update persona status');
      }

      await loadPersonas();
    } catch (error) {
      console.error('Error updating persona status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update persona');
    }
  };

  const setDefaultPersona = async (personaId: string) => {
    try {
      const response = await fetch(`/api/personas/${personaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': '00000000-0000-0000-0000-000000000001'
        },
        body: JSON.stringify({ isDefault: true })
      });

      if (!response.ok) {
        throw new Error('Failed to set default persona');
      }

      await loadPersonas();
    } catch (error) {
      console.error('Error setting default persona:', error);
      setError(error instanceof Error ? error.message : 'Failed to set default persona');
    }
  };

  const getPersonaIcon = (targetAudience: string) => {
    switch (targetAudience?.toLowerCase()) {
      case 'dealers':
        return <Target className="h-5 w-5 text-blue-600" />;
      case 'vendors':
        return <Users className="h-5 w-5 text-green-600" />;
      case 'customers':
        return <MessageSquare className="h-5 w-5 text-purple-600" />;
      default:
        return <Brain className="h-5 w-5 text-gray-600" />;
    }
  };

  const getPersonaStatusColor = (persona: Persona) => {
    if (!persona.isActive) return 'bg-gray-100 text-gray-600';
    if (persona.isDefault) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getPersonaStatusText = (persona: Persona) => {
    if (!persona.isActive) return 'Inactive';
    if (persona.isDefault) return 'Default';
    return 'Active';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading personas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Personas</h1>
            <p className="text-gray-600 mt-2">
              Manage AI personas for different target audiences and use cases
            </p>
          </div>
          <div className="flex items-center gap-4">
            {personas.length === 0 && (
              <Button 
                onClick={createDefaultPersonas} 
                disabled={isCreating}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Setup Default Personas
                  </>
                )}
              </Button>
            )}
            <Button disabled title="Create persona coming soon">
              <Plus className="h-4 w-4 mr-2" />
              New Persona
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Content */}
        {personas.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No AI Personas Configured</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Get started by setting up default personas for your OfferLogix system.
                This will create specialized AI agents for reaching automotive dealerships with your software solutions.
              </p>
              <Button 
                onClick={createDefaultPersonas} 
                disabled={isCreating}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Setup Default Personas
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {personas.map((persona) => (
                  <Card key={persona.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {getPersonaIcon(persona.targetAudience)}
                          <div>
                            <CardTitle className="text-lg font-semibold">
                              {persona.name}
                              {persona.isDefault && (
                                <Star className="inline h-4 w-4 text-yellow-500 ml-2" />
                              )}
                            </CardTitle>
                            <CardDescription className="text-sm">
                              {persona.targetAudience} • {persona.communicationStyle}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={getPersonaStatusColor(persona)}>
                          {getPersonaStatusText(persona)}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600">
                        {persona.description || persona.personality?.substring(0, 100) + '...' || 'No description available'}
                      </p>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Tone:</span>
                          <span className="font-medium capitalize">{persona.tonality}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">KB Access:</span>
                          <span className="font-medium capitalize">{persona.knowledgeBaseAccessLevel.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Knowledge Bases:</span>
                          <span className="font-medium">{persona.knowledgeBases?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Campaigns:</span>
                          <span className="font-medium">{persona.campaignCount || 0}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={persona.isActive}
                            onCheckedChange={(checked) => togglePersonaStatus(persona.id, checked)}
                          />
                          <Label className="text-sm">Active</Label>
                        </div>

                        <div className="flex items-center gap-2">
                          {!persona.isDefault && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDefaultPersona(persona.id)}
                            >
                              Set Default
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            title="Editing coming soon"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Persona Performance Metrics</CardTitle>
                  <CardDescription>
                    Monitor how your AI personas are performing across campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Performance metrics coming soon...</p>
                    <p className="text-sm">Track conversation quality, engagement rates, and more</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Global Persona Settings</CardTitle>
                  <CardDescription>
                    Configure default settings and behaviors for all personas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Settings className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Global settings coming soon...</p>
                    <p className="text-sm">Configure default AI settings</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Dialogs would go here - Create/Edit forms */}
        {/* For now, showing placeholder structure */}
        
      </div>
    </div>
  );
}