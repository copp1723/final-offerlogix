import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Database, 
  FileText, 
  Search, 
  Upload, 
  Trash2, 
  Edit,
  BookOpen,
  Brain,
  Settings
} from "lucide-react";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  clientId: string;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  tags: string[];
  metadata: any;
  embeddingStatus: string;
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [showCreateKBForm, setShowCreateKBForm] = useState(false);
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get client ID (using the first available client for now)
  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });
  const clientId = Array.isArray(clients) && clients.length > 0 ? clients[0].id : null;

  // Fetch knowledge bases
  const { data: knowledgeBases, isLoading: loadingKBs } = useQuery({
    queryKey: [`/api/knowledge-base/${clientId}`],
    enabled: !!clientId,
  });

  // Fetch documents for selected KB
  const { data: documents, isLoading: loadingDocs } = useQuery({
    queryKey: ["/api/knowledge-base/documents", selectedKB?.id],
    enabled: !!selectedKB?.id,
  });

  // Create KB mutation
  const createKBMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest("/api/knowledge-base", "POST", {
        ...data,
        clientId,
        settings: { autoIndex: true, chunkSize: 1000 }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setShowCreateKBForm(false);
      toast({
        title: "Success",
        description: "Knowledge base created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create knowledge base",
        variant: "destructive",
      });
    },
  });

  // Add document mutation
  const addDocMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; documentType: string; tags: string }) => {
      return await apiRequest("/api/knowledge-base/documents", "POST", {
        ...data,
        knowledgeBaseId: selectedKB?.id,
        tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        metadata: { source: 'manual_upload' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/documents", selectedKB?.id] });
      setShowAddDocForm(false);
      toast({
        title: "Success",
        description: "Document added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add document",
        variant: "destructive",
      });
    },
  });

  const handleCreateKB = (formData: FormData) => {
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    createKBMutation.mutate({ name, description });
  };

  const handleAddDocument = (formData: FormData) => {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const documentType = formData.get('documentType') as string || 'note';
    const tags = formData.get('tags') as string || '';
    addDocMutation.mutate({ title, content, documentType, tags });
  };

  if (loadingKBs || !clientId) {
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="w-8 h-8 text-teal-600" style={{ color: '#009CA6' }} />
                Knowledge Base Management
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                Manage AI knowledge bases and documents for enhanced customer interactions
              </p>
            </div>
            <Button 
              onClick={() => setShowCreateKBForm(true)}
              className="flex items-center gap-2"
              style={{ backgroundColor: '#009CA6', color: 'white' }}
            >
              <Plus className="w-4 h-4" />
              New Knowledge Base
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Knowledge Bases List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Knowledge Bases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(knowledgeBases) && knowledgeBases.map((kb: KnowledgeBase) => (
                    <div
                      key={kb.id}
                      onClick={() => setSelectedKB(kb)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedKB?.id === kb.id
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <h3 className="font-medium text-gray-900 mb-1">{kb.name}</h3>
                      <p className="text-sm text-gray-500 mb-2">{kb.description}</p>
                      <div className="text-xs text-gray-400">
                        Created: {new Date(kb.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Documents/Content Area */}
          <div className="lg:col-span-2">
            {showCreateKBForm ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Knowledge Base</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleCreateKB(formData);
                  }} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Knowledge Base Name</Label>
                      <Input id="name" name="name" required placeholder="e.g., OfferLogix Product Info" />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea 
                        id="description" 
                        name="description" 
                        rows={3}
                        placeholder="Describe what this knowledge base contains..."
                        required 
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createKBMutation.isPending} style={{ backgroundColor: '#009CA6' }}>
                        Create Knowledge Base
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateKBForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : selectedKB ? (
              <div className="space-y-6">
                {/* KB Header */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="w-5 h-5" style={{ color: '#009CA6' }} />
                          {selectedKB.name}
                        </CardTitle>
                        <p className="text-gray-600 mt-1">{selectedKB.description}</p>
                      </div>
                      <Button
                        onClick={() => setShowAddDocForm(true)}
                        size="sm"
                        className="flex items-center gap-2"
                        style={{ backgroundColor: '#F58220' }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Document
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {/* Add Document Form */}
                {showAddDocForm && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Add New Document</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        handleAddDocument(formData);
                      }} className="space-y-4">
                        <div>
                          <Label htmlFor="title">Document Title</Label>
                          <Input id="title" name="title" required placeholder="Document title..." />
                        </div>
                        <div>
                          <Label htmlFor="content">Content</Label>
                          <Textarea 
                            id="content" 
                            name="content" 
                            rows={8}
                            placeholder="Enter document content..."
                            required 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="documentType">Document Type</Label>
                            <Input id="documentType" name="documentType" placeholder="e.g., note, guide, faq" />
                          </div>
                          <div>
                            <Label htmlFor="tags">Tags (comma-separated)</Label>
                            <Input id="tags" name="tags" placeholder="pricing, features, support" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={addDocMutation.isPending} style={{ backgroundColor: '#009CA6' }}>
                            Add Document
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddDocForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Documents List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingDocs ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
                        ))}
                      </div>
                    ) : Array.isArray(documents) && documents.length > 0 ? (
                      <div className="space-y-3">
                        {documents.map((doc: KnowledgeBaseDocument) => (
                          <div key={doc.id} className="p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{doc.title}</h4>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {doc.content.slice(0, 150)}...
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <span>Type: {doc.documentType}</span>
                                  <span>Status: {doc.embeddingStatus}</span>
                                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                </div>
                                {doc.tags && doc.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {doc.tags.map((tag, index) => (
                                      <span
                                        key={index}
                                        className="px-2 py-1 text-xs rounded-full"
                                        style={{ backgroundColor: '#009CA6', color: 'white' }}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>No documents found in this knowledge base.</p>
                        <Button 
                          onClick={() => setShowAddDocForm(true)}
                          className="mt-4"
                          style={{ backgroundColor: '#009CA6' }}
                        >
                          Add First Document
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Knowledge Base Selected</h3>
                  <p className="text-gray-500">Select a knowledge base from the list to view and manage its documents.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}