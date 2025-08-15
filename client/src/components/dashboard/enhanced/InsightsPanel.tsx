import { Calendar, Phone, TrendingUp, Target, Users, BarChart3, ArrowUp, ArrowDown, Minus, Activity, Zap, AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import type { FollowUp, CallItem, Campaign } from '@/services/dashboardIntelligence';

interface InsightsPanelProps {
  followUps: FollowUp[];
  callList: CallItem[];
  campaigns?: Campaign[];
}

export function InsightsPanel({ followUps, callList, campaigns = [] }: InsightsPanelProps) {
  const getMetricChange = (value: number) => {
    if (value > 0) return { icon: ArrowUp, color: 'text-green-500', bg: 'bg-green-100' };
    if (value < 0) return { icon: ArrowDown, color: 'text-red-500', bg: 'bg-red-100' };
    return { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100' };
  };

  const mockMetrics = [
    { label: 'Contextual Engagements', value: campaigns.filter(c => c.status === 'active').length, change: 15, icon: MessageSquare, gradient: 'from-purple-500 to-pink-500' },
    { label: 'Quality Conversations', value: '47', change: 23, icon: Users, gradient: 'from-blue-500 to-cyan-500' },
    { label: 'Deal Progression', value: '12', change: 8, icon: Target, gradient: 'from-green-500 to-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Memory over Metrics Header */}
      <div className="glass rounded-xl p-4 border-l-4 border-purple-500">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Memory over Metrics</h2>
            <p className="text-sm text-gray-600">Real insights that help close deals, not vanity numbers</p>
          </div>
        </div>
      </div>

      {/* Key Insights Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockMetrics.map((metric, idx) => {
          const change = getMetricChange(metric.change);
          const Icon = metric.icon;
          const ChangeIcon = change.icon;
          
          return (
            <div key={idx} className="glass rounded-2xl p-6 hover:shadow-glow transition-all duration-300 transform hover:scale-105">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${metric.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${change.bg}`}>
                  <ChangeIcon className={`w-3 h-3 ${change.color}`} />
                  <span className={`text-xs font-bold ${change.color}`}>{Math.abs(metric.change)}%</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gradient mb-1">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.label}</p>
            </div>
          );
        })}
      </div>

      {/* Campaign Performance - Memory over Metrics */}
      {campaigns.length > 0 && (
        <div className="glass rounded-2xl p-6 shadow-glow">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-xl text-gray-900">Campaign Context</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">Quality over Quantity</span>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors">
              View All →
            </button>
          </div>
          
          <div className="space-y-4">
            {campaigns.slice(0, 3).map((campaign, idx) => (
              <div key={idx} className="p-4 glass rounded-xl hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full bg-gradient-to-b ${
                      campaign.status === 'active' ? 'from-green-500 to-emerald-500' : 'from-gray-400 to-gray-500'
                    }`}></div>
                    <div>
                      <h4 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                        {campaign.name}
                      </h4>
                      <p className="text-xs text-gray-500">Contextual engagement focus</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    campaign.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {campaign.status}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((campaign.delivered / campaign.total) * 100, 100)}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-gray-600">{campaign.delivered} meaningful contacts of {campaign.total}</span>
                  <span className="font-bold text-purple-600">{campaign.clickRate}% engagement</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout for Follow-ups and Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Context-Driven Follow-ups */}
        <div className="glass rounded-2xl p-6 shadow-glow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 gradient-secondary rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-900">Context Follow-ups</h3>
              <p className="text-xs text-gray-600">Based on real conversations</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {followUps.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No follow-ups scheduled</p>
                <p className="text-xs">Actions will appear based on lead conversations</p>
              </div>
            ) : (
              followUps.map((followUp, idx) => (
                <div 
                  key={idx} 
                  className="group p-4 glass rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        followUp.type === 'email' 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {followUp.type === 'email' ? '✉️' : '📞'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                          {followUp.lead}
                        </h4>
                        <span className="text-xs text-purple-600 font-bold">
                          {followUp.time}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{followUp.note}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Activity className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">Contextual {followUp.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Intelligent Call List */}
        <div className="glass rounded-2xl p-6 shadow-glow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 gradient-success rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-900">Smart Call List</h3>
              <p className="text-xs text-gray-600">Prioritized by context, not scores</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {callList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Phone className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No priority calls</p>
                <p className="text-xs">Calls will be prioritized based on lead context</p>
              </div>
            ) : (
              callList.map((call, idx) => {
                const priorityColor = call.priority === 'high' 
                  ? 'from-red-500 to-orange-500' 
                  : call.priority === 'medium'
                  ? 'from-yellow-500 to-orange-500'
                  : 'from-gray-400 to-gray-500';
                  
                return (
                  <div 
                    key={idx} 
                    className="group p-4 glass rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 bg-gradient-to-br ${priorityColor} rounded-xl flex items-center justify-center shadow-md`}>
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                            {call.name}
                          </h4>
                          <span className={`px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${priorityColor} text-white`}>
                            {call.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{call.reason}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-500">📱 {call.phone}</span>
                          <span className="text-xs text-purple-600 font-medium">Best: {call.bestTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Actionable Insights Summary */}
      <div className="glass rounded-2xl p-6 shadow-glow">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-xl text-gray-900">Key Takeaways</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Context Wins</h4>
            <p className="text-sm text-blue-700">
              Leads respond 3x better to contextual messages than generic campaigns. 
              Focus on their specific needs and interests.
            </p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">Timing Matters</h4>
            <p className="text-sm text-green-700">
              Follow up within 24 hours of meaningful interactions. 
              Speed + context = higher conversion rates.
            </p>
          </div>
          
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
            <h4 className="font-semibold text-purple-900 mb-2">Quality over Quantity</h4>
            <p className="text-sm text-purple-700">
              10 targeted, contextual touches outperform 100 generic emails. 
              Focus on meaningful engagement.
            </p>
          </div>
          
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2">Listen First</h4>
            <p className="text-sm text-orange-700">
              Track what leads actually say, not just what they click. 
              Real conversations drive real results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}