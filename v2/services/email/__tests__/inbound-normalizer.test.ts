/**
 * Inbound Email Normalizer Tests
 * 
 * Tests for Mailgun payload normalization with various formats
 * and edge cases.
 */

import { describe, test, expect } from '@jest/globals';
import { normalizeMailgun } from '../inbound-normalizer';

// ============================================================================
// TEST DATA
// ============================================================================

const baseMailgunPayload = {
  'message-id': '<test-message-123@example.com>',
  from: 'Customer Name <customer@example.com>',
  to: 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
  subject: 'Test Email Subject',
  'body-plain': 'This is the plain text content.',
  'body-html': '<p>This is the HTML content.</p>',
};

const headerArrayPayload = {
  'message-headers': [
    { name: 'Message-ID', value: '<header-msg-456@example.com>' },
    { name: 'From', value: 'Header Customer <header@example.com>' },
    { name: 'To', value: 'Agent Smith <agent@testdomain.com>' },
    { name: 'Subject', value: 'Header Subject' },
    { name: 'In-Reply-To', value: '<previous-msg@example.com>' },
    { name: 'References', value: '<msg1@example.com> <msg2@example.com>' },
    { name: 'Date', value: 'Mon, 01 Jan 2024 12:00:00 +0000' },
  ],
  'body-plain': 'Header array content.',
  'body-html': '<p>Header array HTML.</p>',
};

const threadedPayload = {
  ...baseMailgunPayload,
  'in-reply-to': '<previous-message@example.com>',
  references: '<msg1@example.com> <msg2@example.com> <previous-message@example.com>',
};

const strippedContentPayload = {
  ...baseMailgunPayload,
  'stripped-text': 'Stripped plain text content.',
  'stripped-html': '<p>Stripped HTML content.</p>',
};

// ============================================================================
// TESTS
// ============================================================================

describe('normalizeMailgun', () => {
  
  describe('Basic Normalization', () => {
    test('normalizes basic Mailgun payload', () => {
      const result = normalizeMailgun(baseMailgunPayload);
      
      expect(result).toMatchSnapshot();
      expect(result.agentLocalPart).toBe('riley');
      expect(result.agentDomain).toBe('kunesmacomb.kunesauto.vip');
      expect(result.fromEmail).toBe('customer@example.com');
      expect(result.subject).toBe('Test Email Subject');
      expect(result.messageId).toBe('<test-message-123@example.com>');
      expect(result.text).toBe('This is the plain text content.');
      expect(result.html).toBe('<p>This is the HTML content.</p>');
      expect(result.inReplyTo).toBeNull();
      expect(result.references).toEqual([]);
    });

    test('normalizes payload with message-headers array', () => {
      const result = normalizeMailgun(headerArrayPayload);
      
      expect(result).toMatchSnapshot();
      expect(result.agentLocalPart).toBe('agent');
      expect(result.agentDomain).toBe('testdomain.com');
      expect(result.fromEmail).toBe('header@example.com');
      expect(result.subject).toBe('Header Subject');
      expect(result.messageId).toBe('<header-msg-456@example.com>');
      expect(result.inReplyTo).toBe('<previous-msg@example.com>');
      expect(result.references).toEqual(['<msg1@example.com>', '<msg2@example.com>']);
    });
  });

  describe('Threading Support', () => {
    test('handles threaded email with In-Reply-To and References', () => {
      const result = normalizeMailgun(threadedPayload);
      
      expect(result.inReplyTo).toBe('<previous-message@example.com>');
      expect(result.references).toEqual([
        '<msg1@example.com>',
        '<msg2@example.com>',
        '<previous-message@example.com>'
      ]);
    });

    test('handles empty references', () => {
      const payload = {
        ...baseMailgunPayload,
        references: '',
      };
      
      const result = normalizeMailgun(payload);
      expect(result.references).toEqual([]);
    });

    test('handles comma-separated references', () => {
      const payload = {
        ...baseMailgunPayload,
        references: '<msg1@example.com>,<msg2@example.com>, <msg3@example.com>',
      };
      
      const result = normalizeMailgun(payload);
      expect(result.references).toEqual([
        '<msg1@example.com>',
        '<msg2@example.com>',
        '<msg3@example.com>'
      ]);
    });
  });

  describe('Content Handling', () => {
    test('prefers stripped content over full content', () => {
      const result = normalizeMailgun(strippedContentPayload);
      
      expect(result.text).toBe('Stripped plain text content.');
      expect(result.html).toBe('<p>Stripped HTML content.</p>');
    });

    test('falls back to full content when stripped not available', () => {
      const payload = {
        ...baseMailgunPayload,
        'stripped-text': undefined,
        'stripped-html': undefined,
      };
      
      const result = normalizeMailgun(payload);
      
      expect(result.text).toBe('This is the plain text content.');
      expect(result.html).toBe('<p>This is the HTML content.</p>');
    });

    test('handles missing content gracefully', () => {
      const payload = {
        ...baseMailgunPayload,
        'body-plain': undefined,
        'body-html': undefined,
        'stripped-text': undefined,
        'stripped-html': undefined,
      };
      
      const result = normalizeMailgun(payload);
      
      expect(result.text).toBeUndefined();
      expect(result.html).toBeUndefined();
    });
  });

  describe('Email Address Parsing', () => {
    test('parses email from "Name <email>" format', () => {
      const payload = {
        ...baseMailgunPayload,
        from: 'John Doe <john.doe@example.com>',
        to: 'Agent Smith <agent.smith@company.com>',
      };
      
      const result = normalizeMailgun(payload);
      
      expect(result.fromEmail).toBe('john.doe@example.com');
      expect(result.agentLocalPart).toBe('agent.smith');
      expect(result.agentDomain).toBe('company.com');
    });

    test('handles plain email addresses without angle brackets', () => {
      const payload = {
        ...baseMailgunPayload,
        from: 'plain@example.com',
        to: 'agent@company.com',
      };
      
      const result = normalizeMailgun(payload);
      
      expect(result.fromEmail).toBe('plain@example.com');
      expect(result.agentLocalPart).toBe('agent');
      expect(result.agentDomain).toBe('company.com');
    });

    test('normalizes email addresses to lowercase', () => {
      const payload = {
        ...baseMailgunPayload,
        from: 'Customer <CUSTOMER@EXAMPLE.COM>',
        to: 'Agent <AGENT@COMPANY.COM>',
      };
      
      const result = normalizeMailgun(payload);
      
      expect(result.fromEmail).toBe('customer@example.com');
      expect(result.agentLocalPart).toBe('agent');
      expect(result.agentDomain).toBe('company.com');
    });
  });

  describe('Raw Headers', () => {
    test('builds raw headers from direct fields and message-headers', () => {
      const result = normalizeMailgun(headerArrayPayload);
      
      expect(result.rawHeaders).toMatchObject({
        'message-id': '<header-msg-456@example.com>',
        'from': 'Header Customer <header@example.com>',
        'to': 'Agent Smith <agent@testdomain.com>',
        'subject': 'Header Subject',
        'in-reply-to': '<previous-msg@example.com>',
        'references': '<msg1@example.com> <msg2@example.com>',
        'date': 'Mon, 01 Jan 2024 12:00:00 +0000',
      });
    });

    test('includes direct fields in raw headers', () => {
      const result = normalizeMailgun(baseMailgunPayload);
      
      expect(result.rawHeaders).toMatchObject({
        'message-id': '<test-message-123@example.com>',
        'from': 'Customer Name <customer@example.com>',
        'to': 'Riley Donovan <riley@kunesmacomb.kunesauto.vip>',
        'subject': 'Test Email Subject',
      });
    });
  });

  describe('Error Handling', () => {
    test('throws error for missing Message-ID', () => {
      const payload = {
        ...baseMailgunPayload,
        'message-id': undefined,
      };
      
      expect(() => normalizeMailgun(payload)).toThrow('Missing required Message-ID header');
    });

    test('throws error for missing From header', () => {
      const payload = {
        ...baseMailgunPayload,
        from: undefined,
      };
      
      expect(() => normalizeMailgun(payload)).toThrow('Missing required From header');
    });

    test('throws error for missing To header', () => {
      const payload = {
        ...baseMailgunPayload,
        to: undefined,
      };
      
      expect(() => normalizeMailgun(payload)).toThrow('Missing required To header');
    });

    test('throws error for missing Subject header', () => {
      const payload = {
        ...baseMailgunPayload,
        subject: undefined,
      };
      
      expect(() => normalizeMailgun(payload)).toThrow('Missing required Subject header');
    });

    test('throws error for invalid To header format', () => {
      const payload = {
        ...baseMailgunPayload,
        to: 'invalid-email-format',
      };
      
      expect(() => normalizeMailgun(payload)).toThrow('Invalid To header format');
    });
  });

  describe('Alternative Field Names', () => {
    test('uses sender field as fallback for from', () => {
      const payload = {
        ...baseMailgunPayload,
        from: undefined,
        sender: 'Sender Name <sender@example.com>',
      };
      
      const result = normalizeMailgun(payload);
      expect(result.fromEmail).toBe('sender@example.com');
    });

    test('uses recipient field as fallback for to', () => {
      const payload = {
        ...baseMailgunPayload,
        to: undefined,
        recipient: 'Recipient <recipient@company.com>',
      };
      
      const result = normalizeMailgun(payload);
      expect(result.agentLocalPart).toBe('recipient');
      expect(result.agentDomain).toBe('company.com');
    });
  });
});
