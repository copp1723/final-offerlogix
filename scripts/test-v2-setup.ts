#!/usr/bin/env node

/**
 * Test V2 setup and configuration
 * This script verifies that V2 is properly configured and working
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { aiAgentConfig, conversations } from '../shared/schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function testV2Setup() {
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
    console.log('🧪 Testing V2 Setup...\n');

    // Test 1: Check environment variables
    console.log('1️⃣ Environment Variables:');
    console.log(`   ✅ V2_MAILGUN_ENABLED: ${process.env.V2_MAILGUN_ENABLED}`);
    console.log(`   ✅ VITE_ENABLE_V2_UI: ${process.env.VITE_ENABLE_V2_UI}`);
    console.log();

    // Test 2: Check V2-enabled agents
    console.log('2️⃣ V2-Enabled Agents:');
    const v2Agents = await db
      .select({
        id: aiAgentConfig.id,
        name: aiAgentConfig.name,
        isActive: aiAgentConfig.isActive,
        useV2: aiAgentConfig.useV2
      })
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.useV2, true));

    if (v2Agents.length === 0) {
      console.log('   ❌ No V2-enabled agents found');
    } else {
      v2Agents.forEach(agent => {
        console.log(`   ✅ ${agent.name}: Active=${agent.isActive}, V2=${agent.useV2}`);
      });
    }
    console.log();

    // Test 3: Check archived conversations
    console.log('3️⃣ Conversation Status:');
    const activeConversations = await sql`
      SELECT COUNT(*) as count FROM conversations WHERE archived = false;
    `;
    const archivedConversations = await sql`
      SELECT COUNT(*) as count FROM conversations WHERE archived = true;
    `;

    console.log(`   📂 Active conversations: ${activeConversations[0].count}`);
    console.log(`   📦 Archived conversations: ${archivedConversations[0].count}`);
    console.log();

    // Test 4: Check V2 tables exist
    console.log('4️⃣ V2 Database Tables:');
    const v2Tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%_v2'
      ORDER BY table_name;
    `;

    if (v2Tables.length === 0) {
      console.log('   ❌ No V2 tables found');
    } else {
      v2Tables.forEach(table => {
        console.log(`   ✅ ${table.table_name}`);
      });
    }
    console.log();

    // Test 5: Summary
    console.log('📋 V2 Setup Summary:');
    const isV2Ready = 
      process.env.V2_MAILGUN_ENABLED === 'true' &&
      process.env.VITE_ENABLE_V2_UI === 'true' &&
      v2Agents.length > 0 &&
      v2Tables.length > 0;

    if (isV2Ready) {
      console.log('   🎉 V2 is properly configured and ready!');
      console.log();
      console.log('📋 Next Steps:');
      console.log('   1. Restart your application: npm run dev');
      console.log('   2. Navigate to the conversations page');
      console.log('   3. New conversations will use V2 system');
      console.log('   4. Look for V2 debug badges in development mode');
    } else {
      console.log('   ⚠️  V2 setup is incomplete. Check the issues above.');
    }

  } catch (error) {
    console.error('❌ Error testing V2 setup:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testV2Setup().catch(console.error);
