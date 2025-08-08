import AIChatInterface from "@/components/ai-chat/AIChatInterface";
import RecentCampaigns from "@/components/dashboard/RecentCampaigns";
import QuickStats from "@/components/dashboard/QuickStats";
import QuickActions from "@/components/dashboard/QuickActions";

import { useBranding } from "@/contexts/ClientContext";

export default function Dashboard() {
  const branding = useBranding();
  
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

      {/* Supporting Information - Improved Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <RecentCampaigns />
          <QuickActions />
        </div>
        <div className="space-y-8">
          <QuickStats />
        </div>
      </div>
    </div>
  );
}
