#!/usr/bin/env node

/**
 * Bridge V2 agents to V1 UI
 * Creates V1 agent configs for each V2 agent so they appear in the UI
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { aiAgentConfig } from '../shared/schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function bridgeV2AgentsToUI() {
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
    console.log('🌉 Bridging V2 Agents to V1 UI...\n');

    // Get all V2 agents
    const v2Agents = await sql`
      SELECT 
        id,
        name,
        domain,
        local_part,
        variables,
        is_active,
        created_at
      FROM agents_v2 
      WHERE is_active = true
      ORDER BY created_at DESC;
    `;

    console.log(`🤖 Found ${v2Agents.length} active V2 agents to bridge:\n`);

    for (const agent of v2Agents) {
      const vars = agent.variables || {};
      const agentName = agent.name;
      const agentEmail = `${agent.local_part}@${agent.domain}`;
      
      console.log(`   📧 ${agentName} (${agentEmail})`);
      console.log(`      Role: ${vars.role || 'Unknown'}`);
      console.log(`      Dealership: ${vars.dealership || 'Unknown'}`);

      // Check if V1 config already exists for this agent
      const existingConfig = await db
        .select()
        .from(aiAgentConfig)
        .where(eq(aiAgentConfig.name, agentName))
        .limit(1);

      if (existingConfig.length > 0) {
        console.log(`      ✅ V1 config already exists - updating...`);
        
        // Update existing config
        await db
          .update(aiAgentConfig)
          .set({
            agentEmailDomain: agent.domain,
            useV2: true,
            isActive: true,
            fromName: agentName,
            updatedAt: new Date()
          })
          .where(eq(aiAgentConfig.id, existingConfig[0].id));
      } else {
        console.log(`      ➕ Creating new V1 config...`);
        
        // Create new V1 config for this V2 agent
        await db
          .insert(aiAgentConfig)
          .values({
            name: agentName,
            tonality: 'professional',
            personality: `${vars.role} at ${vars.dealership}`,
            dosList: [
              'Be helpful and knowledgeable about vehicles',
              'Provide accurate information about inventory',
              'Schedule test drives and appointments',
              'Answer questions about financing and trade-ins'
            ],
            dontsList: [
              'Make promises about specific pricing without verification',
              'Provide inaccurate vehicle information',
              'Be pushy or aggressive in sales approach'
            ],
            industry: 'automotive',
            responseStyle: 'helpful',
            model: 'openai/gpt-5-chat',
            fromName: agentName,
            agentEmailDomain: agent.domain,
            useV2: true,
            isActive: true
          });
      }
      
      console.log(`      ✅ Bridged successfully\n`);
    }

    // Verify the bridge
    console.log('🔍 Verifying bridge...');
    const allV1Configs = await db
      .select({
        id: aiAgentConfig.id,
        name: aiAgentConfig.name,
        agentEmailDomain: aiAgentConfig.agentEmailDomain,
        useV2: aiAgentConfig.useV2,
        isActive: aiAgentConfig.isActive
      })
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.isActive, true));

    console.log('\n📊 Active V1 Agent Configs (UI will show these):');
    allV1Configs.forEach((config, index) => {
      const v2Status = config.useV2 ? '🔗 V2 Bridged' : '🔧 V1 Only';
      console.log(`   ${index + 1}. ${config.name} - ${config.agentEmailDomain} ${v2Status}`);
    });

    console.log('\n🎉 V2 to V1 Bridge Complete!');
    console.log('\n📋 What happened:');
    console.log(`   ✅ ${v2Agents.length} V2 agents now have V1 UI configs`);
    console.log('   ✅ All agents will appear in the UI');
    console.log('   ✅ V2 functionality is preserved');
    console.log('   ✅ Conversations will use V2 system');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Restart your application');
    console.log('   2. Navigate to AI Settings page');
    console.log('   3. You should see all 7+ agents listed');
    console.log('   4. All agents are configured to use V2 system');

  } catch (error) {
    console.error('❌ Error bridging agents:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

bridgeV2AgentsToUI().catch(console.error);
