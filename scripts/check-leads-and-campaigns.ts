#!/usr/bin/env tsx

/**
 * Check Leads and Campaigns Script
 * Verifies the lead database and campaign configuration
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { leads, campaigns, conversationMessages } from '../shared/schema.js';
import { eq, desc, count } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

async function checkDatabase(): Promise<void> {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    return;
  }

  console.log('🗄️  Database Analysis');
  console.log('====================\n');

  try {
    const sql = postgres(DATABASE_URL, { ssl: 'require' });
    const db = drizzle(sql);

    // Check total leads
    const totalLeads = await db.select({ count: count() }).from(leads);
    console.log(`📊 Total Leads: ${totalLeads[0]?.count || 0}`);

    if (totalLeads[0]?.count > 0) {
      // Get recent leads
      const recentLeads = await db
        .select({
          id: leads.id,
          email: leads.email,
          firstName: leads.firstName,
          lastName: leads.lastName,
          status: leads.status,
          campaignId: leads.campaignId,
          createdAt: leads.createdAt
        })
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(10);

      console.log('\n📋 Recent Leads:');
      recentLeads.forEach((lead, index) => {
        console.log(`   ${index + 1}. ${lead.email}`);
        console.log(`      Name: ${lead.firstName || 'N/A'} ${lead.lastName || 'N/A'}`);
        console.log(`      Status: ${lead.status || 'N/A'}`);
        console.log(`      Campaign: ${lead.campaignId || 'None'}`);
        console.log(`      Created: ${lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'N/A'}`);
        console.log('');
      });

      // Check for specific emails we've seen
      const testEmails = ['josh@atsglobal.ai', 'john.customer@gmail.com'];
      console.log('🔍 Checking Specific Emails:');
      
      for (const email of testEmails) {
        const leadExists = await db
          .select()
          .from(leads)
          .where(eq(leads.email, email))
          .limit(1);
        
        if (leadExists.length > 0) {
          console.log(`   ✅ ${email} - EXISTS in database`);
          console.log(`      ID: ${leadExists[0].id}`);
          console.log(`      Campaign: ${leadExists[0].campaignId || 'None'}`);
        } else {
          console.log(`   ❌ ${email} - NOT FOUND in database`);
        }
      }
    } else {
      console.log('❌ NO LEADS FOUND in database');
      console.log('   This explains why replies cannot be processed!');
    }

    // Check campaigns
    const totalCampaigns = await db.select({ count: count() }).from(campaigns);
    console.log(`\n📊 Total Campaigns: ${totalCampaigns[0]?.count || 0}`);

    if (totalCampaigns[0]?.count > 0) {
      const recentCampaigns = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          status: campaigns.status,
          createdAt: campaigns.createdAt
        })
        .from(campaigns)
        .orderBy(desc(campaigns.createdAt))
        .limit(5);

      console.log('\n📋 Recent Campaigns:');
      recentCampaigns.forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.name}`);
        console.log(`      ID: ${campaign.id}`);
        console.log(`      Status: ${campaign.status}`);
        console.log(`      Created: ${campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : 'N/A'}`);
        console.log('');
      });
    }

    // Check conversation messages
    const totalMessages = await db.select({ count: count() }).from(conversationMessages);
    console.log(`📊 Total Conversation Messages: ${totalMessages[0]?.count || 0}`);

    if (totalMessages[0]?.count > 0) {
      const recentMessages = await db
        .select({
          id: conversationMessages.id,
          conversationId: conversationMessages.conversationId,
          content: conversationMessages.content,
          messageType: conversationMessages.messageType,
          isFromAI: conversationMessages.isFromAI,
          createdAt: conversationMessages.createdAt
        })
        .from(conversationMessages)
        .orderBy(desc(conversationMessages.createdAt))
        .limit(5);

      console.log('\n📋 Recent Messages:');
      recentMessages.forEach((msg, index) => {
        const preview = msg.content ? msg.content.substring(0, 50) + '...' : 'No content';
        const sender = msg.isFromAI ? 'AI' : 'Human';
        console.log(`   ${index + 1}. [${sender}] ${preview}`);
        console.log(`      Conversation: ${msg.conversationId}`);
        console.log(`      Type: ${msg.messageType}`);
        console.log(`      Created: ${msg.createdAt ? new Date(msg.createdAt).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }

    await sql.end();

  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

async function main(): Promise<void> {
  console.log('🔍 Lead Database & Campaign Analysis');
  console.log('===================================\n');

  console.log('📋 Configuration:');
  console.log(`   DATABASE_URL: ${DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log('');

  if (!DATABASE_URL) {
    console.error('❌ Cannot analyze database without DATABASE_URL');
    return;
  }

  await checkDatabase();

  console.log('\n💡 Analysis Summary:');
  console.log('   • If no leads exist, you need to import/create leads before campaigns');
  console.log('   • If leads exist but replies fail, check email matching logic');
  console.log('   • Campaign emails should only be sent to existing leads');
  console.log('   • Replies can only be processed from emails that exist as leads');
}

// Run the main function
main().catch(console.error);
