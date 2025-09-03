/**
 * Database test utilities for integration tests
 */

import { randomUUID } from 'crypto';

export interface TestDatabaseConfig {
  connectionString: string;
  testSchemaName?: string;
  cleanupOnExit?: boolean;
}

export class DatabaseTestHelper {
  private static instance: DatabaseTestHelper;
  private config: TestDatabaseConfig;
  private connection: any = null;
  private isSetup = false;

  constructor(config: TestDatabaseConfig) {
    this.config = config;
  }

  static getInstance(config?: TestDatabaseConfig): DatabaseTestHelper {
    if (!DatabaseTestHelper.instance && config) {
      DatabaseTestHelper.instance = new DatabaseTestHelper(config);
    }
    return DatabaseTestHelper.instance;
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;

    try {
      // In a real implementation, this would:
      // 1. Connect to test database
      // 2. Create test schema if needed
      // 3. Run migrations
      // 4. Set up test data isolation

      console.log('Setting up test database...');
      
      // Mock connection setup
      this.connection = {
        query: jest.fn(),
        end: jest.fn(),
      };

      this.isSetup = true;
      console.log('Test database setup complete');
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.isSetup) return;

    try {
      console.log('Cleaning up test database...');
      
      // In a real implementation, this would:
      // 1. Clear all test data
      // 2. Reset sequences
      // 3. Close connections

      if (this.connection) {
        await this.connection.end();
        this.connection = null;
      }

      this.isSetup = false;
      console.log('Test database cleanup complete');
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
      throw error;
    }
  }

  async clearAllTables(): Promise<void> {
    if (!this.isSetup) {
      throw new Error('Database not setup. Call setup() first.');
    }

    // In a real implementation, this would clear all tables in the correct order
    // to avoid foreign key constraint violations
    const tables = [
      'conversation_messages',
      'conversations',
      'leads',
      'campaigns',
      'users',
      'clients'
    ];

    for (const table of tables) {
      await this.query(`DELETE FROM ${table}`);
    }

    // Reset sequences
    for (const table of tables) {
      await this.query(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`);
    }
  }

  async seedTestData(data: any): Promise<void> {
    if (!this.isSetup) {
      throw new Error('Database not setup. Call setup() first.');
    }

    // Insert test data in the correct order
    if (data.clients) {
      await this.insertClients(data.clients);
    }

    if (data.users) {
      await this.insertUsers(data.users);
    }

    if (data.campaigns) {
      await this.insertCampaigns(data.campaigns);
    }

    if (data.leads) {
      await this.insertLeads(data.leads);
    }

    if (data.conversations) {
      await this.insertConversations(data.conversations);
    }
  }

  private async insertClients(clients: any[]): Promise<void> {
    for (const client of clients) {
      await this.query(
        `INSERT INTO clients (id, name, domain, branding_config, settings, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          client.id || randomUUID(),
          client.name,
          client.domain,
          JSON.stringify(client.brandingConfig || {}),
          JSON.stringify(client.settings || {}),
          client.active ?? true,
          client.createdAt || new Date(),
          client.updatedAt || new Date()
        ]
      );
    }
  }

  private async insertUsers(users: any[]): Promise<void> {
    for (const user of users) {
      await this.query(
        `INSERT INTO users (id, username, password, role, email, notification_preferences, client_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id || randomUUID(),
          user.username,
          user.password,
          user.role,
          user.email,
          JSON.stringify(user.notificationPreferences || {}),
          user.clientId,
          user.createdAt || new Date()
        ]
      );
    }
  }

  private async insertCampaigns(campaigns: any[]): Promise<void> {
    for (const campaign of campaigns) {
      await this.query(
        `INSERT INTO campaigns (
          id, name, context, handover_goals, target_audience, status, 
          templates, subject_lines, number_of_templates, days_between_messages,
          communication_type, schedule_type, is_active, client_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          campaign.id || randomUUID(),
          campaign.name,
          campaign.context,
          campaign.handoverGoals,
          campaign.targetAudience,
          campaign.status || 'draft',
          JSON.stringify(campaign.templates || []),
          JSON.stringify(campaign.subjectLines || []),
          campaign.numberOfTemplates || 5,
          campaign.daysBetweenMessages || 3,
          campaign.communicationType || 'email',
          campaign.scheduleType || 'immediate',
          campaign.isActive ?? true,
          campaign.clientId,
          campaign.createdAt || new Date(),
          campaign.updatedAt || new Date()
        ]
      );
    }
  }

  private async insertLeads(leads: any[]): Promise<void> {
    for (const lead of leads) {
      await this.query(
        `INSERT INTO leads (
          id, first_name, last_name, email, phone, status, lead_source,
          vehicle_interest, budget, timeframe, notes, campaign_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          lead.id || randomUUID(),
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.phone,
          lead.status || 'new',
          lead.leadSource,
          lead.vehicleInterest,
          lead.budget,
          lead.timeframe,
          lead.notes,
          lead.campaignId,
          lead.createdAt || new Date(),
          lead.updatedAt || new Date()
        ]
      );
    }
  }

  private async insertConversations(conversations: any[]): Promise<void> {
    for (const conversation of conversations) {
      await this.query(
        `INSERT INTO conversations (id, campaign_id, lead_id, user_id, subject, status, priority, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          conversation.id || randomUUID(),
          conversation.campaignId,
          conversation.leadId,
          conversation.userId,
          conversation.subject,
          conversation.status || 'active',
          conversation.priority || 'normal',
          conversation.createdAt || new Date(),
          conversation.updatedAt || new Date()
        ]
      );
    }
  }

  private async query(sql: string, params: any[] = []): Promise<any> {
    // In a real implementation, this would execute the SQL query
    // For testing, we'll mock this
    if (this.connection && this.connection.query) {
      return this.connection.query(sql, params);
    }
    
    // Mock successful execution
    return { rows: [], rowCount: 0 };
  }

  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0]?.count || '0');
  }

  async createTestTransaction(): Promise<DatabaseTransaction> {
    return new DatabaseTransaction(this);
  }
}

export class DatabaseTransaction {
  private db: DatabaseTestHelper;
  private isActive = false;

  constructor(db: DatabaseTestHelper) {
    this.db = db;
  }

  async begin(): Promise<void> {
    await this.db['query']('BEGIN');
    this.isActive = true;
  }

  async commit(): Promise<void> {
    if (this.isActive) {
      await this.db['query']('COMMIT');
      this.isActive = false;
    }
  }

  async rollback(): Promise<void> {
    if (this.isActive) {
      await this.db['query']('ROLLBACK');
      this.isActive = false;
    }
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    return this.db['query'](sql, params);
  }
}

// Helper functions for test data creation
export class TestDataSeeder {
  static createTestClient(overrides: any = {}) {
    return {
      id: randomUUID(),
      name: 'Test Client',
      domain: 'test-client.com',
      brandingConfig: {
        primaryColor: '#1e3a8a',
        secondaryColor: '#64748b'
      },
      settings: {
        allowCampaignScheduling: true,
        maxCampaignsPerMonth: 50
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createTestUser(overrides: any = {}) {
    return {
      id: randomUUID(),
      username: `testuser_${Date.now()}`,
      password: '$2b$10$test.hashed.password',
      role: 'user',
      email: `test.${Date.now()}@example.com`,
      notificationPreferences: {
        emailNotifications: true,
        campaignAlerts: true,
        leadAlerts: true
      },
      createdAt: new Date(),
      ...overrides
    };
  }

  static createTestLead(overrides: any = {}) {
    const timestamp = Date.now();
    return {
      id: randomUUID(),
      firstName: 'Test',
      lastName: 'Lead',
      email: `testlead.${timestamp}@example.com`,
      phone: '555-0123',
      status: 'new',
      leadSource: 'test',
      vehicleInterest: 'SUV',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createTestCampaign(overrides: any = {}) {
    return {
      id: randomUUID(),
      name: `Test Campaign ${Date.now()}`,
      context: 'Test campaign context',
      targetAudience: 'Test audience',
      status: 'draft',
      templates: [],
      subjectLines: [],
      numberOfTemplates: 3,
      daysBetweenMessages: 2,
      communicationType: 'email',
      scheduleType: 'immediate',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static async seedFullTestData(db: DatabaseTestHelper): Promise<{
    clients: any[];
    users: any[];
    campaigns: any[];
    leads: any[];
  }> {
    const client = this.createTestClient();
    const user = this.createTestUser({ clientId: client.id });
    const campaign = this.createTestCampaign({ clientId: client.id });
    const leads = [
      this.createTestLead({ campaignId: campaign.id }),
      this.createTestLead({ campaignId: campaign.id }),
      this.createTestLead() // No campaign
    ];

    await db.seedTestData({
      clients: [client],
      users: [user],
      campaigns: [campaign],
      leads
    });

    return { clients: [client], users: [user], campaigns: [campaign], leads };
  }
}

// Export singleton instance creator
export function createTestDatabaseHelper(config?: TestDatabaseConfig): DatabaseTestHelper {
  const defaultConfig: TestDatabaseConfig = {
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/mailmind_test',
    testSchemaName: 'test_schema',
    cleanupOnExit: true
  };

  return DatabaseTestHelper.getInstance(config || defaultConfig);
}