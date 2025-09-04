import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Users, UserPlus, Check, X, FileUp, Download, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeadSelectionStepProps {
  campaignId?: string;
  onNext: () => void;
  onBack: () => void;
}

export default function LeadSelectionStep({ campaignId, onNext, onBack }: LeadSelectionStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualLead, setManualLead] = useState({ email: "", firstName: "", lastName: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing leads
  const { data: existingLeads = [], isLoading: leadsLoading } = useQuery<any[]>({
    queryKey: ["/api/leads"],
  });

  // CSV Upload mutation
  const uploadCSV = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (campaignId) {
        formData.append("campaignId", campaignId);
      }

      // Use centralized apiRequest which attaches auth headers and
      // handles FormData correctly (no Content-Type override).
      return await apiRequest<{ uploaded: number }>("/api/leads/upload-csv", "POST", formData as unknown as FormData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Success",
        description: `Uploaded ${data.uploaded} dealerships successfully`,
      });
      setSelectedFile(null);
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  // Manual lead creation
  const createLead = useMutation({
    mutationFn: (leadData: any) => 
      apiRequest("/api/leads", "POST", { ...leadData, campaignId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead added successfully" });
      setManualLead({ email: "", firstName: "", lastName: "" });
      setShowManualAdd(false);
    },
    onError: () => {
      toast({ title: "Failed to add lead", variant: "destructive" });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      setUploadProgress(50);
      uploadCSV.mutate(selectedFile);
    }
  };

  const handleManualAdd = () => {
    if (!manualLead.email) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }
    createLead.mutate(manualLead);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.length === existingLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds((existingLeads || []).map((lead: any) => lead.id));
    }
  };

  const campaignLeads = (existingLeads || []).filter((lead: any) => 
    !lead.campaignId || lead.campaignId === campaignId
  );

  const totalLeads = campaignLeads.length;
  const selectedCount = selectedLeadIds.length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Total Leads</p>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Selected</p>
                <p className="text-2xl font-bold">{selectedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Available</p>
                <p className="text-2xl font-bold">{totalLeads - selectedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Leads
          </CardTitle>
          <CardDescription>
            Upload a CSV file with leads or add them manually
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <FileUp className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : "Choose CSV File"}
              </Button>
            </div>
            {selectedFile && (
              <Button 
                onClick={handleUpload}
                disabled={uploadCSV.isPending}
              >
                {uploadCSV.isPending ? "Uploading..." : "Upload"}
              </Button>
            )}
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualAdd(!showManualAdd)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Manually
            </Button>
            <a
              href="/api/leads/template"
              download="lead-template.csv"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Download Template
            </a>
          </div>

          {showManualAdd && (
            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={manualLead.email}
                  onChange={(e) => setManualLead({ ...manualLead, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={manualLead.firstName}
                    onChange={(e) => setManualLead({ ...manualLead, firstName: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={manualLead.lastName}
                    onChange={(e) => setManualLead({ ...manualLead, lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  onClick={handleManualAdd}
                  disabled={createLead.isPending}
                >
                  {createLead.isPending ? "Adding..." : "Add Lead"}
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => setShowManualAdd(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Selection */}
      {totalLeads > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Select Leads for Campaign</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllLeads}
              >
                {selectedLeadIds.length === campaignLeads.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {campaignLeads.map((lead: any) => (
                <div
                  key={lead.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedLeadIds.includes(lead.id) 
                      ? "bg-blue-50 border-blue-300" 
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => toggleLeadSelection(lead.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedLeadIds.includes(lead.id) 
                        ? "bg-blue-600 border-blue-600" 
                        : "border-gray-300"
                    }`}>
                      {selectedLeadIds.includes(lead.id) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {lead.firstName && lead.lastName 
                          ? `${lead.firstName} ${lead.lastName}` 
                          : lead.email}
                      </p>
                      {lead.firstName && lead.lastName && (
                        <p className="text-sm text-gray-500">{lead.email}</p>
                      )}
                    </div>
                  </div>
                  {lead.status && (
                    <Badge variant="outline">{lead.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={onNext}
          disabled={totalLeads === 0}
        >
          {totalLeads === 0 ? "Add Leads to Continue" : `Continue with ${selectedCount || totalLeads} Leads`}
        </Button>
      </div>
    </div>
  );
}