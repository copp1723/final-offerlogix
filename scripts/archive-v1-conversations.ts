#!/usr/bin/env node

/**
 * Archive V1 conversations to hide them from the UI
 * This script marks old V1 conversations as archived so they don't show in the main UI
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, isNull, and } from 'drizzle-orm';
import { conversations } from '../shared/schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function archiveV1Conversations() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.DATABASE_URL.includes('render.com') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  const db = drizzle(sql);

  try {
    console.log('📦 Archiving V1 conversations...\n');

    // First, add an archived column if it doesn't exist
    console.log('📝 Adding archived column to conversations table...');
    await sql`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;
    `;
    console.log('✅ Column added successfully\n');

    // Get count of all V1 conversations (the entire conversations table is V1)
    const v1ConversationsCount = await sql`
      SELECT COUNT(*) as count
      FROM conversations
      WHERE archived = false;
    `;

    const count = parseInt(v1ConversationsCount[0].count);
    console.log(`🔍 Found ${count} V1 conversations to archive\n`);

    if (count === 0) {
      console.log('✅ No V1 conversations found to archive.');
      return;
    }

    // Show some examples of what will be archived
    const examples = await sql`
      SELECT c.id, l.email as lead_email, c.subject, c.created_at
      FROM conversations c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.archived = false
      ORDER BY c.created_at DESC
      LIMIT 5;
    `;

    console.log('📋 Examples of conversations to be archived:');
    examples.forEach((conv, index) => {
      console.log(`   ${index + 1}. ${conv.lead_email} - "${conv.subject}" (${conv.created_at})`);
    });

    console.log('\n⚠️  This will hide these conversations from the main UI.');
    console.log('   They will still exist in the database and can be unarchived if needed.\n');

    // Archive V1 conversations
    console.log('🔄 Archiving V1 conversations...');

    const result = await sql`
      UPDATE conversations
      SET archived = true, updated_at = NOW()
      WHERE archived = false;
    `;

    console.log(`✅ Successfully archived ${count} V1 conversations\n`);

    // Verify the changes
    const remainingCount = await sql`
      SELECT COUNT(*) as count 
      FROM conversations 
      WHERE archived = false;
    `;

    const archivedCount = await sql`
      SELECT COUNT(*) as count 
      FROM conversations 
      WHERE archived = true;
    `;

    console.log('📊 Conversation status after archiving:');
    console.log(`   📂 Active conversations: ${remainingCount[0].count}`);
    console.log(`   📦 Archived conversations: ${archivedCount[0].count}`);

    console.log('\n🎉 V1 conversation archiving complete!');
    console.log('\n📋 What happened:');
    console.log('   ✅ V1 conversations are now hidden from the main UI');
    console.log('   ✅ V2 conversations will be the primary interface');
    console.log('   ✅ Archived conversations can be restored if needed');
    console.log('\n💡 To restore V1 conversations if needed:');
    console.log('   UPDATE conversations SET archived = false WHERE archived = true;');

  } catch (error) {
    console.error('❌ Error archiving conversations:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

archiveV1Conversations().catch(console.error);
