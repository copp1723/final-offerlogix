#!/usr/bin/env tsx

/**
 * Production Data Migration Script for MailMind
 * Safely migrates existing production data and ensures data integrity
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clients, users, campaigns, leads, conversations, aiAgentConfig } from '../server/db/schema';
import { eq, isNull, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Environment check
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

interface MigrationStats {
  clientsUpdated: number;
  usersUpdated: number;
  campaignsUpdated: number;
  leadsUpdated: number;
  aiConfigsCreated: number;
  errors: string[];
}

async function migrateProductionData(): Promise<MigrationStats> {
  console.log('🔄 Starting production data migration...');
  
  const stats: MigrationStats = {
    clientsUpdated: 0,
    usersUpdated: 0,
    campaignsUpdated: 0,
    leadsUpdated: 0,
    aiConfigsCreated: 0,
    errors: []
  };

  try {
    // 1. Migrate clients - ensure all have proper branding config
    console.log('🏢 Migrating client data...');
    const existingClients = await db.select().from(clients);
    
    for (const client of existingClients) {
      const needsUpdate = !client.brandingConfig || 
                         (client.brandingConfig as any)?.companyName === 'OneKeel Swarm' ||
                         (client.brandingConfig as any)?.companyName === 'AutoCampaigns AI';
      
      if (needsUpdate) {
        const updatedBranding = {
          primaryColor: '#2563eb',
          secondaryColor: '#1e40af',
          logoUrl: '/logo.svg',
          companyName: client.name || 'MailMind',
          favicon: '',
          customCss: ''
        };

        await db.update(clients)
          .set({ 
            brandingConfig: updatedBranding,
            updatedAt: new Date()
          })
          .where(eq(clients.id, client.id));
        
        stats.clientsUpdated++;
        console.log(`   ✅ Updated client: ${client.name}`);
      }
    }

    // 2. Migrate users - ensure all have notification preferences
    console.log('👥 Migrating user data...');
    const existingUsers = await db.select().from(users);
    
    for (const user of existingUsers) {
      if (!user.notificationPreferences) {
        const defaultPreferences = {
          emailNotifications: true,
          campaignAlerts: user.role === 'admin' || user.role === 'manager',
          leadAlerts: true,
          systemAlerts: user.role === 'admin',
          monthlyReports: user.role !== 'user',
          highEngagementAlerts: true,
          quotaWarnings: user.role !== 'admin'
        };

        await db.update(users)
          .set({ notificationPreferences: defaultPreferences })
          .where(eq(users.id, user.id));
        
        stats.usersUpdated++;
        console.log(`   ✅ Updated user: ${user.username}`);
      }
    }

    // 3. Migrate campaigns - ensure all have proper context and goals
    console.log('📧 Migrating campaign data...');
    const existingCampaigns = await db.select().from(campaigns);
    
    for (const campaign of existingCampaigns) {
      let needsUpdate = false;
      const updates: any = {};

      if (!campaign.context || campaign.context.trim() === '') {
        updates.context = `Campaign targeting ${campaign.targetAudience || 'potential customers'} with focus on ${campaign.name}`;
        needsUpdate = true;
      }

      if (!campaign.campaignGoals || campaign.campaignGoals.trim() === '') {
        updates.campaignGoals = `Increase engagement and conversions for ${campaign.name}`;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.updatedAt = new Date();
        await db.update(campaigns)
          .set(updates)
          .where(eq(campaigns.id, campaign.id));
        
        stats.campaignsUpdated++;
        console.log(`   ✅ Updated campaign: ${campaign.name}`);
      }
    }

    // 4. Migrate leads - ensure all have proper status and tags
    console.log('🎯 Migrating lead data...');
    const existingLeads = await db.select().from(leads);
    
    for (const lead of existingLeads) {
      let needsUpdate = false;
      const updates: any = {};

      // Ensure status is valid
      if (!lead.status || !['new', 'contacted', 'qualified', 'hot', 'warm', 'cold', 'converted', 'lost'].includes(lead.status)) {
        updates.status = 'new';
        needsUpdate = true;
      }

      // Ensure tags array exists
      if (!lead.tags || !Array.isArray(lead.tags)) {
        updates.tags = [];
        needsUpdate = true;
      }

      // Add default tags based on lead data
      if (lead.vehicleInterest && (!lead.tags || lead.tags.length === 0)) {
        const vehicleTags = [];
        const interest = lead.vehicleInterest.toLowerCase();
        
        if (interest.includes('suv')) vehicleTags.push('suv-interest');
        if (interest.includes('sedan')) vehicleTags.push('sedan-interest');
        if (interest.includes('truck')) vehicleTags.push('truck-interest');
        if (interest.includes('luxury') || interest.includes('bmw') || interest.includes('mercedes')) {
          vehicleTags.push('luxury');
        }
        
        if (vehicleTags.length > 0) {
          updates.tags = vehicleTags;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        updates.updatedAt = new Date();
        await db.update(leads)
          .set(updates)
          .where(eq(leads.id, lead.id));
        
        stats.leadsUpdated++;
        console.log(`   ✅ Updated lead: ${lead.firstName} ${lead.lastName}`);
      }
    }

    // 5. Create AI agent configs for clients that don't have them
    console.log('🤖 Creating missing AI agent configurations...');
    const clientsWithoutAI = await db
      .select({ id: clients.id, name: clients.name, domain: clients.domain })
      .from(clients)
      .leftJoin(aiAgentConfig, eq(clients.id, aiAgentConfig.clientId))
      .where(isNull(aiAgentConfig.clientId));

    for (const client of clientsWithoutAI) {
      const defaultAIConfig = {
        id: randomUUID(),
        name: `${client.name} AI Assistant`,
        tonality: 'professional',
        personality: 'helpful and knowledgeable automotive expert',
        dosList: [
          'Provide accurate vehicle information',
          'Schedule appointments and test drives',
          'Explain financing and warranty options',
          'Follow up promptly on inquiries'
        ],
        dontsList: [
          'Make unrealistic promises about pricing',
          'Share confidential customer information',
          'Be pushy or overly aggressive',
          'Discuss competitor pricing negatively'
        ],
        industry: 'automotive',
        responseStyle: 'conversational',
        model: 'openai/gpt-5-mini',
        agentEmailDomain: client.domain || 'mailmind.com',
        isActive: true,
        clientId: client.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(aiAgentConfig).values(defaultAIConfig);
      stats.aiConfigsCreated++;
      console.log(`   ✅ Created AI config for: ${client.name}`);
    }

    console.log('✅ Production data migration completed successfully!');
    console.log(`   - ${stats.clientsUpdated} clients updated`);
    console.log(`   - ${stats.usersUpdated} users updated`);
    console.log(`   - ${stats.campaignsUpdated} campaigns updated`);
    console.log(`   - ${stats.leadsUpdated} leads updated`);
    console.log(`   - ${stats.aiConfigsCreated} AI configurations created`);

    if (stats.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      stats.errors.forEach(error => console.log(`   - ${error}`));
    }

  } catch (error) {
    console.error('❌ Production data migration failed:', error);
    stats.errors.push(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await sql.end();
  }

  return stats;
}

// Data validation function
async function validateMigratedData(): Promise<boolean> {
  console.log('🔍 Validating migrated data...');
  
  try {
    // Check that all clients have branding config
    const clientsWithoutBranding = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.brandingConfig));
    
    if (clientsWithoutBranding.length > 0) {
      console.error(`❌ ${clientsWithoutBranding.length} clients missing branding config`);
      return false;
    }

    // Check that all users have notification preferences
    const usersWithoutPrefs = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(isNull(users.notificationPreferences));
    
    if (usersWithoutPrefs.length > 0) {
      console.error(`❌ ${usersWithoutPrefs.length} users missing notification preferences`);
      return false;
    }

    // Check that all clients have AI configs
    const clientsWithoutAI = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .leftJoin(aiAgentConfig, eq(clients.id, aiAgentConfig.clientId))
      .where(isNull(aiAgentConfig.clientId));
    
    if (clientsWithoutAI.length > 0) {
      console.error(`❌ ${clientsWithoutAI.length} clients missing AI configurations`);
      return false;
    }

    console.log('✅ Data validation passed!');
    return true;
  } catch (error) {
    console.error('❌ Data validation failed:', error);
    return false;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateProductionData()
    .then(async (stats) => {
      const isValid = await validateMigratedData();
      if (!isValid) {
        console.error('❌ Migration validation failed');
        process.exit(1);
      }
      console.log('🎉 Migration completed and validated successfully!');
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateProductionData, validateMigratedData };
