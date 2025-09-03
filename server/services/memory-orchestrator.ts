import { searchForCampaignChat, searchForOptimizationComparables } from '../integrations/supermemory';

interface CampaignContextArgs {
  clientId: string;
  campaignId?: string;
  userTurn: string;
  context?: string;
  goals?: string;
  vehicleKeywords?: string[];
}

interface CampaignContextResult {
  ragContext: string;
  optimizationHints: string;
  raw: {
    ragResults: any;
    optimizationResults: any;
  };
}

// Simple in-memory cache with TTL to avoid duplicate rapid queries
const cache = new Map<string, { expires: number; value: CampaignContextResult }>();
const TTL_MS = 15_000; // 15s – short, just to cushion burst traffic

function buildRagContext(r: any, maxChars = 800): string {
  if (!r || !Array.isArray(r.results) || r.results.length === 0) return '';
  const parts: string[] = [];
  for (const item of r.results.slice(0, 3)) {
    const title = item?.metadata?.name || item?.metadata?.title || '';
    const content = (item?.content || '').toString();
    const snippet = content.length > 300 ? content.slice(0, 300) + '…' : content;
    parts.push((title ? `[${title}] ` : '') + snippet);
  }
  let ctx = parts.join('\n---\n');
  if (ctx.length > maxChars) ctx = ctx.slice(0, maxChars) + '…';
  return ctx;
}

export async function getCampaignChatContext(args: CampaignContextArgs): Promise<CampaignContextResult> {
  const key = JSON.stringify({
    c: args.clientId,
    id: args.campaignId,
    ctx: args.context?.slice(0, 120),
    g: args.goals?.slice(0, 120),
    turn: args.userTurn.slice(0, 120),
    vk: args.vehicleKeywords?.slice(0, 6)
  });
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.value;

  let ragResults: any = null;
  let optimizationResults: any = null;
  try {
    ragResults = await searchForCampaignChat({
      clientId: args.clientId,
      campaignId: args.campaignId,
      userTurn: args.userTurn,
      detectedType: args.context,
      vehicleKeywords: args.vehicleKeywords
    });
  } catch {}

  if (args.context && args.goals) {
    try {
      optimizationResults = await searchForOptimizationComparables({
        clientId: args.clientId,
        vehicleType: args.vehicleKeywords?.find(k => ['suv','truck','sedan','crossover','coupe'].includes(k)),
        goal: args.goals.toLowerCase().includes('test') ? 'test drives' : undefined
      });
    } catch {}
  }

  const ragContext = buildRagContext(ragResults);
  let optimizationHints = '';
  if (optimizationResults?.results?.length) {
    optimizationHints = optimizationResults.results.slice(0,2).map((r:any)=> (r.metadata?.title? r.metadata.title+': ':'') + ((r.content||'').toString().slice(0,140)) + ((r.content||'').length>140?'…':'')).join('\n');
  }

  const value: CampaignContextResult = { ragContext, optimizationHints, raw: { ragResults, optimizationResults } };
  cache.set(key, { expires: now + TTL_MS, value });
  return value;
}

export type { CampaignContextArgs, CampaignContextResult };
