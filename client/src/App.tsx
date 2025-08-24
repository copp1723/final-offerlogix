import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/home";
import LeadsPage from "@/pages/leads";
import CampaignsPage from "@/pages/campaigns";
import SettingsPage from "@/pages/settings";
import ConversationsPage from "@/pages/conversations";
import HandoversPage from "@/pages/handovers";
import PersonasPage from "@/pages/personas";
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
        <Route path="/campaigns" component={CampaignsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/personas" component={PersonasPage} />
        <Route path="/conversations" component={ConversationsPage} />
        <Route path="/handovers" component={HandoversPage} />
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