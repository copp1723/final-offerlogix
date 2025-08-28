import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, User, AlertTriangle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface HandoverRequest {
  id: string;
  conversationId: string;
  reason: string;
  priority: 'high' | 'normal' | 'low';
  status: 'pending' | 'resolved' | 'escalated';
  createdAt: string;
  resolvedAt?: string;
  customerEmail: string;
  campaignName?: string;
}

export default function HandoversPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedHandover, setSelectedHandover] = useState<HandoverRequest | null>(null);

  // Fetch handover requests
  const { data: handovers = [], isLoading } = useQuery<HandoverRequest[]>({
    queryKey: ["/api/handovers"],
  });

  // Resolve handover mutation
  const resolveHandoverMutation = useMutation({
    mutationFn: (handoverId: string) => 
      apiRequest(`/api/handovers/${handoverId}/resolve`, 'POST', {}),
    onSuccess: () => {
      toast({ title: "Handover resolved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/handovers"] });
      setSelectedHandover(null);
    },
    onError: () => {
      toast({ title: "Failed to resolve handover", variant: "destructive" });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "normal":
        return "bg-blue-100 text-blue-800";
      case "low":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "escalated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pendingHandovers = handovers.filter(h => h.status === 'pending');
  const resolvedHandovers = handovers.filter(h => h.status === 'resolved');

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Handover Queue</h1>
          <p className="text-gray-600 mt-1">Manage AI-to-human handover requests from campaigns</p>
        </div>
        
        <div className="flex gap-2 text-sm">
          <div className="bg-yellow-50 px-3 py-1 rounded-full">
            ⏳ Pending: {pendingHandovers.length}
          </div>
          <div className="bg-green-50 px-3 py-1 rounded-full">
            ✅ Resolved: {resolvedHandovers.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Handover List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Handovers ({pendingHandovers.length})
            </h2>
          </div>
          
          {pendingHandovers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                <p className="text-gray-500">No pending handover requests at the moment.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingHandovers.map((handover) => (
                <Card
                  key={handover.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedHandover?.id === handover.id ? "ring-2 ring-blue-500" : ""
                  }`}
                  onClick={() => setSelectedHandover(handover)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <div>
                          <h3 className="font-medium text-gray-900">{handover.customerEmail}</h3>
                          {handover.campaignName && (
                            <p className="text-sm text-gray-500">Campaign: {handover.campaignName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(handover.priority)}>
                          {handover.priority}
                        </Badge>
                        <Badge className={getStatusColor(handover.status)}>
                          {handover.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-3">{handover.reason}</p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(handover.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveHandoverMutation.mutate(handover.id);
                        }}
                        disabled={resolveHandoverMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Recently Resolved */}
          {resolvedHandovers.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recently Resolved ({resolvedHandovers.slice(0, 5).length})
              </h2>
              <div className="space-y-2">
                {resolvedHandovers.slice(0, 5).map((handover) => (
                  <Card key={handover.id} className="bg-gray-50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="font-medium text-gray-900">{handover.customerEmail}</span>
                          <Badge className={getStatusColor(handover.status)} variant="outline">
                            {handover.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          {handover.resolvedAt && new Date(handover.resolvedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Handover Details */}
        <div className="lg:col-span-1">
          {selectedHandover ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Handover Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Customer</label>
                  <p className="text-gray-900">{selectedHandover.customerEmail}</p>
                </div>
                
                {selectedHandover.campaignName && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Campaign</label>
                    <p className="text-gray-900">{selectedHandover.campaignName}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Reason</label>
                  <p className="text-gray-900">{selectedHandover.reason}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Priority</label>
                  <Badge className={getPriorityColor(selectedHandover.priority)}>
                    {selectedHandover.priority}
                  </Badge>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Created</label>
                  <p className="text-gray-900">
                    {new Date(selectedHandover.createdAt).toLocaleString()}
                  </p>
                </div>

                {selectedHandover.status === 'pending' && (
                  <div className="pt-4 border-t">
                    <Button
                      className="w-full"
                      onClick={() => resolveHandoverMutation.mutate(selectedHandover.id)}
                      disabled={resolveHandoverMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {resolveHandoverMutation.isPending ? "Resolving..." : "Mark as Resolved"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Handover</h3>
                <p className="text-gray-500">Click on a handover request to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
