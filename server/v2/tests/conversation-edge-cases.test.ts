/**
 * ConversationEngine Edge Cases Tests
 * 
 * Tests idempotency, references capping, and edge scenarios.
 */

jest.mock('../db', () => ({
  dbV2: {},
  v2schema: {
    messages: { id: {}, messageId: {}, conversationId: {}, content: {}, sender: {}, inReplyTo: {} },
    conversations: { id: {}, status: {}, agentId: {}, leadEmail: {}, subject: {}, lastMessageId: {} }
  }
}));

import { ConversationEngine, type ConversationDeps } from '../services/conversation/ConversationEngine';
import { AgentCore } from '../services/agent/AgentCore';
import type { InboundEmail, AgentIdentity, OutboundArgs, OutboundResult } from '../services/email/types';
import { makeDbMock, makeDbMockWithPreset, type DbMock } from './helpers/makeDbMock';

describe('ConversationEngine Edge Cases', () => {
  let mockDb: DbMock;
  let mockAgentCore: jest.Mocked<AgentCore>;
  let mockMailer: any;
  let mockLoadAgent: jest.MockedFunction<ConversationDeps['loadAgent']>;
  let mockLoadHistory: jest.MockedFunction<ConversationDeps['loadHistory']>;
  let conversationEngine: ConversationEngine;

  const mockAgent: AgentIdentity = {
    id: 'agent-123',
    name: 'Riley Donovan',
    domain: 'kunesmacomb.kunesauto.vip',
    localPart: 'riley'
  };

  const mockInbound: InboundEmail & { agentId: string; conversationId: string } = {
    agentLocalPart: 'riley',
    agentDomain: 'kunesmacomb.kunesauto.vip',
    fromEmail: 'customer@example.com',
    subject: 'Test inquiry',
    text: 'Hello, I have a question',
    messageId: '<test-123@example.com>',
    inReplyTo: null,
    references: [],
    rawHeaders: {},
    agentId: 'agent-123',
    conversationId: 'conv-456'
  };

  beforeEach(() => {
    // Create proper DB mock with default configuration
    mockDb = makeDbMock({
      existingMessages: [], // No existing messages by default (new message case)
      existingConversations: [
        { messageId: '<msg-1@example.com>' },
        { messageId: '<msg-2@example.com>' }
      ],
      insertReturns: [{ id: 'mock-msg-id' }]
    });

    mockAgentCore = {
      generate: jest.fn().mockResolvedValue({
        reply: 'Thank you for your inquiry.',
        handover: false
      }),
      injectVariables: jest.fn(),
      detectHandoverTriggers: jest.fn()
    } as jest.Mocked<AgentCore>;

    mockMailer = {
      sendEmail: jest.fn().mockResolvedValue({
        messageId: '<reply-456@kunesmacomb.kunesauto.vip>',
        conversationId: 'conv-456'
      })
    };

    mockLoadAgent = jest.fn().mockResolvedValue({
      globalPrompt: 'You are {{role}} at {{dealership}}.',
      vars: { role: 'Sales Associate', dealership: 'Kunes Macomb' },
      identity: mockAgent
    });

    mockLoadHistory = jest.fn().mockResolvedValue([
      { role: 'user', content: 'Hello, I have a question' }
    ]);

    conversationEngine = new ConversationEngine({
      db: mockDb as any, // Type assertion for mock
      agentCore: mockAgentCore,
      mailer: mockMailer,
      loadAgent: mockLoadAgent,
      loadHistory: mockLoadHistory
    });
  });

  describe('inbound idempotency', () => {
    it('should skip processing for duplicate webhook retries', async () => {
      // Arrange - configure mock for duplicate message scenario
      mockDb.setConfig({
        existingMessages: [{ id: 'existing-msg-id' }], // Simulate existing message
        insertReturns: [] // No inserts should happen
      });

      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - only idempotency check performed, no message insert
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled(); // No duplicate message stored
      expect(mockAgentCore.generate).not.toHaveBeenCalled(); // No AI response generated
      expect(mockMailer.sendEmail).not.toHaveBeenCalled(); // No outbound email sent
    });

    it('should process normally for new messageIds', async () => {
      // Arrange - configure mock for new message scenario
      mockDb.setConfig({
        existingMessages: [], // No existing messages (new message case)
        existingConversations: [
          {
            status: 'active',
            agentId: 'agent-123',
            leadEmail: 'test@example.com',
            subject: 'Test Subject',
            lastMessageId: '<prev-msg@example.com>'
          }
        ],
        insertReturns: [{ id: 'new-msg-123' }]
      });

      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - full processing chain executed
      expect(mockDb.insert).toHaveBeenCalled(); // Message stored
      expect(mockLoadAgent).toHaveBeenCalled(); // Agent loaded
      expect(mockAgentCore.generate).toHaveBeenCalled(); // AI response generated
      expect(mockMailer.sendEmail).toHaveBeenCalled(); // Outbound sent
    });
  });

  describe('references capping', () => {
    it('should cap references to 900 bytes', async () => {
      // Create an instance to test private method via reflection
      const engine = conversationEngine as any;

      // Arrange - create refs that exceed 900 bytes
      const longRefs = [];
      for (let i = 0; i < 20; i++) {
        // Each ref ~50-60 bytes when wrapped in <>
        longRefs.push(`very-long-message-id-${i}-with-lots-of-padding-to-make-it-big@example.com`);
      }

      // Act
      const cappedRefs = engine.capReferences(longRefs);

      // Assert
      const totalBytes = cappedRefs.join('').length;
      expect(totalBytes).toBeLessThanOrEqual(900);
      expect(cappedRefs.length).toBeGreaterThan(0); // Should include some refs
      expect(cappedRefs.length).toBeLessThan(longRefs.length); // Should be truncated

      // Verify angle brackets are added
      cappedRefs.forEach((ref: string) => {
        expect(ref).toMatch(/^<.*>$/);
      });
    });

    it('should preserve refs under byte limit', async () => {
      const engine = conversationEngine as any;

      // Arrange - small refs well under limit
      const smallRefs = [
        '<msg-1@example.com>',
        '<msg-2@example.com>',
        '<msg-3@example.com>'
      ];

      // Act
      const cappedRefs = engine.capReferences(smallRefs);

      // Assert - all refs preserved
      expect(cappedRefs).toEqual(smallRefs);
      expect(cappedRefs.length).toBe(3);
    });

    it('should handle empty references array', async () => {
      const engine = conversationEngine as any;

      // Act
      const cappedRefs = engine.capReferences([]);

      // Assert
      expect(cappedRefs).toEqual([]);
      expect(cappedRefs.length).toBe(0);
    });

    it('should wrap refs without angle brackets', async () => {
      const engine = conversationEngine as any;

      // Arrange - refs without angle brackets
      const rawRefs = [
        'msg-1@example.com',
        'msg-2@example.com'
      ];

      // Act
      const cappedRefs = engine.capReferences(rawRefs);

      // Assert - angle brackets added
      expect(cappedRefs).toEqual([
        '<msg-1@example.com>',
        '<msg-2@example.com>'
      ]);
    });
  });

  describe('conversation status edge cases', () => {
    it('should handle missing conversation gracefully', async () => {
      // Arrange - configure mock for missing conversation scenario
      mockDb.setConfig({
        existingMessages: [], // New message (passes idempotency check)
        existingConversations: [], // No conversation found
        insertReturns: [{ id: 'new-msg-123' }]
      });

      // Act & Assert
      await expect(conversationEngine.processInbound(mockInbound))
        .rejects.toThrow('Conversation not found: conv-456');
    });
  });
});