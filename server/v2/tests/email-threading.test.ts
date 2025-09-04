/**
 * Email Threading Core Tests
 * 
 * Tests deterministic Message-ID generation, threading headers, and conversation management.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  MailgunThreading,
  ThreadingError
} from '../services/email/MailgunThreading';
import {
  normalizeMailgun,
  validateInboundEmail,
  sanitizeContent
} from '../services/email/inbound-normalizer';
import type {
  AgentIdentity,
  EmailTransport,
  RawEmailPayload,
  InboundEmail,
} from '../services/email/types';
import { makeDbMockWithPreset, DB_MOCK_PRESETS } from './helpers/makeDbMock';
// Mock schema to avoid compiling heavy static checks in schema definitions
jest.mock('../schema', () => ({
  agents: {},
  conversations: {},
  messages: {},
  systemPrompts: {},
}));

// Chainable DB mock for deterministic flows (init inside mock factory to avoid hoist issues)
jest.mock('../db', () => {
  const { makeDbMockWithPreset } = require('./helpers/makeDbMock');
  const dbMock = makeDbMockWithPreset('ACTIVE_CONVERSATION');
  return {
    dbV2: dbMock,
    v2schema: {
      agents: {},
      conversations: {},
      messages: {},
    },
  };
});

// Test agent identity
const testAgent: AgentIdentity = {
  id: 'test-agent-123',
  name: 'Test Agent',
  domain: 'test.example.com',
  localPart: 'testagent'
};

describe('OfferLogix V2 Email Threading', () => {
  let sendRaw: jest.MockedFunction<EmailTransport['sendRaw']>;
  let transport: EmailTransport;
  let threading: MailgunThreading;

  beforeEach(() => {
    // Fresh typed transport mock each test
    sendRaw = jest.fn<ReturnType<EmailTransport['sendRaw']> extends Promise<infer R> ? (_: RawEmailPayload) => Promise<R> : never>(
      async (_: RawEmailPayload) => ({ id: 'mailgun-id-123' }) as any
    ) as unknown as jest.MockedFunction<EmailTransport['sendRaw']>;
    transport = { sendRaw };
    threading = new MailgunThreading(transport);
    // Default DB mock: active conversation with some history, insert returns
    const { dbV2 } = require('../db');
    (dbV2 as any).setConfig({
      existingConversations: [
        { id: 'conv-1', threadId: 'thread-1', status: 'active', messageCount: 2 },
      ],
      insertReturns: [{ id: 'msg-row-1' }],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================================================
  // MESSAGE-ID GENERATION TESTS
  // ==========================================================================

  describe('Message-Id Behavior', () => {
    test('sendEmail returns valid Message-Id and sets header', async () => {
      const result = await threading.sendEmail({
        agent: testAgent,
        to: 'customer@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result.messageId).toMatch(/^<[0-9a-f]{16}@[a-z0-9.-]+>$/);
      expect(sendRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Message-Id': expect.stringMatching(/^<[0-9a-f]{16}@[a-z0-9.-]+>$/),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // AGENT VALIDATION TESTS
  // ==========================================================================

  describe('Agent Validation', () => {
    
    test('should accept valid agent configuration', () => {
      expect(() => MailgunThreading.validateAgentDomain(testAgent)).not.toThrow();
    });

    test('should reject invalid domain', () => {
      const invalidAgent = { ...testAgent, domain: 'invalid-domain' };
      expect(() => MailgunThreading.validateAgentDomain(invalidAgent))
        .toThrow(ThreadingError);
    });

    test('should reject invalid local part', () => {
      const invalidAgent = { ...testAgent, localPart: 'invalid@part' };
      expect(() => MailgunThreading.validateAgentDomain(invalidAgent))
        .toThrow(ThreadingError);
    });

    test('should reject empty domain', () => {
      const invalidAgent = { ...testAgent, domain: '' };
      expect(() => MailgunThreading.validateAgentDomain(invalidAgent))
        .toThrow(ThreadingError);
    });

  });

  // ==========================================================================
  // EMAIL ADDRESS FORMATTING TESTS  
  // ==========================================================================

  describe('Email Address Formatting', () => {
    
    test('should format complete agent email address', () => {
      const address = MailgunThreading.getAgentEmailAddress(testAgent);
      expect(address).toBe('Test Agent <testagent@test.example.com>');
    });

    test('should format agent email only', () => {
      const email = MailgunThreading.getAgentEmailOnly(testAgent);
      expect(email).toBe('testagent@test.example.com');
    });

  });

  // ==========================================================================
  // THREADING HEADERS TESTS
  // ==========================================================================

  describe('Threading Headers', () => {
    
    test('should build headers for new thread', () => {
      const messageId = '<msg1@test.com>';
      const headers = MailgunThreading.buildThreadingHeaders(messageId);
      
      expect(headers).toEqual({
        'Message-Id': messageId,
      });
    });

    test('should build headers for reply with In-Reply-To', () => {
      const messageId = '<msg2@test.com>';
      const inReplyTo = '<msg1@test.com>';
      
      const headers = MailgunThreading.buildThreadingHeaders(messageId, inReplyTo);
      
      expect(headers).toEqual({
        'Message-Id': messageId,
        'In-Reply-To': inReplyTo,
        'References': inReplyTo,
      });
    });

    test('should build References chain correctly', () => {
      const existingReferences = ['<msg1@test.com>', '<msg2@test.com>'];
      const inReplyTo = '<msg3@test.com>';
      
      const references = MailgunThreading.buildReferences(existingReferences, inReplyTo);
      
      expect(references).toEqual(['<msg1@test.com>', '<msg2@test.com>', '<msg3@test.com>']);
    });

    test('should cap References at maximum count', () => {
      const longChain = Array.from({ length: 15 }, (_, i) => `<msg${i}@test.com>`);
      
      const references = MailgunThreading.buildReferences(longChain);
      
      expect(references.length).toBeLessThanOrEqual(10);
      expect(references[0]).toBe('<msg5@test.com>'); // Should keep last 10
    });

    test('should not duplicate Message-IDs in References', () => {
      const existingReferences = ['<msg1@test.com>', '<msg2@test.com>'];
      const inReplyTo = '<msg2@test.com>'; // Already in references
      
      const references = MailgunThreading.buildReferences(existingReferences, inReplyTo);
      
      expect(references).toEqual(['<msg1@test.com>', '<msg2@test.com>']);
    });

  });

  // ==========================================================================
  // INBOUND EMAIL NORMALIZER TESTS
  // ==========================================================================

  describe('Inbound Email Normalizer', () => {
    
    test('should normalize valid Mailgun payload with message-headers format', () => {
      const mailgunPayload = {
        recipient: 'testagent@test.example.com',
        sender: 'lead@customer.com',
        subject: 'Test Subject',
        'body-plain': 'Test message content',
        'message-headers': [
          ['Message-Id', '<incoming123@customer.com>'],
          ['In-Reply-To', '<previous456@test.example.com>'],
          ['References', '<msg1@test.com> <msg2@test.com>']
        ]
      };

      const normalized = normalizeMailgun(mailgunPayload);

      expect(normalized).toEqual({
        agentLocalPart: 'testagent',
        agentDomain: 'test.example.com',
        fromEmail: 'lead@customer.com',
        subject: 'Test Subject',
        text: 'Test message content',
        html: undefined,
        messageId: '<incoming123@customer.com>',
        inReplyTo: '<previous456@test.example.com>',
        references: ['<msg1@test.com>', '<msg2@test.com>'],
        rawHeaders: expect.objectContaining({
          'message-id': '<incoming123@customer.com>',
          'in-reply-to': '<previous456@test.example.com>',
          'references': '<msg1@test.com> <msg2@test.com>'
        })
      });
    });

    test('should normalize payload with direct field access', () => {
      const mailgunPayload = {
        recipient: 'testagent@test.example.com', 
        sender: 'lead@customer.com',
        subject: 'Direct Fields Test',
        'body-html': '<p>HTML content</p>',
        'Message-Id': '<direct123@customer.com>',
        'In-Reply-To': '<directreply@test.com>'
      };

      const normalized = normalizeMailgun(mailgunPayload);

      expect(normalized.messageId).toBe('<direct123@customer.com>');
      expect(normalized.inReplyTo).toBe('<directreply@test.com>');
      expect(normalized.html).toBe('<p>HTML content</p>');
    });

    test('should handle email addresses with display names', () => {
      const mailgunPayload = {
        recipient: 'Test Agent <testagent@test.example.com>',
        sender: 'John Doe <john@customer.com>',
        subject: 'Display Name Test',
        'body-plain': 'Test content',
        'Message-Id': '<displayname@customer.com>'
      };

      const normalized = normalizeMailgun(mailgunPayload);

      expect(normalized.agentLocalPart).toBe('testagent');
      expect(normalized.agentDomain).toBe('test.example.com');
      expect(normalized.fromEmail).toBe('john@customer.com');
    });

    test('should throw error for missing required fields', () => {
      const invalidPayload = {
        recipient: 'testagent@test.example.com'
        // Missing sender and subject
      };

      expect(() => normalizeMailgun(invalidPayload)).toThrow('Missing required fields');
    });

    test('should throw error for invalid Message-ID', () => {
      const invalidPayload = {
        recipient: 'testagent@test.example.com',
        sender: 'lead@customer.com', 
        subject: 'Test',
        'body-plain': 'content',
        'Message-Id': 'invalid-message-id' // No @ symbol
      };

      expect(() => normalizeMailgun(invalidPayload)).toThrow('Invalid Message-ID format');
    });

  });

  // ==========================================================================
  // CONTENT SANITIZATION TESTS
  // ==========================================================================

  describe('Content Sanitization', () => {
    
    test('should sanitize and normalize content', () => {
      const messyContent = '  \r\n  Test content  \r\n\r\n\r\n\r\n  More content  \r\n  ';
      const sanitized = sanitizeContent(messyContent);
      
      expect(sanitized).toBe('Test content\n\n  More content');
    });

    test('should limit content length', () => {
      const longContent = 'a'.repeat(100000);
      const sanitized = sanitizeContent(longContent);
      
      expect(sanitized.length).toBe(50000);
    });

    test('should handle empty content', () => {
      expect(sanitizeContent('')).toBe('');
      expect(sanitizeContent(null as any)).toBe('');
      expect(sanitizeContent(undefined as any)).toBe('');
    });

  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('Inbound Email Validation', () => {
    
    const validEmail: InboundEmail = {
      agentLocalPart: 'testagent',
      agentDomain: 'test.example.com',
      fromEmail: 'lead@customer.com',
      subject: 'Test Subject',
      text: 'Test content',
      messageId: '<test123@customer.com>',
      rawHeaders: {}
    };

    test('should validate complete email', () => {
      expect(() => validateInboundEmail(validEmail)).not.toThrow();
    });

    test('should require either text or html content', () => {
      const invalidEmail = { ...validEmail, text: undefined, html: undefined };
      expect(() => validateInboundEmail(invalidEmail)).toThrow('either text or html content');
    });

    test('should validate email formats', () => {
      const invalidEmail = { ...validEmail, fromEmail: 'invalid-email' };
      expect(() => validateInboundEmail(invalidEmail)).toThrow('Invalid sender email format');
    });

    test('should validate Message-ID format', () => {
      const invalidEmail = { ...validEmail, messageId: 'invalid-message-id' };
      expect(() => validateInboundEmail(invalidEmail)).toThrow('Invalid Message-ID format');
    });

  });

  // ==========================================================================
  // INTEGRATION TESTS (MOCKED DATABASE)
  // ==========================================================================

  describe('Threading Integration', () => {
    test('builds payload with threading headers', async () => {
      const outboundArgs = {
        agent: testAgent,
        to: 'customer@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        inReplyTo: '<previous@test.com>',
        references: ['<msg1@test.com>', '<msg2@test.com>'],
      };

      await threading.sendEmail(outboundArgs);

      expect(sendRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Test Agent <testagent@test.example.com>',
          to: 'customer@example.com',
          subject: 'Test Email',
          headers: expect.objectContaining({
            'Reply-To': 'testagent@test.example.com',
            'Message-Id': expect.stringMatching(/^<[0-9a-f]{16}@test\.example\.com>$/),
            'In-Reply-To': '<previous@test.com>',
            'References': expect.stringContaining('<msg1@test.com>'),
          }),
        })
      );
    });

    test('logs health line on transport error', async () => {
      // Make transport throw a Mailgun-like error with status
      const err: any = new Error('mailgun 500 Internal Error');
      err.status = 500;
      sendRaw.mockRejectedValueOnce(err as any);

      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const outboundArgs = {
        agent: testAgent,
        to: 'customer@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      await expect(threading.sendEmail(outboundArgs)).rejects.toThrow(ThreadingError);

      expect(spy).toHaveBeenCalled();
      const [arg] = (spy as jest.Mock).mock.calls[0];
      const payload = JSON.parse(String(arg));
      expect(payload).toEqual(
        expect.objectContaining({
          event: 'mailgun_error',
          status: 500,
          agentId: testAgent.id,
        })
      );
    });
  });

});
