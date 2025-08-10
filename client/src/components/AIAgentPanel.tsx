import { Sparkles, Send, Bot, Wand2, Rocket, Target, Brain, MessageCircle, Activity } from 'lucide-react';
import { useState } from 'react';
import { chatCampaign } from '@/api/client';

interface AIAgentPanelProps {
  suggestions: string[];
  recentActivity: string[];
}

export function AIAgentPanel({ suggestions, recentActivity }: AIAgentPanelProps) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'ai' | 'user'; message: string }>>([
    {
      role: 'ai',
      message: "Hello! I'm your AI Campaign Agent. Tell me your campaign idea and I'll help you build it.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!message.trim() || loading) return;
    setError(null);

    const userMsg = message;
    setMessage('');
    setChatHistory((h) => [...h, { role: 'user', message: userMsg }]);

    try {
      setLoading(true);
      const res = await chatCampaign({ message: userMsg });
      setChatHistory((h) => [...h, { role: 'ai', message: res.message || 'OK, let\'s proceed.' }]);
    } catch (e) {
      setError('Failed to reach AI service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section with Gradient */}
      <div className="relative overflow-hidden glass rounded-3xl p-12 shadow-glow">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-pink-600/10 to-blue-600/10"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
        
        <div className="relative text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 gradient-primary rounded-2xl blur-xl opacity-50 animate-pulse-slow"></div>
              <div className="relative w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center shadow-glow transform rotate-3 hover:rotate-6 transition-transform duration-300">
                <Brain className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black mb-3">
            <span className="text-gradient">AI Campaign Agent</span>
          </h1>
          <p className="text-gray-600 text-lg">Create intelligent automotive email campaigns with conversational AI</p>
          
          {/* Feature Pills */}
          <div className="flex justify-center gap-3 mt-6">
            <div className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Smart Targeting
            </div>
            <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Auto-Personalization
            </div>
            <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Real-time Optimization
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="glass rounded-2xl shadow-glow overflow-hidden">
        {/* Chat Header */}
        <div className="gradient-primary p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Campaign Chat</h3>
                <p className="text-white/80 text-sm">Powered by GPT-4</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-white/90 bg-white/20 px-3 py-1 rounded-full backdrop-blur">
                AI Active
              </span>
            </div>
          </div>
        </div>
        
        {/* Chat Messages */}
        <div className="h-[500px] overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-6">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`mb-4 animate-fadeIn ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block max-w-2xl ${msg.role === 'user' ? 'text-left' : ''}`}>
                {msg.role === 'ai' && (
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                <div
                  className={`rounded-2xl px-5 py-3 shadow-lg ${
                    msg.role === 'ai'
                      ? 'glass ml-11'
                      : 'gradient-primary text-white'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-3 animate-fadeIn">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="glass rounded-2xl px-5 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-5 bg-white border-t border-gray-100">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your campaign idea..."
                className="w-full px-5 py-3 pr-12 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 transition-colors"
              />
              <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !message.trim()}
              className="px-6 py-3 gradient-primary text-white rounded-2xl hover:shadow-glow flex items-center gap-2 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
            >
              <Send className="w-5 h-5" />
              <span className="font-medium">Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Campaigns Grid */}
      <div className="glass rounded-2xl p-6 shadow-glow">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-secondary rounded-xl flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-xl text-gray-900">Suggested Campaigns</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              className="group relative p-5 glass rounded-xl hover:shadow-glow transition-all duration-300 transform hover:scale-105 text-left overflow-hidden"
              onClick={() => setMessage(suggestion)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">{suggestion}</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Rocket className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-purple-600 font-semibold">Quick Start</span>
                <span className="text-xs text-purple-600">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity with Timeline */}
      <div className="glass rounded-2xl p-6 shadow-glow">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-success rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-xl text-gray-900">Recent Activity</h3>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity, idx) => (
            <div key={idx} className="flex items-start gap-4 group">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
                {idx < recentActivity.length - 1 && (
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gray-200"></div>
                )}
              </div>
              <div className="flex-1 pb-2">
                <p className="text-sm text-gray-700">{activity}</p>
                <p className="text-xs text-gray-500 mt-1">Just now</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Add the Activity import from lucide-react if not already present