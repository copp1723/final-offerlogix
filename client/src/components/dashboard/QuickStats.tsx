import { Activity, Users, ArrowRightLeft, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@shared/schema";

interface Lead {
  id: string;
  status: string;
  assignedTo?: string;
}

interface Conversation {
  id: string;
  status: string;
  handoverCompleted: boolean;
}

export default function QuickStats() {
  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    retry: false
  });

  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    retry: false
  });

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;
  const engagedLeads = leads?.filter(l => l.status === 'engaged' || l.assignedTo).length || 0;
  const handoverCount = conversations?.filter(c => c.handoverCompleted).length || 0;
  const totalLeads = leads?.length || 0;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Campaigns</p>
              <p className="text-2xl font-bold text-gray-900">{activeCampaigns}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Engaged Leads</p>
              <p className="text-2xl font-bold text-gray-900">{engagedLeads}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-green-600 mt-2">
            {totalLeads > 0 ? `${Math.round((engagedLeads / totalLeads) * 100)}% of total leads` : 'No leads yet'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Handovers Completed</p>
              <p className="text-2xl font-bold text-gray-900">{handoverCount}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-orange-600 mt-2">
            {conversations?.length ? `${Math.round((handoverCount / conversations.length) * 100)}% handover rate` : 'No conversations yet'}
          </p>
        </div>
      </div>
    </div>
  );
}
