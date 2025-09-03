#!/usr/bin/env node

/**
 * Quick script to show V2 agents in the database
 * This demonstrates that the V2 agents exist and explains why they don't show in the UI
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function showV2Agents() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') || process.env.DATABASE_URL?.includes('postgres.render.com') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('🔍 CHECKING V2 AGENTS IN DATABASE');
    console.log('==================================\n');

    // Check if V2 tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%_v2'
      ORDER BY table_name;
    `);

    console.log('📋 V2 Tables found:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    console.log();

    // Check V2 agents
    const agentsResult = await pool.query(`
      SELECT 
        id,
        name,
        domain,
        local_part,
        variables,
        is_active,
        created_at
      FROM agents_v2 
      ORDER BY created_at DESC;
    `);

    console.log(`🤖 V2 AGENTS (${agentsResult.rows.length} found):`);
    console.log('=====================================\n');

    if (agentsResult.rows.length === 0) {
      console.log('❌ No V2 agents found in database');
    } else {
      agentsResult.rows.forEach((agent, index) => {
        const vars = agent.variables || {};
        console.log(`${index + 1}. ${agent.name}`);
        console.log(`   Email: ${agent.local_part}@${agent.domain}`);
        console.log(`   Role: ${vars.role || 'Unknown'}`);
        console.log(`   Dealership: ${vars.dealership || 'Unknown'}`);
        console.log(`   Active: ${agent.is_active ? '✅' : '❌'}`);
        console.log(`   Created: ${agent.created_at}`);
        console.log();
      });
    }

    // Check V1 agents for comparison
    const v1Result = await pool.query(`
      SELECT 
        id,
        name,
        agent_email_domain,
        is_active,
        created_at
      FROM ai_agent_config 
      ORDER BY created_at DESC;
    `);

    console.log(`🔧 V1 AGENT CONFIGS (${v1Result.rows.length} found):`);
    console.log('=========================================\n');

    if (v1Result.rows.length === 0) {
      console.log('❌ No V1 agent configs found');
    } else {
      v1Result.rows.forEach((config, index) => {
        console.log(`${index + 1}. ${config.name}`);
        console.log(`   Domain: ${config.agent_email_domain || 'Not set'}`);
        console.log(`   Active: ${config.is_active ? '✅' : '❌'}`);
        console.log(`   Created: ${config.created_at}`);
        console.log();
      });
    }

    console.log('💡 EXPLANATION:');
    console.log('===============');
    console.log('The UI currently only shows V1 agent configs from the "ai_agent_config" table.');
    console.log('All the dealership agents we created are in the V2 system ("agents_v2" table).');
    console.log('This is why you don\'t see them in the UI - they\'re in a different table!');
    console.log();
    console.log('To fix this, we need to either:');
    console.log('1. Create V2 agent API endpoints for the UI');
    console.log('2. Bridge V2 agents to appear in the V1 UI');
    console.log('3. Update the UI to use V2 endpoints');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

showV2Agents().catch(console.error);
