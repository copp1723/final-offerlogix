import DashboardHeader from "@/components/dashboard/DashboardHeader";
import AIChatInterface from "@/components/ai-chat/AIChatInterface";
import RecentCampaigns from "@/components/dashboard/RecentCampaigns";
import QuickStats from "@/components/dashboard/QuickStats";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">AutoCampaigns AI</h1>
          <p className="text-lg text-gray-600">Create intelligent automotive email campaigns with conversational AI guidance</p>
        </div>

        {/* Main AI Chat Interface */}
        <div className="mb-12">
          <AIChatInterface />
        </div>

        {/* Supporting Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <RecentCampaigns />
          </div>
          <div>
            <QuickStats />
          </div>
        </div>
      </main>
    </div>
  );
}
