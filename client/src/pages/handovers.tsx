import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { Clock, User, Car, AlertTriangle, Target, TrendingUp, CheckCircle } from "lucide-react";

interface HandoverBrief {
  leadName?: string;
  leadEmail: string;
  productInfo?: string;
  campaignSource: string;
  implementationWindow?: string;
  conversationSummary: string;
  keyIntents: string[];
  communicationStyle: string;
  priorities: string[];
  competitiveContext?: string;
  salesStrategy: string[];
  closingStrategies: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  handoverReason: string;
  triggeredBy: string;
  generatedAt: string;
}

interface HandoverItem {
  id: string;
  leadEmail: string;
  subject: string;
  handoverAt: string;
  handoverReason: string;
  agentId: string;
  hasHandoverBrief: boolean;
}

export default function HandoversPage() {
  const [selectedBrief, setSelectedBrief] = useState<HandoverBrief | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [briefDialogOpen, setBriefDialogOpen] = useState(false);

  // Fetch pending handovers
  const { data: handovers, isLoading } = useQuery<HandoverItem[]>({
    queryKey: ["/v2/handovers/pending"],
    queryFn: () => apiRequest("/v2/handovers/pending", "GET"),
  });

  // Fetch specific handover brief
  const { data: briefData } = useQuery({
    queryKey: ["/v2/handovers/conversation", selectedConversationId],
    queryFn: () => apiRequest(`/v2/handovers/conversation/${selectedConversationId}`, "GET"),
    enabled: !!selectedConversationId,
  });

  const handleViewBrief = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setBriefDialogOpen(true);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <Clock className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading handovers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Sales Qualified Leads</h1>
          <p className="text-sm text-gray-600">Dealership leads ready for direct sales engagement</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {handovers?.length || 0} pending
        </Badge>
      </div>

      {/* Handovers Grid */}
      {!handovers || handovers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No handovers yet</h3>
            <p className="text-gray-500">
              When conversations are handed over to humans, they'll appear here with AI-generated briefs
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {handovers.map((handover) => (
            <Card key={handover.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>{handover.leadEmail}</span>
                    </CardTitle>
                    <p className="text-sm text-gray-600">{handover.subject}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {new Date(handover.handoverAt).toLocaleDateString()} at{' '}
                        {new Date(handover.handoverAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <strong>Reason:</strong> {handover.handoverReason}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <Badge variant={handover.hasHandoverBrief ? "default" : "secondary"}>
                      {handover.hasHandoverBrief ? "Brief Available" : "No Brief"}
                    </Badge>
                    
                    {handover.hasHandoverBrief && (
                      <Button
                        size="sm"
                        onClick={() => handleViewBrief(handover.id)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        View Brief
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Handover Brief Dialog */}
      <Dialog open={briefDialogOpen} onOpenChange={setBriefDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Lead Handover Brief</DialogTitle>
          </DialogHeader>
          
          {briefData?.brief && (
            <div className="max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-6">
                {/* Lead Identification */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Lead Identification</span>
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div><strong>Name:</strong> {briefData.brief.leadName || 'Not provided'}</div>
                    <div><strong>Contact:</strong> {briefData.brief.leadEmail}</div>
                    {briefData.brief.vehicleInfo && (
                      <div className="flex items-center space-x-2">
                        <Car className="w-4 h-4" />
                        <span><strong>Vehicle:</strong> {briefData.brief.vehicleInfo}</span>
                      </div>
                    )}
                    <div><strong>Source:</strong> {briefData.brief.campaignSource}</div>
                    <div><strong>Purchase Window:</strong> {briefData.brief.purchaseWindow || 'Timeline unclear'}</div>
                  </div>
                </div>

                <Separator />

                {/* Conversation Summary */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Conversation Summary</h3>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                    <p>{briefData.brief.conversationSummary}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <strong>Key Intents:</strong>
                      {briefData.brief.keyIntents.map((intent) => (
                        <Badge key={intent} variant="secondary">{intent}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Relationship-Building Intel */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Relationship-Building Intel</span>
                  </h3>
                  <div className="bg-green-50 p-4 rounded-lg space-y-2">
                    <div><strong>Communication Style:</strong> {briefData.brief.communicationStyle}</div>
                    <div>
                      <strong>Priorities:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {briefData.brief.priorities.map((priority, idx) => (
                          <li key={idx}>{priority}</li>
                        ))}
                      </ul>
                    </div>
                    {briefData.brief.competitiveContext && (
                      <div><strong>Competitive Context:</strong> {briefData.brief.competitiveContext}</div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Sales Strategy */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>Sales Strategy & Engagement Tips</span>
                  </h3>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <ul className="list-disc list-inside space-y-1">
                      {briefData.brief.salesStrategy.map((strategy, idx) => (
                        <li key={idx}>{strategy}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Separator />

                {/* Closing Strategies */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5" />
                    <span>Closing Strategies</span>
                  </h3>
                  <div className="bg-orange-50 p-4 rounded-lg space-y-2">
                    <div className="flex items-center space-x-2 mb-2">
                      {getUrgencyIcon(briefData.brief.urgencyLevel)}
                      <Badge className={getUrgencyColor(briefData.brief.urgencyLevel)}>
                        {briefData.brief.urgencyLevel.toUpperCase()} URGENCY
                      </Badge>
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {briefData.brief.closingStrategies.map((strategy, idx) => (
                        <li key={idx}>{strategy}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Meta Information */}
                <div className="text-xs text-gray-500 border-t pt-4">
                  <div>Generated: {new Date(briefData.brief.generatedAt).toLocaleString()}</div>
                  <div>Triggered by: {briefData.brief.triggeredBy}</div>
                  <div>Reason: {briefData.brief.handoverReason}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
