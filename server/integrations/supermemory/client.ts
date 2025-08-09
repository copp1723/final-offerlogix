// Supermemory client with timeouts, retries, and safe fallbacks
// Surface area preserved: supermemory.add(data), supermemory.search(params), isRAGEnabled()

// Tunables (env overrides supported)
const BASE_URL = process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai';
const API_KEY = process.env.SUPERMEMORY_API_KEY || '';
const TIMEOUT_MS = Number(process.env.SUPERMEMORY_TIMEOUT_MS ?? 8000);
const MAX_RETRIES = Number(process.env.SUPERMEMORY_MAX_RETRIES ?? 3);
const RETRY_BASE_MS = Number(process.env.SUPERMEMORY_RETRY_BASE_MS ?? 200);
const CIRCUIT_FAILS = Number(process.env.SUPERMEMORY_CIRCUIT_FAILS ?? 4);
const CIRCUIT_COOLDOWN_MS = Number(process.env.SUPERMEMORY_CIRCUIT_COOLDOWN_MS ?? 30_000);
const MAX_CONTENT_BYTES = Number(process.env.SUPERMEMORY_MAX_CONTENT_BYTES ?? 200_000); // ~200KB

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function backoff(attempt: number) {
  const capped = Math.min(1500, RETRY_BASE_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 150);
  return capped + jitter;
}
function byteLength(s: string) { return new TextEncoder().encode(s || '').length; }
function capContent(s: string) {
  if (!s) return s;
  const len = byteLength(s);
  if (len <= MAX_CONTENT_BYTES) return s;
  const ratio = MAX_CONTENT_BYTES / len;
  const cut = Math.max(0, Math.floor(s.length * ratio) - 1);
  return s.slice(0, cut) + '\n<!-- truncated for size cap -->';
}

// Simple circuit breaker state (per-process)
let consecutiveFails = 0;
let circuitOpenedAt = 0;
function circuitOpen() {
  if (consecutiveFails < CIRCUIT_FAILS) return false;
  const now = Date.now();
  const stillCooling = now - circuitOpenedAt < CIRCUIT_COOLDOWN_MS;
  return stillCooling;
}
function recordSuccess() { consecutiveFails = 0; }
function recordFailure() {
  consecutiveFails += 1;
  if (consecutiveFails === CIRCUIT_FAILS) circuitOpenedAt = Date.now();
}

async function requestWithRetries(path: string, method: 'POST', body: any) {
  if (!API_KEY) throw new Error('Supermemory API key missing');
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);

      // Retry on 408/429/5xx
      if ([408, 429].includes(res.status) || res.status >= 500) {
        recordFailure();
        if (attempt >= MAX_RETRIES) return res; // surface final response
        await sleep(backoff(attempt));
        continue;
      }

      // Success or client error
      recordSuccess();
      return res;
    } catch (err) {
      clearTimeout(timer);
      recordFailure();
      if (attempt >= MAX_RETRIES) throw err;
      await sleep(backoff(attempt));
    }
  }
}

// Real client if API key present; strict mock otherwise
const realClient = API_KEY ? {
  add: async (data: any) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid add payload');
    const content = capContent(String(data.content || ''));
    const payload = { ...data, content };

    if (circuitOpen()) {
      // fail fast but non-throwing to avoid cascading failures
      return { id: undefined, skipped: true, reason: 'circuit_open' } as const;
    }

    const res = await requestWithRetries('/v1/memories', 'POST', payload);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supermemory add failed: ${res.status} ${text}`);
    }
    return res.json();
  },
  search: async (params: any) => {
    if (!params || typeof params !== 'object') throw new Error('Invalid search params');
    const query = String(params.query || params.q || '').slice(0, 512);
    const body = { ...params, query };

    if (circuitOpen()) {
      // Return empty result deterministically so callers can continue
      return { results: [], total: 0, skipped: true, reason: 'circuit_open' } as const;
    }

    const res = await requestWithRetries('/v1/search', 'POST', body);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supermemory search failed: ${res.status} ${text}`);
    }
    // Defensive parse
    let json: any;
    try {
      json = await res.json();
    } catch {
      json = { results: [], total: 0 };
    }
    // Normalize shape
    if (!Array.isArray(json.results)) json.results = [];
    if (typeof json.total !== 'number') json.total = json.results.length;
    return json;
  }
} : null;

export const supermemory = realClient ?? {
  add: async (data: any) => {
    const content = String(data?.content || '').slice(0, 200);
    console.log('[Supermemory Mock] add:', content + (content.length === 200 ? '…' : ''));
    return { id: 'mock-' + Date.now() };
  },
  search: async (params: any) => {
    const q = String(params?.query || params?.q || '').slice(0, 120);
    console.log('[Supermemory Mock] search:', q);
    return { results: [], total: 0 };
  }
};

export function isRAGEnabled() {
  return !!supermemory && process.env.SUPERMEMORY_RAG !== 'off';
}