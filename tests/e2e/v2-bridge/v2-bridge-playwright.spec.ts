/**
 * V2 Bridge Playwright E2E Tests
 * 
 * Comprehensive end-to-end tests for V2 UI bridge functionality using Playwright.
 * Tests real browser interactions with mocked V2 endpoints.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('V2 Bridge E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Set V2 feature flag enabled
    await page.addInitScript(() => {
      window.localStorage.setItem('VITE_ENABLE_V2_UI', 'true');
    });
  });

  test.describe('V2 Conversation Load Test', () => {
    test('should load V2 conversation and render subject & status', async () => {
      // Mock V2 conversation endpoint
      await page.route('**/v2/conversations/conv_123', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'conv_123',
            agentId: 'agent_v2_test',
            leadEmail: 'test@example.com',
            subject: 'Test V2 Conversation Subject',
            status: 'active',
            lastMessageId: 'msg_456',
            updatedAt: new Date().toISOString()
          })
        });
      });

      // Navigate to conversation page
      await page.goto('/conversations/conv_123');
      
      // Wait for conversation to load
      await page.waitForLoadState('networkidle');
      
      // Verify subject is rendered
      await expect(page.locator('text=Test V2 Conversation Subject')).toBeVisible();
      
      // Verify status is displayed
      await expect(page.locator('[data-testid="conversation-status"]')).toContainText('active');
      
      // Verify V2 debug badge is shown in dev mode
      await expect(page.locator('[data-testid="v2-debug-badge"]')).toBeVisible();
    });

    test('should display handover badge for handed_over status', async () => {
      // Mock handed over conversation
      await page.route('**/v2/conversations/conv_handover', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'conv_handover',
            agentId: 'agent_v2_test',
            leadEmail: 'handover@example.com',
            subject: 'Handed Over Conversation',
            status: 'handed_over',
            lastMessageId: 'msg_789',
            updatedAt: new Date().toISOString()
          })
        });
      });

      await page.goto('/conversations/conv_handover');
      await page.waitForLoadState('networkidle');
      
      // Verify handover badge is displayed
      await expect(page.locator('[data-testid="handover-badge"]')).toBeVisible();
      await expect(page.locator('[data-testid="handover-badge"]')).toContainText('Handed over');
    });
  });

  test.describe('V2 Reply Path Test', () => {
    test('should send V2 reply and show success toast', async () => {
      // Mock conversation load
      await page.route('**/v2/conversations/conv_reply', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'conv_reply',
            agentId: 'agent_v2_test',
            subject: 'Reply Test Conversation',
            status: 'active'
          })
        });
      });

      // Mock reply endpoint
      await page.route('**/v2/conversations/conv_reply/reply', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            messageId: 'msg_new_123',
            handover: false
          })
        });
      });

      await page.goto('/conversations/conv_reply');
      await page.waitForLoadState('networkidle');
      
      // Type reply message
      await page.fill('[data-testid="reply-input"]', 'Test reply message');
      
      // Send reply
      await page.click('[data-testid="send-reply-button"]');
      
      // Verify success toast appears
      await expect(page.locator('.toast')).toContainText('Reply sent');
      
      // Verify V1 endpoints were not called
      const v1Calls = await page.evaluate(() => {
        return (window as any).__v1EndpointCalls || [];
      });
      expect(v1Calls.length).toBe(0);
    });

    test('should handle handover scenario and show handover toast', async () => {
      // Mock conversation
      await page.route('**/v2/conversations/conv_handover_test', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'conv_handover_test',
            agentId: 'agent_v2_test',
            subject: 'Handover Test',
            status: 'active'
          })
        });
      });

      // Mock reply with handover
      await page.route('**/v2/conversations/conv_handover_test/reply', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            messageId: 'msg_handover_456',
            handover: true
          })
        });
      });

      await page.goto('/conversations/conv_handover_test');
      await page.waitForLoadState('networkidle');
      
      // Type message that triggers handover
      await page.fill('[data-testid="reply-input"]', 'I need to speak with a human representative');
      await page.click('[data-testid="send-reply-button"]');
      
      // Verify handover toast appears
      await expect(page.locator('.toast')).toContainText('Handed off to a human');
    });
  });

  test.describe('V1 Isolation Test', () => {
    test('should use V1 endpoints when V2 is disabled', async () => {
      // Disable V2 feature flag
      await page.addInitScript(() => {
        window.localStorage.setItem('VITE_ENABLE_V2_UI', 'false');
      });

      // Mock V1 conversation endpoint
      await page.route('**/api/conversations/conv_v1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'conv_v1',
            messages: [],
            status: 'active'
          })
        });
      });

      await page.goto('/conversations/conv_v1');
      await page.waitForLoadState('networkidle');
      
      // Verify V2 debug badge is not shown
      await expect(page.locator('[data-testid="v2-debug-badge"]')).not.toBeVisible();
      
      // Verify V1 structure is used
      await expect(page.locator('[data-testid="v1-conversation-view"]')).toBeVisible();
    });
  });

  test.describe('Telemetry Tracking', () => {
    test('should track v2_reply_sent events', async () => {
      // Setup telemetry tracking
      await page.addInitScript(() => {
        (window as any).__telemetryEvents = [];
        (window as any).__originalTelemetry = console.log;
        console.log = (...args: any[]) => {
          if (args[0] && args[0].includes('[Telemetry]')) {
            (window as any).__telemetryEvents.push(args);
          }
          (window as any).__originalTelemetry(...args);
        };
      });

      // Mock conversation and reply
      await page.route('**/v2/conversations/conv_telemetry', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'conv_telemetry',
            agentId: 'agent_v2_test',
            subject: 'Telemetry Test',
            status: 'active'
          })
        });
      });

      await page.route('**/v2/conversations/conv_telemetry/reply', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            messageId: 'msg_telemetry_123',
            handover: false
          })
        });
      });

      await page.goto('/conversations/conv_telemetry');
      await page.waitForLoadState('networkidle');
      
      // Send reply
      await page.fill('[data-testid="reply-input"]', 'Test telemetry tracking');
      await page.click('[data-testid="send-reply-button"]');
      
      // Wait for telemetry event
      await page.waitForTimeout(1000);
      
      // Verify telemetry event was tracked
      const telemetryEvents = await page.evaluate(() => {
        return (window as any).__telemetryEvents || [];
      });
      
      const replyEvent = telemetryEvents.find((event: any[]) => 
        event.some(arg => typeof arg === 'string' && arg.includes('v2_reply_sent'))
      );
      
      expect(replyEvent).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle V2 endpoint failures gracefully', async () => {
      // Mock 404 response
      await page.route('**/v2/conversations/nonexistent', async route => {
        await route.fulfill({ status: 404 });
      });

      await page.goto('/conversations/nonexistent');
      
      // Verify error message is displayed
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Conversation not found');
    });

    test('should handle V2 reply failures', async () => {
      // Mock conversation load success
      await page.route('**/v2/conversations/conv_error', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'conv_error',
            agentId: 'agent_v2_test',
            subject: 'Error Test',
            status: 'active'
          })
        });
      });

      // Mock reply failure
      await page.route('**/v2/conversations/conv_error/reply', async route => {
        await route.fulfill({ status: 500 });
      });

      await page.goto('/conversations/conv_error');
      await page.waitForLoadState('networkidle');
      
      // Try to send reply
      await page.fill('[data-testid="reply-input"]', 'Test error handling');
      await page.click('[data-testid="send-reply-button"]');
      
      // Verify error toast appears
      await expect(page.locator('.toast')).toContainText('Failed to send reply');
    });
  });
});
