import { Car, Bell, User } from "lucide-react";

export default function DashboardHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">AutoCampaigns AI</span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">Dashboard</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">Campaigns</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">Analytics</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">Settings</a>
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
