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
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import AutomotivePromptsPage from "@/pages/automotive-prompts";
import EmailMonitorPage from "@/pages/email-monitor";
import NotificationsPage from "@/pages/notifications";
import IntelligencePage from "@/pages/intelligence";
import { ClientProvider } from "@/contexts/ClientContext";
import AppLayout from "@/components/layout/AppLayout";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/conversations" component={ConversationsPage} />
        <Route path="/leads" component={LeadsPage} />
        <Route path="/campaigns" component={CampaignsPage} />
        <Route path="/ai-settings" component={AiSettingsPage} />
        <Route path="/automotive-prompts" component={AutomotivePromptsPage} />
        <Route path="/email-monitor" component={EmailMonitorPage} />
        <Route path="/intelligence" component={IntelligencePage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/white-label" component={WhiteLabelPage} />
        <Route path="/users" component={UserManagementPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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