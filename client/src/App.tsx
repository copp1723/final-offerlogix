import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/home";
import LeadsPage from "@/pages/leads";
import ReportsPage from "@/pages/reports";
import CampaignsPage from "@/pages/campaigns";
import SettingsPage from "@/pages/settings";
import EmailMonitorPage from "@/pages/email-monitor";
import UserManagementPage from "@/pages/user-management";
import WhiteLabelPage from "@/pages/white-label";
import AiSettingsPage from "@/pages/ai-settings";
import ConversationsPage from "@/pages/conversations";
import ConversationsV2Page from "@/pages/conversations-v2";
import HandoversPage from "@/pages/handovers";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { ClientProvider } from "@/contexts/ClientContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <ProtectedRoute>
          <AppLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/leads" component={LeadsPage} />
              <Route path="/reports" component={ReportsPage} />
              <Route path="/campaigns" component={CampaignsPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/ai-settings" component={AiSettingsPage} />
              <Route path="/email-monitor" component={EmailMonitorPage} />
              <Route path="/conversations" component={ConversationsPage} />
              <Route path="/conversations-v2" component={ConversationsV2Page} />
              <Route path="/handovers" component={HandoversPage} />
              <Route path="/users" component={UserManagementPage} />
              <Route path="/white-label" component={WhiteLabelPage} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClientProvider>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </TooltipProvider>
        </ClientProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;