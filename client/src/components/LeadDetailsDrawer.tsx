import { X, Mail, Phone, Calendar, Clock, TrendingUp, AlertCircle, MessageCircle, User, Activity, Target, Sparkles } from 'lucide-react';
import type { Lead } from '@/types/api';

interface LeadDetailsDrawerProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadDetailsDrawer({ lead, isOpen, onClose }: LeadDetailsDrawerProps) {
  if (!isOpen) return null;

  const getStatusGradient = (status: Lead['status']) => {
    switch (status) {
      case 'hot':
        return 'from-red-500 to-orange-500';
      case 'warm':
        return 'from-orange-400 to-yellow-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl glass-dark z-50 shadow-2xl animate-slideInRight">
        <div className="h-full flex flex-col">
          {/* Header with Gradient */}
          <div className={`relative bg-gradient-to-br ${getStatusGradient(lead.status)} p-6`}>
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl"></div>
            
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{lead.name}</h2>
                    <p className="text-white/80">{lead.email}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-white/80" />
                    <span className="text-xs text-white/80">Score</span>
                  </div>
                  <p className="text-xl font-bold text-white">{lead.score}</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-white/80" />
                    <span className="text-xs text-white/80">Last Contact</span>
                  </div>
                  <p className="text-sm font-bold text-white">{new Date(lead.lastContact || '').toLocaleDateString()}</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-white/80" />
                    <span className="text-xs text-white/80">Status</span>
                  </div>
                  <p className="text-sm font-bold text-white uppercase">{lead.status}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
            {/* Context Section */}
            <div className="glass rounded-2xl p-5 mb-6 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-gray-900">Context</h3>
              </div>
              <p className="text-gray-700 leading-relaxed">{lead.snippet}</p>
            </div>
            
            {/* Recommended Actions */}
            <div className="glass rounded-2xl p-5 mb-6 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-gray-900">Recommended Actions</h3>
              </div>
              <div className="space-y-3">
                {lead.recommendedActions.map((action, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 glass rounded-xl hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-bold border ${getUrgencyBadge(action.urgency)}`}>
                        {action.urgency}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">{action.action}</p>
                        <p className="text-sm text-gray-600">{action.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button className="p-4 gradient-primary text-white rounded-xl hover:shadow-glow transition-all duration-300 transform hover:scale-105 flex flex-col items-center gap-2">
                <Mail className="w-6 h-6" />
                <span className="text-sm font-medium">Send Email</span>
              </button>
              <button className="p-4 gradient-success text-white rounded-xl hover:shadow-glow transition-all duration-300 transform hover:scale-105 flex flex-col items-center gap-2">
                <Phone className="w-6 h-6" />
                <span className="text-sm font-medium">Call Now</span>
              </button>
              <button className="p-4 gradient-secondary text-white rounded-xl hover:shadow-glow transition-all duration-300 transform hover:scale-105 flex flex-col items-center gap-2">
                <Calendar className="w-6 h-6" />
                <span className="text-sm font-medium">Schedule</span>
              </button>
            </div>
            
            {/* Intelligence Section (placeholder) */}
            <div className="glass rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-gray-900">Intelligence Insights</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm text-gray-700">Engagement Level</span>
                  <span className="font-bold text-purple-600">High</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-700">Best Contact Time</span>
                  <span className="font-bold text-blue-600">2-4 PM</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-gray-700">Preferred Channel</span>
                  <span className="font-bold text-green-600">Email</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* Add these animations to your CSS */
const animationStyles = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

.animate-slideInRight {
  animation: slideInRight 0.3s ease-out;
}
`;

// Add to your global styles or as a style tag