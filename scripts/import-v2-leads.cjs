#!/usr/bin/env node

/*
 * Import V2 Leads from CSV (standalone, no TS)
 *
 * CSV headers expected (case-insensitive, flexible):
 *   email, first_name (or First Name), last_name (or Last Name)
 *
 * Usage:
 *   DATABASE_URL=... node scripts/import-v2-leads.cjs \
 *     --domain kunestoyota-galesburg.kunesauto.vip --local erin \
 *     --campaign <campaign_uuid> --csv /path/to/leads.csv
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { parse } = require('csv-parse');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { domain: '', local: 'erin', campaign: '', csv: '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--domain') out.domain = String(args[++i] || '').trim();
    else if (a === '--local') out.local = String(args[++i] || '').trim();
    else if (a === '--campaign') out.campaign = String(args[++i] || '').trim();
    else if (a === '--csv') out.csv = String(args[++i] || '').trim();
  }
  if (!out.domain) throw new Error('Missing --domain');
  if (!out.campaign) throw new Error('Missing --campaign');
  if (!out.csv) throw new Error('Missing --csv');
  return out;
}

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

async function main() {
  const { domain, local, campaign, csv } = parseArgs();

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env required');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /render\.com/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    // Resolve agent
    const { rows: agentRows } = await client.query(
      `SELECT id, name FROM agents_v2 WHERE domain=$1 AND local_part=$2 LIMIT 1`,
      [domain, local]
    );
    if (!agentRows.length) throw new Error(`Agent not found for ${local}@${domain}`);
    const agentId = agentRows[0].id;

    console.log('Importing leads');
    console.log('  Domain:', domain);
    console.log('  Local :', local);
    console.log('  Agent :', agentRows[0].name, `(${agentId})`);
    console.log('  Campaign:', campaign);
    console.log('  CSV:', csv);

    if (!fs.existsSync(csv)) throw new Error(`CSV not found: ${csv}`);

    const parser = fs
      .createReadStream(csv)
      .pipe(
        parse({
          bom: true,
          columns: (headers) => headers.map(normalizeHeader),
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true,
        })
      );

    let total = 0;
    let inserted = 0;
    for await (const row of parser) {
      total++;
      const email = (row.email || row.e_mail || row.mail || '').toString().trim().toLowerCase();
      if (!email || !email.includes('@')) continue;

      const first = (row.first_name || row.firstname || row.first || row['first'] || '').toString().trim();
      const last = (row.last_name || row.lastname || row.last || row['last'] || '').toString().trim();

      try {
        await client.query(
          `INSERT INTO leads_v2 (email, campaign_id, agent_id, status, first_name, last_name, metadata)
           VALUES ($1,$2,$3,'active',$4,$5,'{}'::jsonb)
           ON CONFLICT (campaign_id, email) DO NOTHING`,
          [email, campaign, agentId, first || null, last || null]
        );
        inserted++;
        if (inserted % 500 === 0) console.log(`  Inserted: ${inserted}`);
      } catch (e) {
        console.warn(`  Skipped ${email}: ${e.message || e}`);
      }
    }

    console.log(`Done. Processed ${total} rows; inserted ${inserted} leads.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Import failed:', e);
  process.exit(1);
});

