import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Save, Settings, Palette, Globe } from "lucide-react";
import type { Client, InsertClient } from "@shared/schema";

export default function WhiteLabelPage() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      return await apiRequest("/api/clients", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowCreateForm(false);
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertClient> }) => {
      return await apiRequest(`/api/clients/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditMode(false);
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/clients/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setSelectedClient(null);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive",
      });
    },
  });

  const handleCreateClient = (formData: FormData) => {
    const name = formData.get('name') as string;
    const domain = formData.get('domain') as string;
    const companyName = formData.get('companyName') as string;
    const primaryColor = formData.get('primaryColor') as string;
    const secondaryColor = formData.get('secondaryColor') as string;

    createMutation.mutate({
      name,
      domain,
      brandingConfig: {
        companyName,
        primaryColor,
        secondaryColor,
        logoUrl: '',
        favicon: '',
        customCss: ''
      },
      settings: {},
      active: true
    });
  };

  const handleUpdateClient = (formData: FormData) => {
    if (!selectedClient) return;

    const name = formData.get('name') as string;
    const domain = formData.get('domain') as string;
    const companyName = formData.get('companyName') as string;
    const primaryColor = formData.get('primaryColor') as string;
    const secondaryColor = formData.get('secondaryColor') as string;
    const logoUrl = formData.get('logoUrl') as string;
    const customCss = formData.get('customCss') as string;
    const active = formData.get('active') === 'on';

    updateMutation.mutate({
      id: selectedClient.id,
      data: {
        name,
        domain,
        brandingConfig: {
          companyName,
          primaryColor,
          secondaryColor,
          logoUrl,
          favicon: '',
          customCss
        },
        settings: {},
        active
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">White Label Management</h1>
              <p className="text-lg text-gray-600 mt-2">
                Manage client branding and multi-tenant configurations
              </p>
            </div>
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Client
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Client List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(clients) && clients.map((client: Client) => (
                    <div
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client);
                        setEditMode(false);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedClient?.id === client.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{client.name}</h3>
                          <p className="text-sm text-gray-500">{client.domain || 'No domain'}</p>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${client.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Client Details/Form */}
          <div className="lg:col-span-2">
            {showCreateForm ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Client</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleCreateClient(formData);
                  }} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Client Name</Label>
                      <Input id="name" name="name" required />
                    </div>
                    <div>
                      <Label htmlFor="domain">Domain</Label>
                      <Input id="domain" name="domain" placeholder="client.yourdomain.com" />
                    </div>
                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input id="companyName" name="companyName" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="primaryColor">Primary Color</Label>
                        <Input id="primaryColor" name="primaryColor" type="color" defaultValue="#2563eb" />
                      </div>
                      <div>
                        <Label htmlFor="secondaryColor">Secondary Color</Label>
                        <Input id="secondaryColor" name="secondaryColor" type="color" defaultValue="#1e40af" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        Create Client
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : selectedClient ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5" />
                      {selectedClient.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditMode(!editMode)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this client?')) {
                            deleteMutation.mutate(selectedClient.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editMode ? (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      handleUpdateClient(formData);
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Client Name</Label>
                        <Input id="name" name="name" defaultValue={selectedClient.name} required />
                      </div>
                      <div>
                        <Label htmlFor="domain">Domain</Label>
                        <Input id="domain" name="domain" defaultValue={selectedClient.domain || ''} />
                      </div>
                      <div>
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input 
                          id="companyName" 
                          name="companyName" 
                          defaultValue={(selectedClient.brandingConfig as any)?.companyName || ''} 
                          required 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="primaryColor">Primary Color</Label>
                          <Input 
                            id="primaryColor" 
                            name="primaryColor" 
                            type="color" 
                            defaultValue={(selectedClient.brandingConfig as any)?.primaryColor || '#2563eb'} 
                          />
                        </div>
                        <div>
                          <Label htmlFor="secondaryColor">Secondary Color</Label>
                          <Input 
                            id="secondaryColor" 
                            name="secondaryColor" 
                            type="color" 
                            defaultValue={(selectedClient.brandingConfig as any)?.secondaryColor || '#1e40af'} 
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="logoUrl">Logo URL</Label>
                        <Input 
                          id="logoUrl" 
                          name="logoUrl" 
                          type="url"
                          defaultValue={(selectedClient.brandingConfig as any)?.logoUrl || ''} 
                        />
                      </div>
                      <div>
                        <Label htmlFor="customCss">Custom CSS</Label>
                        <Textarea 
                          id="customCss" 
                          name="customCss" 
                          rows={6}
                          defaultValue={(selectedClient.brandingConfig as any)?.customCss || ''} 
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="active" 
                          name="active" 
                          defaultChecked={selectedClient.active} 
                        />
                        <Label htmlFor="active">Active</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateMutation.isPending}>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditMode(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Domain</Label>
                          <p className="text-sm">{selectedClient.domain || 'Not set'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Status</Label>
                          <p className={`text-sm ${selectedClient.active ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedClient.active ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Company Name</Label>
                        <p className="text-sm">{(selectedClient.brandingConfig as any)?.companyName || 'Not set'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Primary Color</Label>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: (selectedClient.brandingConfig as any)?.primaryColor || '#2563eb' }}
                            />
                            <span className="text-sm">{(selectedClient.brandingConfig as any)?.primaryColor || '#2563eb'}</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Secondary Color</Label>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: (selectedClient.brandingConfig as any)?.secondaryColor || '#1e40af' }}
                            />
                            <span className="text-sm">{(selectedClient.brandingConfig as any)?.secondaryColor || '#1e40af'}</span>
                          </div>
                        </div>
                      </div>
                      {(selectedClient.brandingConfig as any)?.logoUrl && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Logo</Label>
                          <img 
                            src={(selectedClient.brandingConfig as any).logoUrl} 
                            alt="Client logo" 
                            className="mt-2 max-w-32 h-auto border rounded"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Client Selected</h3>
                  <p className="text-gray-500">Select a client from the list to view and edit their configuration.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}