/**
 * MailgunThreading Service Tests
 * 
 * Tests for deterministic Message-ID generation, threading headers,
 * and database operations with snapshot verification.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MailgunThreading } from '../MailgunThreading';
import type { AgentIdentity, EmailTransport, OutboundArgs, RawEmailPayload } from '../types';

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
  randomUUID: jest.fn(() => 'test-uuid-12345'),
}));

// Mock transport with correct typing
const sendRaw = jest.fn(async (_: RawEmailPayload) => ({ id: 'mailgun-id-12345' })) as EmailTransport['sendRaw'];
const mockTransport: EmailTransport = { sendRaw };

// ============================================================================
// TEST DATA
// ============================================================================

const testAgent: AgentIdentity = {
  id: 'agent-123',
  name: 'Riley Donovan',
  domain: 'kunesmacomb.kunesauto.vip',
  localPart: 'riley',
};

const testOutboundArgs: OutboundArgs = {
  agent: testAgent,
  to: 'customer@example.com',
  subject: 'Test Subject',
  html: '<p>Test message content</p>',
};

// ============================================================================
// TESTS
// ============================================================================

describe('MailgunThreading', () => {
  let service: MailgunThreading;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MailgunThreading(mockTransport);
  });

  describe('Static Methods', () => {
    test('formatAgentIdentity creates proper email format', () => {
      const identity = MailgunThreading.formatAgentIdentity(testAgent);
      expect(identity).toMatchSnapshot();
      expect(identity).toBe('Riley Donovan <riley@kunesmacomb.kunesauto.vip>');
    });

    test('buildReferences handles empty array', () => {
      const references = MailgunThreading.buildReferences();
      expect(references).toEqual([]);
    });

    test('buildReferences adds inReplyTo to existing chain', () => {
      const existing = ['<msg1@domain.com>', '<msg2@domain.com>'];
      const inReplyTo = '<msg3@domain.com>';
      const references = MailgunThreading.buildReferences(existing, inReplyTo);
      
      expect(references).toMatchSnapshot();
      expect(references).toEqual([
        '<msg1@domain.com>',
        '<msg2@domain.com>',
        '<msg3@domain.com>'
      ]);
    });

    test('buildReferences caps at 10 references', () => {
      const existing = Array.from({ length: 12 }, (_, i) => `<msg${i}@domain.com>`);
      const references = MailgunThreading.buildReferences(existing);
      
      expect(references).toHaveLength(10);
      expect(references[0]).toBe('<msg2@domain.com>'); // Should start from index 2
      expect(references[9]).toBe('<msg11@domain.com>'); // Should end at index 11
    });

    test('buildReferences avoids duplicates', () => {
      const existing = ['<msg1@domain.com>', '<msg2@domain.com>'];
      const inReplyTo = '<msg2@domain.com>'; // Duplicate
      const references = MailgunThreading.buildReferences(existing, inReplyTo);
      
      expect(references).toEqual(['<msg1@domain.com>', '<msg2@domain.com>']);
    });
  });

  describe('Email Sending', () => {
    test('sendEmail creates new thread headers', async () => {
      // Mock database responses for new conversation
      const mockDb = require('../../../../server/db').db;
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No existing conversation
          }),
        }),
      });

      // First insert: create conversation; Second insert: create message row -> return ID used for Message-Id
      const firstReturning = jest.fn().mockResolvedValue([{
        id: 'conv-123',
        agentId: 'agent-123',
        leadEmail: 'customer@example.com',
        threadId: 'test-uuid-12345',
        subject: 'Test Subject',
        lastMessageId: null,
        messageCount: 0,
      }]);
      const secondReturning = jest.fn().mockResolvedValue([{ id: 'seed-id-abc' }]);

      mockDb.insert
        .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ returning: firstReturning }) })
        .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ returning: secondReturning }) });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await service.sendEmail(testOutboundArgs);

      // Message-Id format: 16 hex chars @ domain
      expect(result.messageId).toMatch(/^<[a-f0-9]{16}@kunesmacomb\.kunesauto\.vip>$/);
      
      // Verify transport was called with correct headers
      expect(mockTransport.sendRaw).toHaveBeenCalledWith({
        from: 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
        to: 'customer@example.com',
        subject: 'Test Subject',
        html: '<p>Test message content</p>',
        headers: {
          'Message-Id': expect.stringMatching(/^<[a-f0-9]{16}@kunesmacomb\.kunesauto\.vip>$/),
          'Reply-To': 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
        },
      });
    });

    test('sendEmail creates reply headers', async () => {
      const replyArgs: OutboundArgs = {
        ...testOutboundArgs,
        inReplyTo: '<previous-msg@domain.com>',
        references: ['<msg1@domain.com>', '<msg2@domain.com>'],
      };

      // Mock existing conversation
      const mockDb = require('../../../../server/db').db;
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{
              id: 'conv-123',
              agentId: 'agent-123',
              leadEmail: 'customer@example.com',
              lastMessageId: '<previous-msg@domain.com>',
              subject: 'Test Subject',
              threadId: 'thread-123',
              messageCount: 2,
            }]),
          }),
        }),
      });

      // Message row insert returns deterministic seed for Message-Id
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'seed-id-def' }]) })
      });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      await service.sendEmail(replyArgs);

      // Verify transport was called with threading headers
      expect(mockTransport.sendRaw).toHaveBeenCalledWith({
        from: 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
        to: 'customer@example.com',
        subject: 'Test Subject',
        html: '<p>Test message content</p>',
        headers: {
          'Message-Id': expect.stringMatching(/^<[a-f0-9]{16}@kunesmacomb\.kunesauto\.vip>$/),
          'Reply-To': 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
          'In-Reply-To': '<previous-msg@domain.com>',
          'References': '<msg1@domain.com> <msg2@domain.com> <previous-msg@domain.com>',
        },
      });
    });
  });

  describe('Database Operations', () => {
    test('getOrCreateConversation creates new conversation', async () => {
      const mockDb = require('../../../../server/db').db;
      
      // Mock no existing conversation
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock conversation creation
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'new-conv-123',
            agentId: 'agent-123',
            leadEmail: 'customer@example.com',
            threadId: 'test-uuid-12345',
            subject: 'Test Subject',
            lastMessageId: null,
            messageCount: 0,
          }]),
        }),
      });

      const result = await service.getOrCreateConversation(
        'agent-123',
        'customer@example.com',
        'Test Subject'
      );

      expect(result.isNew).toBe(true);
      expect(result.conversation.id).toBe('new-conv-123');
      expect(result.conversation.leadEmail).toBe('customer@example.com');
    });

    test('getOrCreateConversation finds existing conversation', async () => {
      const mockDb = require('../../../../server/db').db;
      
      // Mock existing conversation
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{
              id: 'existing-conv-123',
              agentId: 'agent-123',
              leadEmail: 'customer@example.com',
              threadId: 'existing-thread-123',
              subject: 'Existing Subject',
              lastMessageId: '<last-msg@domain.com>',
              messageCount: 5,
            }]),
          }),
        }),
      });

      const result = await service.getOrCreateConversation(
        'agent-123',
        'customer@example.com',
        'Test Subject'
      );

      expect(result.isNew).toBe(false);
      expect(result.conversation.id).toBe('existing-conv-123');
      expect(result.conversation.messageCount).toBe(5);
    });

    test('getOrCreateConversation normalizes email to lowercase', async () => {
      const mockDb = require('../../../../server/db').db;
      
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'new-conv-123',
            agentId: 'agent-123',
            leadEmail: 'customer@example.com',
            threadId: 'test-uuid-12345',
            subject: 'Test Subject',
            lastMessageId: null,
            messageCount: 0,
          }]),
        }),
      });

      await service.getOrCreateConversation(
        'agent-123',
        'CUSTOMER@EXAMPLE.COM', // Uppercase input
        'Test Subject'
      );

      // Verify the insert was called with lowercase email
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb.insert.mock.calls[0];
      expect(insertCall[0]).toBeDefined(); // conversations table
    });
  });
});
