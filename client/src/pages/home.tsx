import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CampaignModal from '@/components/campaign/CampaignModal';
import { useState } from 'react';
import { Bot, MessageCircle, Target, Mail, Check, Users, Brain, Calendar, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface HomeData {
  metrics: {
    liveCampaigns: number;
    handovers: number;
  };
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const [showCampaignForm, setShowCampaignForm] = useState(false);

  // Fetch real V2 campaigns data (Kunes dealership campaigns)
  const { data: campaigns } = useQuery({
    queryKey: ["/v2/campaigns"],
    queryFn: async () => {
      const response = await fetch('/v2/campaigns');
      if (!response.ok) throw new Error('Failed to fetch V2 campaigns');
      const data = await response.json();
      return data.campaigns || [];
    },
  });

  // Calculate real V2 campaign stats
  const activeCampaigns = campaigns?.filter((c: any) => c.status === 'active') || [];
  const totalEmailsSent = campaigns?.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0;
  const totalResponses = campaigns?.reduce((sum: number, c: any) => sum + (c.totalResponses || 0), 0) || 0;
  const successRate = totalEmailsSent > 0 ? Math.round((totalResponses / totalEmailsSent) * 100) : 0;



  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page heading with top-right metrics */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">AI Sales Platform</h1>
          <p className="text-sm text-gray-600">Monitor and manage your dealership outreach campaigns</p>
        </div>
        
        {/* Top-right metrics */}
        <div className="flex gap-3">
          <Card className="min-w-[140px] bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Active Campaigns</div>
              <div className="text-2xl text-gray-900">{activeCampaigns.length}</div>
            </CardContent>
          </Card>

          <Card className="min-w-[140px] bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Outreach Sent</div>
              <div className="text-2xl text-gray-900">{totalEmailsSent}</div>
            </CardContent>
          </Card>

          <Card className="min-w-[140px] bg-orange-50 border-orange-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Success Rate</div>
              <div className="text-2xl text-gray-900">{successRate}%</div>
            </CardContent>
          </Card>

          <Card className="min-w-[140px] bg-purple-50 border-purple-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Responses</div>
              <div className="text-2xl text-gray-900">{totalResponses}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Active Dealership Campaigns</h2>
          <button
            onClick={() => setShowCampaignForm(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Bot className="w-4 h-4 mr-2" />
            Create Campaign
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCampaigns.length > 0 ? (
            activeCampaigns.map((campaign: any, index: number) => (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    <div className="text-sm text-gray-600">Kunes dealership AI campaign</div>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{campaign.totalSent || 0} emails sent</div>
                      <div className="text-xs text-gray-600">{campaign.totalResponses || 0} responses</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="p-8 text-center">
                <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Campaigns</h3>
                <p className="text-gray-600 mb-4">Create your first AI campaign to get started</p>
                <button
                  onClick={() => setShowCampaignForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Create Campaign
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>



      {/* Campaign Form */}
      <CampaignModal
        isOpen={showCampaignForm}
        onClose={() => setShowCampaignForm(false)}
      />
    </div>
  );
}

