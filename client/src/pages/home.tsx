import AIChatInterface from "@/components/ai-chat/AIChatInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Welcome to OneKeel Swarm</h1>
        <p className="text-sm text-gray-600">Create intelligent automotive email campaigns with conversational AI guidance</p>
      </div>

      {/* Agent chat */}
      <AIChatInterface />

      {/* Simple, non-vanity cards (placeholders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Engaged Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground">0% of total leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Handovers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground">No conversations yet</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

