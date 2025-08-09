import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

async function tableExists(client: any, table: string): Promise<boolean> {
  const { rowCount } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return !!rowCount;
}

async function columnExists(client: any, table: string, column: string): Promise<boolean> {
  const { rowCount } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return !!rowCount;
}

async function applySqlFile(client: any, fileRelPath: string) {
  const filePath = path.resolve(process.cwd(), fileRelPath);
  const sql = await fs.readFile(filePath, 'utf-8');
  await client.query(sql);
  console.log(`Applied ${fileRelPath}`);
}

async function ensureExtensions(client: any) {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  } catch (e) {
    console.warn('pgcrypto extension warning:', (e as Error).message);
  }
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  } catch (e) {
    console.warn('uuid-ossp extension warning:', (e as Error).message);
  }
}

async function applyTargetedPatches(client: any) {
  // Conversations: ensure required columns exist
  if (!(await columnExists(client, 'conversations', 'lead_id'))) {
    console.log('[DB Doctor] Adding conversations.lead_id');
    await client.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_id varchar');
  }
  if (!(await columnExists(client, 'conversations', 'priority'))) {
    console.log('[DB Doctor] Adding conversations.priority');
    await client.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal'");
  }

  // Conversations: ensure timestamps exist
  if (!(await columnExists(client, 'conversations', 'created_at'))) {
    console.log('[DB Doctor] Adding conversations.created_at');
    await client.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now()');
  }
  if (!(await columnExists(client, 'conversations', 'updated_at'))) {
    console.log('[DB Doctor] Adding conversations.updated_at');
    await client.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()');
  }

  // Campaigns: ensure context and related new fields exist
  const campaignCols: Array<[string, string]> = [
    ['context', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT ''"],
    ['target_audience', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_audience text"],
    ['handover_prompt', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_prompt text"],
    ['communication_type', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS communication_type varchar(20) DEFAULT 'email'"],
    ['sms_opt_in_required', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sms_opt_in_required boolean DEFAULT true"],
    ['sms_opt_in_message', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sms_opt_in_message text DEFAULT 'Would you like to continue this conversation via text? Reply YES to receive SMS updates.'"],
    ['schedule_type', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS schedule_type varchar(20) DEFAULT 'immediate'"],
    ['scheduled_start', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_start timestamp"],
    ['recurring_pattern', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recurring_pattern varchar(50)"],
    ['recurring_days', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recurring_days jsonb"],
    ['recurring_time', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recurring_time varchar(8)"],
    ['is_active', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true"],
    ['next_execution', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS next_execution timestamp"],
    ['subject_lines', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS subject_lines jsonb"],
    ['templates', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS templates jsonb"],
    ['number_of_templates', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS number_of_templates integer DEFAULT 5"],
    ['days_between_messages', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS days_between_messages integer DEFAULT 3"],
    ['is_template', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false"],
    ['original_campaign_id', "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS original_campaign_id varchar"],
  ];
  for (const [col, ddl] of campaignCols) {
    if (!(await columnExists(client, 'campaigns', col))) {
      console.log(`[DB Doctor] Adding campaigns.${col}`);
      await client.query(ddl);
    }
  }
  // Drop default on context if newly added
  try { await client.query(`ALTER TABLE campaigns ALTER COLUMN context DROP DEFAULT`); } catch {}

  // Users: notification_preferences
  if (!(await columnExists(client, 'users', 'notification_preferences'))) {
    console.log('[DB Doctor] Adding users.notification_preferences');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
      "emailNotifications": true,
      "campaignAlerts": true,
      "leadAlerts": true,
      "systemAlerts": true,
      "monthlyReports": true,
      "highEngagementAlerts": true,
      "quotaWarnings": true
    }'::jsonb`);
  }

  // ai_agent_config table existence
  if (!(await tableExists(client, 'ai_agent_config'))) {
    console.log('[DB Doctor] Creating ai_agent_config table');
    await client.query(`CREATE TABLE IF NOT EXISTS ai_agent_config (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      name varchar NOT NULL,
      tonality text DEFAULT 'professional' NOT NULL,
      personality text,
      dos_list jsonb DEFAULT '[]',
      donts_list jsonb DEFAULT '[]',
      industry varchar DEFAULT 'automotive',
      response_style text DEFAULT 'helpful',
      model text DEFAULT 'openai/gpt-5-mini',
      system_prompt text,
      is_active boolean DEFAULT false,
      client_id uuid,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )`);
  }

  // ai_agent_config columns & FK
  const agentCols: Array<[string, string]> = [
    ['model', "ALTER TABLE ai_agent_config ADD COLUMN IF NOT EXISTS model text DEFAULT 'openai/gpt-5-mini'"],
    ['system_prompt', 'ALTER TABLE ai_agent_config ADD COLUMN IF NOT EXISTS system_prompt text'],
    ['client_id', 'ALTER TABLE ai_agent_config ADD COLUMN IF NOT EXISTS client_id uuid'],
    ['is_active', 'ALTER TABLE ai_agent_config ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false'],
  ];
  for (const [col, ddl] of agentCols) {
    if (!(await columnExists(client, 'ai_agent_config', col))) {
      console.log(`[DB Doctor] Adding ai_agent_config.${col}`);
      await client.query(ddl);
    }
  }
  // Add FK if missing without DO $$ block
  const fkExists = await client.query(`
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='ai_agent_config' AND constraint_type='FOREIGN KEY' AND constraint_name='ai_agent_config_client_id_clients_id_fk'
  `);
  if (!fkExists.rowCount) {
    try {
      await client.query(`ALTER TABLE ai_agent_config ADD CONSTRAINT ai_agent_config_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES clients(id)`);
    } catch (e) {
      console.warn('[DB Doctor] FK add warning:', (e as Error).message);
    }
  }

  // Seed default client if missing
  const { rows } = await client.query(`SELECT id FROM clients WHERE domain = 'localhost' LIMIT 1`);
  if (!rows.length) {
    console.log('[DB Doctor] Seeding default client (localhost)');
    await client.query(`INSERT INTO clients (name, domain, branding_config, settings, active)
      VALUES ('Default Client', 'localhost', '{"primaryColor": "#2563eb", "secondaryColor": "#1e40af", "logoUrl": "", "companyName": "OneKeel Swarm", "favicon": "", "customCss": ""}', '{}', true)
      ON CONFLICT (domain) DO NOTHING`);
  }
}

async function main() {
  console.log('DB Doctor starting…');
  const connectionString = reqEnv('DATABASE_URL');
  const pool = new Pool({ connectionString, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();

  try {
    await ensureExtensions(client);

    // If base tables missing, bootstrap with initial schema
    const hasClients = await tableExists(client, 'clients');
    const hasConversations = await tableExists(client, 'conversations');
    if (!hasClients || !hasConversations) {
      console.log('[DB Doctor] Applying initial schema (drizzle/0001_initial_schema.sql)');
      await applySqlFile(client, 'drizzle/0001_initial_schema.sql');
    }

    // Apply incremental migrations (idempotent)
    // Prefer targeted patches below to avoid DO $$ blocks incompatibility across environments
    try { await applySqlFile(client, 'drizzle/0002_schema_updates.sql'); } catch (e) { console.warn('[DB Doctor] 0002 apply warning:', (e as Error).message); }
    // Skip 0003; handle via targeted patch to avoid DO $$ ... WHEN syntax issues

    // Apply targeted safety patches (covers any drift)
    await applyTargetedPatches(client);

    // Smoke test key selects to make sure endpoints won’t 500 on simple loads
    await client.query('SELECT id, name, created_at FROM campaigns LIMIT 1');
    await client.query('SELECT id, status, priority, created_at FROM conversations LIMIT 1');
    await client.query('SELECT id, email, created_at FROM leads LIMIT 1');

    console.log('DB Doctor completed successfully ✅');
  } catch (e) {
    console.error('DB Doctor failed ❌:', (e as Error).message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute when run directly with tsx
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

