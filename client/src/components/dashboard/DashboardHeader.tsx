import { Car, Bell, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useBranding } from "@/contexts/ClientContext";

export default function DashboardHeader() {
  const branding = useBranding();
  
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
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
            <span className="text-xl font-semibold text-gray-900">{branding.companyName}</span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">Dashboard</Link>
            <Link href="/campaigns" className="text-gray-500 hover:text-gray-700">Campaigns</Link>
            <Link href="/leads" className="text-gray-500 hover:text-gray-700">Leads</Link>
            <Link href="/conversations" className="text-gray-500 hover:text-gray-700">Conversations</Link>
            <Link href="/handovers" className="text-gray-500 hover:text-gray-700">Handovers</Link>
            <Link href="/ai-settings" className="text-gray-500 hover:text-gray-700">AI Settings</Link>
            <Link href="/white-label" className="text-gray-500 hover:text-gray-700">White Label</Link>
            <Link href="/users" className="text-gray-500 hover:text-gray-700">Users</Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
