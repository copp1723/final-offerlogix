import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import ConversationsPage from "@/pages/conversations";
import UserManagementPage from "@/pages/user-management";
import LeadsPage from "@/pages/leads";
import CampaignsPage from "@/pages/campaigns";
import AiSettingsPage from "@/pages/ai-settings";
import WhiteLabelPage from "@/pages/white-label";
import NotFound from "@/pages/not-found";
import { ClientProvider } from "@/contexts/ClientContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/conversations" component={ConversationsPage} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/campaigns" component={CampaignsPage} />
      <Route path="/ai-settings" component={AiSettingsPage} />
      <Route path="/white-label" component={WhiteLabelPage} />
      <Route path="/users" component={UserManagementPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ClientProvider>
    </QueryClientProvider>
  );
}

export default App;
