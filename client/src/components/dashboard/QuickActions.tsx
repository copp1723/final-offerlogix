import { Bot, Settings, BarChart3, ArrowRight, MessageSquare, Shield } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import CampaignModal from "@/components/campaign/CampaignModal";

export default function QuickActions() {
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

  return (
    <>
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* AI Campaign Agent Card */}
          <div 
            className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
            onClick={() => setIsCampaignModalOpen(true)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">AI Campaign Agent</h4>
            <p className="text-gray-600 text-sm">Create automotive email campaigns with intelligent AI guidance</p>
          </div>

          {/* Campaign Settings Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:border-gray-300 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Campaign Settings</h4>
            <p className="text-gray-600 text-sm">Configure templates and automation rules for campaigns</p>
          </div>

          {/* Analytics Hub Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:border-green-300 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Performance Analytics</h4>
            <p className="text-gray-600 text-sm">Track test drives, service bookings, and engagement metrics</p>
          </div>

          {/* Conversations Card */}
          <Link href="/conversations">
            <div className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:border-purple-300 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Conversations</h4>
              <p className="text-gray-600 text-sm">Manage customer conversations and support requests</p>
            </div>
          </Link>

          {/* User Management Card */}
          <Link href="/users">
            <div className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:border-orange-300 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <Shield className="w-6 h-6 text-orange-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 transition-colors" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">User Management</h4>
              <p className="text-gray-600 text-sm">Manage user roles and access permissions</p>
            </div>
          </Link>
        </div>
      </div>

      <CampaignModal 
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
      />
    </>
  );
}
