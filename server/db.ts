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

    // Scheduling/communication columns
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