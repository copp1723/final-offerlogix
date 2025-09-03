import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Car, Shield, Bell, Database, Palette, Brain, Mail } from "lucide-react";

export default function SettingsPage() {
  const settingsCategories = [
    {
      title: "User Management",
      description: "Manage users, roles, and permissions",
      href: "/users",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "White Label Settings",
      description: "Customize branding and client configurations",
      href: "/white-label",
      icon: Palette,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Email Settings",
      description: "Configure email sender names and delivery settings",
      href: "/email-settings",
      icon: Mail,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Email Monitor",
      description: "Connect IMAP and manage inbound parsing rules",
      href: "/email-monitor",
      icon: Bell,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Security & Privacy",
      description: "Configure security settings and data privacy",
      href: "#",
      icon: Shield,
      color: "text-green-600",
      bgColor: "bg-green-50",
      disabled: true,
    },
    {
      title: "Notifications",
      description: "Manage email and SMS notification preferences",
      href: "#",
      icon: Bell,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      disabled: true,
    },
    {
      title: "Database & Backup",
      description: "Database management and backup configurations",
      href: "#",
      icon: Database,
      color: "text-red-600",
      bgColor: "bg-red-50",
      disabled: true,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Settings</h1>
        <p className="text-lg text-gray-600">Manage your application settings and configurations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          const isDisabled = category.disabled;

          return isDisabled ? (
            <div key={category.title}>
              <Card className={`h-full transition-all duration-200 ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:shadow-lg hover:scale-105 cursor-pointer'
              }`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${category.bgColor}`}>
                      <Icon className={`w-6 h-6 ${category.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      {isDisabled && (
                        <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full mt-1">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-gray-600">
                    {category.description}
                  </CardDescription>
                  {!isDisabled && (
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      Configure
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Link key={category.title} href={category.href}>
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${category.bgColor}`}>
                      <Icon className={`w-6 h-6 ${category.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-gray-600">
                    {category.description}
                  </CardDescription>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                    Configure
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">Export Data</h3>
              <p className="text-sm text-gray-600 mb-3">Download your campaigns, leads, and conversation data</p>
              <Button variant="outline" size="sm" disabled>
                Export (Coming Soon)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">System Health</h3>
              <p className="text-sm text-gray-600 mb-3">Check system status and performance metrics</p>
              <Button variant="outline" size="sm" disabled>
                View Status (Coming Soon)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">API Keys</h3>
              <p className="text-sm text-gray-600 mb-3">Manage API keys for integrations and external services</p>
              <Button variant="outline" size="sm" disabled>
                Manage Keys (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}