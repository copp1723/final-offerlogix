import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/home";
import LeadsPage from "@/pages/leads";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import EmailMonitorPage from "@/pages/email-monitor";
import UserManagementPage from "@/pages/user-management";
import WhiteLabelPage from "@/pages/white-label";
import AiSettingsPage from "@/pages/ai-settings";
import NotFound from "@/pages/not-found";
import { ClientProvider } from "@/contexts/ClientContext";
import AppLayout from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/leads" component={LeadsPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/ai-settings" component={AiSettingsPage} />
        <Route path="/email-monitor" component={EmailMonitorPage} />
        <Route path="/users" component={UserManagementPage} />
        <Route path="/white-label" component={WhiteLabelPage} />
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
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </TooltipProvider>
      </ClientProvider>
    </QueryClientProvider>
  );
}

export default App;