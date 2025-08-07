import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock,
  BarChart3,
  Eye,
  Zap
} from "lucide-react";

interface EmailValidationResult {
  allowed: boolean;
  blocked: boolean;
  quarantined: boolean;
  requiresApproval: boolean;
  reasons: string[];
  triggeredRules: string[];
  riskScore: number;
}

export default function EmailValidationPanel() {
  const [emailContent, setEmailContent] = useState({
    to: ["test@example.com"],
    subject: "",
    htmlContent: "",
    textContent: ""
  });
  const [validationResult, setValidationResult] = useState<EmailValidationResult | null>(null);

  // Get validation statistics
  const { data: validationStats } = useQuery({
    queryKey: ["/api/email/validation-stats"],
  });

  // Validate email content mutation
  const validateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/email/validate-content", "POST", data);
    },
    onSuccess: (result) => {
      setValidationResult(result);
    },
  });

  const handleValidate = () => {
    if (emailContent.subject && emailContent.htmlContent) {
      validateContentMutation.mutate(emailContent);
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return "text-red-600 bg-red-50 border-red-200";
    if (score >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-green-600 bg-green-50 border-green-200";
  };

  const getStatusIcon = (result: EmailValidationResult) => {
    if (result.blocked) return <XCircle className="h-5 w-5 text-red-500" />;
    if (result.quarantined) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (result.requiresApproval) return <Clock className="h-5 w-5 text-blue-500" />;
    if (result.allowed) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <Shield className="h-5 w-5 text-gray-500" />;
  };

  const getStatusText = (result: EmailValidationResult) => {
    if (result.blocked) return "BLOCKED";
    if (result.quarantined) return "QUARANTINED";
    if (result.requiresApproval) return "REQUIRES APPROVAL";
    if (result.allowed) return "APPROVED";
    return "UNKNOWN";
  };

  const getStatusColor = (result: EmailValidationResult) => {
    if (result.blocked) return "bg-red-100 text-red-800 border-red-300";
    if (result.quarantined) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (result.requiresApproval) return "bg-blue-100 text-blue-800 border-blue-300";
    if (result.allowed) return "bg-green-100 text-green-800 border-green-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Email Validation System</h2>
      </div>

      <Tabs defaultValue="test" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="test">Test Email</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="rules">Validation Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Test Email Content
                </CardTitle>
                <CardDescription>
                  Test your email content against validation rules before sending
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="test-email">Test Email Address</Label>
                  <Input
                    id="test-email"
                    value={emailContent.to[0]}
                    onChange={(e) => setEmailContent(prev => ({
                      ...prev,
                      to: [e.target.value]
                    }))}
                    placeholder="test@example.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="test-subject">Subject Line</Label>
                  <Input
                    id="test-subject"
                    value={emailContent.subject}
                    onChange={(e) => setEmailContent(prev => ({
                      ...prev,
                      subject: e.target.value
                    }))}
                    placeholder="Enter email subject"
                  />
                </div>

                <div>
                  <Label htmlFor="test-content">Email Content (HTML)</Label>
                  <Textarea
                    id="test-content"
                    value={emailContent.htmlContent}
                    onChange={(e) => setEmailContent(prev => ({
                      ...prev,
                      htmlContent: e.target.value
                    }))}
                    placeholder="Enter email HTML content"
                    rows={8}
                  />
                </div>

                <Button 
                  onClick={handleValidate}
                  disabled={validateContentMutation.isPending || !emailContent.subject || !emailContent.htmlContent}
                  className="w-full"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {validateContentMutation.isPending ? "Validating..." : "Validate Email"}
                </Button>
              </CardContent>
            </Card>

            {/* Validation Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Validation Results
                </CardTitle>
                <CardDescription>
                  Real-time validation feedback and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!validationResult ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No validation results yet</p>
                    <p className="text-sm text-gray-400">Enter email content and click validate</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Status Overview */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(validationResult)}
                        <span className="font-medium">Status</span>
                      </div>
                      <Badge className={`${getStatusColor(validationResult)} border`}>
                        {getStatusText(validationResult)}
                      </Badge>
                    </div>

                    {/* Risk Score */}
                    <div className={`p-3 border rounded-lg ${getRiskScoreColor(validationResult.riskScore)}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Risk Score</span>
                        <span className="text-xl font-bold">{validationResult.riskScore}/100</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${validationResult.riskScore}%`,
                            backgroundColor: validationResult.riskScore >= 70 ? '#dc2626' : 
                                           validationResult.riskScore >= 40 ? '#d97706' : '#16a34a'
                          }}
                        />
                      </div>
                    </div>

                    {/* Triggered Rules */}
                    {validationResult.triggeredRules.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Triggered Rules ({validationResult.triggeredRules.length})</h4>
                        <div className="space-y-1">
                          {validationResult.triggeredRules.map((rule, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {rule}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reasons */}
                    {validationResult.reasons.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Issues Found ({validationResult.reasons.length})</h4>
                        <div className="space-y-2">
                          {validationResult.reasons.map((reason, index) => (
                            <Alert key={index}>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                {reason}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Success Message */}
                    {validationResult.allowed && validationResult.reasons.length === 0 && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Email content passes all validation checks and is safe to send.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Validation Statistics
              </CardTitle>
              <CardDescription>
                Overview of email validation system status and configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!validationStats ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Loading validation statistics...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{validationStats.rulesCount}</div>
                    <div className="text-sm text-gray-600">Total Rules</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{validationStats.enabledRules}</div>
                    <div className="text-sm text-gray-600">Active Rules</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{validationStats.spamKeywordsCount}</div>
                    <div className="text-sm text-gray-600">Spam Keywords</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation Rules</CardTitle>
              <CardDescription>
                Active email validation rules and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Critical Field Validation
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Ensures required fields (to, subject, content) are present and valid
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Content Completeness Check
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Validates email content is not empty and checks for unresolved template placeholders
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Email Address Validation
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Validates email address format and checks against blocked domains
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Spam Prevention
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Scans for spam keywords and suspicious content patterns
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Bulk Send Limits
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Enforces recipient limits and requires approval for large campaigns
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}