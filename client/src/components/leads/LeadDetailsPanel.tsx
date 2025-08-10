import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Lightbulb } from "lucide-react";

export default function LeadDetailsPanel({ lead }: { lead: any }) {
  if (!lead) return null;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" /> Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Conversation view will appear here (integrated from Conversations page).
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" /> What we know
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="list-disc ml-5 space-y-1">
            <li>Data-backed bullet points from messages and opens</li>
            <li>No vanity metrics</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

