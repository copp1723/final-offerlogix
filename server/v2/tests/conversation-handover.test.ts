/**
 * ConversationEngine Handover Tests
 * 
 * Tests handover logic and status transitions.
 */

import { ConversationEngine, type ConversationDeps } from '../services/conversation/ConversationEngine';
import { AgentCore } from '../services/agent/AgentCore';

describe('ConversationEngine Handover Logic', () => {
  let mockDb: any;
  let mockAgentCore: jest.Mocked<AgentCore>;
  let mockMailer: any;
  let mockLoadAgent: jest.MockedFunction<ConversationDeps['loadAgent']>;
  let mockLoadHistory: jest.MockedFunction<ConversationDeps['loadHistory']>;
  let conversationEngine: ConversationEngine;

  beforeEach(() => {
    // Mock database with conversation lookup
    mockDb = {
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue([]) }),
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockResolvedValue([{
            agentId: 'agent-123',
            leadEmail: 'customer@example.com',
            subject: 'Test inquiry',
            lastMessageId: '<test-123@example.com>',
            status: 'active'
          }])
        }))
      })),
      update: jest.fn().mockImplementation(() => ({
        set: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockResolvedValue([])
        }))
      }))
    };

    mockAgentCore = {
      generate: jest.fn(),
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
      vars: { 
        role: 'Sales Associate', 
        dealership: 'Kunes Macomb',
        handoverTriggers: 'financing,trade-in,test drive'
      },
      identity: {
        id: 'agent-123',
        name: 'Riley Donovan',
        domain: 'kunesmacomb.kunesauto.vip',
        localPart: 'riley'
      }
    });

    mockLoadHistory = jest.fn().mockResolvedValue([
      { role: 'user', content: 'I need financing options' }
    ]);

    conversationEngine = new ConversationEngine({
      db: mockDb,
      agentCore: mockAgentCore,
      mailer: mockMailer,
      loadAgent: mockLoadAgent,
      loadHistory: mockLoadHistory
    });
  });

  describe('handover triggers', () => {
    it('should trigger handover for financing keywords', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'Let me connect you with our financing specialist.',
        handover: true,
        reason: 'Customer requested financing assistance'
      });

      mockLoadHistory.mockResolvedValue([
        { role: 'user', content: 'I need financing options for a new car' }
      ]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert
      expect(mockAgentCore.generate).toHaveBeenCalledWith({
        systemPrompt: 'You are {{role}} at {{dealership}}.',
        history: [{ role: 'user', content: 'I need financing options for a new car' }],
        variables: { 
          role: 'Sales Associate', 
          dealership: 'Kunes Macomb',
          handoverTriggers: 'financing,trade-in,test drive'
        }
      });

      // Verify handover email content
      expect(mockMailer.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "Let me connect you with our financing specialist.\n\nI'm connecting you with one of our specialists who will be in touch shortly to provide personalized assistance."
        })
      );

      // Verify conversation status update
      const updateCall = mockDb.update().set.mock.calls[0][0];
      expect(updateCall.status).toBe('handed_over');
      expect(updateCall.handoverReason).toBe('Customer requested financing assistance');
      expect(updateCall.handoverAt).toBeInstanceOf(Date);
    });

    it('should trigger handover for trade-in keywords', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'I\'ll connect you with our trade-in specialist.',
        handover: true,
        reason: 'Customer inquired about trade-in'
      });

      mockLoadHistory.mockResolvedValue([
        { role: 'user', content: 'What is my trade-in value?' }
      ]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert
      const updateCall = mockDb.update().set.mock.calls[0][0];
      expect(updateCall.status).toBe('handed_over');
      expect(updateCall.handoverReason).toBe('Customer inquired about trade-in');
    });

    it('should not trigger handover for general inquiries', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'I can help you with information about our vehicles.',
        handover: false
      });

      mockLoadHistory.mockResolvedValue([
        { role: 'user', content: 'What vehicles do you have in stock?' }
      ]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert
      expect(mockMailer.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: 'I can help you with information about our vehicles.'
        })
      );

      // Verify no handover status update
      const updateCall = mockDb.update().set.mock.calls[0][0];
      expect(updateCall.status).toBeUndefined();
      expect(updateCall.handoverReason).toBeUndefined();
      expect(updateCall.handoverAt).toBeUndefined();
    });
  });

  describe('handed over conversation behavior', () => {
    it('should block auto-replies for handed over conversations', async () => {
      // Arrange - conversation already handed over
      mockDb.select().from().where.mockResolvedValue([{
        agentId: 'agent-123',
        leadEmail: 'customer@example.com',
        subject: 'Test inquiry',
        lastMessageId: '<test-123@example.com>',
        status: 'handed_over'
      }]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert - no AI generation or email sending
      expect(mockAgentCore.generate).not.toHaveBeenCalled();
      expect(mockMailer.sendEmail).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should store inbound messages but not reply for handed over conversations', async () => {
      // Arrange
      const inboundData = {
        agentLocalPart: 'riley',
        agentDomain: 'kunesmacomb.kunesauto.vip',
        fromEmail: 'customer@example.com',
        subject: 'Follow up question',
        text: 'I have another question',
        messageId: '<followup-789@example.com>',
        rawHeaders: {},
        agentId: 'agent-123',
        conversationId: 'conv-456'
      };

      // Mock conversation status as handed over
      mockDb.select().from().where.mockResolvedValue([{ status: 'handed_over' }]);

      // Act
      await conversationEngine.processInbound(inboundData);

      // Assert - message stored but no reply generated
      expect(mockDb.insert).toHaveBeenCalled();
      const valuesCall = mockDb.insert().values.mock.calls[0][0];
      expect(valuesCall.content).toBe('I have another question');
      expect(valuesCall.sender).toBe('lead');

      // No AI generation or outbound email
      expect(mockAgentCore.generate).not.toHaveBeenCalled();
      expect(mockMailer.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('conversation status transitions', () => {
    it('should transition from active to handed_over', async () => {
      // Arrange - active conversation
      let conversationStatus = 'active';
      mockDb.select().from().where.mockImplementation(() => 
        Promise.resolve([{
          agentId: 'agent-123',
          leadEmail: 'customer@example.com',
          subject: 'Test inquiry',
          lastMessageId: '<test-123@example.com>',
          status: conversationStatus
        }])
      );

      mockAgentCore.generate.mockResolvedValue({
        reply: 'Connecting you with a specialist.',
        handover: true,
        reason: 'Complex inquiry requires specialist'
      });

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert - status updated to handed_over
      const updateCall = mockDb.update().set.mock.calls[0][0];
      expect(updateCall.status).toBe('handed_over');
      expect(updateCall.handoverReason).toBe('Complex inquiry requires specialist');
      expect(updateCall.handoverAt).toBeInstanceOf(Date);
    });

    it('should preserve handed_over status', async () => {
      // Arrange - already handed over
      mockDb.select().from().where.mockResolvedValue([{
        agentId: 'agent-123',
        leadEmail: 'customer@example.com',
        subject: 'Test inquiry',
        lastMessageId: '<test-123@example.com>',
        status: 'handed_over'
      }]);

      // Act
      await conversationEngine.generateResponse('conv-456');

      // Assert - no status changes attempted
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});