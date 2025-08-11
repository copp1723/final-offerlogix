import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConversationView from "@/components/conversations/ConversationView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ConversationMessage, Lead, Conversation } from "@shared/schema";
import { useState, useEffect } from 'react';

function deriveFacts(lead: Lead | null, messages: ConversationMessage[]): string[] {
  const facts: string[] = [];
  if (lead?.vehicleInterest) facts.push(`Interested in ${lead.vehicleInterest}`);
  const lastMsg = messages?.[0];
  if (lastMsg?.content && lastMsg.content.trim()) facts.push(`Last inbound: "${lastMsg.content.slice(0, 80)}${lastMsg.content.length > 80 ? "…" : ""}"`);
  if (lead?.notes && facts.length < 2) facts.push(`Notes: ${String(lead.notes).slice(0, 80)}${String(lead.notes).length > 80 ? "…" : ""}`);
  while (facts.length < 2) facts.push("Expressed interest; awaiting follow-up");
  return facts.slice(0, 4);
}

function deriveNextSteps(lead: Lead | null, messages: ConversationMessage[]): { label: string; type: 'context' | 'campaign'; template?: string; context?: string }[] {
  const steps: { label: string; type: 'context' | 'campaign'; template?: string; context?: string }[] = [];
  const last = messages?.[0];
  const lastText = last?.content?.toLowerCase() || "";

  // Contextual insights
  if (lastText.includes("?") || lastText.includes("price") || lastText.includes("when") || lastText.includes("available")) {
    steps.push({
      label: "Summarize their ask",
      type: "context",
      context: "Recent inbound includes a question",
    });
    steps.push({
      label: "Answer their question",
      type: "campaign",
      template: `Hi ${lead?.firstName || ''}, about your question: [insert concise answer]. If helpful, I can share options that match your preferences.`,
      context: "Respond to recent question",
    });
  }

  // High engagement nudge
  if (!steps.find(s => s.type === 'campaign') && messages.length >= 3) {
    steps.push({
      label: "Send a quick nudge",
      type: "campaign",
      template: `Hi ${lead?.firstName || ''}, looping back—happy to share a couple of tailored options if you're still considering.`,
      context: "3+ messages, no reply yet",
    });
  }

  // Vehicle intro when we have interest
  if (lead?.vehicleInterest) {
    steps.push({
      label: `Introduce ${lead.vehicleInterest}`,
      type: "campaign",
      template: `Hi ${lead?.firstName || ''}, based on your interest in ${lead.vehicleInterest}, I can share 2-3 options that fit. Any constraints (budget/timing)?`,
      context: "vehicleInterest present",
    });
  }

  // Always include context deepening option
  steps.push({ label: "Show recent topics", type: "context", context: "last 5 inbound highlights" });

  return steps.slice(0, 4);
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
  const nextSteps = deriveNextSteps(lead, messages);
  const [memoryFacts, setMemoryFacts] = useState<string[] | null>(null);

  // Fetch memory-backed insights (lightweight) when drawer opens
  useEffect(() => {
    let cancelled = false;
    async function loadMemory() {
      if (!open || !lead?.id) { setMemoryFacts(null); return; }
      try {
        const res = await fetch(`/api/leads/${lead.id}/memory-summary`);
        if (!res.ok) throw new Error('memory fetch failed');
        const data = await res.json();
        if (cancelled) return;
        const bullets: string[] = [];
        if (Array.isArray(data.leadSignals) && data.leadSignals.length) bullets.push(`Historical signals: ${data.leadSignals.slice(0,3).join('; ')}`);
        if (data.priorCampaign && data.priorCampaign.performance) bullets.push(`Prior campaign: ${data.priorCampaign.performance}`);
        if (data.optimizationHint) bullets.push(data.optimizationHint);
        setMemoryFacts(bullets.slice(0,4));
      } catch {
        if (!cancelled) setMemoryFacts([]);
      }
    }
    loadMemory();
    return () => { cancelled = true; };
  }, [open, lead?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : 'Lead Details'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2">What we know {memoryFacts && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded uppercase tracking-wide">Memory</span>}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Current session</div>
                  <ul className="list-disc ml-5 space-y-1">
                    {facts.map((f, i) => (<li key={i}>{f}</li>))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">Historical intelligence {memoryFacts === null && <span className="animate-pulse text-gray-400">…</span>}</div>
                  {memoryFacts && memoryFacts.length > 0 ? (
                    <ul className="list-disc ml-5 space-y-1">
                      {memoryFacts.map((m,i)=><li key={i}>{m}</li>)}
                    </ul>
                  ) : memoryFacts && memoryFacts.length === 0 ? (
                    <div className="text-xs text-gray-400">No enriched memory yet</div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Next steps</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="ml-1 space-y-2">
                  {nextSteps.map((s, i) => (
                    <li key={i} className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-gray-900">{s.label}</div>
                        {s.context && <div className="text-xs text-muted-foreground mt-0.5">{s.context}</div>}
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {s.template && (
                          <button
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                            onClick={() => navigator.clipboard.writeText(s.template || '')}
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          <ConversationView
            conversationId={activeConversationId}
            messages={messages}
            onSendMessage={(c) => sendMessage.mutate(c)}
            isLoading={sendMessage.isPending}
            allowCompose={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

