import { InboundEmailService } from '../../server/services/inbound-email';

// Mock the signature verification to always pass in tests
jest.spyOn(InboundEmailService as any, 'verifyMailgunSignature').mockReturnValue(true);

// Mock other dependencies
jest.mock('../../server/storage', () => ({
  storage: {
    getConversationsByLead: jest.fn().mockResolvedValue([]),
    createConversation: jest.fn().mockResolvedValue({ id: 'conv-1' }),
  },
}));

jest.mock('../../server/services/conversation-state/MessageThreadingService', () => ({
  messageThreadingService: {
    processMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
  },
}));

describe('InboundEmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores lead messages with correct type', async () => {
    const mockReq = {
      headers: { 'content-type': 'application/json' },
      body: {
        'message-id': '<test-message-id@example.com>',
        sender: 'test@example.com',
        subject: 'Test Subject',
        'stripped-text': 'Test message content',
        timestamp: Date.now(),
        token: 'test-token',
        signature: 'test-signature',
      },
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Mock extractLeadFromEmail to return a lead
    jest.spyOn(InboundEmailService as any, 'extractLeadFromEmail').mockResolvedValue({
      leadId: 'lead-1',
      lead: { campaignId: 'campaign-1' },
    });

    // Mock processAutoResponse
    jest.spyOn(InboundEmailService as any, 'processAutoResponse').mockResolvedValue(undefined);

    const { messageThreadingService } = require('../../server/services/conversation-state/MessageThreadingService');

    await InboundEmailService.handleInboundEmail(mockReq as any, mockRes as any);

    expect(messageThreadingService.processMessage).toHaveBeenCalledWith(
      'conv-1',
      'lead-1',
      'Test message content',
      'lead_msg',
      0,
      expect.any(Object),
      { providerMessageId: 'test-message-id@example.com' }
    );

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Email processed successfully' });
  });

  it('handles duplicate messages', async () => {
    const messageId = 'duplicate-message-id';
    
    const mockReq = {
      headers: { 'content-type': 'application/json' },
      body: {
        'message-id': `<${messageId}@example.com>`,
        sender: 'test@example.com',
        timestamp: Date.now(),
        token: 'test-token',
        signature: 'test-signature',
      },
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // First call should succeed
    await InboundEmailService.handleInboundEmail(mockReq as any, mockRes as any);
    
    // Second call with same message ID should be rejected as duplicate
    await InboundEmailService.handleInboundEmail(mockReq as any, mockRes as any);

    // Check that the second call returned duplicate status
    expect(mockRes.status).toHaveBeenLastCalledWith(202);
    expect(mockRes.json).toHaveBeenLastCalledWith({ message: 'Duplicate message ignored' });
  });
});