/**
 * ConversationEngine Tests
 * 
 * Tests the full inbound → LLM → outbound conversation loop.
 */

import { ConversationEngine, type ConversationDeps } from '../services/conversation/ConversationEngine';
import { AgentCore } from '../services/agent/AgentCore';
import type { InboundEmail, AgentIdentity } from '../services/email/types';

describe('ConversationEngine', () => {
  let mockDb: any;
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
    text: 'I need help with financing options',
    messageId: '<test-123@example.com>',
    inReplyTo: null,
    references: [],
    rawHeaders: {},
    agentId: 'agent-123',
    conversationId: 'conv-456'
  };

  beforeEach(() => {
    // Mock database
    mockDb = {
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue([]) }),
      select: jest.fn().mockReturnValue({ 
        from: jest.fn().mockReturnValue({ 
          where: jest.fn().mockResolvedValue([{ status: 'active' }]) 
        }) 
      }),
      update: jest.fn().mockReturnValue({ 
        set: jest.fn().mockReturnValue({ 
          where: jest.fn().mockResolvedValue([]) 
        }) 
      })
    };

    // Mock AgentCore
    mockAgentCore = {
      generate: jest.fn().mockResolvedValue({
        reply: 'Thank you for your inquiry. I can help you with financing options.',
        handover: false
      }),
      injectVariables: jest.fn(),
      detectHandoverTriggers: jest.fn()
    } as jest.Mocked<AgentCore>;

    // Mock MailgunThreading
    mockMailer = {
      sendEmail: jest.fn().mockResolvedValue({
        messageId: '<reply-456@kunesmacomb.kunesauto.vip>',
        conversationId: 'conv-456'
      })
    };

    // Mock helper functions
    mockLoadAgent = jest.fn().mockResolvedValue({
      globalPrompt: 'You are {{role}} at {{dealership}}.',
      vars: { role: 'Sales Associate', dealership: 'Kunes Macomb' },
      identity: mockAgent
    });

    mockLoadHistory = jest.fn().mockResolvedValue([
      { role: 'user', content: 'I need help with financing options' }
    ]);

    // Create ConversationEngine instance
    conversationEngine = new ConversationEngine({
      db: mockDb,
      agentCore: mockAgentCore,
      mailer: mockMailer,
      loadAgent: mockLoadAgent,
      loadHistory: mockLoadHistory
    });
  });

  describe('processInbound', () => {
    it('should store inbound message and generate reply for active conversation', async () => {
      // Arrange
      mockDb.select().from().where.mockResolvedValue([{ status: 'active' }]);
      
      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - Store inbound message
      expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Object));
      const insertCall = mockDb.insert.mock.calls[0];
      expect(insertCall[0]).toBeDefined(); // messages table reference
      
      const valuesCall = mockDb.insert().values.mock.calls[0][0];
      expect(valuesCall).toMatchObject({
        conversationId: 'conv-456',
        content: 'I need help with financing options',
        sender: 'lead',
        messageId: '<test-123@example.com>',
        inReplyTo: null
      });

      // Assert - Generate response was called
      expect(mockLoadAgent).toHaveBeenCalledWith('agent-123');
      expect(mockLoadHistory).toHaveBeenCalledWith('conv-456', 5);
      expect(mockAgentCore.generate).toHaveBeenCalled();
      expect(mockMailer.sendEmail).toHaveBeenCalled();
    });

    it('should skip auto-reply for handed over conversations', async () => {
      // Arrange
      mockDb.select().from().where.mockResolvedValue([{ status: 'handed_over' }]);
      
      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - Inbound stored but no reply generated
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // Only inbound message stored
      expect(mockAgentCore.generate).not.toHaveBeenCalled();
      expect(mockMailer.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('generateResponse', () => {
    beforeEach(() => {
      // Mock conversation lookup
      mockDb.select().from().where.mockResolvedValue([{
        agentId: 'agent-123',
        leadEmail: 'customer@example.com',
        subject: 'Test inquiry',
        lastMessageId: '<test-123@example.com>',
        status: 'active'
      }]);
    });

    it('should generate normal reply and update conversation', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'I can help you with financing options.',
        handover: false
      });

      // Mock buildReferencesChain
      mockDb.select().from().where().orderBy().limit.mockResolvedValue([
        { messageId: '<test-123@example.com>' }
      ]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert
      expect(mockLoadAgent).toHaveBeenCalledWith('agent-123');
      expect(mockLoadHistory).toHaveBeenCalledWith('conv-456', 5);
      
      expect(mockAgentCore.generate).toHaveBeenCalledWith({
        systemPrompt: 'You are {{role}} at {{dealership}}.',
        history: [{ role: 'user', content: 'I need help with financing options' }],
        variables: { role: 'Sales Associate', dealership: 'Kunes Macomb' }
      });

      expect(mockMailer.sendEmail).toHaveBeenCalledWith({
        agent: mockAgent,
        to: 'customer@example.com',
        subject: 'Test inquiry',
        html: 'I can help you with financing options.',
        inReplyTo: '<test-123@example.com>',
        references: ['<test-123@example.com>'],
        conversationId: 'conv-456'
      });

      // Should update lastMessageId but not status
      expect(mockDb.update).toHaveBeenCalled();
      const updateCall = mockDb.update().set.mock.calls[0][0];
      expect(updateCall.lastMessageId).toBe('<reply-456@kunesmacomb.kunesauto.vip>');
      expect(updateCall.status).toBeUndefined();
    });

    it('should handle handover request and update conversation status', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'Let me connect you with a specialist.',
        handover: true,
        reason: 'Customer requested financing specialist'
      });

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert
      expect(mockMailer.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "Let me connect you with a specialist.\n\nI'm connecting you with one of our specialists who will be in touch shortly to provide personalized assistance."
        })
      );

      // Should update status to handed_over
      const updateCall = mockDb.update().set.mock.calls[0][0];
      expect(updateCall.status).toBe('handed_over');
      expect(updateCall.handoverReason).toBe('Customer requested financing specialist');
      expect(updateCall.handoverAt).toBeInstanceOf(Date);
      expect(updateCall.lastMessageId).toBe('<reply-456@kunesmacomb.kunesauto.vip>');
    });

    it('should skip generation for already handed over conversations', async () => {
      // Arrange
      mockDb.select().from().where.mockResolvedValue([{
        agentId: 'agent-123',
        leadEmail: 'customer@example.com',
        subject: 'Test inquiry',
        lastMessageId: '<test-123@example.com>',
        status: 'handed_over'
      }]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert
      expect(mockAgentCore.generate).not.toHaveBeenCalled();
      expect(mockMailer.sendEmail).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent conversation', async () => {
      // Arrange
      mockDb.select().from().where.mockResolvedValue([]);

      // Act & Assert
      await expect(conversationEngine.generateResponse('invalid-conv'))
        .rejects.toThrow('Conversation not found: invalid-conv');
    });
  });

  describe('buildReferencesChain', () => {
    it('should build chronological references chain', async () => {
      // Arrange
      mockDb.select().from().where().orderBy().limit.mockResolvedValue([
        { messageId: '<msg-3@example.com>' }, // Most recent first
        { messageId: '<msg-2@example.com>' },
        { messageId: '<msg-1@example.com>' }
      ]);

      mockDb.select().from().where.mockResolvedValue([{
        agentId: 'agent-123',
        leadEmail: 'customer@example.com',
        subject: 'Test inquiry',
        lastMessageId: '<msg-3@example.com>',
        status: 'active'
      }]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert - References should be in chronological order
      const emailCall = mockMailer.sendEmail.mock.calls[0][0];
      expect(emailCall.references).toEqual([
        '<msg-1@example.com>',
        '<msg-2@example.com>',  
        '<msg-3@example.com>'
      ]);
    });
  });
});