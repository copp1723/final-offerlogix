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

  // Type-safe access to intelligence data
  const leadScoring = (intelligenceData as any)?.leadScoring || { totalLeads: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, averageScore: 0 };
  const predictiveOpt = (intelligenceData as any)?.predictiveOptimization || { recommendationCount: 0, insights: {} };
  
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickStats />
      </div>
    </div>
  );
}
