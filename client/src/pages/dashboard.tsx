import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Sparkles, Users, TrendingUp, AlertCircle, Mail, Zap, BarChart3, Activity } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { AIAgentPanel } from '@/components/AIAgentPanel';
import { LeadList } from '@/components/LeadList';
import { InsightsPanel } from '@/components/InsightsPanel';
import { useBranding } from "@/contexts/ClientContext";

type TabValue = 'agent' | 'leads' | 'insights';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>('agent');
  const { data, isLoading, error } = useDashboard();
  const branding = useBranding();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 gradient-primary rounded-full animate-ping opacity-20"></div>
            <div className="relative flex items-center justify-center w-20 h-20 gradient-primary rounded-full animate-pulse-slow shadow-glow">
              <Mail className="w-10 h-10 text-white" />
            </div>
          </div>
          <p className="mt-6 text-white font-medium text-lg">Loading your dashboard...</p>
          <div className="flex justify-center mt-3 loading-dots">
            <span className="w-2 h-2 bg-white rounded-full mx-1"></span>
            <span className="w-2 h-2 bg-white rounded-full mx-1"></span>
            <span className="w-2 h-2 bg-white rounded-full mx-1"></span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-8 text-center max-w-md shadow-glow">
          <div className="w-16 h-16 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-2">Oops! Something went wrong</p>
          <p className="text-gray-600 mb-6">We couldn't load your dashboard. Please try refreshing.</p>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
            className="px-6 py-3 gradient-primary text-white rounded-xl font-medium hover:shadow-glow transition-all duration-300 transform hover:scale-105"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { value: 'agent' as const, label: 'AI Campaign Agent', icon: Sparkles, count: null, color: 'from-purple-500 to-pink-500' },
    { value: 'leads' as const, label: 'Smart Leads', icon: Users, count: data.leads.length, color: 'from-blue-500 to-cyan-500' },
    { value: 'insights' as const, label: 'Insights', icon: TrendingUp, count: null, color: 'from-green-500 to-emerald-500' },
  ];

  return (
    <div className="min-h-screen">
      {/* Premium Header */}
      <div className="glass border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-glow animate-float">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
                    <span className="text-gradient">{branding.companyName}</span>
                  </h1>
                  <p className="text-sm text-gray-600">Intelligent Email Campaign Platform</p>
                </div>
              </div>
              
              {/* Status Cards */}
              <div className="flex items-center gap-3">
                {data.summary.hotLeadsNeedingAttention > 0 && (
                  <div className="glass px-4 py-2 rounded-xl border border-red-200/50 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping"></div>
                        <Zap className="relative w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Hot Leads</p>
                        <p className="text-lg font-bold text-red-600">{data.summary.hotLeadsNeedingAttention}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="glass px-4 py-2 rounded-xl shadow-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-600">Active Campaigns</p>
                      <p className="text-lg font-bold text-gray-900">
                        {data.intelligence.campaigns?.filter(c => c.type).length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Tabs */}
            <div className="flex gap-3 p-2 glass rounded-2xl shadow-lg">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`
                      relative flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-medium text-sm 
                      transition-all duration-300 transform hover:scale-105
                      ${isActive 
                        ? 'bg-white shadow-xl text-gray-900' 
                        : 'hover:bg-white/50 text-gray-700'
                      }
                    `}
                  >
                    {isActive && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-10 rounded-xl`}></div>
                    )}
                    <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                    <span className="relative">{tab.label}</span>
                    {tab.count !== null && (
                      <span className={`
                        relative px-2 py-0.5 text-xs rounded-full font-semibold
                        ${isActive 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                        }
                      `}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="glass rounded-xl p-4 hover:shadow-glow transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-wider">Total Leads</p>
                    <p className="text-2xl font-bold text-gradient">{data.leads.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
              
              <div className="glass rounded-xl p-4 hover:shadow-glow transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-wider">Hot Leads</p>
                    <p className="text-2xl font-bold text-gradient">
                      {data.leads.filter(l => l.status === 'hot').length}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
              
              <div className="glass rounded-xl p-4 hover:shadow-glow transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-wider">Avg Score</p>
                    <p className="text-2xl font-bold text-gradient">
                      {Math.round(data.leads.reduce((acc, l) => acc + l.score, 0) / data.leads.length) || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
              
              <div className="glass rounded-xl p-4 hover:shadow-glow transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-wider">Active Now</p>
                    <p className="text-2xl font-bold text-gradient">
                      {data.agent.recentActivity?.length || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fadeIn">
          {activeTab === 'agent' && (
            <AIAgentPanel 
              suggestions={data.agent.suggestions}
              recentActivity={data.agent.recentActivity}
            />
          )}
          
          {activeTab === 'leads' && (
            <div className="space-y-6">
              {/* Urgent Alerts with Premium Design */}
              {(data.summary.competitorMentions.length > 0 || data.summary.expiringOpportunities.length > 0) && (
                <div className="glass rounded-2xl p-6 border-l-4 border-yellow-500 shadow-glow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-yellow-500 rounded-full animate-ping"></div>
                      <AlertCircle className="relative w-6 h-6 text-yellow-500" />
                    </div>
                    <h3 className="font-bold text-xl text-gray-900">Immediate Action Required</h3>
                  </div>
                  <div className="space-y-2">
                    {data.summary.competitorMentions.map((mention, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                        <Zap className="w-4 h-4 text-yellow-600" />
                        <p className="text-sm text-gray-800">{mention}</p>
                      </div>
                    ))}
                    {data.summary.expiringOpportunities.map((opp, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                        <Activity className="w-4 h-4 text-orange-600" />
                        <p className="text-sm text-gray-800">{opp}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <LeadList leads={data.leads} />
            </div>
          )}
          
          {activeTab === 'insights' && (
            <InsightsPanel
              followUps={data.intelligence.followUps}
              callList={data.intelligence.callList as any}
              campaigns={data.intelligence.campaigns as any}
            />
          )}
        </div>
      </div>
    </div>
  );
}
