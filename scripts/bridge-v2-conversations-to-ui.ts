#!/usr/bin/env node

/**
 * Bridge V2 conversations to V1 UI
 * Creates V1 conversation records for recent V2 conversations so they appear in the UI
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { conversations, leads } from '../shared/schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function bridgeV2ConversationsToUI() {
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
    console.log('🌉 Bridging V2 Conversations to V1 UI...\n');

    // Get recent V2 conversations (last 50 for performance)
    const v2Conversations = await sql`
      SELECT 
        c.id,
        c.agent_id,
        c.lead_email,
        c.subject,
        c.status,
        c.message_count,
        c.created_at,
        c.updated_at,
        a.name as agent_name
      FROM conversations_v2 c
      LEFT JOIN agents_v2 a ON c.agent_id = a.id
      WHERE c.status = 'active'
      ORDER BY c.updated_at DESC
      LIMIT 50;
    `;

    console.log(`💬 Found ${v2Conversations.length} recent V2 conversations to bridge\n`);

    let bridged = 0;
    let skipped = 0;

    for (const conv of v2Conversations) {
      // Check if lead exists in V1 leads table
      let leadRecord = await db
        .select()
        .from(leads)
        .where(eq(leads.email, conv.lead_email))
        .limit(1);

      let leadId = null;
      if (leadRecord.length === 0) {
        // Create lead if it doesn't exist
        console.log(`   👤 Creating lead: ${conv.lead_email}`);
        const [newLead] = await db
          .insert(leads)
          .values({
            email: conv.lead_email,
            firstName: conv.lead_email.split('@')[0],
            status: 'active'
          })
          .returning();
        leadId = newLead.id;
      } else {
        leadId = leadRecord[0].id;
      }

      // Check if V1 conversation already exists for this V2 conversation
      const existingConv = await sql`
        SELECT id FROM conversations 
        WHERE subject = ${conv.subject} 
        AND lead_id = ${leadId}
        LIMIT 1;
      `;

      if (existingConv.length > 0) {
        skipped++;
        continue;
      }

      // Create V1 conversation record
      console.log(`   💬 Bridging: ${conv.lead_email} - "${conv.subject}"`);
      
      await db
        .insert(conversations)
        .values({
          leadId: leadId,
          subject: conv.subject,
          status: conv.status === 'handed_over' ? 'handed_over' : 'active',
          priority: 'normal',
          archived: false,
          createdAt: new Date(conv.created_at),
          updatedAt: new Date(conv.updated_at)
        });

      bridged++;
    }

    console.log(`\n📊 Bridge Summary:`);
    console.log(`   ✅ Bridged: ${bridged} conversations`);
    console.log(`   ⏭️  Skipped: ${skipped} (already existed)`);
    console.log(`   📈 Total V2 conversations: ${v2Conversations.length}`);

    // Show current conversation counts
    const v1ActiveCount = await sql`
      SELECT COUNT(*) as count FROM conversations WHERE archived = false;
    `;
    
    const v2ActiveCount = await sql`
      SELECT COUNT(*) as count FROM conversations_v2 WHERE status = 'active';
    `;

    console.log(`\n📈 Current Status:`);
    console.log(`   📂 V1 Active Conversations: ${v1ActiveCount[0].count}`);
    console.log(`   🔗 V2 Active Conversations: ${v2ActiveCount[0].count}`);

    console.log('\n🎉 V2 Conversations Bridge Complete!');
    console.log('\n📋 What happened:');
    console.log(`   ✅ ${bridged} recent V2 conversations now appear in V1 UI`);
    console.log('   ✅ Leads were created/linked as needed');
    console.log('   ✅ Conversation status preserved');
    console.log('   ✅ V2 system continues to handle the actual conversations');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Restart your application');
    console.log('   2. Navigate to Conversations page');
    console.log('   3. You should see recent conversations listed');
    console.log('   4. V2 system will handle all conversation interactions');

  } catch (error) {
    console.error('❌ Error bridging conversations:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

bridgeV2ConversationsToUI().catch(console.error);
