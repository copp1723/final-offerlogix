import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { Copy, Edit, Trash2, Plus, Eye, Play } from "lucide-react";
import CampaignExecutionModal from "@/components/campaigns/CampaignExecutionModal";
import type { Campaign } from "@shared/schema";

export default function CampaignsPage() {
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [cloneName, setCloneName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["/api/campaigns"],
  });

  const cloneMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      return await apiRequest(`/api/campaigns/${id}/clone`, "POST", { name });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Campaign cloned successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setCloneDialogOpen(false);
      setCloneName("");
      setSelectedCampaign(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clone campaign",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/campaigns/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  const handleClone = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCloneName(`${campaign.name} (Copy)`);
    setCloneDialogOpen(true);
  };

  const handleCloneConfirm = () => {
    if (selectedCampaign) {
      cloneMutation.mutate({
        id: selectedCampaign.id,
        name: cloneName || undefined,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-300";
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "completed":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-48"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.isArray(campaigns) && campaigns.map((campaign: Campaign) => (
          <Card key={campaign.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {campaign.context}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(campaign.status)}>
                  {campaign.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <div>Templates: {campaign.numberOfTemplates || 0}</div>
                  <div>Frequency: Every {campaign.daysBetweenMessages || 3} days</div>
                  {campaign.openRate && (
                    <div>Open Rate: {campaign.openRate}%</div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <CampaignExecutionModal campaign={{
                    ...campaign,
                    templates: typeof campaign.templates === 'string' ? campaign.templates : JSON.stringify(campaign.templates ?? [])
                  } as unknown as Campaign}>
                    <Button size="sm" className="flex-1">
                      <Play className="h-4 w-4 mr-1" />
                      Execute
                    </Button>
                  </CampaignExecutionModal>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleClone(campaign)}
                    disabled={cloneMutation.isPending}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{campaign.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(campaign.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Campaign</DialogTitle>
            <DialogDescription>
              Create a copy of "{selectedCampaign?.name}" with a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="clone-name" className="text-sm font-medium">
                Campaign Name
              </label>
              <Input
                id="clone-name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Enter new campaign name"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setCloneDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCloneConfirm}
                disabled={cloneMutation.isPending || !cloneName.trim()}
              >
                {cloneMutation.isPending ? "Cloning..." : "Clone Campaign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}