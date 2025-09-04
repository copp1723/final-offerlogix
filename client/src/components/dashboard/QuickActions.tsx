import { Plus, Target, Users, Mail, BarChart3, Settings } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function QuickActions() {
  const actions = [
    {
      title: "Create Campaign",
      description: "Start a new automotive email campaign",
      icon: Plus,
      href: "/campaigns",
      color: "bg-blue-500 hover:bg-blue-600",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      title: "View Leads",
      description: "Manage your automotive leads",
      icon: Users,
      href: "/leads",
      color: "bg-green-500 hover:bg-green-600", 
      iconBg: "bg-green-100",
      iconColor: "text-green-600"
    },
    {
      title: "Email Monitor",
      description: "Monitor incoming dealership inquiries",
      icon: Mail,
      href: "/email-monitor",
      color: "bg-purple-500 hover:bg-purple-600",
      iconBg: "bg-purple-100", 
      iconColor: "text-purple-600"
    },
    {
      title: "Intelligence Hub",
      description: "AI-powered insights and analytics",
      icon: BarChart3,
      href: "/intelligence",
      color: "bg-orange-500 hover:bg-orange-600",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600"
    },
    {
      title: "Scoring Config",
      description: "Configure lead scoring rules",
      icon: Target,
      href: "/scoring-config",
      color: "bg-indigo-500 hover:bg-indigo-600",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600"
    },
    {
      title: "Settings",
      description: "Platform and notification settings",
      icon: Settings,
      href: "/settings",
      color: "bg-gray-500 hover:bg-gray-600",
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href}>
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center space-y-2 hover:shadow-md transition-all duration-200 w-full"
                >
                  <div className={`w-10 h-10 ${action.iconBg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${action.iconColor}`} />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-sm">{action.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{action.description}</div>
                  </div>
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}