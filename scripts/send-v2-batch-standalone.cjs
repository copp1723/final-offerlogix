#!/usr/bin/env node

/*
 * Standalone V2 Batch Sender (no TS deps)
 * - Connects to Postgres directly via 'pg'
 * - Creates/uses conversations_v2 + messages_v2
 * - Sends via Mailgun HTTP API with proper From/Reply-To and Message-Id
 *
 * Usage:
 *   node scripts/send-v2-batch-standalone.cjs \
 *     --domain kunesmacomb.kunesauto.vip --local riley \
 *     --campaign ebbbb676-5fee-45d6-beda-330a43cacd09 \
 *     --campaign 878ecbb1-639f-44c9-a35f-2e860bd0ac81 \
 *     --limit 10 --throttle 1000
 *
 * Drain all eligible leads (no manual batching):
 *   node scripts/send-v2-batch-standalone.cjs \
 *     --domain kunesmacomb.kunesauto.vip --local riley \
 *     --campaign <trucks_id> --campaign <suvs_id> \
 *     --all --per-minute 120 --chunk 100
 */

const crypto = require('crypto');
const { Pool } = require('pg');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { domain: '', local: 'riley', campaigns: [], limit: 10, throttle: 1000, all: false, perMinute: 0, chunk: 100 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--domain') out.domain = String(args[++i] || '').trim();
    else if (a === '--local') out.local = String(args[++i] || '').trim();
    else if (a === '--campaign') out.campaigns.push(String(args[++i] || '').trim());
    else if (a === '--limit') out.limit = Number(args[++i] || '10');
    else if (a === '--throttle') out.throttle = Number(args[++i] || '1000');
    else if (a === '--all') out.all = true;
    else if (a === '--per-minute') out.perMinute = Number(args[++i] || '0');
    else if (a === '--chunk') out.chunk = Number(args[++i] || '100');
  }
  if (!out.domain) throw new Error('Missing --domain');
  if (!out.campaigns.length) throw new Error('At least one --campaign id is required');
  return out;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mkMessageId(domain) {
  const seed = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `<${hash}@${domain}>`;
}

async function main() {
  const { domain, local, campaigns, limit, throttle, all, perMinute, chunk } = parseArgs();
  const sendingDomain = domain; // per-agent domain

  const required = ['DATABASE_URL', 'MAILGUN_API_KEY'];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`Missing env: ${k}`);
  }

  // Domain allow-list (optional)
  const allowed = (process.env.MAILGUN_ALLOWED_DOMAINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(sendingDomain)) {
    throw new Error(`Blocked: ${sendingDomain} not in MAILGUN_ALLOWED_DOMAINS`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: /render\.com/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false });

  const client = await pool.connect();
  try {
    // Resolve agent
    const { rows: agentRows } = await client.query(
      `SELECT id, name, domain, local_part FROM agents_v2 WHERE domain=$1 AND local_part=$2 LIMIT 1`,
      [domain, local]
    );
    if (!agentRows.length) throw new Error(`Agent not found for ${local}@${domain}`);
    const agent = agentRows[0];

    console.log('V2 Batch Sender (standalone)');
    console.log('Agent:', `${agent.name} <${agent.local_part}@${agent.domain}>`);
    console.log('Campaigns:', campaigns.join(', '));
    if (all) {
      console.log('Mode: drain all eligible leads');
      if (perMinute > 0) console.log('Rate:', `${perMinute}/min`);
      else console.log('Throttle (ms):', throttle);
      console.log('Chunk size:', chunk);
    } else {
      console.log('Limit per campaign:', limit);
      console.log('Throttle (ms):', throttle);
    }

    for (const campaignId of campaigns) {
      const { rows: campRows } = await client.query(
        `SELECT id, name, subject, template FROM campaigns_v2 WHERE id=$1`,
        [campaignId]
      );
      if (!campRows.length) {
        console.warn('⚠️  Campaign not found:', campaignId);
        continue;
      }
      const camp = campRows[0];
      console.log(`\nCampaign: ${camp.name}`);

      let totalSent = 0;
      while (true) {
        // Leads with no conversation messages yet
        const batchLimit = all ? (Number.isFinite(chunk) && chunk > 0 ? chunk : 100) : limit;
        const { rows: leads } = await client.query(
          `SELECT l.email, COALESCE(l.first_name,'') AS first_name, COALESCE(l.last_name,'') AS last_name
           FROM leads_v2 l
           WHERE l.campaign_id=$1
             AND NOT EXISTS (
               SELECT 1 FROM conversations_v2 cv
               WHERE cv.agent_id=l.agent_id AND cv.lead_email=l.email AND cv.message_count > 0
             )
           ORDER BY l.created_at ASC
           LIMIT $2`,
          [campaignId, batchLimit]
        );

        if (!leads.length) {
          if (all) console.log('  ✔ No more eligible leads — campaign drained.');
          else console.log('  No eligible leads found.');
          break;
        }

        console.log(`  Sending to ${leads.length} leads...`);

        let sent = 0;
        for (const lead of leads) {
          const to = String(lead.email || '').trim().toLowerCase();
          const fname = lead.first_name || 'there';
          const subject = (camp.subject || '').replace(/\{\{\s*firstName\s*\}\}/gi, fname);
          const bodyText = (camp.template || '').replace(/\{\{\s*firstName\s*\}\}/gi, fname);
          const html = `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;

        // Get or create conversation
        let convId, lastMessageId;
        {
          const { rows } = await client.query(
            `SELECT id, last_message_id FROM conversations_v2 WHERE agent_id=$1 AND lead_email=$2 AND status='active' ORDER BY updated_at DESC LIMIT 1`,
            [agent.id, to]
          );
          if (rows.length) {
            convId = rows[0].id;
            lastMessageId = rows[0].last_message_id;
          } else {
            const threadId = 'thread-' + crypto.randomUUID();
            const ins = await client.query(
              `INSERT INTO conversations_v2 (agent_id, lead_email, thread_id, subject, status, message_count) VALUES ($1,$2,$3,$4,'active',0) RETURNING id`,
              [agent.id, to, threadId, subject || 'Email Conversation']
            );
            convId = ins.rows[0].id;
          }
        }

        // Prepare Message-Id
        const messageId = mkMessageId(agent.domain);

        // Insert message (outbound)
        await client.query(
          `INSERT INTO messages_v2 (conversation_id, content, sender, message_id, in_reply_to) VALUES ($1,$2,'agent',$3,$4)`,
          [convId, html, messageId, lastMessageId || null]
        );

        // Update conversation
        await client.query(
          `UPDATE conversations_v2 SET last_message_id=$2, message_count=message_count+1, updated_at=NOW() WHERE id=$1`,
          [convId, messageId]
        );

        // Send via Mailgun
        try {
          const form = new URLSearchParams();
          const fromHeader = `${agent.name} <${agent.local_part}@${agent.domain}>`;
          form.append('from', fromHeader);
          form.append('to', to);
          form.append('subject', subject);
          form.append('html', html);
          form.append('h:Message-Id', messageId);
          form.append('h:Reply-To', fromHeader);

          const base = process.env.MAILGUN_BASE || 'https://api.mailgun.net/v3';
          const r = await fetch(`${base}/${sendingDomain}/messages`, {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form,
          });
          if (!r.ok) throw new Error(`mailgun ${r.status}`);
          sent++;
          console.log(`  ✅ ${to}`);
        } catch (e) {
          console.log(`  ❌ ${to} - ${e.message || e}`);
        }

          const msBetween = perMinute > 0 ? Math.floor(60000 / perMinute) : throttle;
          if (msBetween > 0) await sleep(msBetween);
        }

        totalSent += sent;
        console.log(`  Batch complete. Sent: ${sent}/${leads.length}. Total so far: ${totalSent}`);
        if (!all) break;
      }
      console.log(`Done campaign ${camp.name}. Total sent this run: ${totalSent}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('Batch failed:', e); process.exit(1); });
