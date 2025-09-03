/**
 * Test utility functions and helpers
 */

import { randomUUID } from 'crypto';

// Mock data generators
export class TestDataFactory {
  static createMockLead(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      firstName: 'John',
      lastName: 'Doe',
      email: `test.${Date.now()}@example.com`,
      phone: '555-0123',
      status: 'new',
      leadSource: 'test',
      vehicleInterest: 'SUV',
      campaignId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createMockCampaign(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      name: 'Test Campaign',
      context: 'Automotive sales campaign',
      status: 'draft',
      templates: [
        {
          id: 'template-1',
          subject: 'Welcome to our dealership!',
          content: 'Hello {firstName}, we have great deals for you!'
        }
      ],
      subjectLines: ['Welcome!', 'Great deals await!'],
      numberOfTemplates: 1,
      daysBetweenMessages: 3,
      communicationType: 'email',
      scheduleType: 'immediate',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createMockTemplate(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      campaignId: randomUUID(),
      subject: 'Test Template Subject',
      html: '<p>Test template content</p>',
      text: 'Test template content',
      variables: {},
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createMockUser(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      username: 'testuser',
      password: 'hashedpassword',
      role: 'user',
      email: 'test@example.com',
      notificationPreferences: {
        emailNotifications: true,
        campaignAlerts: true,
        leadAlerts: true,
        systemAlerts: true,
        monthlyReports: true,
        highEngagementAlerts: true,
        quotaWarnings: true
      },
      createdAt: new Date(),
      ...overrides
    };
  }

  static createMockClient(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      name: 'Test Client',
      domain: 'testclient.com',
      brandingConfig: {},
      settings: {},
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createMockConversation(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      campaignId: randomUUID(),
      leadId: randomUUID(),
      userId: randomUUID(),
      subject: 'Test Conversation',
      status: 'active',
      priority: 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createMockCSVFile(data: string[] = ['email', 'john@example.com', 'jane@example.com']) {
    const csvContent = data.join('\n');
    return {
      buffer: Buffer.from(csvContent, 'utf8'),
      originalname: 'test.csv',
      mimetype: 'text/csv',
      size: csvContent.length
    };
  }

  static createValidCSVContent(rows: number = 5): string {
    const headers = 'firstName,lastName,email,phone,vehicleInterest';
    const dataRows = Array.from({ length: rows }, (_, i) => 
      `User${i},Test${i},user${i}@example.com,555-012${i},SUV`
    );
    return [headers, ...dataRows].join('\n');
  }

  static createInvalidCSVContent(): string {
    return 'email,name\ninvalid-email,John Doe\nvalid@example.com,Jane Smith';
  }

}

// Mock implementations
export class MockStorageService {
  private leads: any[] = [];
  private campaigns: any[] = [];
  private users: any[] = [];
  private templates: any[] = [];

  async getLeads() {
    return [...this.leads];
  }

  async getLeadById(id: string) {
    return this.leads.find(lead => lead.id === id) || null;
  }

  async getLeadByEmail(email: string) {
    return this.leads.find(lead => lead.email === email) || null;
  }

  async createLead(leadData: any) {
    const lead = { id: randomUUID(), ...leadData, createdAt: new Date(), updatedAt: new Date() };
    this.leads.push(lead);
    return lead;
  }

  async updateLead(id: string, updates: any) {
    const index = this.leads.findIndex(lead => lead.id === id);
    if (index !== -1) {
      this.leads[index] = { ...this.leads[index], ...updates, updatedAt: new Date() };
      return this.leads[index];
    }
    return null;
  }

  async deleteLead(id: string) {
    const index = this.leads.findIndex(lead => lead.id === id);
    if (index !== -1) {
      return this.leads.splice(index, 1)[0];
    }
    return null;
  }

  async getCampaigns() {
    return [...this.campaigns];
  }

  async getCampaign(id: string) {
    return this.campaigns.find(campaign => campaign.id === id) || null;
  }

  async createCampaign(campaignData: any) {
    const campaign = { id: randomUUID(), ...campaignData, createdAt: new Date(), updatedAt: new Date() };
    this.campaigns.push(campaign);
    return campaign;
  }

  async updateCampaign(id: string, updates: any) {
    const index = this.campaigns.findIndex(campaign => campaign.id === id);
    if (index !== -1) {
      this.campaigns[index] = { ...this.campaigns[index], ...updates, updatedAt: new Date() };
      return this.campaigns[index];
    }
    return null;
  }

  async getTemplatesByCampaign(campaignId: string) {
    return this.templates.filter(t => t.campaignId === campaignId);
  }

  async createTemplate(templateData: any) {
    const version = this.templates.filter(t => t.campaignId === templateData.campaignId).length + 1;
    const template = {
      id: randomUUID(),
      version,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...templateData
    };
    this.templates.push(template);
    return template;
  }

  async getUsers() {
    return [...this.users];
  }

  async getUserById(id: string) {
    return this.users.find(user => user.id === id) || null;
  }

  async createUser(userData: any) {
    const user = { id: randomUUID(), ...userData, createdAt: new Date() };
    this.users.push(user);
    return user;
  }

  // Helper methods for tests
  reset() {
    this.leads = [];
    this.campaigns = [];
    this.users = [];
    this.templates = [];
  }

  seedData(data: { leads?: any[], campaigns?: any[], users?: any[], templates?: any[] }) {
    if (data.leads) this.leads = [...data.leads];
    if (data.campaigns) this.campaigns = [...data.campaigns];
    if (data.users) this.users = [...data.users];
    if (data.templates) this.templates = [...data.templates];
  }
}

// Mock email service
export class MockEmailService {
  private sentEmails: any[] = [];
  private shouldFail = false;

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async sendEmail(emailData: any) {
    if (this.shouldFail) {
      throw new Error('Mock email service failure');
    }

    const email = {
      id: randomUUID(),
      ...emailData,
      sentAt: new Date(),
      status: 'sent'
    };
    
    this.sentEmails.push(email);
    return email;
  }

  async sendBulkEmails(emails: any[]) {
    const results = [];
    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({ success: true, email: result });
      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : String(error), email });
      }
    }
    return results;
  }

  getSentEmails() {
    return [...this.sentEmails];
  }

  reset() {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

// Mock WebSocket service
export class MockWebSocketService {
  private broadcasts: any[] = [];
  private emissions: any[] = [];

  broadcast(event: string, data: any) {
    this.broadcasts.push({ event, data, timestamp: new Date() });
  }

  emit(event: string, data: any, socketId?: string) {
    this.emissions.push({ event, data, socketId, timestamp: new Date() });
  }

  getBroadcasts() {
    return [...this.broadcasts];
  }

  getEmissions() {
    return [...this.emissions];
  }

  reset() {
    this.broadcasts = [];
    this.emissions = [];
  }
}

// Test environment helpers
export class TestEnvironment {
  static async setupTestDatabase() {
    // Database setup logic for integration tests
    // This would create a clean test database state
  }

  static async cleanupTestDatabase() {
    // Database cleanup logic for integration tests
    // This would remove all test data
  }

  static mockConsole() {
    const originalConsole = { ...console };
    
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'info').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    return originalConsole;
  }

  static createMockRequest(overrides: any = {}): any {
    return {
      params: {},
      query: {},
      body: {},
      headers: {},
      user: null,
      session: {},
      ...overrides
    };
  }

  static createMockResponse(): any {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    return res;
  }
}

// Async test helpers
export class AsyncTestHelpers {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.delay(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async waitForEmptyEventLoop(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }
}

// Validation helpers
export class ValidationHelpers {
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidTimestamp(timestamp: string | Date): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.getTime() > 0;
  }

  static expectValidDatabaseRecord(record: any) {
    expect(record).toBeDefined();
    expect(record.id).toBeDefined();
    expect(this.isValidUUID(record.id)).toBe(true);
    expect(record.createdAt).toBeDefined();
    expect(this.isValidTimestamp(record.createdAt)).toBe(true);
  }
}