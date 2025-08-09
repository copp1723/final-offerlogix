import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  MessageSquare, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Award,
  Database
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface AdvancedAnalyticsData {
  leadScoring: {
    totalLeads: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    averageScore: number;
    qualityScore: number;
    confidenceLevel: number;
    accuracyTrend: number;
    lifetimeValueDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    conversionPredictions: {
      next7Days: number;
      next30Days: number;
      next90Days: number;
    };
  };
  mlOptimization: {
    sendTimeOptimization: {
      optimalTimes: Array<{
        dayOfWeek: number;
        hour: number;
        expectedOpenRate: number;
        confidence: number;
      }>;
    };
    audienceSegmentation: {
      clusters: Array<{
        name: string;
        size: number;
        conversionProbability: number;
        lifetimeValue: number;
      }>;
    };
    abTestingRecommendations: Array<{
      testName: string;
      expectedImpact: number;
      priority: string;
      category: string;
    }>;
  };
  customerJourney: {
    journeyStages: Array<{
      stage: { name: string };
      leadsInStage: number;
      conversionRate: number;
      stageHealth: string;
    }>;
    churnPredictions: Array<{
      leadId: string;
      churnProbability: number;
      riskLevel: string;
    }>;
    nextBestActions: Array<{
      leadId: string;
      priority: string;
      expectedImpact: number;
    }>;
  };
  dataQuality: {
    overview: {
      qualityScore: number;
      totalRecords: number;
    };
    leadDataQuality: {
      completeness: number;
      accuracy: number;
      consistency: number;
      freshness: number;
    };
  };
}

const AdvancedAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['/api/intelligence/advanced-analytics', selectedTimeframe],
    refetchInterval: 60000 // Refresh every minute
  });

  const { data: mlInsights } = useQuery({
    queryKey: ['/api/intelligence/ml-optimization/insights'],
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  const { data: journeyAnalysis } = useQuery({
    queryKey: ['/api/intelligence/customer-journey/analysis'],
    refetchInterval: 180000 // Refresh every 3 minutes
  });

  const { data: dataQualityReport } = useQuery({
    queryKey: ['/api/intelligence/data-quality/report'],
    refetchInterval: 600000 // Refresh every 10 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-4 animate-pulse text-purple-600" />
          <p className="text-lg font-medium">Loading Advanced Analytics...</p>
          <p className="text-sm text-gray-600">Processing intelligence data</p>
        </div>
      </div>
    );
  }

  const data = analyticsData || {
    leadScoring: {
      totalLeads: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, averageScore: 0,
      qualityScore: 0, confidenceLevel: 0, accuracyTrend: 0,
      lifetimeValueDistribution: { high: 0, medium: 0, low: 0 },
      conversionPredictions: { next7Days: 0, next30Days: 0, next90Days: 0 }
    },
    mlOptimization: {
      sendTimeOptimization: { optimalTimes: [] },
      audienceSegmentation: { clusters: [] },
      abTestingRecommendations: []
    },
    customerJourney: {
      journeyStages: [],
      churnPredictions: [],
      nextBestActions: []
    },
    dataQuality: {
      overview: { qualityScore: 0, totalRecords: 0 },
      leadDataQuality: { completeness: 0, accuracy: 0, consistency: 0, freshness: 0 }
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Target className="h-4 w-4 mr-2 text-blue-600" />
              Predictive Lead Scoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.leadScoring.totalLeads}</div>
            <p className="text-xs text-muted-foreground mb-3">Total Leads Analyzed</p>
            <div className="flex items-center space-x-1 mb-2">
              <Badge variant="destructive" className="text-xs px-2 py-1">
                {data.leadScoring.hotLeads} Hot
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-1">
                {data.leadScoring.warmLeads} Warm
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-1">
                {data.leadScoring.coldLeads} Cold
              </Badge>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>AI Confidence:</span>
                <span className="font-medium">{data.leadScoring.confidenceLevel}%</span>
              </div>
              <Progress value={data.leadScoring.confidenceLevel} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Brain className="h-4 w-4 mr-2 text-green-600" />
              ML Optimization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mlInsights?.abTestingRecommendations?.length || 0}</div>
            <p className="text-xs text-muted-foreground mb-3">Active ML Recommendations</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Send Time Optimization:</span>
                <CheckCircle className="h-3 w-3 text-green-500" />
              </div>
              <div className="flex justify-between text-xs">
                <span>Audience Segmentation:</span>
                <CheckCircle className="h-3 w-3 text-green-500" />
              </div>
              <div className="flex justify-between text-xs">
                <span>A/B Testing:</span>
                <Activity className="h-3 w-3 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2 text-purple-600" />
              Customer Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.customerJourney.nextBestActions.length}</div>
            <p className="text-xs text-muted-foreground mb-3">Next Best Actions</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>High Priority:</span>
                <span className="font-medium text-red-600">
                  {data.customerJourney.nextBestActions.filter(a => a.priority === 'high').length}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Churn Risk:</span>
                <span className="font-medium text-orange-600">
                  {data.customerJourney.churnPredictions.filter(p => p.riskLevel === 'high').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Database className="h-4 w-4 mr-2 text-orange-600" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.dataQuality.overview.qualityScore}%</div>
            <p className="text-xs text-muted-foreground mb-3">Overall Quality Score</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Completeness:</span>
                <span className="font-medium">{data.dataQuality.leadDataQuality.completeness}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Accuracy:</span>
                <span className="font-medium">{data.dataQuality.leadDataQuality.accuracy}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Freshness:</span>
                <span className="font-medium">{data.dataQuality.leadDataQuality.freshness}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Predictions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Conversion Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Next 7 Days</p>
                  <p className="text-xs text-gray-600">Expected conversions</p>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {data.leadScoring.conversionPredictions.next7Days}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Next 30 Days</p>
                  <p className="text-xs text-gray-600">Expected conversions</p>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {data.leadScoring.conversionPredictions.next30Days}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Next 90 Days</p>
                  <p className="text-xs text-gray-600">Expected conversions</p>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {data.leadScoring.conversionPredictions.next90Days}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audience Segmentation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-green-600" />
              ML Audience Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mlInsights?.audienceSegmentation?.clusters?.slice(0, 4).map((cluster: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{cluster.name}</p>
                    <p className="text-xs text-gray-600">{cluster.size} leads</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      {cluster.conversionProbability}%
                    </p>
                    <p className="text-xs text-gray-600">conv. rate</p>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Segmentation in progress...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Journey Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-purple-600" />
              Journey Stage Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.customerJourney.journeyStages.map((stage: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 border-l-4 border-l-blue-200 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{stage.stage.name}</p>
                    <p className="text-xs text-gray-600">{stage.leadsInStage} leads</p>
                  </div>
                  <div className="text-right mr-3">
                    <p className="text-sm font-bold">{stage.conversionRate}%</p>
                    <p className="text-xs text-gray-600">conversion</p>
                  </div>
                  <Badge 
                    variant={
                      stage.stageHealth === 'excellent' ? 'default' :
                      stage.stageHealth === 'good' ? 'secondary' :
                      stage.stageHealth === 'needs_attention' ? 'outline' : 'destructive'
                    }
                    className="text-xs"
                  >
                    {stage.stageHealth}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* A/B Testing Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="h-5 w-5 mr-2 text-orange-600" />
              A/B Testing Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mlInsights?.abTestingRecommendations?.slice(0, 3).map((test: any, index: number) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{test.testName}</p>
                    <Badge 
                      variant={test.priority === 'high' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {test.priority}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">{test.category}</span>
                    <span className="font-medium text-green-600">+{test.expectedImpact}% impact</span>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500">
                  <Zap className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Generating test recommendations...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderPredictiveTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Time Optimization */}
        <Card>
          <CardHeader>
            <CardTitle>Optimal Send Times</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mlInsights?.sendTimeOptimization?.optimalTimes?.slice(0, 5).map((time: any, index: number) => {
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">
                        {dayNames[time.dayOfWeek]} at {time.hour}:00
                      </p>
                      <p className="text-xs text-gray-600">
                        Confidence: {time.confidence}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">
                        {time.expectedOpenRate}%
                      </p>
                      <p className="text-xs text-gray-600">open rate</p>
                    </div>
                  </div>
                );
              }) || (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Analyzing send time patterns...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LTV Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Lifetime Value Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">High Value Leads</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded">
                    <div 
                      className="h-2 bg-green-500 rounded" 
                      style={{ width: `${(data.leadScoring.lifetimeValueDistribution.high / data.leadScoring.totalLeads) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {data.leadScoring.lifetimeValueDistribution.high}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Medium Value Leads</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded">
                    <div 
                      className="h-2 bg-blue-500 rounded" 
                      style={{ width: `${(data.leadScoring.lifetimeValueDistribution.medium / data.leadScoring.totalLeads) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {data.leadScoring.lifetimeValueDistribution.medium}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Lower Value Leads</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-gray-200 rounded">
                    <div 
                      className="h-2 bg-gray-400 rounded" 
                      style={{ width: `${(data.leadScoring.lifetimeValueDistribution.low / data.leadScoring.totalLeads) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {data.leadScoring.lifetimeValueDistribution.low}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderJourneyTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer Journey Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.customerJourney.journeyStages.map((stage: any, index: number) => (
                  <div key={index} className="relative">
                    <div className="flex items-center p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50">
                      <div className="flex-1">
                        <h3 className="font-medium">{stage.stage.name}</h3>
                        <p className="text-sm text-gray-600">{stage.leadsInStage} leads</p>
                      </div>
                      <div className="text-right mr-4">
                        <p className="text-lg font-bold">{stage.conversionRate}%</p>
                        <p className="text-xs text-gray-600">conversion rate</p>
                      </div>
                      <Badge 
                        variant={
                          stage.stageHealth === 'excellent' ? 'default' :
                          stage.stageHealth === 'good' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {stage.stageHealth}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">High Churn Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.customerJourney.churnPredictions
                  .filter((p: any) => p.riskLevel === 'high')
                  .slice(0, 5)
                  .map((prediction: any, index: number) => (
                  <div key={index} className="p-3 border-l-4 border-l-red-500 bg-red-50 rounded">
                    <p className="text-sm font-medium">Lead {prediction.leadId.slice(-6)}</p>
                    <p className="text-xs text-gray-600">
                      {prediction.churnProbability}% churn risk
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Priority Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.customerJourney.nextBestActions
                  .filter((action: any) => action.priority === 'high')
                  .slice(0, 5)
                  .map((action: any, index: number) => (
                  <div key={index} className="p-3 border-l-4 border-l-green-500 bg-green-50 rounded">
                    <p className="text-sm font-medium">Lead {action.leadId.slice(-6)}</p>
                    <p className="text-xs text-gray-600">
                      {action.expectedImpact}% expected impact
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderDataQualityTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Completeness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{data.dataQuality.leadDataQuality.completeness}%</div>
            <Progress value={data.dataQuality.leadDataQuality.completeness} className="mb-2" />
            <p className="text-xs text-gray-600">Lead data fields populated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{data.dataQuality.leadDataQuality.accuracy}%</div>
            <Progress value={data.dataQuality.leadDataQuality.accuracy} className="mb-2" />
            <p className="text-xs text-gray-600">Validated and correct data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Consistency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{data.dataQuality.leadDataQuality.consistency}%</div>
            <Progress value={data.dataQuality.leadDataQuality.consistency} className="mb-2" />
            <p className="text-xs text-gray-600">Standardized formats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Freshness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{data.dataQuality.leadDataQuality.freshness}%</div>
            <Progress value={data.dataQuality.leadDataQuality.freshness} className="mb-2" />
            <p className="text-xs text-gray-600">Recently updated records</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Quality Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dataQualityReport?.recommendations?.map((rec: string, index: number) => (
              <div key={index} className="flex items-center p-3 border rounded-lg">
                <AlertTriangle className="h-4 w-4 mr-3 text-orange-500" />
                <span className="text-sm">{rec}</span>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">All data quality checks passed!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Brain className="h-8 w-8 mr-3 text-purple-600" />
            Advanced Intelligence Analytics
          </h1>
          <p className="text-gray-600">AI-powered insights and predictive analytics for automotive campaigns</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant={selectedTimeframe === '7d' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setSelectedTimeframe('7d')}
          >
            7D
          </Button>
          <Button 
            variant={selectedTimeframe === '30d' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setSelectedTimeframe('30d')}
          >
            30D
          </Button>
          <Button 
            variant={selectedTimeframe === '90d' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setSelectedTimeframe('90d')}
          >
            90D
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="predictive">Predictive ML</TabsTrigger>
          <TabsTrigger value="journey">Customer Journey</TabsTrigger>
          <TabsTrigger value="data-quality">Data Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {renderOverviewTab()}
        </TabsContent>

        <TabsContent value="predictive" className="space-y-6">
          {renderPredictiveTab()}
        </TabsContent>

        <TabsContent value="journey" className="space-y-6">
          {renderJourneyTab()}
        </TabsContent>

        <TabsContent value="data-quality" className="space-y-6">
          {renderDataQualityTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;