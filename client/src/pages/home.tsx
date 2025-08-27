import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Mail, TrendingUp, Zap, Target } from "lucide-react";

export default function HomePage() {
  const [, navigate] = useLocation();
  // Mock data - replace with actual API calls later
  const liveCampaigns = 2;
  const totalLeads = 45;
  const responseRate = 12;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5">
      <div className="container mx-auto p-6 space-y-8">
        {/* Welcome Header */}
        <div className="text-center py-8 animate-fadeIn">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Welcome to OfferLogix
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Driving industry innovation with customized credit solutions for automotive dealerships
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slideUp">
          <Card className="bg-primary/10 border-primary/20 shadow-glow hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-primary/20 rounded-full">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold text-primary mb-1">{liveCampaigns}</div>
              <div className="text-sm text-muted-foreground">Active Campaigns</div>
            </CardContent>
          </Card>
          
          <Card className="bg-accent/10 border-accent/20 shadow-glow-orange hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-accent/20 rounded-full">
                  <Users className="h-6 w-6 text-accent" />
                </div>
              </div>
              <div className="text-3xl font-bold text-accent mb-1">{totalLeads}</div>
              <div className="text-sm text-muted-foreground">Total Leads</div>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/20 shadow-glow hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-primary/20 rounded-full">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold text-primary mb-1">{responseRate}%</div>
              <div className="text-sm text-muted-foreground">Response Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="group hover:shadow-glow transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={() => navigate('/campaigns')}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-gradient-primary rounded-xl text-white group-hover:scale-110 transition-transform duration-300">
                  <Mail className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Campaign</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Launch targeted email campaigns to dealerships and technology partners
                  </p>
                  <Button size="sm" className="bg-primary hover:bg-primary/90">
                    Get Started
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-glow-orange transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={() => navigate('/leads')}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-gradient-secondary rounded-xl text-white group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Leads</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Track and nurture your prospects with our credit solutions
                  </p>
                  <Button size="sm" variant="outline" className="border-accent text-accent hover:bg-accent hover:text-white">
                    View Leads
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-glow transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={() => navigate('/personas')}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-gradient-offerlogix rounded-xl text-white group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Personas</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Configure AI-powered responses for better lead engagement
                  </p>
                  <Button size="sm" className="bg-primary hover:bg-primary/90">
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Value Proposition Section */}
        <Card className="mt-12 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Stop Wasting Time on Unqualified Leads</h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
              OfferLogix Instant Credit Solutions provide real-time credit processing without impacting consumer credit scores, 
              giving dealerships the power to pre-qualify leads and close deals faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Start Your Campaign
              </Button>
              <Button size="lg" variant="outline" className="border-accent text-accent hover:bg-accent hover:text-white">
                Learn More
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
