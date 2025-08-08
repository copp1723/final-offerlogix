import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Brain, 
  TrendingUp, 
  MessageSquare, 
  Target, 
  Zap, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Users,
  Activity,
  ArrowUpRight,
  Settings
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface IntelligenceDashboard {
  leadScoring: {
    totalLeads: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    averageScore: number;
    topScores: Array<{
      leadId: string;
      totalScore: number;
      priority: 'hot' | 'warm' | 'cold';
      factors: string[];
    }>;
  };
  predictiveOptimization: {
    insights: any;
    recommendationCount: number;
  };
  conversationIntelligence: {
    totalConversations: number;
    escalationCount: number;
    highUrgency: number;
    readyToBuy: number;
    averageConfidence: number;
  };
}

interface OptimizationRecommendation {
  type: 'timing' | 'sequence' | 'targeting' | 'content';
  confidence: number;
  recommendation: string;
  reasoning: string;
  expectedImprovement: number;
  implementation: string;
}

interface ConversationAnalysis {
  conversationId: string;
  leadId: string;
  mood: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  intent: 'research' | 'comparison' | 'ready_to_buy' | 'price_focused' | 'undecided';
  buyingSignals: string[];
  riskFactors: string[];
  recommendedAction: 'continue' | 'escalate' | 'schedule_call' | 'send_offer' | 'urgent_followup';
  confidence: number;
  nextSteps: string[];
}

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/intelligence/dashboard'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Extract recommendations from dashboard data instead of separate endpoints
  const insights = dashboard?.predictiveOptimization?.insights;
  const recommendations = insights ? [
    ...(insights.targetingRecommendations?.map((rec: any) => ({
      type: 'targeting',
      confidence: Math.round(rec.expectedConversion),
      recommendation: `Target ${rec.segment} with ${rec.messagingFocus.toLowerCase()}`,
      reasoning: `Focus on ${rec.vehicleTypes.join(', ')} vehicles`,
      expectedImprovement: rec.expectedConversion,
      implementation: `Create campaigns targeting ${rec.segment} segment`
    })) ?? []),
    ...(insights.optimalSendTimes?.slice(0, 2).map((time: any) => ({
      type: 'timing',
      confidence: time.confidence,
      recommendation: `Send campaigns on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][time.dayOfWeek]} at ${time.hour}:00`,
      reasoning: `${time.confidence}% confidence with ${time.expectedOpenRate}% expected open rate`,
      expectedImprovement: time.expectedOpenRate,
      implementation: `Schedule campaigns for ${time.hour}:00 on ${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][time.dayOfWeek]}`
    })) ?? []),
    ...(insights.seasonalAdjustments?.slice(0, 2).map((adj: any) => ({
      type: 'content',
      confidence: 75,
      recommendation: adj.adjustment,
      reasoning: adj.reasoning,
      expectedImprovement: 25,
      implementation: `Adjust campaign messaging for ${adj.adjustment.toLowerCase()}`
    })) ?? [])
  ] : [];

  // Mock escalation candidates based on conversation intelligence
  const escalationCandidates = dashboard?.conversationIntelligence ? [
    {
      conversationId: '1',
      leadId: 'escalation-lead-1', 
      mood: 'frustrated',
      urgency: 'high',
      intent: 'ready_to_buy',
      buyingSignals: ['Price comparison request', 'Timeline urgency'],
      riskFactors: ['Competitor mention', 'Budget concerns'],
      recommendedAction: 'urgent_followup',
      confidence: 85,
      nextSteps: ['Schedule immediate callback', 'Send pricing options']
    }
  ] : [];

  // Mock active conversations
  const activeConversations = dashboard?.conversationIntelligence ? [
    {
      conversationId: '1',
      leadId: 'active-lead-1',
      mood: 'positive',
      urgency: 'medium', 
      intent: 'comparison',
      buyingSignals: ['Asking about features', 'Test drive interest'],
      riskFactors: ['Shopping competitors'],
      recommendedAction: 'continue',
      confidence: 70,
      nextSteps: ['Send vehicle comparison', 'Offer test drive']
    }
  ] : [];

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading intelligence dashboard...</p>
        </div>
      </div>
    );
  }

  const getDashboard = (): IntelligenceDashboard => {
    if (!dashboard) {
      return {
        leadScoring: { totalLeads: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, averageScore: 0, topScores: [] },
        predictiveOptimization: { insights: {}, recommendationCount: 0 },
        conversationIntelligence: { totalConversations: 0, escalationCount: 0, highUrgency: 0, readyToBuy: 0, averageConfidence: 0 }
      };
    }
    return dashboard as IntelligenceDashboard;
  };

  const dashboardData = getDashboard();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'hot': return 'bg-red-100 text-red-800';
      case 'warm': return 'bg-orange-100 text-orange-800';
      case 'cold': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'excited': return '🎉';
      case 'positive': return '😊';
      case 'neutral': return '😐';
      case 'negative': return '😞';
      case 'frustrated': return '😤';
      default: return '😐';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <TabsTrigger value="predictive">Predictive Optimization</TabsTrigger>
          <TabsTrigger value="conversations">Conversation Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lead Scoring</CardTitle>
                <Target className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.leadScoring.totalLeads}</div>
                <p className="text-xs text-muted-foreground">Total Leads Analyzed</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge className="bg-red-100 text-red-800">{dashboardData.leadScoring.hotLeads} Hot</Badge>
                  <Badge className="bg-orange-100 text-orange-800">{dashboardData.leadScoring.warmLeads} Warm</Badge>
                  <Badge className="bg-blue-100 text-blue-800">{dashboardData.leadScoring.coldLeads} Cold</Badge>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-sm">
                    <span>Avg Score</span>
                    <span>{Math.round(dashboardData.leadScoring.averageScore)}%</span>
                  </div>
                  <Progress value={dashboardData.leadScoring.averageScore} className="mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Predictive Optimization</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.predictiveOptimization.recommendationCount}</div>
                <p className="text-xs text-muted-foreground">Active Recommendations</p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    View Optimizations
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversation Intelligence</CardTitle>
                <MessageSquare className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.conversationIntelligence.totalConversations}</div>
                <p className="text-xs text-muted-foreground">Active Conversations</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge className="bg-red-100 text-red-800">{dashboardData.conversationIntelligence.escalationCount} Escalations</Badge>
                  <Badge className="bg-green-100 text-green-800">{dashboardData.conversationIntelligence.readyToBuy} Ready to Buy</Badge>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-sm">
                    <span>Confidence</span>
                    <span>{Math.round(dashboardData.conversationIntelligence.averageConfidence)}%</span>
                  </div>
                  <Progress value={dashboardData.conversationIntelligence.averageConfidence} className="mt-1" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Priority Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 text-orange-600" />
                Priority Actions Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.isArray(escalationCandidates) && escalationCandidates.slice(0, 5).map((candidate: ConversationAnalysis, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{getMoodIcon(candidate.mood)}</span>
                      <div>
                        <div className="font-medium">Conversation {candidate.conversationId.slice(0, 8)}</div>
                        <div className="text-sm text-gray-600">
                          {candidate.buyingSignals.length} buying signals • {candidate.recommendedAction}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getUrgencyColor(candidate.urgency)}>{candidate.urgency}</Badge>
                      <Button size="sm">Take Action</Button>
                    </div>
                  </div>
                ))}
                {(!escalationCandidates || !Array.isArray(escalationCandidates) || escalationCandidates.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No urgent actions required</p>
                    <p className="text-sm">All conversations are being handled appropriately</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lead-scoring" className="space-y-6">
          {/* Lead Scoring Analytics Header */}
          <div className="text-center py-8">
            <Target className="h-16 w-16 mx-auto mb-4 text-blue-500" />
            <h2 className="text-2xl font-bold mb-2">Lead Scoring System Active</h2>
            <p className="text-gray-600">Analyzing {dashboardData.leadScoring.totalLeads} leads with automotive-specific criteria</p>
          </div>

          {/* Lead Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-red-600">Hot Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboardData.leadScoring.hotLeads}</div>
                <p className="text-sm text-gray-600">Score: 80-100%</p>
                <p className="text-xs text-gray-500 mt-2">Ready for immediate contact</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-orange-600">Warm Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboardData.leadScoring.warmLeads}</div>
                <p className="text-sm text-gray-600">Score: 50-79%</p>
                <p className="text-xs text-gray-500 mt-2">Nurture with targeted campaigns</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-600">Cold Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboardData.leadScoring.coldLeads}</div>
                <p className="text-sm text-gray-600">Score: 0-49%</p>
                <p className="text-xs text-gray-500 mt-2">Long-term nurturing required</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lead Scoring Details</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.leadScoring.topScores && dashboardData.leadScoring.topScores.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Key Factors</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.leadScoring.topScores.map((lead, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{lead.leadId.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold">{lead.totalScore}%</span>
                            <Progress value={lead.totalScore} className="w-16" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(lead.priority)}>{lead.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {lead.factors?.slice(0, 2).map((factor, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{factor}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">Just now</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-2" />
                  <p>No lead scoring data available</p>
                  <p className="text-sm">Lead scores will appear as contacts are processed</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictive" className="space-y-6">
          {/* Predictive Optimization Header */}
          <div className="text-center py-8">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold mb-2">Optimization Engine Active</h2>
            <p className="text-gray-600">{dashboardData.predictiveOptimization.recommendationCount} recommendations generated</p>
          </div>

          {/* AI Optimization Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>AI Optimization Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(recommendations) && recommendations.map((rec: OptimizationRecommendation, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="capitalize">{rec.type}</Badge>
                        <span className="font-medium">{rec.confidence}% Confidence</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">+{rec.expectedImprovement}% Expected</Badge>
                    </div>
                    <h4 className="font-medium mb-1">{rec.recommendation}</h4>
                    <p className="text-sm text-gray-600 mb-2">{rec.reasoning}</p>
                    <div className="bg-blue-50 p-3 rounded text-sm">
                      <strong>Implementation:</strong> {rec.implementation}
                    </div>
                  </div>
                ))}
                {(!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                    <p>Analyzing campaign data...</p>
                    <p className="text-sm">Recommendations will appear as more data is collected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Optimization Insights */}
          {dashboardData?.predictiveOptimization?.insights && (
            <>
              {/* Optimal Send Times */}
              <Card>
                <CardHeader>
                  <CardTitle>Optimal Send Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.predictiveOptimization.insights.optimalSendTimes?.slice(0, 4).map((time: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][time.dayOfWeek]} at {time.hour}:00
                          </div>
                          <Badge className="bg-green-100 text-green-800">{time.confidence}% confidence</Badge>
                        </div>
                        <p className="text-sm text-gray-600">Expected open rate: {time.expectedOpenRate}%</p>
                        <Progress value={time.expectedOpenRate} className="mt-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommended Sequence */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommended Email Sequence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.predictiveOptimization.insights.recommendedSequence?.map((step: any, index: number) => (
                      <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">Day {step.dayOffset}: {step.templateType.replace('_', ' ').toUpperCase()}</div>
                          <div className="text-sm text-gray-600">{step.reasoning}</div>
                        </div>
                        <Badge variant="outline">Day {step.dayOffset}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Targeting Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Targeting Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData.predictiveOptimization.insights.targetingRecommendations?.map((target: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{target.segment.replace('_', ' ').toUpperCase()}</div>
                          <Badge className="bg-blue-100 text-blue-800">{target.expectedConversion}% conversion</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">Focus: {target.messagingFocus}</p>
                        <div className="text-xs text-gray-500">
                          Vehicle types: {target.vehicleTypes.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Conversation Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(activeConversations) && activeConversations.map((analysis: ConversationAnalysis, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{getMoodIcon(analysis.mood)}</span>
                        <div>
                          <div className="font-medium">Conversation {analysis.conversationId.slice(0, 8)}</div>
                          <div className="text-sm text-gray-600">Lead: {analysis.leadId.slice(0, 8)}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getUrgencyColor(analysis.urgency)}>{analysis.urgency}</Badge>
                        <Badge variant="outline">{analysis.intent.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-sm font-medium">Buying Signals</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.buyingSignals?.slice(0, 3).map((signal, i) => (
                            <Badge key={i} className="bg-green-100 text-green-800 text-xs">{signal}</Badge>
                          ))}
                          {(analysis.buyingSignals?.length || 0) > 3 && (
                            <Badge variant="outline" className="text-xs">+{(analysis.buyingSignals?.length || 0) - 3} more</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Risk Factors</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.riskFactors?.slice(0, 2).map((risk, i) => (
                            <Badge key={i} className="bg-red-100 text-red-800 text-xs">{risk}</Badge>
                          ))}
                          {(analysis.riskFactors?.length || 0) > 2 && (
                            <Badge variant="outline" className="text-xs">+{(analysis.riskFactors?.length || 0) - 2} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Recommended Action: {analysis.recommendedAction.replace('_', ' ')}</div>
                          <div className="text-xs text-gray-600">{analysis.confidence}% confidence</div>
                        </div>
                        <Button size="sm">Execute</Button>
                      </div>
                    </div>
                  </div>
                ))}
                {(!activeConversations || !Array.isArray(activeConversations) || activeConversations.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2" />
                    <p>No active conversations to analyze</p>
                    <p className="text-sm">Conversation intelligence will appear as customers engage</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}