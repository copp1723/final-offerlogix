// The three exact prompts (chat, scoring, optimization)

export function campaignChatPrompt({
  userTurn,
  detectedType,
  snippets,
}: {
  userTurn: string;
  detectedType?: string;
  snippets: Array<{ title?: string; content: string }>;
}) {
  const context = snippets.slice(0, 3).map((s, i) =>
    `SNIPPET ${i + 1}${s.title ? ` — ${s.title}` : ""}:\n${s.content}`
  ).join("\n\n");

  return `You are the OfferLogix Campaign Agent for dealership outreach. Your job is to help users design email campaigns that promote OfferLogix services and tools to automotive dealerships (B2B), not to consumers. Use prior wins as inspiration, not gospel.

USER INTENT: ${userTurn}
DETECTED TYPE: ${detectedType ?? "unknown"}

PRIOR WINS (top 3):
${context || "None"}

INSTRUCTIONS:
- Ask ONE next best question that moves the campaign forward.
- If a pattern in prior wins is relevant (send time, subject style, vehicle angle), briefly mention it (one line).
- Keep tone friendly, concise, and practical.

Return JSON:
{
  "message": "assistant reply",
  "nextStep": "campaign_type|target_audience|goals|details|complete",
  "campaignData": { ...merge any safe inferred fields... },
  "isComplete": false
}`;
}

export function leadScoringPrompt({
  leadSummary,
  snippets,
}: {
  leadSummary: string; // last 3–5 messages, timestamps, reply latency you computed
  snippets: Array<{ content: string }>;
}) {
  const evidence = snippets.slice(0, 6).map((s) => s.content).join("\n---\n");

  return `You are scoring a single automotive lead.

LEAD RECENT TIMELINE:
${leadSummary}

EVIDENCE FROM MEMORY (keyword hits: urgency/payment/price/test drive):
${evidence || "None"}

SCORE FIELDS (0-100):
- qualification: considers vehicle specificity, payment/financing mentions, test-drive intent
- urgency: considers words "asap", "today", "this week", quick reply cadence
- handover: overall buy-readiness

Return JSON:
{
  "qualification": 0-100,
  "urgency": 0-100,
  "handover": 0-100,
  "signals": ["string", ...],
  "reasoning": "1-3 short bullets"
}`;
}

export function optimizationPrompt({
  campaignContext,
  snippets,
}: {
  campaignContext: { vehicleType?: string; season?: string; goal?: string; };
  snippets: Array<{ title?: string; content: string }>;
}) {
  const comps = snippets.slice(0, 6).map((s, i) =>
`COMPARABLE ${i + 1}${s.title ? ` — ${s.title}` : ""}:
${s.content}`).join("\n\n");

  const ctx = JSON.stringify(campaignContext);

  return `You are generating optimization guidance for an automotive email campaign.

CAMPAIGN CONTEXT: ${ctx}

COMPARABLES (same client or similar goals):
${comps || "None"}

REQUIRED OUTPUT JSON:
{
  "sendTime": {"dayOfWeek": "Mon|Tue|...|Sun", "hour": 8-20, "confidence": 0-100, "reason": "short"},
  "sequence": [
    {"step": 1, "type": "introduction|vehicle_showcase|incentive_offer|urgency_close", "dayOffset": 0, "note": "short"},
    {"step": 2, "type": "...", "dayOffset": 3, "note": "short"}
  ],
  "contentAngles": ["fuel economy", "family features", "payment examples"],
  "expectedLift": {"metric": "open|ctr|reply|handover", "percent": 1-30}
}`;
}