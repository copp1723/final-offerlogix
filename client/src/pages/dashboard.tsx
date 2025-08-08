import AIChatInterface from "@/components/ai-chat/AIChatInterface";
import QuickStats from "@/components/dashboard/QuickStats";
import { useBranding } from "@/contexts/ClientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Users, ArrowRightLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const branding = useBranding();
  
  const { data: intelligenceData } = useQuery({
    queryKey: ['/api/intelligence/dashboard'],
    refetchInterval: 60000 // Refresh every minute
  });
  
  return (
    <div className="p-6 space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome to {branding.companyName}</h1>
        <p className="text-lg text-gray-600">Create intelligent automotive email campaigns with conversational AI guidance</p>
      </div>

      {/* Main AI Chat Interface */}
      <div className="mb-12">
        <AIChatInterface />
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <QuickStats />
        
        {/* Lead Scoring Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Target className="h-4 w-4 mr-2 text-blue-600" />
              Lead Scoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{intelligenceData?.leadScoring?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground mb-3">Leads Analyzed</p>
            <div className="flex items-center space-x-2">
              <Badge className="bg-red-100 text-red-800 text-xs">{intelligenceData?.leadScoring?.hotLeads || 0} Hot</Badge>
              <Badge className="bg-orange-100 text-orange-800 text-xs">{intelligenceData?.leadScoring?.warmLeads || 0} Warm</Badge>
              <Badge className="bg-blue-100 text-blue-800 text-xs">{intelligenceData?.leadScoring?.coldLeads || 0} Cold</Badge>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs">
                <span>Avg Score</span>
                <span>{Math.round(intelligenceData?.leadScoring?.averageScore || 0)}%</span>
              </div>
              <Progress value={intelligenceData?.leadScoring?.averageScore || 0} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Predictive Insights Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{intelligenceData?.predictiveOptimization?.recommendationCount || 0}</div>
            <p className="text-xs text-muted-foreground mb-3">Recommendations</p>
            {intelligenceData?.predictiveOptimization?.insights?.optimalSendTimes?.[0] && (
              <div className="text-xs text-gray-600">
                <div className="font-medium">Best Send Time:</div>
                <div>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][intelligenceData.predictiveOptimization.insights.optimalSendTimes[0].dayOfWeek]} at {intelligenceData.predictiveOptimization.insights.optimalSendTimes[0].hour}:00
                </div>
                <div className="text-green-600">{intelligenceData.predictiveOptimization.insights.optimalSendTimes[0].confidence}% confidence</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
