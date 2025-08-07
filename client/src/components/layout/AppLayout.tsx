import { ReactNode } from "react";
import { Car, Bell, User, BarChart3, MessageSquare, Users, Settings, Zap, FileText, Target, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useBranding } from "@/contexts/ClientContext";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: BarChart3,
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    icon: Target,
    children: [
      { name: "All Campaigns", href: "/campaigns", icon: FileText },
      { name: "Leads", href: "/leads", icon: Users },
      { name: "Conversations", href: "/conversations", icon: MessageSquare },
      { name: "Email Monitor", href: "/email-monitor", icon: Mail },
      { name: "AI Agent Settings", href: "/ai-settings", icon: Zap },
    ],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { name: "User Management", href: "/users", icon: Users },
      { name: "White Label", href: "/white-label", icon: Car },
    ],
  },
];

function SidebarNavItem({ item, isActive, isChild = false }: { item: NavItem; isActive: boolean; isChild?: boolean }) {
  const Icon = item.icon;
  
  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isChild && "ml-6 text-sm",
          isActive
            ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        )}
      >
        <Icon className={cn("flex-shrink-0", isChild ? "w-4 h-4" : "w-5 h-5")} />
        <span>{item.name}</span>
      </div>
    </Link>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  const branding = useBranding();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg" />
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <Car className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="text-lg font-semibold text-gray-900">{branding.companyName}</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isParentActive = location === item.href || 
                (item.children?.some(child => location === child.href) && location !== "/");
              
              return (
                <div key={item.name}>
                  <SidebarNavItem 
                    item={item} 
                    isActive={location === item.href}
                  />
                  
                  {/* Show children if parent is active or current location matches child */}
                  {item.children && isParentActive && (
                    <div className="mt-2 space-y-1">
                      {item.children.map((child) => (
                        <SidebarNavItem
                          key={child.name}
                          item={child}
                          isActive={location === child.href}
                          isChild={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User section */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Admin User</p>
                <p className="text-xs text-gray-500 truncate">admin@autocampaigns.ai</p>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="w-6 h-6 rounded" />
            ) : (
              <div 
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ backgroundColor: branding.primaryColor }}
              >
                <Car className="w-3 h-3 text-white" />
              </div>
            )}
            <span className="font-semibold text-gray-900">{branding.companyName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}