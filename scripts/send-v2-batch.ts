#!/usr/bin/env tsx

/**
 * V2 Batch Sender
 *
 * Sends a small batch of outbound emails for a given V2 campaign to its leads_v2.
 * Uses ConversationEngine → MailgunThreading for proper threading and delivery.
 *
 * Usage examples:
 *   tsx scripts/send-v2-batch.ts \
 *     --domain kunesmacomb.kunesauto.vip --local riley \
 *     --campaign ebbbb676-5fee-45d6-beda-330a43cacd09 \
 *     --limit 10 --throttle 1000
 *
 * Multiple campaigns:
 *   tsx scripts/send-v2-batch.ts --domain kunesmacomb.kunesauto.vip --local riley \
 *     --campaign <trucks_id> --campaign <suvs_id> --limit 10
 */

import dotenv from 'dotenv';
dotenv.config();

import { dbV2, v2schema } from '../server/v2/db.ts';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { makeConversationEngine } from '../server/v2/services/conversation/factory.js';

type Args = {
  domain: string;
  local: string;
  campaign: string[];
  limit: number;
  throttle: number; // ms between sends
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = {
    domain: '',
    local: 'riley',
    campaign: [],
    limit: 10,
    throttle: 1000,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--domain') out.domain = String(args[++i] || '').trim();
    else if (a === '--local') out.local = String(args[++i] || '').trim();
    else if (a === '--campaign') out.campaign.push(String(args[++i] || '').trim());
    else if (a === '--limit') out.limit = Number(args[++i] || '10');
    else if (a === '--throttle') out.throttle = Number(args[++i] || '1000');
  }

  if (!out.domain) throw new Error('Missing --domain');
  if (!out.campaign.length) throw new Error('At least one --campaign id is required');
  if (!Number.isFinite(out.limit) || out.limit <= 0) out.limit = 10;
  if (!Number.isFinite(out.throttle) || out.throttle < 0) out.throttle = 0;
  return out;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { domain, local, campaign: campaignIds, limit, throttle } = parseArgs();

  console.log('V2 Batch Sender');
  console.log('================');
  console.log(`Agent: ${local}@${domain}`);
  console.log(`Campaigns: ${campaignIds.join(', ')}`);
  console.log(`Limit per campaign: ${limit}`);
  console.log(`Throttle: ${throttle} ms`);
  console.log('');

  // Resolve agent
  const [agent] = await dbV2
    .select({ id: v2schema.agents.id, name: v2schema.agents.name, domain: v2schema.agents.domain, localPart: v2schema.agents.localPart })
    .from(v2schema.agents)
    .where(and(eq(v2schema.agents.domain, domain), eq(v2schema.agents.localPart, local)));
  if (!agent) throw new Error(`Agent not found for ${local}@${domain}`);

  // Create engine (validates env)
  const engine = makeConversationEngine();

  for (const campaignId of campaignIds) {
    console.log(`\nFetching campaign ${campaignId} ...`);
    const [campaign] = await dbV2
      .select({ id: v2schema.campaigns.id, name: v2schema.campaigns.name, subject: v2schema.campaigns.subject, template: v2schema.campaigns.template })
      .from(v2schema.campaigns)
      .where(eq(v2schema.campaigns.id, campaignId));
    if (!campaign) {
      console.warn(`  ⚠️  Campaign not found: ${campaignId}`);
      continue;
    }

    console.log(`  Campaign: ${campaign.name}`);

    // Select leads that have not received an agent message (no conversation with message_count > 0)
    // Use LEFT JOIN to exclude those with active conversations containing messages
    const leads = await dbV2.execute(sql<{
      email: string;
      first_name: string | null;
      last_name: string | null;
    }>`
      SELECT l.email, l.first_name, l.last_name
      FROM leads_v2 l
      WHERE l.campaign_id = ${campaignId}
        AND NOT EXISTS (
          SELECT 1
          FROM conversations_v2 cv
          WHERE cv.agent_id = l.agent_id
            AND cv.lead_email = l.email
            AND cv.message_count > 0
        )
      ORDER BY l.created_at ASC
      LIMIT ${limit}
    `);

    if (!leads.rows.length) {
      console.log('  No eligible leads found (all have conversations or none exist).');
      continue;
    }

    console.log(`  Will send ${leads.rows.length} emails...`);

    let sent = 0;
    for (const row of leads.rows) {
      const to = row.email.trim().toLowerCase();
      const fname = row.first_name || 'there';

      // Simple token replacement for {{firstName}}
      const subject = campaign.subject.replace(/\{\{\s*firstName\s*\}\}/gi, fname);
      const html = `<p>${campaign.template.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')
        .replace(/\{\{\s*firstName\s*\}\}/gi, fname)}</p>`;

      try {
        const res = await engine.sendManualEmail({
          agent: { id: agent.id, name: agent.name, domain: agent.domain, localPart: agent.localPart },
          to,
          subject,
          html,
        } as any);
        sent++;
        console.log(`    ✅ ${to} (${res.messageId})`);
      } catch (err: any) {
        console.log(`    ❌ ${to} - ${err?.message || String(err)}`);
      }

      if (throttle) await sleep(throttle);
    }

    console.log(`  Done. Sent: ${sent}/${leads.rows.length}`);
  }

  console.log('\nAll batches complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Batch send failed:', err);
    process.exit(1);
  });
}
