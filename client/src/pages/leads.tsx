import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Plus, Search, FileText, Users, Car, Phone, Mail, Tag, Target, MessageCircle, Lightbulb, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import LeadCampaignAssignment from "@/components/leads/LeadCampaignAssignment";
import type { Lead, Campaign } from "@shared/schema";
import ConversationView from "@/components/conversations/ConversationView";
import LeadDetailsDrawer from "@/components/LeadDetailsDrawerAdapter";

import type { ConversationMessage } from "@shared/schema";


// Small button to open conversation/details panel
function ConversationPreview({ onOpen }: { onOpen: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onOpen} className="flex items-center gap-1">
      <MessageCircle className="h-4 w-4" />
      View
    </Button>
  );
}

function LeadTwoPane({ lead }: { lead: Lead | null }) {
  const { data: messages = [] } = useQuery<ConversationMessage[]>({
    queryKey: ["/api/conversations", lead?.id, "messages"],
    enabled: !!lead?.id,
  });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">What we know</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add conversation-backed bullets here (e.g., "Asked for April follow-up").
          </CardContent>
        </Card>
      </div>
      <div>
        {lead?.id ? (
          <ConversationView conversationId={lead.id} messages={messages} onSendMessage={() => {}} isLoading={false} allowCompose={false} />
        ) : (
          <Card className="h-96"><CardContent className="p-6">Select a lead to view conversation</CardContent></Card>
        )}
      </div>
    </div>
  );
}


export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Handle leadId URL parameter from homepage navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const leadId = urlParams.get('leadId');

    if (leadId && leads) {
      const targetLead = leads.find(lead => lead.id === leadId);
      if (targetLead) {
        setSelectedLead(targetLead);
        // Scroll to lead in table if needed
        setTimeout(() => {
          const leadRow = document.querySelector(`[data-lead-id="${leadId}"]`);
          if (leadRow) {
            leadRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [location]);

  // Fetch campaigns for filtering
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  // Fetch leads with optional campaign filter
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads", selectedCampaign],
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (leadData: any) => {
      return await apiRequest("/api/leads", "POST", leadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Lead created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create lead", variant: "destructive" });
    },
  });

  // CSV upload mutation
  const csvUploadMutation = useMutation({
    mutationFn: ({ file, campaignId }: { file: File; campaignId?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (campaignId && campaignId !== "all" && campaignId !== "none") {
        formData.append("campaignId", campaignId);
      }
      return apiRequest<{ leads: Lead[] }>("/api/leads/upload-csv", "POST", formData as any);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setCsvFile(null);
      toast({
        title: "CSV uploaded successfully",
        description: `Imported ${data.leads?.length || 0} leads`
      });
    },
    onError: () => {
      toast({ title: "Failed to upload CSV", variant: "destructive" });
    },
  });

  // Update lead status mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/leads/${id}`, "PUT", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead status updated" });
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/leads/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete lead", variant: "destructive" });
    },
  });

  const handleCreateLead = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const leadData: any = {
      email: formData.get("email"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone"),
      vehicleInterest: formData.get("vehicleInterest"),
      leadSource: formData.get("leadSource"),
      notes: formData.get("notes"),
      campaignId: formData.get("campaignId") || null,
    };
    createLeadMutation.mutate(leadData);
  };

  const handleCsvUpload = () => {
    if (csvFile) {
      csvUploadMutation.mutate({ file: csvFile, campaignId: selectedCampaign });
    }
  };

  const filteredLeads = Array.isArray(leads) ? leads.filter((lead: Lead) =>
    !searchTerm ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.vehicleInterest?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-800";
      case "contacted": return "bg-yellow-100 text-yellow-800";
      case "qualified": return "bg-green-100 text-green-800";
      case "converted": return "bg-purple-100 text-purple-800";
      case "lost": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const leadStats = {
    total: Array.isArray(leads) ? leads.length : 0,
    new: Array.isArray(leads) ? leads.filter((l: Lead) => l.status === "new").length : 0,
    contacted: Array.isArray(leads) ? leads.filter((l: Lead) => l.status === "contacted").length : 0,
    qualified: Array.isArray(leads) ? leads.filter((l: Lead) => l.status === "qualified").length : 0,
    converted: Array.isArray(leads) ? leads.filter((l: Lead) => l.status === "converted").length : 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section - V2 Style */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-1">Track and manage your dealership leads and outreach campaigns</p>
        </div>
        <div className="flex gap-3">
          <LeadCampaignAssignment
            preSelectedLeadIds={selectedLeadIds}
            onAssignmentComplete={() => setSelectedLeadIds([])}
          >
            <Button variant="outline" disabled={selectedLeadIds.length === 0} className="shadow-sm">
              <Target className="h-4 w-4 mr-2" />
              Assign to Campaign {selectedLeadIds.length > 0 && `(${selectedLeadIds.length})`}
            </Button>
          </LeadCampaignAssignment>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>Add a new dealership lead for outreach</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" name="firstName" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" name="lastName" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
                <div>
                  <Label htmlFor="companyName">Dealership *</Label>
                  <Input id="companyName" name="companyName" placeholder="e.g., Premier Auto Group" required />
                </div>
                <div>
                  <Label htmlFor="vehicleInterest">Product to Pitch</Label>
                  <Select name="vehicleInterest">
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant_credit">Instant Credit Platform</SelectItem>
                      <SelectItem value="ai_agents">AI Financing Agents</SelectItem>
                      <SelectItem value="credit_api">Credit Decision API</SelectItem>
                      <SelectItem value="full_suite">Full Platform Suite</SelectItem>
                      <SelectItem value="subprime_module">Subprime Financing Module</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="leadSource">Source</Label>
                  <Select name="leadSource">
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="conference">Conference</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="campaignId">Campaign</Label>
                  <Select name="campaignId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select campaign (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No campaign</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Additional notes..." />
                </div>
                <Button type="submit" className="w-full" disabled={createLeadMutation.isPending}>
                  {createLeadMutation.isPending ? "Creating..." : "Add Lead"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dealership Statistics - V2 Style */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{leadStats.total}</div>
                <div className="text-sm text-gray-600">Total Leads</div>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{leadStats.new}</div>
                <div className="text-sm text-gray-600">New</div>
              </div>
              <Tag className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-600">{leadStats.contacted}</div>
                <div className="text-sm text-gray-600">Contacted</div>
              </div>
              <Phone className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{leadStats.qualified}</div>
                <div className="text-sm text-gray-600">Qualified</div>
              </div>
              <Car className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">{leadStats.converted}</div>
                <div className="text-sm text-gray-600">Converted</div>
              </div>
              <Target className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actionable Intelligence (no vanity metrics) */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recommended Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          When conversation data is available, this section will list concrete next actions
          like "Schedule demo with Smith Auto Group" or "Follow up with Johnson Motors (interested in credit solutions)".
        </CardContent>
      </Card>



      {/* CSV Upload Section - V2 Style */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">Import Dealerships</div>
                <div className="text-sm text-gray-600">Upload CSV with dealership data</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="w-48"
              />
              <Select onValueChange={(value) => setSelectedCampaign(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Campaign (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleCsvUpload}
                disabled={!csvFile || csvUploadMutation.isPending}
                className="shadow-sm"
              >
                {csvUploadMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Leads Table - V2 Style */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <FileText className="h-5 w-5" />
              Dealerships
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All campaigns</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading dealerships...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No dealerships found. Add dealerships manually or upload a CSV file.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedLeadIds(filteredLeads.map(lead => lead.id));
                        } else {
                          setSelectedLeadIds([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Dealership</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Conversation</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead: Lead) => (
                  <TableRow key={lead.id} data-lead-id={lead.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeadIds.includes(lead.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLeadIds(prev => [...prev, lead.id]);
                          } else {
                            setSelectedLeadIds(prev => prev.filter(id => id !== lead.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {lead.firstName || lead.lastName
                        ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()

                        : "—"
                      }
                    </TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.phone || "—"}</TableCell>
                    <TableCell>{lead.companyName || "—"}</TableCell>
                    <TableCell>{lead.vehicleInterest || "—"}</TableCell>
                    <TableCell>{lead.leadSource || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.status || "new"}
                        onValueChange={(status) =>
                          updateLeadMutation.mutate({ id: lead.id, status })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <Badge className={getStatusColor(lead.status || "new")}>
                            {lead.status || "new"}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Demo Scheduled</SelectItem>
                          <SelectItem value="converted">Customer</SelectItem>
                          <SelectItem value="lost">Not Interested</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {lead.createdAt
                        ? new Date(lead.createdAt).toLocaleDateString()
                        : "—"
                      }
                    </TableCell>
                    <TableCell>
                      {/* V2 Conversation Status */}
                      {(() => {
                        const bridgedLead = lead as any;
                        const hasV2Conversation = bridgedLead.v2ConversationId;
                        const messageCount = bridgedLead.v2MessageCount || 0;
                        const lastActivity = bridgedLead.v2LastMessageAt;

                        if (hasV2Conversation) {
                          return (
                            <div className="text-xs">
                              <div className="font-medium text-green-700">{messageCount} messages</div>
                              {lastActivity && (
                                <div className="text-gray-500">
                                  {new Date(lastActivity).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          return <span className="text-xs text-gray-400">No conversation</span>;
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {/* Priority badge based on V2 conversation data */}
                      {(() => {
                        const bridgedLead = lead as any;
                        const hasV2Conversation = bridgedLead.v2ConversationId;
                        const messageCount = bridgedLead.v2MessageCount || 0;
                        const hasResponses = bridgedLead.v2HasResponses;
                        const recentActivity = bridgedLead.v2LastMessageAt &&
                          new Date(bridgedLead.v2LastMessageAt).getTime() > Date.now() - (6 * 60 * 60 * 1000); // 6 hours

                        if (hasV2Conversation && messageCount >= 3 && recentActivity) {
                          return <span className="text-xs px-2 py-1 rounded border bg-red-50 text-red-800 border-red-200">Urgent</span>;
                        } else if (hasV2Conversation && (messageCount >= 2 || hasResponses)) {
                          return <span className="text-xs px-2 py-1 rounded border bg-amber-50 text-amber-800 border-amber-200">Priority outreach</span>;
                        } else if (hasV2Conversation) {
                          return <span className="text-xs px-2 py-1 rounded border bg-blue-50 text-blue-800 border-blue-200">Active conversation</span>;
                        } else {
                          return <span className="text-xs text-muted-foreground">—</span>;
                        }
                      })()}
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onMouseEnter={() => setSelectedLead(lead)}
                        onFocus={() => setSelectedLead(lead)}
                        onClick={() => setSelectedLead(lead)}
                      >
                        View
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Dealership</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this dealership? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteLeadMutation.mutate(lead.id)}
                              className="bg-red-600 hover:bg-red-700"
                              disabled={deleteLeadMutation.isPending}
                            >
                              {deleteLeadMutation.isPending ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <LeadDetailsDrawer lead={selectedLead as any} isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} />

    </div>
  );
}