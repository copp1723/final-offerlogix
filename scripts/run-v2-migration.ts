#!/usr/bin/env node

/**
 * Run V2 migration to add provider_message_id column
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function runV2Migration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.DATABASE_URL.includes('render.com') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('🔧 Running V2 migration: Add provider_message_id column\n');

    // Add provider_message_id column for webhook correlation
    console.log('1️⃣ Adding provider_message_id column...');
    await sql`
      ALTER TABLE "messages_v2" 
      ADD COLUMN IF NOT EXISTS "provider_message_id" varchar(255);
    `;
    console.log('✅ Column added successfully');

    // Add index for provider_message_id lookups (webhook performance)
    console.log('2️⃣ Adding index for provider_message_id...');
    await sql`
      CREATE INDEX IF NOT EXISTS "messages_v2_provider_message_id_idx" 
      ON "messages_v2" ("provider_message_id")
      WHERE "provider_message_id" IS NOT NULL;
    `;
    console.log('✅ Index created successfully');

    // Add unique constraint to prevent duplicate provider message IDs
    console.log('3️⃣ Adding unique constraint...');
    try {
      await sql`
        ALTER TABLE "messages_v2"
        ADD CONSTRAINT "messages_v2_provider_message_id_unique" 
        UNIQUE ("provider_message_id");
      `;
      console.log('✅ Unique constraint added successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Unique constraint already exists');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 V2 migration completed successfully!');
    console.log('\n📋 What was added:');
    console.log('   ✅ provider_message_id column for webhook correlation');
    console.log('   ✅ Index for fast webhook lookups');
    console.log('   ✅ Unique constraint to prevent duplicates');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runV2Migration().catch(console.error);
