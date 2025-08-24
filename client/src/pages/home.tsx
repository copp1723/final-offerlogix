import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Mail, TrendingUp } from "lucide-react";

export default function HomePage() {
  const [, navigate] = useLocation();
  // Mock data - replace with actual API calls later
  const liveCampaigns = 2;
  const totalLeads = 45;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page heading with top-right metrics */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Welcome to OfferLogix</h1>
          <p className="text-sm text-gray-600">B2B Email Campaign Platform for Dealers & Vendors</p>
        </div>
        
        {/* Top-right metrics */}
        <div className="flex gap-3">
          <Card className="min-w-[140px] bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Active Email Campaigns</div>
              <div className="text-2xl text-gray-900">{liveCampaigns}</div>
            </CardContent>
          </Card>
          
          <Card className="min-w-[140px] bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Total Leads</div>
              <div className="text-2xl text-gray-900">{totalLeads}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/campaigns')}>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Create Campaign</h3>
              <p className="text-sm text-gray-600">Start a new B2B email campaign</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/leads')}>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Manage Leads</h3>
              <p className="text-sm text-gray-600">View and manage your prospects</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/')}>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">View Metrics</h3>
              <p className="text-sm text-gray-600">Check campaign performance</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

