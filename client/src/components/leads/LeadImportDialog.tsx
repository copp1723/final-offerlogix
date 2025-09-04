import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FieldMapping {
  csvColumn: string;
  leadField: string;
}

interface ImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row?: number; error: string }>;
  leads: any[];
}

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (result: ImportResult) => void;
  campaigns?: Array<{ id: string; name: string }>;
}

export function LeadImportDialog({ 
  open, 
  onOpenChange, 
  onImportComplete,
  campaigns = []
}: LeadImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const leadFields = [
    { value: '', label: 'Ignore Column' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'email', label: 'Email (Required)' },
    { value: 'phone', label: 'Phone' },
    { value: 'source', label: 'Source' },
    { value: 'vehicleInterest', label: 'Product Interest' },
    { value: 'employer', label: 'Employer/Company' },
    { value: 'jobTitle', label: 'Job Title' },
    { value: 'income', label: 'Income' },
    { value: 'creditScore', label: 'Credit Score' },
    { value: 'notes', label: 'Notes' }
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please select a CSV file.',
        variant: 'destructive'
      });
    }
  };

  const analyzeFile = async () => {
    if (!file) return;

    setImportProgress(10);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/leads/import/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to analyze CSV file');
      }

      const data = await response.json();
      setCsvData(data);
      setMappings(data.suggestedMappings || []);
      setStep('mapping');
      setImportProgress(25);
    } catch (error) {
      console.error('CSV analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Unable to analyze the CSV file. Please check the format.',
        variant: 'destructive'
      });
    }
  };

  const updateMapping = (csvColumn: string, leadField: string) => {
    setMappings(prev => 
      prev.map(mapping => 
        mapping.csvColumn === csvColumn 
          ? { ...mapping, leadField }
          : mapping
      )
    );
  };

  const startImport = async () => {
    if (!file) return;

    setStep('importing');
    setImportProgress(50);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mappings', JSON.stringify(mappings));
      if (selectedCampaign) {
        formData.append('campaignId', selectedCampaign);
      }

      const response = await fetch('/api/leads/import', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();
      setImportResult(result);
      setStep('complete');
      setImportProgress(100);

      if (onImportComplete) {
        onImportComplete(result);
      }

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${result.successful} leads${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        variant: result.failed > 0 ? 'destructive' : 'default'
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'Unable to import leads. Please try again.',
        variant: 'destructive'
      });
      setStep('mapping');
    }
  };

  const resetDialog = () => {
    setStep('upload');
    setFile(null);
    setCsvData(null);
    setMappings([]);
    setSelectedCampaign('');
    setImportProgress(0);
    setImportResult(null);
  };

  const hasValidEmailMapping = mappings.some(m => m.leadField === 'email');

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetDialog();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="mb-6">
          <Progress value={importProgress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Upload</span>
            <span>Field Mapping</span>
            <span>Importing</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="csvFile">Select CSV File</Label>
              <div className="mt-2 flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">CSV files only</p>
                  </div>
                  <input
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
              {file && (
                <div className="mt-2 flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">{file.name}</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">CSV Format Requirements:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• First row should contain column headers</li>
                <li>• Email column is required for all leads</li>
                <li>• Supported fields: Name, Email, Phone, Vehicle Interest, etc.</li>
                <li>• Maximum file size: 10MB</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button onClick={analyzeFile} disabled={!file}>
                Next: Map Fields
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Field Mapping */}
        {step === 'mapping' && csvData && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Map CSV Columns to Lead Fields</h3>
              <p className="text-sm text-gray-600 mb-4">
                Found {csvData.totalRows} rows with {csvData.headers.length} columns
              </p>
            </div>

            {/* Campaign Selection */}
            <div>
              <Label htmlFor="campaign">Assign to Campaign (Optional)</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Campaign</SelectItem>
                  {campaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field Mappings */}
            <div className="space-y-3">
              {mappings.map((mapping, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 border rounded">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{mapping.csvColumn}</Label>
                    {csvData.previewRows[0] && (
                      <p className="text-xs text-gray-500 mt-1">
                        Example: {csvData.previewRows[0][mapping.csvColumn]}
                      </p>
                    )}
                  </div>
                  <div className="w-48">
                    <Select 
                      value={mapping.leadField} 
                      onValueChange={(value) => updateMapping(mapping.csvColumn, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {leadFields.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {/* Validation */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              {!hasValidEmailMapping ? (
                <div className="flex items-center space-x-2 text-yellow-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">⚠️ Email field mapping is required</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-green-700">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">✅ Ready to import</span>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={startImport} disabled={!hasValidEmailMapping}>
                Import Leads
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <h3 className="text-lg font-semibold">Importing Leads...</h3>
            <p className="text-gray-600">Please wait while we process your CSV file</p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importResult && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">Import Complete!</h3>
            </div>

            {/* Results Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.total}</div>
                  <div className="text-sm text-gray-600">Total Processed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.successful}</div>
                  <div className="text-sm text-gray-600">Successfully Imported</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </CardContent>
              </Card>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Import Errors:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-sm text-red-600 flex items-center space-x-2">
                      <X className="h-3 w-3" />
                      <span>Row {error.row}: {error.error}</span>
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <p className="text-sm text-gray-500">
                      ... and {importResult.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}