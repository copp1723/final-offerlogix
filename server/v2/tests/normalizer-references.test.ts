/**
 * Normalizer References Test
 * 
 * Verifies that references always defaults to empty array, never undefined.
 */

import { normalizeMailgun } from '../services/email/inbound-normalizer';

describe('Normalizer References Cleanup', () => {
  
  it('should default references to empty array when no References header', () => {
    const mailgunPayload = {
      recipient: 'testagent@test.example.com',
      sender: 'lead@customer.com',
      subject: 'Test Subject',
      'body-plain': 'Test message content',
      'Message-Id': '<test123@customer.com>'
    };

    const normalized = normalizeMailgun(mailgunPayload);

    expect(normalized.references).toEqual([]); // Should be empty array, not undefined
    expect(Array.isArray(normalized.references)).toBe(true);
  });

  it('should parse References header into array when present', () => {
    const mailgunPayload = {
      recipient: 'testagent@test.example.com',
      sender: 'lead@customer.com',
      subject: 'Test Subject',
      'body-plain': 'Test message content',
      'Message-Id': '<test123@customer.com>',
      'References': '<msg1@test.com> <msg2@test.com>'
    };

    const normalized = normalizeMailgun(mailgunPayload);

    expect(normalized.references).toEqual(['<msg1@test.com>', '<msg2@test.com>']);
    expect(Array.isArray(normalized.references)).toBe(true);
  });

  it('should handle empty References header as empty array', () => {
    const mailgunPayload = {
      recipient: 'testagent@test.example.com',
      sender: 'lead@customer.com',
      subject: 'Test Subject',
      'body-plain': 'Test message content',
      'Message-Id': '<test123@customer.com>',
      'References': '   ' // Empty/whitespace only
    };

    const normalized = normalizeMailgun(mailgunPayload);

    expect(normalized.references).toEqual([]);
    expect(Array.isArray(normalized.references)).toBe(true);
  });

  it('should handle null/undefined References as empty array', () => {
    const mailgunPayload = {
      recipient: 'testagent@test.example.com',
      sender: 'lead@customer.com', 
      subject: 'Test Subject',
      'body-plain': 'Test message content',
      'Message-Id': '<test123@customer.com>',
      'References': null // Explicitly null
    };

    const normalized = normalizeMailgun(mailgunPayload);

    expect(normalized.references).toEqual([]);
    expect(Array.isArray(normalized.references)).toBe(true);
  });

  it('should ensure references is never undefined in any scenario', () => {
    // Test various edge cases that might produce undefined
    const testCases = [
      {
        name: 'minimal payload',
        payload: {
          recipient: 'testagent@test.example.com',
          sender: 'lead@customer.com',
          subject: 'Test',
          'body-plain': 'content',
          'Message-Id': '<test@customer.com>'
        }
      },
      {
        name: 'message-headers format',
        payload: {
          recipient: 'testagent@test.example.com',
          sender: 'lead@customer.com',
          subject: 'Test',
          'body-plain': 'content',
          'message-headers': [
            ['Message-Id', '<test@customer.com>']
          ]
        }
      }
    ];

    testCases.forEach(({ name, payload }) => {
      const normalized = normalizeMailgun(payload);
      
      expect(normalized.references).toBeDefined(); // Never undefined
      expect(Array.isArray(normalized.references)).toBe(true); // Always array
      expect(normalized.references).toEqual([]); // Default to empty
    });
  });
});