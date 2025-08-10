import { createHash } from "crypto";
import { supermemory, isRAGEnabled } from "./client";

type Tag = `client:${string}` | `campaign:${string}` | `lead:${string}` | `type:${string}`;

export type MemoryWrite =
  | { type: "mail_event";  clientId: string; campaignId?: string; leadEmail?: string; content: string; meta?: Record<string, any>; }
  | { type: "lead_msg";    clientId: string; campaignId?: string; leadEmail?: string; content: string; meta?: Record<string, any>; }
  | { type: "email_template"; clientId: string; campaignId?: string; name: string; html: string; meta?: Record<string, any>; }
  | { type: "campaign_summary"; clientId: string; campaignId: string; summary: string; meta?: Record<string, any>; }
  | { type: "oem_doc";     clientId: string; title: string; content: string; meta?: Record<string, any>; }
  | { type: "handover_event"; clientId: string; campaignId?: string; leadEmail?: string; content: string; meta?: Record<string, any>; }
  | { type: "webhook";     clientId: string; source: "mailgun" | "twilio" | "internal"; content: string; meta?: Record<string, any>; }
  // Newly added granular campaign construction memory events
  | { type: "campaign_step"; clientId: string; campaignId?: string; stepId: string; content: string; meta?: Record<string, any>; }
  | { type: "campaign_metric"; clientId: string; campaignId: string; content: string; meta?: Record<string, any>; };

const queue: any[] = [];
let flushTimer: NodeJS.Timeout | null = null;

export const MemoryMapper = {
  async write(item: MemoryWrite) {
    if (!isRAGEnabled()) return;

    const { content, metadata, containerTags } = normalize(item);
    queue.push({ content, metadata, containerTags });

    // debounce + batch (flush every ~750ms or 20 items)
    if (queue.length >= 20) await flush();
    else {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => flush().catch(() => {}), 750);
    }
  },

  // Convenience helpers
  writeMailEvent(args: Extract<MemoryWrite, { type: "mail_event" }>) { return this.write(args); },
  writeLeadMessage(args: Extract<MemoryWrite, { type: "lead_msg" }>) { return this.write(args); },
  writeTemplate(args: Extract<MemoryWrite, { type: "email_template" }>) { return this.write(args); },
  writeCampaignSummary(args: Extract<MemoryWrite, { type: "campaign_summary" }>) { return this.write(args); },
  writeOEMDoc(args: Extract<MemoryWrite, { type: "oem_doc" }>) { return this.write(args); },
  writeHandoverEvent(args: Extract<MemoryWrite, { type: "handover_event" }>) { return this.write(args); },
  writeWebhook(args: Extract<MemoryWrite, { type: "webhook" }>) { return this.write(args); },
  writeCampaignStep(args: Extract<MemoryWrite, { type: "campaign_step" }>) { return this.write(args); },
  writeCampaignMetric(args: Extract<MemoryWrite, { type: "campaign_metric" }>) { return this.write(args); },

  // Utility to hash emails for consistent lead tagging
  hashEmail,
};

function normalize(item: MemoryWrite) {
  const baseTags: Tag[] = [
    `client:${item.clientId}`,
    `type:${item.type}`,
  ];

  let leadTag: Tag | undefined;
  // link by hashed email for safety but keep deterministic join key
  if ("leadEmail" in item && item.leadEmail) {
    leadTag = `lead:${hashEmail(item.leadEmail)}` as Tag;
  }
  const campaignTag = "campaignId" in item && item.campaignId ? `campaign:${item.campaignId}` as Tag : undefined;

  const containerTags = [ ...baseTags, campaignTag, leadTag ].filter(Boolean) as Tag[];

  // Build content + metadata safely
  const content =
    item.type === "email_template" ? stripPII(item.html)
    : item.type === "oem_doc" ? stripPII(`${item.title}\n\n${item.content}`)
    : stripPII((item as any).content);

  const metadata: Record<string, any> = {
    type: item.type,
    ...(("name" in item && item.name) ? { name: item.name } : {}),
    ...(("title" in item && item.title) ? { title: item.title } : {}),
    ...(("campaignId" in item && item.campaignId) ? { campaignId: item.campaignId } : {}),
    ...(("leadEmail" in item && item.leadEmail) ? { leadHash: hashEmail(item.leadEmail) } : {}),
    ...(item.meta || {}),
  };

  return { content, metadata, containerTags };
}

async function flush() {
  if (!isRAGEnabled() || queue.length === 0) return;
  const batch = queue.splice(0, 20);
  try {
    await Promise.all(
      batch.map(async (b) => {
        try {
          // Use the correct Supermemory API method
          return await supermemory!.add({
            content: b.content,
            metadata: b.metadata,
            tags: b.containerTags,
            userId: b.metadata.clientId || 'default'
          });
        } catch (err) {
          console.warn('[Supermemory] Single memory write failed:', err);
          return null;
        }
      })
    );
  } catch (err) {
    // swallow to avoid impacting critical-path; your logs will still capture
    console.error("[Supermemory] batch write failed", err);
  }
}

function hashEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

// very basic PII scrub—good enough for email bodies/log lines
function stripPII(text: string) {
  if (!text) return text;
  return text
    .replace(/\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, (m) => `${m.split("@")[0].slice(0,2)}***@***`)
    .replace(/\b(\+?1[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "***-***-****");
}