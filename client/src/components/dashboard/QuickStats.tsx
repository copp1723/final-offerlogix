import { Activity, Users, ArrowRightLeft, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <>
      {/* Engaged Leads Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <Users className="h-4 w-4 mr-2 text-green-600" />
            Engaged Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{engagedLeads}</div>
          <p className="text-xs text-muted-foreground">
            {totalLeads > 0 ? `${Math.round((engagedLeads / totalLeads) * 100)}% of total leads` : 'No leads yet'}
          </p>
        </CardContent>
      </Card>

      {/* Handovers Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <ArrowRightLeft className="h-4 w-4 mr-2 text-orange-600" />
            Handovers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{handoverCount}</div>
          <p className="text-xs text-muted-foreground">
            {conversations?.length ? `${Math.round((handoverCount / conversations.length) * 100)}% success rate` : 'No conversations yet'}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
