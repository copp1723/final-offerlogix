import { X, Mail, Phone, Calendar, User, Clock, Zap, AlertTriangle, Target, MessageSquare } from 'lucide-react';
import type { MappedLead } from '@/services/dashboardIntelligence';

interface LeadDetailsDrawerProps {
  lead: MappedLead;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadDetailsDrawer({ lead, isOpen, onClose }: LeadDetailsDrawerProps) {
  if (!isOpen) return null;

  const getStatusColor = (status: MappedLead['status']) => {
    switch (status) {
      case 'hot':
        return 'text-red-600 bg-red-100';
      case 'warm':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto animate-slideInRight">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{lead.name}</h2>
                <p className="text-sm text-gray-600">{lead.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="mb-6">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(lead.status)}`}>
              {lead.status === 'hot' && <Zap className="w-4 h-4" />}
              {lead.status === 'warm' && <Clock className="w-4 h-4" />}
              {lead.status === 'cold' && <User className="w-4 h-4" />}
              {lead.status.toUpperCase()} LEAD
            </span>
          </div>

          {/* Context Section - Memory over Metrics */}
          <div className="glass rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">Context & Insights</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">Memory over Metrics</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {lead.snippet || 'No context available yet. Add notes or conversations to see insights here.'}
            </p>
            {lead.lastContact && (
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                Last contact: {new Date(lead.lastContact).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Recommended Actions */}
          {lead.recommendedActions.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-900">Recommended Actions</h3>
              </div>
              <div className="space-y-3">
                {lead.recommendedActions.map((action, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getUrgencyColor(action.urgency)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{action.action}</p>
                        <p className="text-xs mt-1">{action.reason}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {action.urgency === 'high' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        <span className="text-xs font-bold uppercase tracking-wide">
                          {action.urgency}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              <button className="flex items-center gap-3 p-3 glass rounded-lg hover:shadow-glow transition-all duration-300 transform hover:scale-105">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900">Send Contextual Email</p>
                  <p className="text-xs text-gray-600">Based on their specific interests</p>
                </div>
              </button>
              
              <button className="flex items-center gap-3 p-3 glass rounded-lg hover:shadow-glow transition-all duration-300 transform hover:scale-105">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900">Schedule Call</p>
                  <p className="text-xs text-gray-600">Discuss their specific needs</p>
                </div>
              </button>
              
              <button className="flex items-center gap-3 p-3 glass rounded-lg hover:shadow-glow transition-all duration-300 transform hover:scale-105">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900">Set Follow-up</p>
                  <p className="text-xs text-gray-600">Keep the conversation going</p>
                </div>
              </button>
            </div>
          </div>

          {/* Lead Information */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-4">Lead Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Email</span>
                <span className="text-sm font-medium text-gray-900">{lead.email}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`text-sm font-bold uppercase ${
                  lead.status === 'hot' ? 'text-red-600' :
                  lead.status === 'warm' ? 'text-orange-600' : 'text-gray-600'
                }`}>
                  {lead.status}
                </span>
              </div>
              
              {lead.lastContact && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last Contact</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(lead.lastContact).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}