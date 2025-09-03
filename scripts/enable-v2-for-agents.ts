#!/usr/bin/env node

/**
 * Enable V2 for all active agents
 * This script adds the useV2 column and enables V2 for all active agents
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { aiAgentConfig } from '../shared/schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function enableV2ForAgents() {
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
    console.log('🚀 Enabling V2 for all active agents...\n');

    // First, add the useV2 column if it doesn't exist
    console.log('📝 Adding useV2 column to ai_agent_config table...');
    await sql`
      ALTER TABLE ai_agent_config 
      ADD COLUMN IF NOT EXISTS use_v2 boolean DEFAULT false NOT NULL;
    `;
    console.log('✅ Column added successfully\n');

    // Get all active agents
    const activeAgents = await db
      .select()
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.isActive, true));

    console.log(`🤖 Found ${activeAgents.length} active agents:\n`);

    for (const agent of activeAgents) {
      console.log(`   - ${agent.name} (ID: ${agent.id})`);
    }

    if (activeAgents.length === 0) {
      console.log('⚠️  No active agents found. Nothing to update.');
      return;
    }

    console.log('\n🔄 Enabling V2 for all active agents...');

    // Enable V2 for all active agents
    const result = await db
      .update(aiAgentConfig)
      .set({ 
        useV2: true,
        updatedAt: new Date()
      })
      .where(eq(aiAgentConfig.isActive, true));

    console.log(`✅ Successfully enabled V2 for ${activeAgents.length} agents\n`);

    // Verify the changes
    console.log('🔍 Verifying changes...');
    const updatedAgents = await db
      .select({
        id: aiAgentConfig.id,
        name: aiAgentConfig.name,
        isActive: aiAgentConfig.isActive,
        useV2: aiAgentConfig.useV2
      })
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.isActive, true));

    console.log('\n📊 Updated agent status:');
    updatedAgents.forEach(agent => {
      console.log(`   ✅ ${agent.name}: Active=${agent.isActive}, V2=${agent.useV2}`);
    });

    console.log('\n🎉 V2 enablement complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your application to pick up the changes');
    console.log('   2. V2 UI is already enabled (VITE_ENABLE_V2_UI=true)');
    console.log('   3. V2 conversations will now be used for all active agents');
    console.log('   4. Old V1 conversations will still be accessible but new ones use V2');

  } catch (error) {
    console.error('❌ Error enabling V2:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

enableV2ForAgents().catch(console.error);
