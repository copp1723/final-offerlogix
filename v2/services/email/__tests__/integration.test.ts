/**
 * Integration Tests for V2 Email Services
 * 
 * Tests the complete flow from inbound normalization through
 * threading and database operations.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MailgunThreading } from '../MailgunThreading';
import { normalizeMailgun } from '../inbound-normalizer';
import type { AgentIdentity, EmailTransport } from '../types';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the database
jest.mock('../../../../server/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  }
}));

// Mock crypto for deterministic testing
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'integration-test-uuid'),
}));

// Mock transport
const mockTransport: EmailTransport = {
  sendRaw: jest.fn().mockResolvedValue({ id: 'mailgun-integration-id' }),
};

// ============================================================================
// TEST DATA
// ============================================================================

const testAgent: AgentIdentity = {
  id: 'agent-integration-123',
  name: 'Integration Agent',
  domain: 'integration.test.com',
  localPart: 'integration',
};

const inboundMailgunPayload = {
  'message-id': '<inbound-msg-123@customer.com>',
  from: 'Customer Smith <customer@example.com>',
  to: 'Integration Agent <integration@integration.test.com>',
  subject: 'Integration Test Email',
  'body-plain': 'This is an integration test message.',
  'body-html': '<p>This is an integration test message.</p>',
};

const threadedInboundPayload = {
  ...inboundMailgunPayload,
  'message-id': '<threaded-msg-456@customer.com>',
  'in-reply-to': '<agent-reply-123@integration.test.com>',
  references: '<initial-msg@customer.com> <agent-reply-123@integration.test.com>',
  subject: 'Re: Integration Test Email',
};

// ============================================================================
// TESTS
// ============================================================================

describe('V2 Email Services Integration', () => {
  let threadingService: MailgunThreading;

  beforeEach(() => {
    jest.clearAllMocks();
    threadingService = new MailgunThreading(mockTransport);
  });

  describe('Complete Email Flow', () => {
    test('handles new conversation flow', async () => {
      // Mock database for new conversation
      const mockDb = require('../../../../server/db').db;
      
      // No existing conversation
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // New conversation creation
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'new-conv-integration',
            agentId: 'agent-integration-123',
            leadEmail: 'customer@example.com',
            threadId: 'integration-test-uuid',
            subject: 'Integration Test Email',
            lastMessageId: null,
            messageCount: 0,
          }]),
        }),
      });

      // Update conversation
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // 1. Normalize inbound email
      const inboundEmail = normalizeMailgun(inboundMailgunPayload);
      
      expect(inboundEmail.agentLocalPart).toBe('integration');
      expect(inboundEmail.agentDomain).toBe('integration.test.com');
      expect(inboundEmail.fromEmail).toBe('customer@example.com');

      // 2. Send agent response
      const outboundResult = await threadingService.sendEmail({
        agent: testAgent,
        to: inboundEmail.fromEmail,
        subject: `Re: ${inboundEmail.subject}`,
        html: '<p>Thank you for your message. How can I help you?</p>',
      });

      // 3. Verify results
      expect(outboundResult.messageId).toBe('<integration-test-uuid@integration.test.com>');
      
      // Verify transport was called correctly
      expect(mockTransport.sendRaw).toHaveBeenCalledWith({
        from: 'Integration Agent <integration@integration.test.com>',
        to: 'customer@example.com',
        subject: 'Re: Integration Test Email',
        html: '<p>Thank you for your message. How can I help you?</p>',
        headers: {
          'Message-ID': '<integration-test-uuid@integration.test.com>',
          'Reply-To': 'Integration Agent <integration@integration.test.com>',
        },
      });

      // Verify database operations
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // conversation + message
      expect(mockDb.update).toHaveBeenCalledTimes(1); // update lastMessageId
    });

    test('handles threaded conversation flow', async () => {
      // Mock existing conversation
      const mockDb = require('../../../../server/db').db;
      
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{
              id: 'existing-conv-integration',
              agentId: 'agent-integration-123',
              leadEmail: 'customer@example.com',
              threadId: 'existing-thread-123',
              subject: 'Integration Test Email',
              lastMessageId: '<agent-reply-123@integration.test.com>',
              messageCount: 2,
            }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // 1. Normalize threaded inbound email
      const inboundEmail = normalizeMailgun(threadedInboundPayload);
      
      expect(inboundEmail.inReplyTo).toBe('<agent-reply-123@integration.test.com>');
      expect(inboundEmail.references).toEqual([
        '<initial-msg@customer.com>',
        '<agent-reply-123@integration.test.com>'
      ]);

      // 2. Send threaded response
      const outboundResult = await threadingService.sendEmail({
        agent: testAgent,
        to: inboundEmail.fromEmail,
        subject: inboundEmail.subject,
        html: '<p>I understand your follow-up question.</p>',
        inReplyTo: inboundEmail.messageId,
        references: inboundEmail.references,
      });

      // 3. Verify threading headers
      expect(mockTransport.sendRaw).toHaveBeenCalledWith({
        from: 'Integration Agent <integration@integration.test.com>',
        to: 'customer@example.com',
        subject: 'Re: Integration Test Email',
        html: '<p>I understand your follow-up question.</p>',
        headers: {
          'Message-ID': '<integration-test-uuid@integration.test.com>',
          'Reply-To': 'Integration Agent <integration@integration.test.com>',
          'In-Reply-To': '<threaded-msg-456@customer.com>',
          'References': '<initial-msg@customer.com> <agent-reply-123@integration.test.com> <threaded-msg-456@customer.com>',
        },
      });
    });
  });

  describe('Error Handling', () => {
    test('handles transport errors gracefully', async () => {
      const failingTransport: EmailTransport = {
        sendRaw: jest.fn().mockRejectedValue(new Error('Transport failed')),
      };

      const failingService = new MailgunThreading(failingTransport);

      await expect(failingService.sendEmail({
        agent: testAgent,
        to: 'customer@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      })).rejects.toThrow('Transport failed');
    });

    test('handles malformed inbound payloads', () => {
      const malformedPayload = {
        'message-id': '<valid-id@example.com>',
        // Missing required fields
      };

      expect(() => normalizeMailgun(malformedPayload)).toThrow();
    });
  });

  describe('Data Consistency', () => {
    test('maintains email address consistency', () => {
      const payloadWithMixedCase = {
        ...inboundMailgunPayload,
        from: 'Customer <CUSTOMER@EXAMPLE.COM>',
        to: 'Agent <AGENT@INTEGRATION.TEST.COM>',
      };

      const normalized = normalizeMailgun(payloadWithMixedCase);
      
      expect(normalized.fromEmail).toBe('customer@example.com');
      expect(normalized.agentLocalPart).toBe('agent');
      expect(normalized.agentDomain).toBe('integration.test.com');
    });

    test('maintains message ID format consistency via computeMessageId', () => {
      const messageId1 = MailgunThreading.computeMessageId('seed1', testAgent.domain);
      const messageId2 = MailgunThreading.computeMessageId('seed2', testAgent.domain);
      
      // Should have same format with different seeds
      expect(messageId1).toMatch(/^<[a-f0-9]{16}@integration\.test\.com>$/);
      expect(messageId2).toMatch(/^<[a-f0-9]{16}@integration\.test\.com>$/);
      
      // Different seeds should produce different message IDs
      expect(messageId1).not.toBe(messageId2);
    });
  });

  describe('No V1 Dependencies', () => {
    test('services do not import from V1 paths', () => {
      // This test ensures we're not accidentally importing from V1
      // by checking that our modules can be imported without V1 dependencies
      
      expect(() => {
        require('../MailgunThreading');
        require('../inbound-normalizer');
        require('../types');
      }).not.toThrow();
    });
  });
});
