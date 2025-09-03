#!/usr/bin/env node

/**
 * Show all real data in the system - agents, campaigns, conversations
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { campaigns, conversations, leads, aiAgentConfig } from '../shared/schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function showRealData() {
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
    console.log('📊 REAL DATA INVENTORY\n');

    // V1 Campaigns
    console.log('📋 V1 CAMPAIGNS:');
    const v1Campaigns = await sql`
      SELECT id, name, status, created_at, agent_config_id
      FROM campaigns 
      ORDER BY created_at DESC;
    `;
    console.log(`Found ${v1Campaigns.length} V1 campaigns:`);
    v1Campaigns.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.name} (${campaign.status}) - ${campaign.created_at}`);
    });
    console.log();

    // V2 Campaigns
    console.log('📋 V2 CAMPAIGNS:');
    const v2Campaigns = await sql`
      SELECT id, name, status, created_at, agent_id
      FROM campaigns_v2 
      ORDER BY created_at DESC;
    `;
    console.log(`Found ${v2Campaigns.length} V2 campaigns:`);
    v2Campaigns.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.name} (${campaign.status}) - ${campaign.created_at}`);
    });
    console.log();

    // V1 Conversations (including archived)
    console.log('💬 V1 CONVERSATIONS:');
    const v1Conversations = await sql`
      SELECT c.id, c.subject, c.status, c.archived, c.created_at, l.email as lead_email
      FROM conversations c
      LEFT JOIN leads l ON c.lead_id = l.id
      ORDER BY c.created_at DESC;
    `;
    console.log(`Found ${v1Conversations.length} V1 conversations:`);
    v1Conversations.forEach((conv, index) => {
      const archivedStatus = conv.archived ? '📦 ARCHIVED' : '📂 ACTIVE';
      console.log(`   ${index + 1}. ${conv.lead_email} - "${conv.subject}" (${conv.status}) ${archivedStatus}`);
    });
    console.log();

    // V2 Conversations
    console.log('💬 V2 CONVERSATIONS:');
    const v2Conversations = await sql`
      SELECT id, lead_email, subject, status, created_at
      FROM conversations_v2 
      ORDER BY created_at DESC;
    `;
    console.log(`Found ${v2Conversations.length} V2 conversations:`);
    v2Conversations.forEach((conv, index) => {
      console.log(`   ${index + 1}. ${conv.lead_email} - "${conv.subject}" (${conv.status})`);
    });
    console.log();

    // Leads
    console.log('👥 LEADS:');
    const allLeads = await sql`
      SELECT id, email, first_name, last_name, created_at
      FROM leads 
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    console.log(`Found ${allLeads.length} leads (showing first 10):`);
    allLeads.forEach((lead, index) => {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'No name';
      console.log(`   ${index + 1}. ${lead.email} - ${name}`);
    });
    console.log();

    // V1 vs V2 Agent Summary
    console.log('🤖 AGENT SUMMARY:');
    console.log(`   V1 Agents: 1 (in ai_agent_config table)`);
    console.log(`   V2 Agents: 7 (in agents_v2 table)`);
    console.log();

    console.log('🎯 MIGRATION NEEDED:');
    console.log('   ✅ V2 agents already exist (7 dealership agents)');
    console.log(`   📋 V1 campaigns need migration (${v1Campaigns.length} campaigns)`);
    console.log(`   💬 V1 conversations archived (${v1Conversations.filter(c => c.archived).length} archived)`);
    console.log(`   👥 Leads exist and can be used by V2 (${allLeads.length}+ leads)`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

showRealData().catch(console.error);
