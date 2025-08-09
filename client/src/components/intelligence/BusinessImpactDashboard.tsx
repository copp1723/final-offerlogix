import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Timer, Zap, Award, BarChart3, Target, AlertTriangle } from 'lucide-react';

interface BusinessImpactMetrics {
  revenueImpact: {
    monthlyRevenueLift: number;
    yearlyRevenueProjection: number;
    revenuePerHotLead: number;
    conversionRateAdvantage: number;
    totalRevenuePotential: number;
  };
  timeSavings: {
    dailyTimeSaved: number;
    weeklyTimeSaved: number;
    monthlyTimeSaved: number;
    totalTimeSavingsValue: number;
    salesTeamEfficiencyGain: number;
  };
  competitiveAdvantage: {
    responseTimeAdvantage: string;
    firstContactAdvantage: string;
    industryBenchmarkComparison: {
      ourResponseTime: number;
      industryAverage: number;
      advantage: string;
    };
  };
  leadScoringROI: {
    roiPercentage: number;
    monthlyReturn: number;
    paybackPeriod: string;
    netProfitIncrease: number;
  };
  missedOpportunityPrevention: {
    preventedLostDeals: number;
    preventedLostRevenue: number;
    monthlyOpportunityValue: number;
  };
  performanceBenchmarks: {
    ourPerformance: {
      conversionRate: number;
      responseTime: number;
      leadQualificationAccuracy: number;
    };
    competitivePositioning: string;
  };
}

interface BusinessImpactDashboardProps {
  data?: BusinessImpactMetrics;
  loading?: boolean;
}

const BusinessImpactDashboard: React.FC<BusinessImpactDashboardProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Default fallback data for demonstration
  const businessImpact = data || {
    revenueImpact: {
      monthlyRevenueLift: 45000,
      yearlyRevenueProjection: 540000,
      revenuePerHotLead: 15750,
      conversionRateAdvantage: 775,
      totalRevenuePotential: 385000
    },
    timeSavings: {
      dailyTimeSaved: 3.2,
      weeklyTimeSaved: 16.0,
      monthlyTimeSaved: 69.3,
      totalTimeSavingsValue: 4504,
      salesTeamEfficiencyGain: 28
    },
    competitiveAdvantage: {
      responseTimeAdvantage: "4x faster response to hot leads",
      firstContactAdvantage: "85% first-contact advantage",
      industryBenchmarkComparison: {
        ourResponseTime: 0.8,
        industryAverage: 3.2,
        advantage: "75% faster than industry average"
      }
    },
    leadScoringROI: {
      roiPercentage: 340,
      monthlyReturn: 52750,
      paybackPeriod: "Less than 1 month",
      netProfitIncrease: 51900
    },
    missedOpportunityPrevention: {
      preventedLostDeals: 8,
      preventedLostRevenue: 288000,
      monthlyOpportunityValue: 96000
    },
    performanceBenchmarks: {
      ourPerformance: {
        conversionRate: 24,
        responseTime: 0.8,
        leadQualificationAccuracy: 89
      },
      competitivePositioning: "Market Leading Performance"
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Monthly Revenue Impact</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${businessImpact.revenueImpact?.monthlyRevenueLift?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-green-700">From intelligent lead prioritization</p>
            <div className="mt-2 text-xs">
              <span className="text-green-600 font-medium">
                Yearly: ${businessImpact.revenueImpact?.yearlyRevenueProjection?.toLocaleString() || '0'}
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">ROI Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {businessImpact.leadScoringROI.roiPercentage}%
            </div>
            <p className="text-xs text-blue-700">Monthly return on investment</p>
            <div className="mt-2 text-xs">
              <span className="text-blue-600 font-medium">
                Payback: {businessImpact.leadScoringROI.paybackPeriod}
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Time Savings</CardTitle>
            <Timer className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {businessImpact.timeSavings.dailyTimeSaved}h
            </div>
            <p className="text-xs text-purple-700">Daily productivity gain</p>
            <div className="mt-2 text-xs">
              <span className="text-purple-600 font-medium">
                Monthly value: ${businessImpact.timeSavings?.totalTimeSavingsValue?.toLocaleString() || '0'}
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Competitive Edge</CardTitle>
            <Zap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">4x</div>
            <p className="text-xs text-orange-700">Faster response to hot leads</p>
            <div className="mt-2 text-xs">
              <span className="text-orange-600 font-medium">
                {businessImpact.competitiveAdvantage.firstContactAdvantage}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-green-500" />
              Revenue Impact Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-gradient-to-r from-red-50 to-red-100">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                    <span className="font-medium">Hot Leads</span>
                    <Badge variant="destructive" className="ml-2 text-xs">High Priority</Badge>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    ${businessImpact.revenueImpact?.revenuePerHotLead?.toLocaleString() || '0'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Average revenue per lead • 35% conversion rate</p>
                <div className="text-xs text-green-600 mt-1 font-medium">
                  {Math.round(businessImpact.revenueImpact.conversionRateAdvantage / 10)}x higher conversion than cold leads
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-gradient-to-r from-orange-50 to-orange-100">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
                    <span className="font-medium">Warm Leads</span>
                    <Badge variant="secondary" className="ml-2 text-xs">Medium Priority</Badge>
                  </div>
                  <span className="text-lg font-bold">$6,300</span>
                </div>
                <p className="text-sm text-gray-600">Average revenue per lead • 18% conversion rate</p>
                <div className="text-xs text-blue-600 mt-1 font-medium">
                  4.5x higher conversion than cold leads
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                    <span className="font-medium">Cold Leads</span>
                    <Badge variant="outline" className="ml-2 text-xs">Low Priority</Badge>
                  </div>
                  <span className="text-lg font-bold">$1,120</span>
                </div>
                <p className="text-sm text-gray-600">Average revenue per lead • 4% conversion rate</p>
                <div className="text-xs text-gray-500 mt-1">
                  Baseline performance benchmark
                </div>
              </div>

              <div className="mt-4 pt-4 border-t bg-green-50 rounded-lg p-3">
                <div className="text-center">
                  <div className="text-sm font-medium text-green-800">Total Revenue Opportunity</div>
                  <div className="text-xl font-bold text-green-600">
                    ${businessImpact.revenueImpact?.totalRevenuePotential?.toLocaleString() || '0'}
                  </div>
                  <div className="text-xs text-green-600">Monthly potential from current lead portfolio</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="w-5 h-5 mr-2 text-purple-500" />
              Business Impact Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-green-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-800">Revenue Amplification</h4>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-sm text-green-700 mb-2">
                  Hot leads generate <span className="font-bold">14x more revenue</span> than cold leads
                </p>
                <div className="text-xs text-green-600">
                  • ${businessImpact.revenueImpact?.yearlyRevenueProjection?.toLocaleString() || '0'} projected annual increase
                  <br />• {businessImpact.revenueImpact.conversionRateAdvantage}% conversion rate improvement
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-blue-800">Operational Excellence</h4>
                  <Timer className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-sm text-blue-700 mb-2">
                  Save <span className="font-bold">{Math.round(businessImpact.timeSavings.monthlyTimeSaved)} hours monthly</span> through smart prioritization
                </p>
                <div className="text-xs text-blue-600">
                  • Sales team operates {businessImpact.timeSavings.salesTeamEfficiencyGain}% more efficiently
                  <br />• ${businessImpact.timeSavings?.totalTimeSavingsValue?.toLocaleString() || '0'} monthly time value savings
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-purple-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-purple-800">Market Dominance</h4>
                  <Zap className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-sm text-purple-700 mb-2">
                  Respond to high-value leads <span className="font-bold">4x faster</span> than competitors
                </p>
                <div className="text-xs text-purple-600">
                  • {businessImpact.competitiveAdvantage.industryBenchmarkComparison.advantage}
                  <br />• {businessImpact.performanceBenchmarks.ourPerformance.leadQualificationAccuracy}% lead qualification accuracy
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-orange-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-orange-800">Lost Deal Prevention</h4>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-sm text-orange-700 mb-2">
                  Prevent <span className="font-bold">${businessImpact.missedOpportunityPrevention?.monthlyOpportunityValue?.toLocaleString() || '0'} monthly</span> in missed opportunities
                </p>
                <div className="text-xs text-orange-600">
                  • {businessImpact.missedOpportunityPrevention.preventedLostDeals} deals recovered monthly
                  <br />• Early warning system prevents revenue loss
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executive Summary */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center text-green-800">
            <Target className="w-5 h-5 mr-2" />
            Executive Summary: Lead Scoring ROI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {businessImpact.leadScoringROI.roiPercentage}%
              </div>
              <div className="text-sm font-medium text-gray-600">Monthly ROI</div>
              <div className="text-xs text-green-600 mt-1">
                {businessImpact.leadScoringROI.paybackPeriod} payback period
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                ${businessImpact.leadScoringROI?.netProfitIncrease?.toLocaleString() || '0'}
              </div>
              <div className="text-sm font-medium text-gray-600">Net Monthly Profit Increase</div>
              <div className="text-xs text-blue-600 mt-1">
                Above investment costs
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {businessImpact.performanceBenchmarks.competitivePositioning.includes('Leading') ? 'Leading' : 'Competitive'}
              </div>
              <div className="text-sm font-medium text-gray-600">Market Position</div>
              <div className="text-xs text-purple-600 mt-1">
                Outperforming industry standards
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-medium">Bottom Line Impact:</span> Lead scoring delivers measurable business results with 
              <span className="font-bold text-green-600"> ${businessImpact.revenueImpact?.monthlyRevenueLift?.toLocaleString() || '0'} monthly revenue lift</span>, 
              <span className="font-bold text-blue-600"> {businessImpact.timeSavings.salesTeamEfficiencyGain}% efficiency gains</span>, and 
              <span className="font-bold text-purple-600"> market-leading competitive positioning</span>.
            </p>
            <Badge variant="default" className="bg-green-600">
              Critical Revenue Driver • Not Just Analytics
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessImpactDashboard;