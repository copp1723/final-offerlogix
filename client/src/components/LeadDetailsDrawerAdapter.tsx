import React from "react";
import type { Lead as ApiLead } from "@/types/api";
import LeadDetailsDrawerMinimal from "@/components/leads/LeadDetailsDrawer";

interface LeadDetailsDrawerProps {
  lead: ApiLead;
  isOpen: boolean;
  onClose: () => void;
}

// Adapter to reuse the unified minimal LeadDetailsDrawer (keeps original minimalist styling)
export function LeadDetailsDrawer({ lead, isOpen, onClose }: LeadDetailsDrawerProps) {
  const mappedLead: any = lead
    ? {
        id: lead.id,
        email: lead.email,
        firstName: (lead.name || "").split(" ")[0] || undefined,
        lastName: (lead.name || "").split(" ").slice(1).join(" ") || undefined,
        status: "new",
      }
    : null;

  return (
    <LeadDetailsDrawerMinimal
      lead={mappedLead}
      open={isOpen}
      onOpenChange={(v: boolean) => {
        if (!v) onClose();
      }}
    />
  );
}

export default LeadDetailsDrawer;

