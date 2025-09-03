/**
 * ConversationEngine Polish Tests
 * 
 * Tests Option A handover pattern, message status transitions, and structured logging.
 */

// Mock heavy deps to avoid loading real db
jest.mock('../db', () => ({
  dbV2: {},
  v2schema: {
    messages: { id: 'id', messageId: 'message_id', createdAt: 'created_at' },
    conversations: {
      id: 'id', agentId: 'agent_id', leadEmail: 'lead_email', subject: 'subject', lastMessageId: 'last_message_id', status: 'status', updatedAt: 'updated_at', threadId: 'thread_id', messageCount: 'message_count'
    }
  }
}));
jest.mock('../services/email/MailgunThreading');
import { ConversationEngine } from '../services/conversation/ConversationEngine';
import { AgentCore } from '../services/agent/AgentCore';
import type { InboundEmail, AgentIdentity } from '../services/email/types';

describe('ConversationEngine Polish', () => {
  let mockDb: any;
  let mockAgentCore: jest.Mocked<AgentCore>;
  let mockMailer: any;
  let mockLoadAgent: any;
  let mockLoadHistory: any;
  let conversationEngine: ConversationEngine;
  let logSpy: jest.SpyInstance;

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
    text: 'I need financing help',
    messageId: '<test-123@example.com>',
    inReplyTo: null,
    references: [],
    rawHeaders: {},
    agentId: 'agent-123',
    conversationId: 'conv-456'
  };

  beforeEach(() => {
    // Mock console.log for structured logging tests
    logSpy = jest.spyOn(console, 'log').mockImplementation();

    // Mock database with proper chaining
    const mockInsert = jest.fn();
    const mockUpdate = jest.fn();
    const mockSelect = jest.fn();

    mockDb = {
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect
    };

    // Default mock setup
    mockSelect.mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValue([]), // No existing message by default
          orderBy: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([
              { messageId: '<msg-1@example.com>' }
            ])
          }))
        }))
      }))
    }));

    mockInsert.mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => ({
        returning: jest.fn().mockResolvedValue([{ id: 'new-message-id' }])
      }))
    }));

    mockUpdate.mockImplementation(() => ({
      set: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockResolvedValue([])
      }))
    }));

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
      vars: { role: 'Sales Associate', dealership: 'Kunes Macomb' },
      identity: mockAgent
    });

    mockLoadHistory = jest.fn().mockResolvedValue([
      { role: 'user', content: 'I need financing help' }
    ]);

    conversationEngine = new ConversationEngine({
      db: mockDb,
      agentCore: mockAgentCore,
      mailer: mockMailer,
      loadAgent: mockLoadAgent,
      loadHistory: mockLoadHistory
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('Option A Handover Pattern', () => {
    it('should send final AI message then set handed_over status', async () => {
      // Arrange - LLM requests handover
      mockAgentCore.generate.mockResolvedValue({
        reply: 'Let me connect you with a specialist.',
        handover: true,
        reason: 'Customer needs financing assistance'
      });

      // Mock conversation status check (not handed over yet)
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // Idempotency check - no existing message
              return { limit: jest.fn().mockResolvedValue([]) };
            } else if (callCount === 2) {
              // Conversation status check - active
              return Promise.resolve([{ status: 'active' }]);
            } else if (callCount === 3) {
              // generateResponse conversation lookup result
              return Promise.resolve([{
                agentId: 'agent-123',
                leadEmail: 'customer@example.com',
                subject: 'Test inquiry',
                lastMessageId: '<test-123@example.com>',
                status: 'active'
              }]);
            } else {
              // references chain query
              return {
                orderBy: jest.fn().mockImplementation(() => ({
                  limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
                }))
              } as any;
            }
          }),
          orderBy: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
          }))
        }))
      }));

      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - AI message sent with handoff note
      expect(mockMailer.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "Let me connect you with a specialist.\n\nI'm connecting you with one of our specialists who will be in touch shortly to provide personalized assistance."
        })
      );

      // Assert - conversation status set to handed_over after sending message
      const updateCalls = mockDb.update().set.mock.calls;
      expect(updateCalls.some((call: any) => 
        call[0].status === 'handed_over' && 
        call[0].handoverReason === 'Customer needs financing assistance'
      )).toBe(true);

      // Assert - message marked as handover message
      const insertCalls = mockDb.insert().values.mock.calls;
      expect(insertCalls.some((call: any) => 
        call[0].isHandoverMessage === true
      )).toBe(true);
    });

    it('should continue normal conversation without handover', async () => {
      // Arrange - Normal AI response
      mockAgentCore.generate.mockResolvedValue({
        reply: 'I can help you with that inquiry.',
        handover: false
      });

      // Mock conversation lookups
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return { limit: jest.fn().mockResolvedValue([]) }; // No existing message
            } else if (callCount === 2) {
              return Promise.resolve([{ status: 'active' }]); // Conversation active
            } else if (callCount === 3) {
              return Promise.resolve([{ // generateResponse lookup
                agentId: 'agent-123',
                leadEmail: 'customer@example.com',
                subject: 'Test inquiry',
                lastMessageId: '<test-123@example.com>',
                status: 'active'
              }]);
            } else {
              return {
                orderBy: jest.fn().mockImplementation(() => ({
                  limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
                }))
              } as any;
            }
          }),
          orderBy: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
          }))
        }))
      }));

      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - Normal AI message sent without handoff note
      expect(mockMailer.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: 'I can help you with that inquiry.'
        })
      );

      // Assert - conversation remains active
      const updateCalls = mockDb.update().set.mock.calls;
      expect(updateCalls.some((call: any) => call[0].status === 'handed_over')).toBe(false);
      expect(updateCalls.some((call: any) => call[0].lastMessageId)).toBe(true); // lastMessageId updated
    });
  });

  describe('Message Status Transitions', () => {
    it('should transition outbound message from pending → sent', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'Thank you for your message.',
        handover: false
      });

      // Mock successful email send
      mockMailer.sendEmail.mockResolvedValue({
        messageId: '<reply-789@kunesmacomb.kunesauto.vip>',
        conversationId: 'conv-456'
      });

      // Setup mocks for conversation flow
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
              return callCount === 1 
                ? { limit: jest.fn().mockResolvedValue([]) }
                : Promise.resolve([{ status: 'active' }]);
            } else if (callCount === 3) {
              return Promise.resolve([{
                agentId: 'agent-123',
                leadEmail: 'customer@example.com', 
                subject: 'Test inquiry',
                lastMessageId: '<test-123@example.com>',
                status: 'active'
              }]);
            } else {
              return {
                orderBy: jest.fn().mockImplementation(() => ({
                  limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
                }))
              } as any;
            }
          }),
          orderBy: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
          }))
        }))
      }));

      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - message inserted with pending status
      const insertCalls = mockDb.insert().values.mock.calls;
      expect(insertCalls.some((call: any) => 
        call[0].sender === 'agent' && call[0].status === 'pending'
      )).toBe(true);

      // Assert - message updated to sent status after successful send
      const updateCalls = mockDb.update().set.mock.calls;
      expect(updateCalls.some((call: any) => 
        call[0].status === 'sent' && call[0].messageId === '<reply-789@kunesmacomb.kunesauto.vip>'
      )).toBe(true);
    });

    it('should set message status to failed on transport error', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'Thank you for your message.',
        handover: false
      });

      // Mock email send failure
      mockMailer.sendEmail.mockRejectedValue(new Error('Transport error'));

      // Setup mocks
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
              return callCount === 1 
                ? { limit: jest.fn().mockResolvedValue([]) }
                : Promise.resolve([{ status: 'active' }]);
            } else if (callCount === 3) {
              return Promise.resolve([{
                agentId: 'agent-123',
                leadEmail: 'customer@example.com',
                subject: 'Test inquiry', 
                lastMessageId: '<test-123@example.com>',
                status: 'active'
              }]);
            } else {
              return {
                orderBy: jest.fn().mockImplementation(() => ({
                  limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
                }))
              } as any;
            }
          }),
          orderBy: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
          }))
        }))
      }));

      // Act & Assert
      await expect(conversationEngine.processInbound(mockInbound)).rejects.toThrow('Transport error');

      // Assert - message status set to failed
      const updateCalls = mockDb.update().set.mock.calls;
      expect(updateCalls.some((call: any) => call[0].status === 'failed')).toBe(true);
    });
  });

  describe('Structured Logging', () => {
    it('should log structured events throughout the flow', async () => {
      // Arrange
      mockAgentCore.generate.mockResolvedValue({
        reply: 'Thank you for your message.',
        handover: false
      });

      // Setup mocks for successful flow
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
              return callCount === 1 
                ? { limit: jest.fn().mockResolvedValue([]) }
                : Promise.resolve([{ status: 'active' }]);
            } else if (callCount === 3) {
              return Promise.resolve([{
                agentId: 'agent-123',
                leadEmail: 'customer@example.com',
                subject: 'Test inquiry',
                lastMessageId: '<test-123@example.com>',
                status: 'active'
              }]);
            } else {
              return {
                orderBy: jest.fn().mockImplementation(() => ({
                  limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
                }))
              } as any;
            }
          }),
          orderBy: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
          }))
        }))
      }));

      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - structured log events were emitted
      const logCalls = logSpy.mock.calls.map(call => call[0]);
      
      // Check for key events
      expect(logCalls.some(log => 
        log.includes('inbound_stored') && 
        log.includes('conv-456') &&
        log.includes('agent-123')
      )).toBe(true);
      
      expect(logCalls.some(log => 
        log.includes('llm_generated') && 
        log.includes('conv-456')
      )).toBe(true);
      
      expect(logCalls.some(log => 
        log.includes('outbound_sent') && 
        log.includes('conv-456')
      )).toBe(true);
    });

    it('should log handover events with reason', async () => {
      // Arrange - handover scenario
      mockAgentCore.generate.mockResolvedValue({
        reply: 'Let me connect you with a specialist.',
        handover: true,
        reason: 'Complex financing inquiry'
      });

      // Setup mocks
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
              return callCount === 1 
                ? { limit: jest.fn().mockResolvedValue([]) }
                : Promise.resolve([{ status: 'active' }]);
            } else {
              return {
                orderBy: jest.fn().mockImplementation(() => ({
                  limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
                }))
              } as any;
            }
          }),
          orderBy: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([{ messageId: '<msg-1@example.com>' }])
          }))
        }))
      }));

      // Act
      await conversationEngine.processInbound(mockInbound);

      // Assert - handover event logged with reason
      const logCalls = logSpy.mock.calls.map(call => call[0]);
      expect(logCalls.some(log => 
        log.includes('handover_set') && 
        log.includes('Complex financing inquiry')
      )).toBe(true);
    });
  });
});
