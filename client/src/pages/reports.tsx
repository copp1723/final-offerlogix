import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, MessageSquare, Send, Activity } from "lucide-react";

export default function ReportsPage() {
  // Fetch V2 data for basic metrics
  const { data: campaignsData } = useQuery({
    queryKey: ["/v2/campaigns"],
    queryFn: async () => {
      const response = await fetch('/v2/campaigns');
      if (!response.ok) throw new Error('Failed to fetch V2 campaigns');
      const data = await response.json();
      return data.campaigns || [];
    },
  });

  const { data: conversationsData } = useQuery({
    queryKey: ["/v2/conversations"],
    queryFn: async () => {
      const response = await fetch('/v2/conversations?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch V2 conversations');
      const data = await response.json();
      return data.conversations || [];
    },
  });

  const { data: agentsData } = useQuery({
    queryKey: ["/v2/agents"],
    queryFn: async () => {
      const response = await fetch('/v2/agents');
      if (!response.ok) throw new Error('Failed to fetch V2 agents');
      const data = await response.json();
      return data.agents || [];
    },
  });

  // Use the fetched data with fallbacks
  const campaigns = campaignsData || [];
  const conversations = conversationsData || [];
  const agents = agentsData || [];

  // Calculate V2 metrics
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalConversations = conversations.length;
  const activeConversations = conversations.filter(c => c.status === 'active').length;
  const totalAgents = agents.length;

  // Calculate total emails sent and responses from campaigns
  const totalEmailsSent = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
  const totalResponses = campaigns.reduce((sum, c) => sum + (c.totalResponses || 0), 0);
  const overallSuccessRate = totalEmailsSent > 0 ? Math.round((totalResponses / totalEmailsSent) * 100) : 0;

  // Conversation engagement metrics
  const avgMessagesPerConversation = totalConversations > 0
    ? Math.round(conversations.reduce((acc, conv) => acc + (conv.messageCount || 0), 0) / totalConversations)
    : 0;

  // Active conversations with responses
  const conversationsWithResponses = conversations.filter(c => (c.messageCount || 0) > 1).length;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Campaign Reports & Analytics</h1>
        <p className="text-gray-600 mt-2">Monitor your campaign performance and lead engagement metrics</p>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {activeCampaigns} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmailsSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalResponses} responses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversations}</div>
            <p className="text-xs text-muted-foreground">
              {activeConversations} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallSuccessRate}%</div>
            <p className="text-xs text-muted-foreground">
              Response rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Campaign Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active</span>
                <Badge variant="default">{activeCampaigns}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Inactive</span>
                <Badge variant="secondary">{campaigns.filter(c => c.status === 'inactive').length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Agents</span>
                <Badge variant="outline">{totalAgents}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">With Responses</span>
                <Badge variant="default">{conversationsWithResponses}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Conversation Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active</span>
                <Badge variant="default">{activeConversations}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Closed</span>
                <Badge variant="secondary">{conversations.filter(c => c.status === 'closed').length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Archived</span>
                <Badge variant="outline">{conversations.filter(c => c.status === 'archived').length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Avg Messages</span>
                <Badge variant="outline">{avgMessagesPerConversation}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaign Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No campaigns yet. Create your first campaign to see activity here.</p>
          ) : (
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{campaign.name}</h4>
                    <p className="text-sm text-gray-500">
                      {campaign.totalSent || 0} emails sent • {campaign.totalResponses || 0} responses
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                    {campaign.totalSent > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round(((campaign.totalResponses || 0) / campaign.totalSent) * 100)}% success
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}