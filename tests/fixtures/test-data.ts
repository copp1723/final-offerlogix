/**
 * Test fixtures and sample data for tests
 */

// Sample CSV files for testing
export const VALID_CSV_CONTENT = `firstName,lastName,email,phone,vehicleInterest
John,Doe,john.doe@example.com,555-0123,SUV
Jane,Smith,jane.smith@example.com,555-0124,Sedan
Bob,Johnson,bob.johnson@example.com,555-0125,Truck
Alice,Brown,alice.brown@example.com,555-0126,Coupe
Charlie,Davis,charlie.davis@example.com,555-0127,Convertible`;

export const INVALID_CSV_CONTENT = `firstName,lastName,email,phone
John,Doe,invalid-email,555-0123
Jane,Smith,jane@example.com,invalid-phone
Bob,Johnson,,555-0125`;

export const MALICIOUS_CSV_CONTENT = `email,notes
test@example.com,"<script>alert('xss')</script>"
user@example.com,"=cmd|'/c calc'!A0"
victim@example.com,"javascript:alert('malicious')"`;

export const DUPLICATE_EMAIL_CSV = `email,firstName
test@example.com,John
different@example.com,Jane
test@example.com,Bob
another@example.com,Alice`;

// Sample lead data
export const SAMPLE_LEADS = [
  {
    id: 'lead-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-0123',
    status: 'new',
    leadSource: 'website',
    vehicleInterest: 'SUV',
    budget: '50000',
    timeframe: '3 months',
    notes: 'Interested in family-friendly vehicles',
    campaignId: null,
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:00:00Z')
  },
  {
    id: 'lead-002',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '555-0124',
    status: 'contacted',
    leadSource: 'referral',
    vehicleInterest: 'Sedan',
    budget: '35000',
    timeframe: '1 month',
    notes: 'Looking for fuel-efficient car',
    campaignId: 'campaign-001',
    createdAt: new Date('2023-01-02T14:30:00Z'),
    updatedAt: new Date('2023-01-03T09:15:00Z')
  },
  {
    id: 'lead-003',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@example.com',
    phone: '555-0125',
    status: 'qualified',
    leadSource: 'advertisement',
    vehicleInterest: 'Truck',
    budget: '60000',
    timeframe: '6 months',
    notes: 'Needs commercial vehicle for business',
    campaignId: 'campaign-002',
    createdAt: new Date('2023-01-03T16:45:00Z'),
    updatedAt: new Date('2023-01-05T11:20:00Z')
  }
];

// Sample campaign data
export const SAMPLE_CAMPAIGNS = [
  {
    id: 'campaign-001',
    name: 'Summer Sale Campaign',
    context: 'Promoting summer vehicle deals and incentives',
    handoverGoals: 'Generate qualified leads for test drives',
    targetAudience: 'Budget-conscious families looking for reliable vehicles',
    status: 'active',
    templates: [
      {
        id: 'template-001',
        subject: 'Summer Sale: Save Big on Family Vehicles!',
        content: `Hi {firstName},

Our summer sale is here! Save up to $5,000 on select family vehicles.

Perfect for families like yours looking for reliability and value.

Schedule your test drive today!

Best regards,
The Sales Team`
      },
      {
        id: 'template-002',
        subject: 'Last Chance: Summer Savings End Soon',
        content: `Hello {firstName},

Don't miss out on our summer sale ending this month.

We have the perfect {vehicleInterest} waiting for you.

Visit us this weekend for the best deals!

Regards,
Your Local Dealer`
      }
    ],
    subjectLines: [
      'Summer Sale: Save Big on Family Vehicles!',
      'Last Chance: Summer Savings End Soon',
      'Your Dream Car Awaits: Summer Deals Inside'
    ],
    numberOfTemplates: 2,
    daysBetweenMessages: 3,
    communicationType: 'email',
    scheduleType: 'immediate',
    isActive: true,
    isTemplate: false,
    createdAt: new Date('2023-06-01T09:00:00Z'),
    updatedAt: new Date('2023-06-01T09:00:00Z')
  },
  {
    id: 'campaign-002',
    name: 'Commercial Vehicle Outreach',
    context: 'Targeting business owners needing commercial vehicles',
    handoverGoals: 'Connect with fleet managers and business owners',
    targetAudience: 'Small to medium business owners, contractors',
    status: 'draft',
    templates: [
      {
        id: 'template-003',
        subject: 'Boost Your Business with Our Commercial Fleet',
        content: `Dear {firstName},

Is your business ready to grow? Our commercial vehicle fleet can help.

From trucks to vans, we have the right vehicle for your needs.

Schedule a consultation to discuss fleet options.

Professional regards,
Commercial Sales Team`
      }
    ],
    subjectLines: [
      'Boost Your Business with Our Commercial Fleet',
      'Commercial Vehicle Solutions for Growing Businesses'
    ],
    numberOfTemplates: 1,
    daysBetweenMessages: 5,
    communicationType: 'email',
    scheduleType: 'immediate',
    isActive: false,
    isTemplate: true,
    createdAt: new Date('2023-06-15T14:30:00Z'),
    updatedAt: new Date('2023-06-15T14:30:00Z')
  }
];

// Sample user data
export const SAMPLE_USERS = [
  {
    id: 'user-001',
    username: 'admin',
    password: '$2b$10$hashedpassword1',
    role: 'admin',
    email: 'admin@offerlogix.com',
    notificationPreferences: {
      emailNotifications: true,
      campaignAlerts: true,
      leadAlerts: true,
      systemAlerts: true,
      monthlyReports: true,
      highEngagementAlerts: true,
      quotaWarnings: true
    },
    clientId: 'client-001',
    createdAt: new Date('2023-01-01T00:00:00Z')
  },
  {
    id: 'user-002',
    username: 'manager',
    password: '$2b$10$hashedpassword2',
    role: 'manager',
    email: 'manager@offerlogix.com',
    notificationPreferences: {
      emailNotifications: true,
      campaignAlerts: true,
      leadAlerts: true,
      systemAlerts: false,
      monthlyReports: true,
      highEngagementAlerts: true,
      quotaWarnings: true
    },
    clientId: 'client-001',
    createdAt: new Date('2023-01-02T09:00:00Z')
  },
  {
    id: 'user-003',
    username: 'salesrep',
    password: '$2b$10$hashedpassword3',
    role: 'user',
    email: 'sales@offerlogix.com',
    notificationPreferences: {
      emailNotifications: true,
      campaignAlerts: false,
      leadAlerts: true,
      systemAlerts: false,
      monthlyReports: false,
      highEngagementAlerts: true,
      quotaWarnings: true
    },
    clientId: 'client-001',
    createdAt: new Date('2023-01-03T10:30:00Z')
  }
];

// Sample client data
export const SAMPLE_CLIENTS = [
  {
    id: 'client-001',
    name: 'Acme Auto Dealership',
    domain: 'acme-auto.com',
    brandingConfig: {
      primaryColor: '#1e3a8a',
      secondaryColor: '#64748b',
      logo: 'https://example.com/acme-logo.png',
      companyName: 'Acme Auto Dealership'
    },
    settings: {
      allowCampaignScheduling: true,
      maxCampaignsPerMonth: 50,
      allowSMSIntegration: true,
      requireApprovalForCampaigns: false
    },
    active: true,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z')
  },
  {
    id: 'client-002',
    name: 'Best Cars Inc',
    domain: 'bestcars.com',
    brandingConfig: {
      primaryColor: '#dc2626',
      secondaryColor: '#374151',
      logo: 'https://example.com/bestcars-logo.png',
      companyName: 'Best Cars Inc'
    },
    settings: {
      allowCampaignScheduling: true,
      maxCampaignsPerMonth: 25,
      allowSMSIntegration: false,
      requireApprovalForCampaigns: true
    },
    active: true,
    createdAt: new Date('2023-02-01T00:00:00Z'),
    updatedAt: new Date('2023-02-01T00:00:00Z')
  }
];

// Sample conversation data
export const SAMPLE_CONVERSATIONS = [
  {
    id: 'conv-001',
    campaignId: 'campaign-001',
    leadId: 'lead-001',
    userId: 'user-002',
    subject: 'Summer Sale Inquiry - John Doe',
    status: 'active',
    priority: 'normal',
    createdAt: new Date('2023-06-05T10:00:00Z'),
    updatedAt: new Date('2023-06-05T10:00:00Z')
  },
  {
    id: 'conv-002',
    campaignId: 'campaign-001',
    leadId: 'lead-002',
    userId: 'user-003',
    subject: 'Follow-up: Jane Smith Vehicle Interest',
    status: 'active',
    priority: 'high',
    createdAt: new Date('2023-06-06T14:30:00Z'),
    updatedAt: new Date('2023-06-07T09:15:00Z')
  }
];

// Email template samples
export const SAMPLE_EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to {dealershipName}!',
    content: `Hi {firstName},

Welcome to {dealershipName}! We're excited to help you find your perfect vehicle.

Our team is here to assist you with:
- Expert vehicle recommendations
- Competitive financing options
- Comprehensive warranties
- Outstanding customer service

Visit us at {dealershipAddress} or call {dealershipPhone} to schedule your test drive.

Best regards,
{salesRepName}
{dealershipName}`
  },
  followUp: {
    subject: 'Following up on your {vehicleInterest} interest',
    content: `Hello {firstName},

I wanted to follow up on your interest in our {vehicleInterest} models.

We have some exciting new inventory that matches your preferences:
- {budget} price range
- Available for {timeframe}
- {specificFeatures}

Would you like to schedule a test drive this week?

Please reply to this email or call me directly at {salesRepPhone}.

Best regards,
{salesRepName}`
  },
  promotional: {
    subject: 'Limited Time Offer: Save on {vehicleType}',
    content: `Dear {firstName},

This month only, save up to ${amount} on select {vehicleType} models!

Perfect timing for your {timeframe} purchase timeline.

Featured vehicles include:
- {model1} - Starting at ${price1}
- {model2} - Starting at ${price2}
- {model3} - Starting at ${price3}

Don't miss out - offer ends {expirationDate}.

Schedule your visit today!

{salesRepName}
{dealershipName}`
  }
};

// API response samples
export const SAMPLE_API_RESPONSES = {
  leadCreated: {
    success: true,
    message: 'Lead created successfully',
    data: {
      id: 'lead-new-001',
      firstName: 'New',
      lastName: 'Lead',
      email: 'new.lead@example.com',
      status: 'new',
      createdAt: new Date().toISOString()
    }
  },
  campaignExecuted: {
    success: true,
    message: 'Campaign executed successfully',
    data: {
      campaignId: 'campaign-001',
      emailsSent: 150,
      emailsFailed: 3,
      totalLeads: 153,
      executionTime: '2.3 seconds'
    }
  },
  validationError: {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'phone', message: 'Phone number required' }
      ]
    }
  }
};

// Test environment configurations
export const TEST_CONFIG = {
  database: {
    testConnectionString: 'postgresql://test:test@localhost:5432/offerlogix_test',
    setupScript: 'tests/scripts/setup-test-db.sql',
    cleanupScript: 'tests/scripts/cleanup-test-db.sql'
  },
  email: {
    mockProvider: true,
    testAccount: 'test@offerlogix-test.com',
    maxEmailsPerTest: 10
  },
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 30000,
    rateLimitBypass: true
  },
  security: {
    testJwtSecret: 'test-jwt-secret-for-testing-only',
    testSessionSecret: 'test-session-secret-for-testing-only'
  }
};