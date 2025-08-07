import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Plus, Search, FileText, Users, Car, Phone, Mail, Tag } from "lucide-react";
import type { Lead, Campaign } from "@shared/schema";

export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Fetch campaigns for filtering
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  // Fetch leads with optional campaign filter
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads", selectedCampaign],
    queryFn: async () => {
      const url = selectedCampaign && selectedCampaign !== "all" ? `/api/leads?campaignId=${selectedCampaign}` : "/api/leads";
      return await apiRequest(url) as Lead[];
    },
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (leadData: any) => {
      return await apiRequest("/api/leads", {
        method: "POST",
        body: JSON.stringify(leadData),
      });
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
      return fetch("/api/leads/upload-csv", {
        method: "POST",
        body: formData,
      }).then(res => res.json());
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
      return await apiRequest(`/api/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead status updated" });
    },
  });

  const handleCreateLead = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const leadData = {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground">Manage your automotive leads and track conversions</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Lead</DialogTitle>
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
                  <Label htmlFor="vehicleInterest">Vehicle Interest</Label>
                  <Input id="vehicleInterest" name="vehicleInterest" placeholder="e.g., 2024 Toyota Camry" />
                </div>
                <div>
                  <Label htmlFor="leadSource">Lead Source</Label>
                  <Select name="leadSource">
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="showroom">Showroom</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="advertising">Advertising</SelectItem>
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
                  {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lead Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <Tag className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{leadStats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacted</CardTitle>
            <Phone className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{leadStats.contacted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
            <Car className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{leadStats.qualified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
            <Mail className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{leadStats.converted}</div>
          </CardContent>
        </Card>
      </div>

      {/* CSV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Leads from CSV
          </CardTitle>
          <CardDescription>
            Upload a CSV file with columns: email, firstName, lastName, phone, vehicleInterest, leadSource, notes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="max-w-xs"
            />
            <Select onValueChange={(value) => setSelectedCampaign(value)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Associate with campaign (optional)" />
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
            >
              {csvUploadMutation.isPending ? "Uploading..." : "Upload CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="max-w-xs">
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

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leads ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leads found. Add leads manually or upload a CSV file.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle Interest</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead: Lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      {lead.firstName || lead.lastName 
                        ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
                        : "—"
                      }
                    </TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.phone || "—"}</TableCell>
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
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
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
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}