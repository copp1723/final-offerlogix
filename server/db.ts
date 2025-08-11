import dotenv from "dotenv";
dotenv.config();

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Best-effort: ensure required extensions exist (Render Postgres supports these)
async function ensureDatabaseReady() {
  const client = await pool.connect();
  try {
    // gen_random_uuid() comes from pgcrypto; uuid-ossp provides uuid_generate_v4()
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  } catch (err) {
    console.warn('Database extension setup warning:', (err as Error)?.message || err);
  } finally {
    client.release();
  }
}

// Helper to check table existence (shared)
async function tableExists(client: any, table: string): Promise<boolean> {
  const { rowCount } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [table]
  );
  return !!rowCount;
}

// Legacy patcher: add columns that older prod DBs might miss (idempotent)
async function applyLegacyPatches() {
  const client = await pool.connect();
  try {
    // campaigns.context
    const { rowCount: hasContext } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='context'`
    );
    if (!hasContext) {
      console.log('[DB Patch] Adding campaigns.context column');
      await client.query(`ALTER TABLE campaigns ADD COLUMN context text NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE campaigns ALTER COLUMN context DROP DEFAULT`);
      console.log('[DB Patch] campaigns.context added');
    }

    // Idempotent add if missing
    const addColumn = async (col: string, ddl: string) => {
      const { rowCount } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name=$1`, [col]
      );
      if (!rowCount) {
        console.log(`[DB Patch] Adding campaigns.${col}`);
        await client.query(ddl);
      }
    };

    // Functional columns required by runtime
    await addColumn('handover_goals', `ALTER TABLE campaigns ADD COLUMN handover_goals text`);
    await addColumn('communication_type', `ALTER TABLE campaigns ADD COLUMN communication_type varchar(20) DEFAULT 'email'`);
    await addColumn('sms_opt_in_required', `ALTER TABLE campaigns ADD COLUMN sms_opt_in_required boolean DEFAULT true`);
    await addColumn('sms_opt_in_message', `ALTER TABLE campaigns ADD COLUMN sms_opt_in_message text DEFAULT 'Would you like to continue this conversation via text? Reply YES to receive SMS updates.'`);
    await addColumn('schedule_type', `ALTER TABLE campaigns ADD COLUMN schedule_type varchar(20) DEFAULT 'immediate'`);
    await addColumn('scheduled_start', `ALTER TABLE campaigns ADD COLUMN scheduled_start timestamp`);
    await addColumn('recurring_pattern', `ALTER TABLE campaigns ADD COLUMN recurring_pattern varchar(50)`);
    await addColumn('recurring_days', `ALTER TABLE campaigns ADD COLUMN recurring_days jsonb`);
    await addColumn('recurring_time', `ALTER TABLE campaigns ADD COLUMN recurring_time varchar(8)`);
    await addColumn('is_active', `ALTER TABLE campaigns ADD COLUMN is_active boolean DEFAULT true`);
    await addColumn('next_execution', `ALTER TABLE campaigns ADD COLUMN next_execution timestamp`);
    await addColumn('target_audience', `ALTER TABLE campaigns ADD COLUMN target_audience text`);
    await addColumn('handover_prompt', `ALTER TABLE campaigns ADD COLUMN handover_prompt text`);
    await addColumn('templates', `ALTER TABLE campaigns ADD COLUMN templates jsonb`);
    await addColumn('subject_lines', `ALTER TABLE campaigns ADD COLUMN subject_lines jsonb`);
    await addColumn('number_of_templates', `ALTER TABLE campaigns ADD COLUMN number_of_templates integer DEFAULT 5`);
    await addColumn('days_between_messages', `ALTER TABLE campaigns ADD COLUMN days_between_messages integer DEFAULT 3`);
    await addColumn('open_rate', `ALTER TABLE campaigns ADD COLUMN open_rate integer`);
    await addColumn('is_template', `ALTER TABLE campaigns ADD COLUMN is_template boolean DEFAULT false`);
    await addColumn('original_campaign_id', `ALTER TABLE campaigns ADD COLUMN original_campaign_id varchar`);

    // Leads fields that may be missing on older DBs
    const addColumnTo = async (table: string, col: string, ddl: string) => {
      const { rowCount } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [table, col]
      );
      if (!rowCount) {
        console.log(`[DB Patch] Adding ${table}.${col}`);
        await client.query(ddl);
      }
    };
    await addColumnTo('leads', 'vehicle_interest', `ALTER TABLE leads ADD COLUMN vehicle_interest varchar`);
    await addColumnTo('leads', 'lead_source', `ALTER TABLE leads ADD COLUMN lead_source varchar`);
    await addColumnTo('leads', 'status', `ALTER TABLE leads ADD COLUMN status varchar DEFAULT 'new'`);
    await addColumnTo('leads', 'tags', `ALTER TABLE leads ADD COLUMN tags varchar[]`);
    await addColumnTo('leads', 'notes', `ALTER TABLE leads ADD COLUMN notes text`);
    await addColumnTo('leads', 'campaign_id', `ALTER TABLE leads ADD COLUMN campaign_id varchar`);
    await addColumnTo('leads', 'client_id', `ALTER TABLE leads ADD COLUMN client_id uuid`);
    await addColumnTo('leads', 'created_at', `ALTER TABLE leads ADD COLUMN created_at timestamp DEFAULT now()`);
    await addColumnTo('leads', 'updated_at', `ALTER TABLE leads ADD COLUMN updated_at timestamp DEFAULT now()`);
    await addColumnTo('conversations', 'lead_id', `ALTER TABLE conversations ADD COLUMN lead_id varchar`);
    await addColumnTo('users', 'notification_preferences', `ALTER TABLE users ADD COLUMN notification_preferences jsonb DEFAULT '{
      "emailNotifications": true,
      "campaignAlerts": true,
      "leadAlerts": true,
      "systemAlerts": true,
      "monthlyReports": true,
      "highEngagementAlerts": true,
      "quotaWarnings": true
    }'::jsonb`);

    // Ensure ai_agent_config table exists
    if (!(await tableExists(client, 'ai_agent_config'))) {
      console.log('[DB Patch] Creating missing ai_agent_config table');
      await client.query(`CREATE TABLE IF NOT EXISTS ai_agent_config (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        name varchar NOT NULL,
        tonality text DEFAULT 'professional' NOT NULL,
        personality text,
        dos_list jsonb DEFAULT '[]',
        donts_list jsonb DEFAULT '[]',
        industry varchar DEFAULT 'automotive',
        response_style text DEFAULT 'helpful',
    model text DEFAULT 'openai/gpt-5-chat',
        system_prompt text,
        is_active boolean DEFAULT false,
        client_id uuid,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )`);
    }

  await addColumnTo('ai_agent_config', 'model', `ALTER TABLE ai_agent_config ADD COLUMN model text DEFAULT 'openai/gpt-5-chat'`);
    await addColumnTo('ai_agent_config', 'system_prompt', `ALTER TABLE ai_agent_config ADD COLUMN system_prompt text`);
    await addColumnTo('ai_agent_config', 'client_id', `ALTER TABLE ai_agent_config ADD COLUMN client_id uuid`);
    await addColumnTo('ai_agent_config', 'is_active', `ALTER TABLE ai_agent_config ADD COLUMN is_active boolean DEFAULT false`);
    await addColumnTo('ai_agent_config', 'agent_email_domain', `ALTER TABLE ai_agent_config ADD COLUMN agent_email_domain varchar`);

    try {
      await client.query(`ALTER TABLE ai_agent_config ALTER COLUMN model SET DEFAULT 'openai/gpt-5-chat'`);
      await client.query(`UPDATE ai_agent_config SET model='openai/gpt-5-chat' 
        WHERE model IS NULL 
           OR model='' 
           OR model ILIKE 'openai/gpt-5-mini' 
           OR model ILIKE 'gpt-5-mini' 
           OR model ILIKE 'openai/gpt-4o-mini' 
           OR model ILIKE 'gpt-4o-mini' 
           OR model ILIKE 'openai/gpt-4o' 
           OR model ILIKE 'gpt-4o'`);
    } catch (e) {
      console.warn('[DB Patch] model default update warning:', (e as Error).message);
    }

    try {
      await client.query(`ALTER TABLE ai_agent_config ADD CONSTRAINT ai_agent_config_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES clients(id)`);
    } catch (e) {
      // ignore duplicate_object
    }

  } catch (err) {
    console.warn('[DB Patch] Warning while applying legacy patches:', (err as Error)?.message || err);
  } finally {
    client.release();
  }
}

// Fire-and-forget on startup
void ensureDatabaseReady();
void applyLegacyPatches();

export const db = drizzle(pool, { schema });