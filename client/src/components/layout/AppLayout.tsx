import { ReactNode, useState } from "react";
import { CreditCard, Bell, User, BarChart3, MessageSquare, Users, Settings, Zap, FileText, Target, Mail, Brain, Database, ChevronDown, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useBranding } from "@/contexts/ClientContext";
import { cn } from "@/lib/utils";
import ChatWidget from "@/components/ChatWidget";

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
  isGroup?: boolean;
}

const navigation: NavItem[] = [
  // Core Operations
  {
    name: "Dashboard",
    href: "/",
    icon: BarChart3,
  },
  {
    name: "Customers",
    href: "/leads",
    icon: Users,
  },
  {
    name: "Customer Interactions",
    href: "/conversations",
    icon: MessageSquare,
  },

  // AI & Automation
  {
    name: "AI Management",
    href: "/ai-settings",
    icon: Brain,
    children: [
      {
        name: "AI Personas",
        href: "/personas",
        icon: Target,
      }
    ]
  },
  {
    name: "Knowledge Base",
    href: "/knowledge-base",
    icon: Database,
  },
  {
    name: "Credit Campaigns",
    href: "/campaigns",
    icon: Zap,
  },

  // System
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      {
        name: "Communication Monitor",
        href: "/email-monitor",
        icon: Mail,
      }
    ]
  },
];

function SidebarNavItem({ item, isActive, currentPath }: { item: NavItem; isActive: boolean; currentPath: string }) {
  const [isExpanded, setIsExpanded] = useState(
    item.children?.some(child => currentPath === child.href) || false
  );
  const Icon = item.icon;
  
  // Check if any child is active
  const hasActiveChild = item.children?.some(child => currentPath === child.href);
  
  if (item.children && item.children.length > 0) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-between space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            isActive || hasActiveChild
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          <div className="flex items-center space-x-3">
            <Icon className="flex-shrink-0 w-5 h-5" />
            <span>{item.name}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        
        {isExpanded && (
          <div className="ml-8 mt-1 space-y-1">
            {item.children.map((child) => {
              const ChildIcon = child.icon;
              const isChildActive = currentPath === child.href;
              
              return (
                <Link key={child.name} href={child.href}>
                  <div
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isChildActive
                        ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <ChildIcon className="flex-shrink-0 w-4 h-4" />
                    <span>{child.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        )}
      >
        <Icon className="flex-shrink-0 w-5 h-5" />
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
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="text-lg font-semibold text-gray-900">{branding.companyName}</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item, index) => {
              const needsDivider = index === 3 || index === 6 || index === 7; // After core, AI, monitoring sections
              
              return (
                <div key={item.name}>
                  {needsDivider && (
                    <div className="border-t border-gray-200 my-3"></div>
                  )}
                  <SidebarNavItem 
                    item={item} 
                    isActive={location === item.href}
                    currentPath={location}
                  />
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
                <p className="text-xs text-gray-500 truncate">admin@offerlogix.com</p>
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
                <CreditCard className="w-3 h-3 text-white" />
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
      
      {/* Chat Widget - Demo Integration */}
      <ChatWidget 
        campaignId="demo-offerlogix-campaign"
        position="bottom-right"
        theme="default"
        autoOpen={false}
        autoOpenDelay={3000}
        debug={true}
      />
    </div>
  );
}