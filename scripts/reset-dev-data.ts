#!/usr/bin/env tsx

/**
 * Development Data Reset Script for MailMind
 * Safely resets development database with fresh sample data
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clients, users, campaigns, leads, conversations, conversationMessages, aiAgentConfig, rateLimitRecords, apiKeys, securityEvents } from '../server/db/schema';
import { seedDatabase } from './seed-database';
import readline from 'readline';

// Environment check
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Safety check - prevent running in production
if (process.env.NODE_ENV === 'production') {
  console.error('❌ This script cannot be run in production environment');
  console.error('   Set NODE_ENV to "development" or "test" to proceed');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

// Interactive confirmation
async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('⚠️  WARNING: This will completely reset your development database!');
    console.log('   All existing data will be permanently deleted.');
    console.log('   Current environment:', process.env.NODE_ENV || 'undefined');
    console.log('   Database URL:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***:***@'));
    console.log('');
    
    rl.question('Are you sure you want to continue? (type "yes" to confirm): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function clearAllData(): Promise<void> {
  console.log('🧹 Clearing all existing data...');
  
  try {
    // Clear data in reverse dependency order to avoid foreign key constraints
    await db.delete(conversationMessages);
    console.log('   ✅ Cleared conversation messages');
    
    await db.delete(conversations);
    console.log('   ✅ Cleared conversations');
    
    await db.delete(leads);
    console.log('   ✅ Cleared leads');
    
    await db.delete(campaigns);
    console.log('   ✅ Cleared campaigns');
    
    await db.delete(aiAgentConfig);
    console.log('   ✅ Cleared AI agent configurations');
    
    await db.delete(users);
    console.log('   ✅ Cleared users');
    
    await db.delete(clients);
    console.log('   ✅ Cleared clients');
    
    // Clear system tables
    await db.delete(rateLimitRecords);
    console.log('   ✅ Cleared rate limit records');
    
    await db.delete(apiKeys);
    console.log('   ✅ Cleared API keys');
    
    await db.delete(securityEvents);
    console.log('   ✅ Cleared security events');
    
    console.log('✅ All data cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
    throw error;
  }
}

async function generateSampleConversations(leadIds: string[]): Promise<void> {
  console.log('💬 Creating sample conversations...');
  
  const sampleConversations = leadIds.slice(0, 2).map((leadId, index) => ({
    id: `conv-${Date.now()}-${index}`,
    leadId,
    status: 'active' as const,
    priority: index === 0 ? 'high' as const : 'medium' as const,
    lastMessageAt: new Date(),
    messageCount: 3,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  await db.insert(conversations).values(sampleConversations);
  
  // Create sample messages for the first conversation
  const sampleMessages = [
    {
      id: `msg-${Date.now()}-1`,
      conversationId: sampleConversations[0].id,
      content: 'Hi! I saw your Honda CR-V listing online and I\'m very interested. Could you tell me more about the safety features?',
      senderId: 'sarah.johnson@email.com',
      isFromAI: false,
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      createdAt: new Date(Date.now() - 3600000)
    },
    {
      id: `msg-${Date.now()}-2`,
      conversationId: sampleConversations[0].id,
      content: 'Hello Sarah! Thank you for your interest in the Honda CR-V. It\'s an excellent choice for families! The CR-V comes with Honda Sensing® suite of safety features including collision mitigation braking, road departure mitigation, and adaptive cruise control. Would you like to schedule a test drive to experience these features firsthand?',
      senderId: 'ai-assistant@premierauto.com',
      isFromAI: true,
      timestamp: new Date(Date.now() - 3000000), // 50 minutes ago
      createdAt: new Date(Date.now() - 3000000)
    },
    {
      id: `msg-${Date.now()}-3`,
      conversationId: sampleConversations[0].id,
      content: 'That sounds great! I\'d love to schedule a test drive. I\'m available this weekend. Also, do you have any current financing offers?',
      senderId: 'sarah.johnson@email.com',
      isFromAI: false,
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      createdAt: new Date(Date.now() - 1800000)
    }
  ];

  await db.insert(conversationMessages).values(sampleMessages);
  console.log('   ✅ Created sample conversations and messages');
}

async function resetDevData(): Promise<void> {
  console.log('🔄 Starting development data reset...');
  
  try {
    // Confirm with user
    const confirmed = await confirmReset();
    if (!confirmed) {
      console.log('❌ Reset cancelled by user');
      return;
    }

    // Clear all existing data
    await clearAllData();
    
    // Seed with fresh sample data
    console.log('🌱 Seeding fresh sample data...');
    await seedDatabase();
    
    // Get the newly created lead IDs for conversations
    const newLeads = await db.select({ id: leads.id }).from(leads);
    const leadIds = newLeads.map(lead => lead.id);
    
    // Generate sample conversations
    if (leadIds.length > 0) {
      await generateSampleConversations(leadIds);
    }
    
    console.log('✅ Development data reset completed successfully!');
    console.log('');
    console.log('📊 Summary of reset data:');
    
    // Display summary
    const clientCount = await db.select().from(clients);
    const userCount = await db.select().from(users);
    const campaignCount = await db.select().from(campaigns);
    const leadCount = await db.select().from(leads);
    const conversationCount = await db.select().from(conversations);
    
    console.log(`   - ${clientCount.length} clients`);
    console.log(`   - ${userCount.length} users`);
    console.log(`   - ${campaignCount.length} campaigns`);
    console.log(`   - ${leadCount.length} leads`);
    console.log(`   - ${conversationCount.length} conversations`);
    
    console.log('');
    console.log('🔑 Default login credentials:');
    console.log('   Username: admin_premier');
    console.log('   Password: SecurePass123!');
    console.log('');
    console.log('   Username: manager_metro');
    console.log('   Password: SecurePass456!');
    console.log('');
    console.log('   Username: sales_premier');
    console.log('   Password: SecurePass789!');
    
  } catch (error) {
    console.error('❌ Development data reset failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Backup function for safety
async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `backup-dev-${timestamp}.sql`;
  
  console.log(`💾 Creating backup: ${backupFile}`);
  
  // This would typically use pg_dump, but for development we'll just log
  console.log('   ⚠️  Backup creation skipped in development mode');
  console.log('   💡 For production, implement pg_dump backup here');
  
  return backupFile;
}

// Quick reset without confirmation (for CI/testing)
async function quickReset(): Promise<void> {
  console.log('⚡ Quick reset mode (no confirmation)');
  await clearAllData();
  await seedDatabase();
  
  const newLeads = await db.select({ id: leads.id }).from(leads);
  const leadIds = newLeads.map(lead => lead.id);
  
  if (leadIds.length > 0) {
    await generateSampleConversations(leadIds);
  }
  
  console.log('✅ Quick reset completed');
}

// Run reset if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const isQuickMode = process.argv.includes('--quick') || process.argv.includes('-q');
  
  if (isQuickMode) {
    quickReset().catch((error) => {
      console.error('❌ Quick reset failed:', error);
      process.exit(1);
    });
  } else {
    resetDevData().catch((error) => {
      console.error('❌ Reset failed:', error);
      process.exit(1);
    });
  }
}

export { resetDevData, quickReset, clearAllData };
