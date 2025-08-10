import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConversationView from "@/components/conversations/ConversationView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ConversationMessage, Lead, Conversation } from "@shared/schema";

function deriveFacts(lead: Lead | null, messages: ConversationMessage[]): string[] {
  const facts: string[] = [];
  if (lead?.vehicleInterest) facts.push(`Interested in ${lead.vehicleInterest}`);
  const lastMsg = messages?.[0];
  if (lastMsg?.content && lastMsg.content.trim()) facts.push(`Last inbound: "${lastMsg.content.slice(0, 80)}${lastMsg.content.length > 80 ? "…" : ""}"`);
  if (lead?.notes && facts.length < 2) facts.push(`Notes: ${String(lead.notes).slice(0, 80)}${String(lead.notes).length > 80 ? "…" : ""}`);
  while (facts.length < 2) facts.push("Expressed interest; awaiting follow-up");
  return facts.slice(0, 4);
}

function deriveActions(lead: Lead | null, messages: ConversationMessage[]): string[] {
  const actions: string[] = [];
  const last = messages?.[0];
  if (last?.content) {
    const text = last.content.toLowerCase();
    if (text.includes("?") || text.includes("price") || text.includes("when") || text.includes("available")) {
      actions.push("Call now (recent question from lead)");
    }
  }
  if (!actions.length && messages.length >= 3) actions.push("Email follow-up (high engagement, no reply)");
  if (!actions.length && lead?.vehicleInterest) actions.push(`Send intro about ${lead.vehicleInterest}`);
  if (!actions.length) actions.push("Email follow-up");
  return actions.slice(0, 3);
}

export default function LeadDetailsDrawer({ lead, open, onOpenChange }: { lead: Lead | null; open: boolean; onOpenChange: (v: boolean) => void; }) {
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/leads", lead?.id, "conversations"],
    enabled: !!lead?.id,
  });
  const activeConversationId = conversations[0]?.id || "";

  const { data: messages = [] } = useQuery<ConversationMessage[]>({
    queryKey: ["/api/leads", lead?.id, "conversations", "latest", "messages"],
    enabled: !!lead?.id,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let convId = activeConversationId;
      if (!convId && lead?.id) {
        const created = await apiRequest(`/api/conversations`, "POST", {
          leadId: lead.id,
          campaignId: (lead as any).campaignId || undefined,
          subject: `Conversation with ${[lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email}`,
          status: "active",
          priority: "normal",
        });
        convId = created.id;
      }
      return await apiRequest(`/api/conversations/${convId}/messages`, "POST", {
        senderId: lead?.id,
        content,
        messageType: "text",
        isFromAI: 0,
      });
    },
    onSuccess: () => {
      if (!lead?.id) return;
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "conversations", "latest", "messages"] });
    },
  });

  const facts = deriveFacts(lead, messages);
  const actions = deriveActions(lead, messages);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : 'Lead Details'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">What we know</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-disc ml-5 space-y-1">
                  {facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Recommended actions</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-disc ml-5 space-y-1">
                  {actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          <ConversationView conversationId={activeConversationId} messages={messages} onSendMessage={(c) => sendMessage.mutate(c)} isLoading={sendMessage.isPending} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

