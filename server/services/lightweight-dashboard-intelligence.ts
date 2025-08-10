/*
 * Lightweight dashboard intelligence without bloat.
 * - Maps raw leads to UI-ready leads with contextual snippets
 * - Computes followUps, callList, campaign opportunities, and summary
 */
import { storage } from '../storage';

export type UICategory = 'hot' | 'warm' | 'cold';

export interface MappedLead {
  id: string;
  name: string;
  email: string;
  status: UICategory;
  score: number;
  lastContact: string; // ISO string
  snippet: string;
  insights: Record<string, any>;
  recommendedActions: Array<{ action: string; urgency: 'high'|'medium'|'low'; reason: string }>;
}

export class LightweightDashboardIntelligence {
  // simple in-process cache (60s TTL) to avoid recalculating per request
  private static _cache: { ts: number; leads: MappedLead[] } | null = null;
  private static readonly TTL_MS = 60_000;

  // Map server status to UI status
  private mapStatus(s?: string): UICategory {
    switch ((s || '').toLowerCase()) {
      case 'qualified':
      case 'converted':
        return 'hot';
      case 'contacted':
        return 'warm';
      default:
        return 'cold';
    }
  }

  static invalidateCache() {
    this._cache = null;
  }

  private iso(dt: any): string {
    const d = dt || new Date();
    try { return new Date(d).toISOString(); } catch { return new Date().toISOString(); }
  }

  private buildRecommendedActions(snippet: string): MappedLead['recommendedActions'] {
    const t = (snippet || '').toLowerCase();
    const actions: MappedLead['recommendedActions'] = [];
    if (/toyota|honda|ford|chevy|nissan|hyundai|kia|bmw|mercedes|audi/.test(t)) {
      actions.push({ action: 'Send comparison vs competitor', urgency: 'high', reason: 'Competitor mentioned' });
    }
    if (/lease/.test(t)) {
      actions.push({ action: 'Offer lease-end options', urgency: 'high', reason: 'Lease context' });
    }
    if (/tax|refund/.test(t)) {
      actions.push({ action: 'Highlight tax refund financing', urgency: 'medium', reason: 'Seasonal timing' });
    }
    if (/urgent|asap|now/.test(t)) {
      actions.push({ action: 'Call immediately', urgency: 'high', reason: 'Urgent intent' });
    }
    if (/financ/.test(t)) {
      actions.push({ action: 'Send financing options', urgency: 'medium', reason: 'Financing interest' });
    }
    if (actions.length === 0 && t) {
      actions.push({ action: 'Send personalized inventory matches', urgency: 'low', reason: 'Maintain engagement' });
    }
    return actions;
  }

  async mapLeads(limit = 50): Promise<MappedLead[]> {
    const now = Date.now();
    const cached = LightweightDashboardIntelligence._cache;
    if (cached && (now - cached.ts) < LightweightDashboardIntelligence.TTL_MS) {
      return cached.leads.slice(0, limit);
    }

    const leads = await storage.getLeads();
    const slice = leads.slice(0, limit);

    const mapped = await Promise.all(slice.map(async (l: any) => {
      let name = [l.firstName, l.lastName].filter(Boolean).join(' ').trim();
      if (!name) name = l.email || 'Unknown';

      let snippet = l.notes || (l.vehicleInterest ? `Interested in ${l.vehicleInterest}` : '');
      try {
        const convs = await storage.getConversationsByLead(l.id);
        if (convs && convs[0]) {
          const msgs = await storage.getConversationMessages(convs[0].id, 1);
          const last = Array.isArray(msgs) ? msgs[0] : undefined;
          if (last && typeof last.content === 'string' && last.content.trim()) {
            snippet = last.content.slice(0, 160);
          }
        }
      } catch {}

      const recs = this.buildRecommendedActions(snippet);

      return {
        id: l.id,
        name,
        email: l.email,
        status: this.mapStatus(l.status),
        score: 0,
        lastContact: this.iso(l.updatedAt || l.createdAt),
        snippet,
        insights: {},
        recommendedActions: recs,
      } as MappedLead;
    }));

    // store in cache (full set, not sliced)
    LightweightDashboardIntelligence._cache = { ts: Date.now(), leads: mapped };

    return mapped;
  }

  private daysSince(iso?: string): number {
    if (!iso) return Infinity;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return Infinity;
    const now = Date.now();
    return Math.floor((now - t) / (1000 * 60 * 60 * 24));
  }

  private contains(txt: string, kws: string[]): boolean {
    const t = (txt || '').toLowerCase();
    return kws.some(k => t.includes(k));
  }

  computeIntelligence(leads: MappedLead[]) {
    const followUps = leads
      .filter(l => (l.status === 'hot' || l.status === 'warm') && this.daysSince(l.lastContact) >= 7)
      .slice(0, 10)
      .map(l => ({
        leadName: l.name,
        reason: `No contact in ${this.daysSince(l.lastContact)} days`,
        overdue: this.daysSince(l.lastContact) >= 14,
      }));

    const callList = leads
      .map(l => {
        let score = l.status === 'hot' ? 90 : l.status === 'warm' ? 70 : 40;
        const reasons: string[] = [];
        const t = (l.snippet || '').toLowerCase();
        if (this.contains(t, ['urgent','asap','now'])) { score += 10; reasons.push('Urgent intent'); }
        if (this.contains(t, ['lease'])) { score += 8; reasons.push('Lease context'); }
        if (this.contains(t, ['tax','refund'])) { score += 6; reasons.push('Tax refund timing'); }
        if (this.contains(t, ['financ'])) { score += 4; reasons.push('Financing interest'); }
        // recency boost
        if (this.daysSince(l.lastContact) <= 2) { score += 10; reasons.push('Recent activity'); }
        if (!reasons.length) reasons.push('Recent interest');
        return { leadName: l.name, score, reasons };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const taxCount = leads.filter(l => this.contains(l.snippet || '', ['tax','refund'])).length;
    const leaseCount = leads.filter(l => this.contains(l.snippet || '', ['lease'])).length;
    const dormantCount = leads.filter(l => this.daysSince(l.lastContact) >= 30).length;

    const campaigns: Array<{ type: string; description: string; count: number; suggestedAction: string }> = [];
    if (taxCount) campaigns.push({ type: 'Tax Season', description: `${taxCount} leads mentioned tax refunds`, count: taxCount, suggestedAction: 'Create tax refund financing campaign' });
    if (leaseCount) campaigns.push({ type: 'Lease End', description: `${leaseCount} leads referenced lease terms`, count: leaseCount, suggestedAction: 'Launch lease renewal offers' });
    if (dormantCount) campaigns.push({ type: 'Dormant', description: `${dormantCount} leads inactive 30+ days`, count: dormantCount, suggestedAction: 'Start re-engagement sequence' });

    const competitorBrands = ['toyota','honda','ford','chevy','chevrolet','hyundai','kia','nissan','bmw','mercedes','audi'];
    const competitorMentions = leads.flatMap(l => {
      const t = (l.snippet || '').toLowerCase();
      const hits = competitorBrands.filter(b => t.includes(b));
      return hits.map(h => `${l.name}: ${h}`);
    });

    const expiringOpportunities = leads
      .filter(l => this.contains(l.snippet || '', ['lease','asap','urgent']))
      .map(l => `${l.name}: ${(l.snippet || 'Needs attention').slice(0, 60)}`)
      .slice(0, 10);

    const hotLeadsNeedingAttention = leads.filter(l => l.status === 'hot').length;

    return { followUps, callList, campaigns, competitorMentions, expiringOpportunities, hotLeadsNeedingAttention };
  }
}

