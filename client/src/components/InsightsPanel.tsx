import { Calendar, Phone, TrendingUp, Target, Users, BarChart3, ArrowUp, ArrowDown, Minus, Activity, Zap } from 'lucide-react';
import type { FollowUp, CallPriority, CampaignOpportunity } from '@/types/api';

interface InsightsPanelProps {
  followUps: FollowUp[];
  callList: CallPriority[];
  campaigns?: CampaignOpportunity[];
}

export function InsightsPanel({ followUps, callList, campaigns = [] }: InsightsPanelProps) {
  const getMetricChange = (value: number) => {
    if (value > 0) return { icon: ArrowUp, color: 'text-green-500', bg: 'bg-green-100' };
    if (value < 0) return { icon: ArrowDown, color: 'text-red-500', bg: 'bg-red-100' };
    return { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100' };
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Campaign Opportunities', value: campaigns.length, change: 12, icon: TrendingUp, gradient: 'from-purple-500 to-pink-500' },
          { label: 'Total Reach', value: '12.4K', change: 8, icon: Users, gradient: 'from-blue-500 to-cyan-500' },
          { label: 'Conversion Rate', value: '3.8%', change: -2, icon: Target, gradient: 'from-green-500 to-emerald-500' },
        ].map((metric, idx) => {
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

      {/* Campaign Opportunities */}
      {campaigns.length > 0 && (
        <div className="glass rounded-2xl p-6 shadow-glow">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-xl text-gray-900">Campaign Opportunities</h3>
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
                    <div className="w-3 h-8 rounded-full bg-gradient-to-b from-orange-500 to-red-500"></div>
                    <div>
                      <h4 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                        {campaign.type}
                      </h4>
                      <p className="text-xs text-gray-500">{campaign.description}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                    {campaign.count} leads
                  </div>
                </div>
                
                <div className="mt-3">
                  <p className="text-sm text-purple-600 font-medium">💡 {campaign.suggestedAction}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout for Follow-ups and Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Follow-ups */}
        <div className="glass rounded-2xl p-6 shadow-glow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 gradient-secondary rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-xl text-gray-900">Scheduled Follow-ups</h3>
          </div>
          
          <div className="space-y-3">
            {followUps.map((followUp, idx) => (
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
                      <span className="text-xs text-gray-500">{followUp.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call List */}
        <div className="glass rounded-2xl p-6 shadow-glow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 gradient-success rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-xl text-gray-900">Priority Call List</h3>
          </div>
          
          <div className="space-y-3">
            {callList.map((call, idx) => {
              // Determine priority based on score
              const priority = call.score >= 90 ? 'high' : call.score >= 70 ? 'medium' : 'low';
              const priorityColor = priority === 'high' 
                ? 'from-red-500 to-orange-500' 
                : priority === 'medium'
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
                          {call.leadName}
                        </h4>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${priorityColor} text-white`}>
                            {priority}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">Score: {call.score}</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {call.reasons.map((reason, ridx) => (
                          <p key={ridx} className="text-sm text-gray-600">• {reason}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}