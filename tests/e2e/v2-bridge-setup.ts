/**
 * Global setup for V2 Bridge Playwright tests
 * 
 * Sets up test environment, mocks, and initial data for V2 bridge testing.
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up V2 Bridge E2E tests...');
  
  // Set environment variables for testing
  process.env.VITE_ENABLE_V2_UI = 'true';
  process.env.NODE_ENV = 'test';
  
  // Launch browser for setup tasks
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Wait for the application to be ready
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Setup test data if needed
    await setupTestData(page);
    
    console.log('✅ V2 Bridge E2E setup complete');
  } catch (error) {
    console.error('❌ V2 Bridge E2E setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function setupTestData(page: any) {
  // Create test agents with V2 configuration
  const testAgents = [
    {
      id: 'agent_v2_test',
      name: 'V2 Test Agent',
      useV2: true,
      active: true
    },
    {
      id: 'agent_v1_only',
      name: 'V1 Only Agent', 
      useV2: false,
      active: true
    }
  ];
  
  // Create test conversations
  const testConversations = [
    {
      id: 'conv_v2_active',
      agentId: 'agent_v2_test',
      leadEmail: 'test@example.com',
      subject: 'V2 Test Conversation',
      status: 'active'
    },
    {
      id: 'conv_v2_handover',
      agentId: 'agent_v2_test', 
      leadEmail: 'handover@example.com',
      subject: 'Handover Test Conversation',
      status: 'handed_over'
    }
  ];
  
  // Setup mock API responses
  await page.route('**/v2/conversations/**', async (route: any) => {
    const url = route.request().url();
    const method = route.request().method();
    
    if (method === 'GET') {
      const conversationId = url.split('/').pop();
      const conversation = testConversations.find(c => c.id === conversationId);
      
      if (conversation) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...conversation,
            lastMessageId: `msg_${Date.now()}`,
            updatedAt: new Date().toISOString()
          })
        });
      } else {
        await route.fulfill({ status: 404 });
      }
    } else if (method === 'POST' && url.includes('/reply')) {
      const conversationId = url.split('/')[url.split('/').length - 2];
      const requestBody = route.request().postDataJSON();
      
      // Simulate handover detection based on content
      const handover = requestBody?.content?.toLowerCase().includes('human') || 
                     requestBody?.content?.toLowerCase().includes('representative');
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messageId: `msg_reply_${Date.now()}`,
          handover
        })
      });
    }
  });
  
  console.log('📝 Test data setup complete');
}

export default globalSetup;
