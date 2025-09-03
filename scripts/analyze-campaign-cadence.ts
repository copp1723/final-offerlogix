#!/usr/bin/env node

/**
 * Analyze Campaign Cadence and Template Structure
 * Check the sending patterns, templates, and timing for V2 campaigns
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeCampaignCadence() {
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
    console.log('📊 ANALYZING CAMPAIGN CADENCE & TEMPLATES\n');

    // Get V2 campaigns overview
    console.log('1️⃣ V2 CAMPAIGNS OVERVIEW:');
    const campaigns = await sql`
      SELECT 
        c.id,
        c.name,
        c.subject,
        c.status,
        c.total_sent,
        c.total_responses,
        c.created_at,
        a.name as agent_name,
        a.domain as agent_domain
      FROM campaigns_v2 c
      JOIN agents_v2 a ON c.agent_id = a.id
      ORDER BY c.created_at DESC;
    `;

    campaigns.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.name}`);
      console.log(`      Agent: ${campaign.agent_name} (${campaign.agent_domain})`);
      console.log(`      Subject: "${campaign.subject}"`);
      console.log(`      Status: ${campaign.status} | Sent: ${campaign.total_sent} | Responses: ${campaign.total_responses}`);
      console.log(`      Created: ${campaign.created_at}`);
      console.log();
    });

    // Check message timing patterns
    console.log('2️⃣ MESSAGE TIMING ANALYSIS:');
    const messageTiming = await sql`
      SELECT 
        DATE(m.created_at) as send_date,
        COUNT(*) as messages_sent,
        COUNT(DISTINCT c.lead_email) as unique_leads,
        MIN(m.created_at) as first_message,
        MAX(m.created_at) as last_message
      FROM messages_v2 m
      JOIN conversations_v2 c ON m.conversation_id = c.id
      WHERE m.sender = 'agent'
      GROUP BY DATE(m.created_at)
      ORDER BY send_date DESC
      LIMIT 10;
    `;

    console.log('📅 Daily sending pattern (last 10 days):');
    messageTiming.forEach(day => {
      console.log(`   ${day.send_date}: ${day.messages_sent} messages to ${day.unique_leads} leads`);
      console.log(`      Time range: ${day.first_message} → ${day.last_message}`);
    });
    console.log();

    // Check for follow-up patterns
    console.log('3️⃣ FOLLOW-UP PATTERNS:');
    const followUpAnalysis = await sql`
      SELECT 
        c.lead_email,
        c.subject,
        COUNT(m.id) as total_messages,
        MIN(m.created_at) as first_message,
        MAX(m.created_at) as last_message,
        EXTRACT(DAYS FROM (MAX(m.created_at) - MIN(m.created_at))) as campaign_duration_days
      FROM conversations_v2 c
      JOIN messages_v2 m ON c.id = m.conversation_id
      WHERE m.sender = 'agent'
      GROUP BY c.id, c.lead_email, c.subject
      HAVING COUNT(m.id) > 1
      ORDER BY total_messages DESC, campaign_duration_days DESC
      LIMIT 20;
    `;

    console.log(`📈 Leads with multiple messages (${followUpAnalysis.length} found):`);
    if (followUpAnalysis.length === 0) {
      console.log('   ❌ No follow-up sequences found - all leads got single messages');
    } else {
      followUpAnalysis.forEach((lead, index) => {
        console.log(`   ${index + 1}. ${lead.lead_email}`);
        console.log(`      Subject: "${lead.subject}"`);
        console.log(`      Messages: ${lead.total_messages} over ${lead.campaign_duration_days} days`);
        console.log(`      Period: ${lead.first_message} → ${lead.last_message}`);
        console.log();
      });
    }

    // Check campaign templates/subjects
    console.log('4️⃣ CAMPAIGN TEMPLATES & SUBJECTS:');
    const subjectAnalysis = await sql`
      SELECT 
        c.subject,
        COUNT(DISTINCT c.lead_email) as leads_contacted,
        COUNT(m.id) as total_messages,
        MIN(m.created_at) as first_sent,
        MAX(m.created_at) as last_sent
      FROM conversations_v2 c
      JOIN messages_v2 m ON c.id = m.conversation_id
      WHERE m.sender = 'agent'
      GROUP BY c.subject
      ORDER BY leads_contacted DESC;
    `;

    console.log('📧 Subject line usage:');
    subjectAnalysis.forEach((subject, index) => {
      console.log(`   ${index + 1}. "${subject.subject}"`);
      console.log(`      Leads: ${subject.leads_contacted} | Messages: ${subject.total_messages}`);
      console.log(`      Period: ${subject.first_sent} → ${subject.last_sent}`);
      console.log();
    });

    // Check for cadence patterns
    console.log('5️⃣ CADENCE ANALYSIS:');
    const cadenceAnalysis = await sql`
      WITH message_intervals AS (
        SELECT 
          c.lead_email,
          m.created_at,
          LAG(m.created_at) OVER (PARTITION BY c.lead_email ORDER BY m.created_at) as prev_message,
          EXTRACT(HOURS FROM (m.created_at - LAG(m.created_at) OVER (PARTITION BY c.lead_email ORDER BY m.created_at))) as hours_between
        FROM conversations_v2 c
        JOIN messages_v2 m ON c.id = m.conversation_id
        WHERE m.sender = 'agent'
      )
      SELECT 
        CASE 
          WHEN hours_between < 1 THEN 'Under 1 hour'
          WHEN hours_between < 24 THEN '1-24 hours'
          WHEN hours_between < 72 THEN '1-3 days'
          WHEN hours_between < 168 THEN '3-7 days'
          ELSE 'Over 1 week'
        END as interval_category,
        COUNT(*) as message_count,
        AVG(hours_between) as avg_hours_between
      FROM message_intervals
      WHERE hours_between IS NOT NULL
      GROUP BY 
        CASE 
          WHEN hours_between < 1 THEN 'Under 1 hour'
          WHEN hours_between < 24 THEN '1-24 hours'
          WHEN hours_between < 72 THEN '1-3 days'
          WHEN hours_between < 168 THEN '3-7 days'
          ELSE 'Over 1 week'
        END
      ORDER BY avg_hours_between;
    `;

    console.log('⏰ Message spacing intervals:');
    if (cadenceAnalysis.length === 0) {
      console.log('   ❌ No follow-up intervals found - appears to be single-message campaigns');
    } else {
      cadenceAnalysis.forEach(interval => {
        console.log(`   ${interval.interval_category}: ${interval.message_count} messages (avg: ${parseFloat(interval.avg_hours_between).toFixed(1)} hours)`);
      });
    }

    console.log('\n📋 CADENCE SUMMARY:');
    const totalMessages = await sql`SELECT COUNT(*) as count FROM messages_v2 WHERE sender = 'agent';`;
    const totalConversations = await sql`SELECT COUNT(*) as count FROM conversations_v2;`;
    const avgMessagesPerLead = totalMessages[0].count / totalConversations[0].count;

    console.log(`   📧 Total Messages Sent: ${totalMessages[0].count}`);
    console.log(`   👥 Total Conversations: ${totalConversations[0].count}`);
    console.log(`   📊 Average Messages per Lead: ${avgMessagesPerLead.toFixed(2)}`);
    
    if (avgMessagesPerLead < 1.1) {
      console.log('   🎯 FINDING: Single-message campaigns (no follow-up sequence)');
    } else {
      console.log(`   🎯 FINDING: Multi-message campaigns with ${avgMessagesPerLead.toFixed(1)} messages per lead on average`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

analyzeCampaignCadence().catch(console.error);
