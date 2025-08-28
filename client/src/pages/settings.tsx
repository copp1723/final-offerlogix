import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Bell, FileDown } from "lucide-react";

export default function SettingsPage() {
  const settingsCategories = [
    {
      id: 'user-management',
      title: 'User Management',
      icon: Users,
      description: 'Manage user accounts, roles, and permissions',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '#user-management',
      settings: [
        { key: 'max_users', label: 'Maximum Users', value: '10', type: 'input' },
        { key: 'user_roles', label: 'User Roles', value: 'admin,user,viewer', type: 'input' },
        { key: 'password_policy', label: 'Password Policy', value: 'Strong', type: 'select', options: ['Basic', 'Strong', 'Enterprise'] }
      ]
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      description: 'Configure email alerts and notification settings',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      href: '#notifications',
      settings: [
        { key: 'email_notifications', label: 'Email Notifications', value: true, type: 'boolean' },
        { key: 'daily_summary', label: 'Daily Summary', value: true, type: 'boolean' },
        { key: 'lead_alerts', label: 'Lead Alerts', value: false, type: 'boolean' }
      ]
    },
    {
      id: 'export-data',
      title: 'Export Data',
      icon: FileDown,
      description: 'Data export settings and format preferences',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      href: '#export-data',
      settings: [
        { key: 'export_format', label: 'Default Export Format', value: 'CSV', type: 'select', options: ['CSV', 'JSON', 'Excel'] },
        { key: 'include_metadata', label: 'Include Metadata', value: true, type: 'boolean' },
        { key: 'max_export_size', label: 'Max Export Size (MB)', value: '50', type: 'input' }
      ]
    }
  ];  return (
    <div className="p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Settings</h1>
        <p className="text-lg text-gray-600">Manage your application settings and configurations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          const isDisabled = false; // No categories are disabled anymore

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
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <FileDown className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-medium text-gray-900">Export Data</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">Download your campaigns, leads, and conversation data</p>
              <Button variant="outline" size="sm" disabled>
                Export (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}