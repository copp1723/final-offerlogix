#!/usr/bin/env tsx

/**
 * Database Seeding Script for MailMind
 * Populates database with realistic sample data for development and testing
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clients, users, campaigns, leads, conversations, conversationMessages, aiAgentConfig } from '../server/db/schema';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

// Environment check
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

// Sample data generators
const generateClients = () => [
  {
    id: randomUUID(),
    name: 'Premier Auto Dealership',
    domain: 'premierauto.com',
    brandingConfig: {
      primaryColor: '#1e40af',
      secondaryColor: '#3b82f6',
      logoUrl: '/logos/premier-auto.svg',
      companyName: 'Premier Auto Dealership',
      favicon: '/favicons/premier-auto.ico',
      customCss: ''
    },
    settings: {
      allowAutoResponse: true,
      businessHours: { start: '08:00', end: '18:00', timezone: 'America/New_York' },
      maxCampaignsPerMonth: 25,
      allowSMSIntegration: true
    },
    active: true,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z')
  },
  {
    id: randomUUID(),
    name: 'Metro Motors',
    domain: 'metromotors.net',
    brandingConfig: {
      primaryColor: '#dc2626',
      secondaryColor: '#ef4444',
      logoUrl: '/logos/metro-motors.svg',
      companyName: 'Metro Motors',
      favicon: '/favicons/metro-motors.ico',
      customCss: ''
    },
    settings: {
      allowAutoResponse: true,
      businessHours: { start: '09:00', end: '19:00', timezone: 'America/Chicago' },
      maxCampaignsPerMonth: 15,
      allowSMSIntegration: false
    },
    active: true,
    createdAt: new Date('2024-02-01T10:00:00Z'),
    updatedAt: new Date('2024-02-01T10:00:00Z')
  }
];

const generateUsers = (clientIds: string[]) => [
  {
    id: randomUUID(),
    username: 'admin_premier',
    password: bcrypt.hashSync('SecurePass123!', 10),
    role: 'admin' as const,
    email: 'admin@premierauto.com',
    notificationPreferences: {
      emailNotifications: true,
      campaignAlerts: true,
      leadAlerts: true,
      systemAlerts: true,
      monthlyReports: true,
      highEngagementAlerts: true,
      quotaWarnings: true
    },
    clientId: clientIds[0],
    createdAt: new Date('2024-01-15T10:30:00Z')
  },
  {
    id: randomUUID(),
    username: 'manager_metro',
    password: bcrypt.hashSync('SecurePass456!', 10),
    role: 'manager' as const,
    email: 'manager@metromotors.net',
    notificationPreferences: {
      emailNotifications: true,
      campaignAlerts: true,
      leadAlerts: true,
      systemAlerts: false,
      monthlyReports: true,
      highEngagementAlerts: true,
      quotaWarnings: false
    },
    clientId: clientIds[1],
    createdAt: new Date('2024-02-01T10:30:00Z')
  },
  {
    id: randomUUID(),
    username: 'sales_premier',
    password: bcrypt.hashSync('SecurePass789!', 10),
    role: 'user' as const,
    email: 'sales@premierauto.com',
    notificationPreferences: {
      emailNotifications: true,
      campaignAlerts: false,
      leadAlerts: true,
      systemAlerts: false,
      monthlyReports: false,
      highEngagementAlerts: true,
      quotaWarnings: true
    },
    clientId: clientIds[0],
    createdAt: new Date('2024-01-20T10:30:00Z')
  }
];

const generateAIAgentConfigs = (clientIds: string[]) => [
  {
    id: randomUUID(),
    name: 'Premier Auto AI Assistant',
    tonality: 'professional',
    personality: 'helpful and knowledgeable automotive expert',
    dosList: [
      'Provide detailed vehicle information',
      'Schedule test drives',
      'Explain financing options',
      'Follow up on leads promptly'
    ],
    dontsList: [
      'Make unrealistic promises',
      'Discuss competitor pricing',
      'Share personal information',
      'Be pushy or aggressive'
    ],
    industry: 'automotive',
    responseStyle: 'conversational',
    model: 'openai/gpt-5-mini',
    agentEmailDomain: 'premierauto.com',
    isActive: true,
    clientId: clientIds[0],
    createdAt: new Date('2024-01-15T11:00:00Z'),
    updatedAt: new Date('2024-01-15T11:00:00Z')
  },
  {
    id: randomUUID(),
    name: 'Metro Motors AI Assistant',
    tonality: 'friendly',
    personality: 'enthusiastic car specialist',
    dosList: [
      'Highlight vehicle features',
      'Offer competitive pricing',
      'Provide warranty information',
      'Assist with trade-in evaluations'
    ],
    dontsList: [
      'Overpromise on deals',
      'Ignore customer concerns',
      'Rush the sales process',
      'Forget to follow up'
    ],
    industry: 'automotive',
    responseStyle: 'engaging',
    model: 'openai/gpt-5-mini',
    agentEmailDomain: 'metromotors.net',
    isActive: true,
    clientId: clientIds[1],
    createdAt: new Date('2024-02-01T11:00:00Z'),
    updatedAt: new Date('2024-02-01T11:00:00Z')
  }
];

const generateCampaigns = (clientIds: string[]) => [
  {
    id: randomUUID(),
    name: 'Spring SUV Promotion',
    status: 'active' as const,
    targetAudience: 'Families looking for reliable SUVs',
    campaignGoals: 'Increase SUV sales by 25% this quarter',
    context: 'Spring is the perfect time for families to upgrade to a spacious SUV',
    clientId: clientIds[0],
    createdAt: new Date('2024-03-01T09:00:00Z'),
    updatedAt: new Date('2024-03-01T09:00:00Z')
  },
  {
    id: randomUUID(),
    name: 'Luxury Sedan Showcase',
    status: 'active' as const,
    targetAudience: 'Professional executives and business owners',
    campaignGoals: 'Promote premium sedan models to high-income prospects',
    context: 'Luxury sedans offer comfort and prestige for business professionals',
    clientId: clientIds[0],
    createdAt: new Date('2024-03-15T09:00:00Z'),
    updatedAt: new Date('2024-03-15T09:00:00Z')
  },
  {
    id: randomUUID(),
    name: 'First-Time Buyer Program',
    status: 'active' as const,
    targetAudience: 'Young adults purchasing their first vehicle',
    campaignGoals: 'Help first-time buyers find affordable, reliable transportation',
    context: 'Special financing and support for first-time car buyers',
    clientId: clientIds[1],
    createdAt: new Date('2024-02-15T09:00:00Z'),
    updatedAt: new Date('2024-02-15T09:00:00Z')
  }
];

const generateLeads = (campaignIds: string[]) => [
  {
    id: randomUUID(),
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@email.com',
    phone: '555-0123',
    status: 'hot' as const,
    leadSource: 'website',
    vehicleInterest: 'Honda CR-V',
    budget: '35000',
    timeframe: '2 weeks',
    notes: 'Looking for a reliable family SUV with good safety ratings',
    tags: ['family', 'safety-focused'],
    campaignId: campaignIds[0],
    createdAt: new Date('2024-03-10T14:30:00Z'),
    updatedAt: new Date('2024-03-10T14:30:00Z')
  },
  {
    id: randomUUID(),
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@business.com',
    phone: '555-0456',
    status: 'warm' as const,
    leadSource: 'referral',
    vehicleInterest: 'BMW 5 Series',
    budget: '55000',
    timeframe: '1 month',
    notes: 'Business executive looking for luxury sedan with advanced tech features',
    tags: ['luxury', 'business'],
    campaignId: campaignIds[1],
    createdAt: new Date('2024-03-20T10:15:00Z'),
    updatedAt: new Date('2024-03-20T10:15:00Z')
  },
  {
    id: randomUUID(),
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily.rodriguez@college.edu',
    phone: '555-0789',
    status: 'new' as const,
    leadSource: 'social_media',
    vehicleInterest: 'Toyota Corolla',
    budget: '20000',
    timeframe: '3 months',
    notes: 'College graduate looking for first car with good fuel economy',
    tags: ['first-time-buyer', 'budget-conscious'],
    campaignId: campaignIds[2],
    createdAt: new Date('2024-03-25T16:45:00Z'),
    updatedAt: new Date('2024-03-25T16:45:00Z')
  }
];

// Create a minimal conversation linked to the first lead
const generateConversations = (leadId: string, campaignId: string, userId: string) => [
  {
    id: randomUUID(),
    campaignId,
    leadId,
    userId,
    subject: 'Seeded Conversation',
    status: 'active' as const,
    priority: 'normal' as const,
    createdAt: new Date('2024-03-21T10:00:00Z'),
    updatedAt: new Date('2024-03-21T10:00:00Z')
  }
];

// Basic messages for the seeded conversation
const generateConversationMessages = (conversationId: string, userId: string) => [
  {
    id: randomUUID(),
    conversationId,
    senderId: userId,
    content: 'Hello Sarah, thanks for your interest in the Honda CR-V. Would you like to schedule a test drive?',
    messageType: 'text' as const,
    isFromAI: 1,
    createdAt: new Date('2024-03-21T10:00:00Z')
  },
  {
    id: randomUUID(),
    conversationId,
    senderId: null,
    content: 'Yes, I would like to schedule a test drive. My email is lead@example.com and phone is 555-123-4567.',
    messageType: 'text' as const,
    isFromAI: 0,
    createdAt: new Date('2024-03-21T10:05:00Z')
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear existing data (in reverse dependency order)
    console.log('🧹 Clearing existing data...');
    await db.delete(conversationMessages);
    await db.delete(conversations);
    await db.delete(leads);
    await db.delete(campaigns);
    await db.delete(aiAgentConfig);
    await db.delete(users);
    await db.delete(clients);

    // Generate sample data
    const sampleClients = generateClients();
    const clientIds = sampleClients.map(c => c.id);
    
    const sampleUsers = generateUsers(clientIds);
    const sampleAIConfigs = generateAIAgentConfigs(clientIds);
    const sampleCampaigns = generateCampaigns(clientIds);
    const campaignIds = sampleCampaigns.map(c => c.id);
    const sampleLeads = generateLeads(campaignIds);
    const sampleConversations = generateConversations(
      sampleLeads[0].id,
      sampleCampaigns[0].id,
      sampleUsers[0].id
    );
    const sampleMessages = generateConversationMessages(
      sampleConversations[0].id,
      sampleUsers[0].id
    );

    // Insert data in dependency order
    console.log('📊 Inserting clients...');
    await db.insert(clients).values(sampleClients);

    console.log('👥 Inserting users...');
    await db.insert(users).values(sampleUsers);

    console.log('🤖 Inserting AI agent configurations...');
    await db.insert(aiAgentConfig).values(sampleAIConfigs);

    console.log('📧 Inserting campaigns...');
    await db.insert(campaigns).values(sampleCampaigns);

    console.log('🎯 Inserting leads...');
    await db.insert(leads).values(sampleLeads);

    console.log('💬 Inserting conversations...');
    await db.insert(conversations).values(sampleConversations);
    await db.insert(conversationMessages).values(sampleMessages);

    console.log('✅ Database seeding completed successfully!');
    console.log(`   - ${sampleClients.length} clients created`);
    console.log(`   - ${sampleUsers.length} users created`);
    console.log(`   - ${sampleAIConfigs.length} AI configurations created`);
    console.log(`   - ${sampleCampaigns.length} campaigns created`);
    console.log(`   - ${sampleLeads.length} leads created`);
    console.log(`   - ${sampleConversations.length} conversations created`);
    console.log(`   - ${sampleMessages.length} conversation messages created`);

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch(console.error);
}

export { seedDatabase };
