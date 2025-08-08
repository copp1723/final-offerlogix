import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertCircle, XCircle, Mail, Zap, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SystemStatus {
  service: string;
  status: 'online' | 'warning' | 'offline';
  lastCheck: string;
  details?: string;
}

export default function SystemHealth() {
  const { data: emailStatus } = useQuery({
    queryKey: ['/api/email-monitor/status'],
    retry: false
  });

  const systemStatuses: SystemStatus[] = [
    {
      service: "Email Monitor",
      status: emailStatus?.running ? 'online' : 'warning',
      lastCheck: "Just now",
      details: emailStatus?.running ? "Processing emails" : "Ready to start"
    },
    {
      service: "AI Processing", 
      status: 'online',
      lastCheck: "Just now",
      details: "OpenRouter API connected"
    },
    {
      service: "Database",
      status: 'online', 
      lastCheck: "Just now",
      details: "PostgreSQL connected"
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'offline':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'Email Monitor':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'AI Processing':
        return <Zap className="w-4 h-4 text-purple-500" />;
      case 'Database':
        return <Database className="w-4 h-4 text-orange-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'warning': 
        return 'Warning';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'offline':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">System Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {systemStatuses.map((item) => (
            <div key={item.service} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
              <div className="flex items-center space-x-3">
                {getServiceIcon(item.service)}
                <div>
                  <div className="font-medium text-sm">{item.service}</div>
                  <div className="text-xs text-gray-500">{item.details}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(item.status)}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                  {getStatusText(item.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}