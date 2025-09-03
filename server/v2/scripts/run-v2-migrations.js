#!/usr/bin/env node
/**
 * V2 Migrations Runner
 * - Applies SQL files in server/v2/migrations in lexicographic order
 * - Idempotent via tracking table `v2_migrations`
 * - Uses `psql` under the hood; no extra deps
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sh(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString();
}

function log(msg) {
  console.log(`[v2-migrate] ${msg}`);
}

function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[v2-migrate] DATABASE_URL must be set');
    process.exit(1);
  }

  const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[v2-migrate] Missing migrations dir: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  // Ensure tracking table exists
  log('Ensuring tracking table v2_migrations exists');
  sh(`psql "${dbUrl}" -c "CREATE TABLE IF NOT EXISTS v2_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now());"`);

  // Bootstrap tracking if DB already has base schema/data
  try {
    const migCountRaw = sh(`psql "${dbUrl}" -t -c "SELECT COUNT(*) FROM v2_migrations;"`).trim();
    const migCount = parseInt(migCountRaw, 10) || 0;
    if (migCount === 0) {
      const hasConversations = /t\b/.test(
        sh(`psql "${dbUrl}" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations_v2');"`).trim()
      );
      if (hasConversations) {
        log('Bootstrap: marking 0001_v2_schema.sql as applied (schema already present)');
        sh(`psql "${dbUrl}" -c "INSERT INTO v2_migrations (filename) VALUES ('0001_v2_schema.sql') ON CONFLICT DO NOTHING;"`);
      }
      const hasAgents = /t\b/.test(
        sh(`psql "${dbUrl}" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agents_v2');"`).trim()
      );
      if (hasAgents) {
        const agentsCountRaw = sh(`psql "${dbUrl}" -t -c "SELECT COUNT(*) FROM agents_v2;"`).trim();
        const agentsCount = parseInt(agentsCountRaw, 10) || 0;
        if (agentsCount > 0) {
          log('Bootstrap: marking 0002_seed_data.sql as applied (agents exist)');
          sh(`psql "${dbUrl}" -c "INSERT INTO v2_migrations (filename) VALUES ('0002_seed_data.sql') ON CONFLICT DO NOTHING;"`);
        }
      }
    }
  } catch (e) {
    console.warn('[v2-migrate] Bootstrap warning:', e.message || e);
  }

  // Collect and sort migrations
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (!files.length) {
    log('No migration files found');
    return;
  }

  log(`Found ${files.length} migration(s)`);

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const base = file;
    // Check if already applied
    const existsRaw = sh(
      `psql "${dbUrl}" -t -c "SELECT EXISTS (SELECT 1 FROM v2_migrations WHERE filename = '${base}');"`
    ).trim();

    const exists = /t\b/.test(existsRaw);
    if (exists) {
      skipped++;
      log(`Skip: ${base} (already applied)`);
      continue;
    }

    const fullPath = path.join(MIGRATIONS_DIR, file);
    log(`Apply: ${base}`);
    try {
      // Apply migration file
      execSync(`psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${fullPath}"`, { stdio: 'inherit' });
      // Record success
      sh(`psql "${dbUrl}" -c "INSERT INTO v2_migrations (filename) VALUES ($$${base}$$) ON CONFLICT DO NOTHING;"`);
      applied++;
    } catch (e) {
      console.error(`\n[v2-migrate] Failed on ${base}:`, e.message || e);
      process.exit(1);
    }
  }

  log(`Done. Applied: ${applied}, Skipped: ${skipped}`);
}

main();
