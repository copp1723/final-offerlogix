import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Target, Mail } from "lucide-react";

interface LeadCampaignAssignmentProps {
  children: React.ReactNode;
  preSelectedLeadIds?: string[];
  onAssignmentComplete?: () => void;
}

export default function LeadCampaignAssignment({ children, preSelectedLeadIds = [], onAssignmentComplete }: LeadCampaignAssignmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>(preSelectedLeadIds);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns } = useQuery({
    queryKey: ["/api/campaigns"],
  });

  const { data: leads } = useQuery({
    queryKey: ["/api/leads"],
  });

  // Update selected leads when dialog opens with pre-selected IDs
  useEffect(() => {
    if (isOpen && preSelectedLeadIds.length > 0) {
      setSelectedLeads(preSelectedLeadIds);
    }
  }, [isOpen, preSelectedLeadIds]);

  const assignLeadsMutation = useMutation({
    mutationFn: async (data: { campaignId: string; leadIds: string[] }) => {
      // Update each lead with the campaign ID
      const promises = data.leadIds.map(leadId =>
        apiRequest(`/api/leads/${leadId}`, "PUT", { campaignId: data.campaignId })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Leads Assigned",
        description: `Successfully assigned ${selectedLeads.length} leads to campaign`,
      });
      setIsOpen(false);
      setSelectedCampaign("");
      setSelectedLeads([]);
      onAssignmentComplete?.();
    },
    onError: () => {
      toast({
        title: "Assignment Failed",
        description: "Failed to assign leads to campaign",
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    if (selectedCampaign && selectedLeads.length > 0) {
      assignLeadsMutation.mutate({
        campaignId: selectedCampaign,
        leadIds: selectedLeads
      });
    }
  };

  const campaignList = Array.isArray(campaigns) ? campaigns : [];
  const leadList = Array.isArray(leads) ? leads : [];
  // Show all leads, not just unassigned ones - allow reassignment
  const availableLeads = leadList;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Assign Leads to Campaign
          </DialogTitle>
          <DialogDescription>
            Assign or reassign leads to a specific campaign for targeted outreach
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Campaign Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Campaign</CardTitle>
              <CardDescription>Choose which campaign to assign the leads to</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaignList.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <span>{campaign.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {campaign.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Lead Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Available Leads ({availableLeads.length})
              </CardTitle>
              <CardDescription>Select leads to assign to the campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {availableLeads.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No leads available</p>
                  <p className="text-sm text-gray-400">Upload some leads first</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLeads(
                        selectedLeads.length === availableLeads.length
                          ? []
                          : availableLeads.map(lead => lead.id)
                      )}
                    >
                      {selectedLeads.length === availableLeads.length ? "Deselect All" : "Select All"}
                    </Button>
                    <span className="text-sm text-gray-600">
                      {selectedLeads.length} of {availableLeads.length} selected
                    </span>
                  </div>
                  
                  {availableLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedLeads.includes(lead.id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => {
                        setSelectedLeads(prev =>
                          prev.includes(lead.id)
                            ? prev.filter(id => id !== lead.id)
                            : [...prev, lead.id]
                        );
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{lead.email}</p>
                          {lead.vehicleInterest && (
                            <p className="text-xs text-gray-500">
                              Interested in: {lead.vehicleInterest}
                            </p>
                          )}
                          {lead.campaignId && (
                            <p className="text-xs text-blue-600">
                              Currently in: {campaignList.find(c => c.id === lead.campaignId)?.name || 'Unknown Campaign'}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {lead.status}
                          </Badge>
                          {lead.campaignId && (
                            <Badge variant="outline" className="text-xs text-blue-600">
                              Assigned
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleAssign}
              disabled={!selectedCampaign || selectedLeads.length === 0 || assignLeadsMutation.isPending}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              {assignLeadsMutation.isPending ? "Assigning..." : `Assign ${selectedLeads.length} Leads`}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}