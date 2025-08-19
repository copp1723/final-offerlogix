import AIChatInterface from "@/components/ai-chat/AIChatInterface";
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const [, navigate] = useLocation();
  // Mock data - replace with actual API calls later
  const liveCampaigns = 2;
  const handovers = 8;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page heading with top-right metrics */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Welcome to OfferLogix</h1>
          <p className="text-sm text-gray-600">AI-powered dealer outreach and payment display solutions</p>
        </div>
        
        {/* Top-right metrics */}
        <div className="flex gap-3">
          <Card className="min-w-[140px] bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Active dealer outreach campaigns</div>
              <div className="text-2xl text-gray-900">{liveCampaigns}</div>
            </CardContent>
          </Card>
          
          <Card className="min-w-[140px] bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Dealer conversations</div>
              <div className="text-2xl text-gray-900">{handovers}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Agent chat - wider and taller */}
      <div className="w-full max-w-5xl mx-auto min-h-[500px]">
        <AIChatInterface />
      </div>

      {/* Priority alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card 
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => navigate('/leads?leadId=carol-davis')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Carol Davis (Metro Motors) asked about payment widget integration</span>
              <span className="text-xs text-red-600 font-medium">High Priority</span>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => navigate('/leads?leadId=bob-brown')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Bob Brown (Sunrise Auto Group) requested API access for a pilot</span>
              <span className="text-xs text-orange-600 font-medium">Urgent</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

