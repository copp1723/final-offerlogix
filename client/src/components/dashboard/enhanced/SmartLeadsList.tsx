import { useState } from 'react';
import { ChevronRight, Clock, Zap, TrendingUp, AlertTriangle, Star, Mail, Phone, Calendar, User } from 'lucide-react';
import type { MappedLead } from '@/services/dashboardIntelligence';
import { LeadDetailsDrawer } from './LeadDetailsDrawer';

interface SmartLeadsListProps {
  leads: MappedLead[];
}

function relativeTime(iso?: string) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / (1000 * 60));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function SmartLeadsList({ leads }: SmartLeadsListProps) {
  const [selectedLead, setSelectedLead] = useState<MappedLead | null>(null);

  const getStatusGradient = (status: MappedLead['status']) => {
    switch (status) {
      case 'hot':
        return 'from-red-500 to-orange-500';
      case 'warm':
        return 'from-orange-400 to-yellow-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const getStatusIcon = (status: MappedLead['status']) => {
    switch (status) {
      case 'hot':
        return <Zap className="w-4 h-4 text-white" />;
      case 'warm':
        return <TrendingUp className="w-4 h-4 text-white" />;
      default:
        return <Clock className="w-4 h-4 text-white" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'from-red-500 to-red-600';
      case 'medium':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  if (leads.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center shadow-glow">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Leads Found</h3>
        <p className="text-gray-600 mb-6">Start by importing leads or adding them manually to see contextual insights here.</p>
        <div className="flex justify-center gap-3">
          <button className="px-4 py-2 gradient-primary text-white rounded-xl font-medium hover:shadow-glow transition-all duration-300">
            Import Leads
          </button>
          <button className="px-4 py-2 glass rounded-xl font-medium hover:shadow-lg transition-all duration-300">
            Add Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Memory over Metrics Header */}
        <div className="glass rounded-xl p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Memory over Metrics</h3>
              <p className="text-sm text-gray-600">Showing actionable context, not vanity numbers</p>
            </div>
          </div>
        </div>

        {/* Smart Leads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leads.map((lead, index) => {
            const urgentAction = lead.recommendedActions.find(a => a.urgency === 'high');
            const statusGradient = getStatusGradient(lead.status);
            
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className="group relative glass rounded-2xl p-6 hover:shadow-glow transition-all duration-300 transform hover:scale-105 cursor-pointer overflow-hidden animate-fadeIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Background Gradient Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${statusGradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${statusGradient} rounded-xl flex items-center justify-center shadow-lg transform rotate-3 group-hover:rotate-6 transition-transform`}>
                    {getStatusIcon(lead.status)}
                  </div>
                </div>
                
                {/* Lead Info */}
                <div className="relative">
                  {/* Header */}
                  <div className="mb-4">
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-gradient transition-all">
                      {lead.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500">{relativeTime(lead.lastContact)}</p>
                    </div>
                  </div>

                  {/* Context Snippet - Memory over Metrics */}
                  <div className="glass rounded-xl p-3 mb-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 mt-0.5 gradient-primary rounded flex items-center justify-center">
                        <span className="text-xs text-white font-bold">💡</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-purple-700 mb-1">Context</p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {lead.snippet || 'New lead - no context yet'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Urgent Action Alert - Real Insights */}
                  {urgentAction && (
                    <div className={`relative overflow-hidden rounded-xl p-3 mb-4 bg-gradient-to-r ${getUrgencyColor(urgentAction.urgency)}`}>
                      <div className="absolute inset-0 bg-white opacity-90"></div>
                      <div className="relative flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 animate-pulse" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-900">{urgentAction.action}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{urgentAction.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Recommended Actions */}
                  {lead.recommendedActions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Recommended Actions</p>
                      <div className="space-y-1">
                        {lead.recommendedActions.slice(0, 2).map((action, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <div className={`w-2 h-2 rounded-full ${
                              action.urgency === 'high' ? 'bg-red-500' :
                              action.urgency === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}></div>
                            <span className="text-gray-600 truncate">{action.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button className="flex-1 py-2 px-3 glass rounded-lg hover:bg-white/80 transition-colors flex items-center justify-center gap-2 group/btn">
                      <Mail className="w-4 h-4 text-gray-600 group-hover/btn:text-purple-600" />
                      <span className="text-xs font-medium text-gray-700">Email</span>
                    </button>
                    <button className="flex-1 py-2 px-3 glass rounded-lg hover:bg-white/80 transition-colors flex items-center justify-center gap-2 group/btn">
                      <Phone className="w-4 h-4 text-gray-600 group-hover/btn:text-green-600" />
                      <span className="text-xs font-medium text-gray-700">Call</span>
                    </button>
                    <button className="flex-1 py-2 px-3 glass rounded-lg hover:bg-white/80 transition-colors flex items-center justify-center gap-2 group/btn">
                      <Calendar className="w-4 h-4 text-gray-600 group-hover/btn:text-blue-600" />
                      <span className="text-xs font-medium text-gray-700">Follow-up</span>
                    </button>
                  </div>

                  {/* View Details Link */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${statusGradient} text-white uppercase`}>
                        {lead.status}
                      </span>
                      <div className="flex items-center gap-1 text-purple-600 group-hover:text-purple-700">
                        <span className="text-xs font-medium">View context</span>
                        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer for Lead Details */}
      {selectedLead && (
        <LeadDetailsDrawer
          lead={selectedLead}
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </>
  );
}