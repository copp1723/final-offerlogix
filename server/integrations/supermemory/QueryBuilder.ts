import { supermemory, isRAGEnabled } from "./client";

export interface SearchInput {
  q: string;
  clientId: string;
  campaignId?: string;
  leadEmailHash?: string;         // use MemoryMapper.hashEmail output if you store it
  limit?: number;
  documentThreshold?: number;
  chunkThreshold?: number;
  onlyMatchingChunks?: boolean;

  extraTags?: string[];
  rewriteQuery?: boolean;
  timeoutMs?: number;             // hard latency budget
}

export async function searchMemories(input: SearchInput) {
  if (!isRAGEnabled()) return { results: [], total: 0, timing: 0, skipped: true };

  const payload = buildSearchPayload(input);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), input.timeoutMs ?? 300);

  try {
    const res = await supermemory!.search({
      query: payload.q,
      limit: payload.limit,
      threshold: payload.documentThreshold,
      tags: payload.containerTags.filter(Boolean),
      userId: payload.containerTags.find(tag => tag.startsWith('client:'))?.split(':')[1] || 'default'
    });
    clearTimeout(t);
    return res;
  } catch (err) {
    clearTimeout(t);
    // graceful fallback on timeout/any error
    return { results: [], total: 0, timing: 0, skipped: true, error: String((err as Error).message) };
  }
}

export function buildSearchPayload({
  q, clientId, campaignId, leadEmailHash,
  limit = 8, documentThreshold = 0.6, chunkThreshold = 0.6,
  onlyMatchingChunks = true, extraTags = [],
  rewriteQuery = true,
}: Omit<SearchInput, 'categoriesFilter'>) {
  const containerTags = [
    `client:${clientId}`,
    campaignId ? `campaign:${campaignId}` : null,
    leadEmailHash ? `lead:${leadEmailHash}` : null,
    ...extraTags,
  ].filter(Boolean);

  return {
    q,
    limit,
    documentThreshold,
    chunkThreshold,
    onlyMatchingChunks,
    rewriteQuery,
    containerTags,
  };
}

/** Opinionated helpers for your three hot paths */

export async function searchForCampaignChat(opts: {
  clientId: string;
  campaignId?: string;
  userTurn: string;
  detectedType?: string;        // "new_inventory" | "seasonal_service" | ...
  vehicleKeywords?: string[];
}) {
  const q = [
    opts.userTurn,
    opts.detectedType?.replace(/_/g, " "),
    ...(opts.vehicleKeywords || []),
    "previous campaign performance OR winning template OR high CTR OR conversion",
  ].filter(Boolean).join(" ");

  return searchMemories({
    q,
    clientId: opts.clientId,
    campaignId: opts.campaignId,
    limit: 6,
    documentThreshold: 0.65,
    chunkThreshold: 0.65,
    onlyMatchingChunks: true,
    rewriteQuery: true,
    timeoutMs: 300,
  });
}

export async function searchForLeadSignals(opts: {
  clientId: string;
  leadEmailHash: string;
}) {
  const q = "asap today urgent payment monthly best price test drive financing trade-in ready to buy timeline";
  return searchMemories({
    q,
    clientId: opts.clientId,
    leadEmailHash: opts.leadEmailHash,
    limit: 10,
    documentThreshold: 0.55,
    chunkThreshold: 0.6,
    onlyMatchingChunks: true,
    rewriteQuery: true,
    timeoutMs: 250,
  });
}

export async function searchForOptimizationComparables(opts: {
  clientId: string;
  vehicleType?: string;       // suv | truck | sedan | mixed
  season?: string;            // spring | summer | fall | winter
  goal?: string;              // test drives | service appts | sales | financing
}) {
  const q = [
    opts.vehicleType, opts.season, opts.goal,
    "send time performance open rate click through conversion best practices",
  ].filter(Boolean).join(" ");
  return searchMemories({
    q,
    clientId: opts.clientId,
    limit: 8,
    documentThreshold: 0.6,
    chunkThreshold: 0.6,
    rewriteQuery: true,
    timeoutMs: 350,
  });
}