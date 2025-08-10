import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConversationView from "@/components/conversations/ConversationView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { ConversationMessage, Lead } from "@shared/schema";

export default function LeadDetailsDrawer({ lead, open, onOpenChange }: { lead: Lead | null; open: boolean; onOpenChange: (v: boolean) => void; }) {
  const { data: messages = [] } = useQuery<ConversationMessage[]>({
    queryKey: ["/api/conversations", lead?.id, "messages"],
    enabled: !!lead?.id,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : 'Lead Details'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">What we know</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Conversation-backed bullets will appear here.
            </CardContent>
          </Card>
          <ConversationView conversationId={lead?.id || ''} messages={messages} onSendMessage={() => {}} isLoading={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

