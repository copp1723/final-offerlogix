import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, TrendingUp, MessageSquare, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['/api/intelligence/dashboard'],
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p>Loading intelligence dashboard...</p>
        </div>
      </div>
    );
  }

  const data = dashboard || {
    leadScoring: { totalLeads: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, averageScore: 0 },
    predictiveOptimization: { recommendationCount: 0 },
    conversationIntelligence: { totalConversations: 0, escalationCount: 0, averageConfidence: 0 }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Brain className="h-8 w-8 mr-3 text-purple-600" />
            Intelligence Dashboard
          </h1>
          <p className="text-gray-600">AI-powered insights for automotive campaign optimization</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lead-scoring">Lead Scoring</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lead Scoring</CardTitle>
                <Target className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.leadScoring.totalLeads}</div>
                <p className="text-xs text-muted-foreground">Total Leads Analyzed</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">{data.leadScoring.hotLeads} Hot</span>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">{data.leadScoring.warmLeads} Warm</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{data.leadScoring.coldLeads} Cold</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Predictive Optimization</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.predictiveOptimization.recommendationCount}</div>
                <p className="text-xs text-muted-foreground">Active Recommendations</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversation Intelligence</CardTitle>
                <MessageSquare className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.conversationIntelligence.totalConversations}</div>
                <p className="text-xs text-muted-foreground">Active Conversations</p>
                <div className="mt-2">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">{data.conversationIntelligence.escalationCount} Escalations</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Intelligence System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-green-600">✅ Lead Scoring System</h3>
                  <p className="text-sm text-gray-600">Automotive-specific scoring with configurable profiles for dealership types</p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-green-600">✅ Predictive Optimization</h3>
                  <p className="text-sm text-gray-600">AI-powered recommendations for campaign timing, targeting, and content</p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-green-600">✅ Conversation Intelligence</h3>
                  <p className="text-sm text-gray-600">Real-time analysis of customer conversations with escalation detection</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lead-scoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Scoring Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                <p className="font-medium">Lead Scoring System Active</p>
                <p className="text-sm text-gray-600">Analyzing {data.leadScoring.totalLeads} leads with automotive-specific criteria</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictive" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Predictive Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="font-medium">Optimization Engine Active</p>
                <p className="text-sm text-gray-600">{data.predictiveOptimization.recommendationCount} recommendations generated</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-purple-500" />
                <p className="font-medium">Conversation Analysis Active</p>
                <p className="text-sm text-gray-600">Monitoring {data.conversationIntelligence.totalConversations} conversations</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}