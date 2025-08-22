// NOTE:
// - dotenv is loaded once in the main entry (server/index.ts). Avoid duplicate loads here
//   to prevent double log lines like "dotenv injecting env".
// - DATABASE_URL must be set at import time because this module initializes the DB pool.
//   Ensure your .env is configured before importing server modules that access the DB.

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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DATABASE_POOL_MAX) || 20,
  min: Number(process.env.DATABASE_POOL_MIN) || 5,
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT) || 10000,
  query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT) || 60000,
  statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT) || 60000,
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
  // New structured JSON spec for handover evaluation (added via migration 0009) - ensure presence in older DBs
  await addColumn('handover_prompt_spec', `ALTER TABLE campaigns ADD COLUMN handover_prompt_spec jsonb`);
    await addColumn('templates', `ALTER TABLE campaigns ADD COLUMN templates jsonb`);
    await addColumn('subject_lines', `ALTER TABLE campaigns ADD COLUMN subject_lines jsonb`);
    await addColumn('number_of_templates', `ALTER TABLE campaigns ADD COLUMN number_of_templates integer DEFAULT 5`);
    await addColumn('days_between_messages', `ALTER TABLE campaigns ADD COLUMN days_between_messages integer DEFAULT 3`);
    await addColumn('open_rate', `ALTER TABLE campaigns ADD COLUMN open_rate integer`);
    await addColumn('is_template', `ALTER TABLE campaigns ADD COLUMN is_template boolean DEFAULT false`);
    await addColumn('original_campaign_id', `ALTER TABLE campaigns ADD COLUMN original_campaign_id varchar`);

    await addColumn('agent_config_id', `ALTER TABLE campaigns ADD COLUMN agent_config_id varchar`);

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

    // Ensure ai_personas table exists
    if (!(await tableExists(client, 'ai_personas'))) {
      console.log('[DB Patch] Creating missing ai_personas table');
      await client.query(`CREATE TABLE IF NOT EXISTS ai_personas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        client_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        target_audience varchar(255),
        industry varchar(100) DEFAULT 'automotive',
        tonality text DEFAULT 'professional' NOT NULL,
        personality text,
        communication_style text DEFAULT 'helpful',
        model text DEFAULT 'openai/gpt-4o',
        temperature integer DEFAULT 70,
        max_tokens integer DEFAULT 300,
        system_prompt text,
        response_guidelines jsonb DEFAULT '[]'::jsonb NOT NULL,
        escalation_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
        preferred_channels jsonb DEFAULT '["email"]'::jsonb NOT NULL,
        handover_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
        kb_access_level varchar(50) DEFAULT 'campaign_only',
        is_active boolean DEFAULT true NOT NULL,
        is_default boolean DEFAULT false NOT NULL,
        priority integer DEFAULT 100,
        metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )`);
    }
    // Ensure handovers table exists (idempotent)
    if (!(await tableExists(client, 'handovers'))) {
      console.log('[DB Patch] Creating missing handovers table');
      await client.query(`CREATE TABLE IF NOT EXISTS handovers (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        conversation_id varchar REFERENCES conversations(id),
        reason text,
        created_at timestamp DEFAULT now() NOT NULL,
        resolved_at timestamp
      )`);
    }


    // Ensure persona_knowledge_bases table exists
    if (!(await tableExists(client, 'persona_knowledge_bases'))) {
      console.log('[DB Patch] Creating missing persona_knowledge_bases table');
      await client.query(`CREATE TABLE IF NOT EXISTS persona_knowledge_bases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        persona_id uuid NOT NULL,
        knowledge_base_id uuid NOT NULL,
        access_level varchar(50) DEFAULT 'read',
        priority integer DEFAULT 100,
        created_at timestamp DEFAULT now() NOT NULL
      )`);
    }

    // Ensure kb_document_persona_tags table exists
    if (!(await tableExists(client, 'kb_document_persona_tags'))) {
      console.log('[DB Patch] Creating missing kb_document_persona_tags table');
      await client.query(`CREATE TABLE IF NOT EXISTS kb_document_persona_tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        document_id uuid NOT NULL,
        persona_id uuid NOT NULL,
        relevance_score integer DEFAULT 100,
        tags varchar[] DEFAULT '{}',
        created_at timestamp DEFAULT now() NOT NULL
      )`);
    }

    // Add foreign key constraints for persona tables if they don't exist
    try {
      await client.query(`ALTER TABLE ai_personas ADD CONSTRAINT ai_personas_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES clients(id)`);
    } catch (e) {
      // ignore if constraint already exists
    }

    try {
      await client.query(`ALTER TABLE persona_knowledge_bases ADD CONSTRAINT persona_knowledge_bases_persona_id_ai_personas_id_fk FOREIGN KEY (persona_id) REFERENCES ai_personas(id)`);
    } catch (e) {
      // ignore if constraint already exists
    }

    try {
      await client.query(`ALTER TABLE persona_knowledge_bases ADD CONSTRAINT persona_knowledge_bases_knowledge_base_id_knowledge_bases_id_fk FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)`);
    } catch (e) {
      // ignore if constraint already exists
    }

    try {
      await client.query(`ALTER TABLE kb_document_persona_tags ADD CONSTRAINT kb_document_persona_tags_document_id_kb_documents_id_fk FOREIGN KEY (document_id) REFERENCES kb_documents(id)`);
    } catch (e) {
      // ignore if constraint already exists
    }

    try {
      await client.query(`ALTER TABLE kb_document_persona_tags ADD CONSTRAINT kb_document_persona_tags_persona_id_ai_personas_id_fk FOREIGN KEY (persona_id) REFERENCES ai_personas(id)`);
    } catch (e) {
      // ignore if constraint already exists
    }

    try {
      await client.query(`ALTER TABLE campaigns ADD CONSTRAINT campaigns_persona_id_ai_personas_id_fk FOREIGN KEY (persona_id) REFERENCES ai_personas(id)`);
    } catch (e) {
      // ignore if constraint already exists
    }

    // Create indexes for better performance
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_client_id ON ai_personas (client_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_target_audience ON ai_personas (target_audience)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_active ON ai_personas (is_active)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_personas_default ON ai_personas (is_default)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_persona_knowledge_bases_persona_id ON persona_knowledge_bases (persona_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_persona_knowledge_bases_kb_id ON persona_knowledge_bases (knowledge_base_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_kb_document_persona_tags_document_id ON kb_document_persona_tags (document_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_kb_document_persona_tags_persona_id ON kb_document_persona_tags (persona_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_campaigns_persona_id ON campaigns (persona_id)`);
    } catch (e) {
      // ignore if indexes already exist
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

// Graceful shutdown handling
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, closing database connections...`);
  try {
    await pool.end();
    console.log('Database connections closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error closing database connections:', error);
    process.exit(1);
  }
}