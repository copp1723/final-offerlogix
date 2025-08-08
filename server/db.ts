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

// Fire-and-forget on startup
void ensureDatabaseReady();

export const db = drizzle(pool, { schema });