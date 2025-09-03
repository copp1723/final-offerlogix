import { ConversationMessage, Conversation, Lead } from '@shared/schema';
const mockStorage: any = {};
jest.mock('../../server/storage', () => ({ storage: mockStorage }));
jest.mock('../../server/services/reliable-email-service', () => ({
  sendReliableCampaignEmail: jest.fn(),
}));
import { ConversationResponderService } from '../../server/services/conversation-responder';
const mockStateManager: any = {
  getRecentMessages: jest.fn(),
  addMessageToHistory: jest.fn(),
};

describe('ConversationResponderService', () => {
  const leadMsg: ConversationMessage = {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'lead1',
    content: 'Hello',
    messageType: 'text',
    isFromAI: 0,
    createdAt: new Date(),
  } as any;

  const conversation: Conversation = {
    id: 'c1',
    subject: 'Hi',
    status: 'active',
    priority: 'normal',
    userId: 'u1',
    leadId: 'lead1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const lead: Lead = {
    id: 'lead1',
    email: 'lead@example.com',
    clientId: 'client1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('responds to new lead message and queues email', async () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    Object.assign(mockStorage, {
      getLeadMessagesSince: jest.fn().mockResolvedValue([leadMsg]),
      getConversation: jest.fn().mockResolvedValue(conversation),
      getLead: jest.fn().mockResolvedValue(lead),
      createConversationMessage: jest
        .fn()
        .mockImplementation(async (m: any) => ({ ...m, id: 'ai1', createdAt: new Date() })),
      getConsecutiveAiReplies: jest.fn().mockResolvedValue(0),
    });
    mockStateManager.getRecentMessages.mockResolvedValue([leadMsg]);
    mockStateManager.addMessageToHistory.mockResolvedValue(undefined);
    const aiProvider = jest.fn().mockResolvedValue('AI reply');
    const emailSender = jest.fn().mockResolvedValue({ success: true });
    const svc = new ConversationResponderService({
      storage: mockStorage,
      aiProvider,
      emailSender,
      stateManager: mockStateManager,
    });
    await svc.processNewLeadMessages();
    expect(aiProvider).toHaveBeenCalled();
    expect(mockStorage.createConversationMessage).toHaveBeenCalledWith(
      expect.objectContaining({ isFromAI: 1, content: 'AI reply' }),
    );
    expect(emailSender).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'lead@example.com', content: 'AI reply' }),
    );
    expect(mockStateManager.addMessageToHistory).toHaveBeenCalledTimes(2);
    expect(mockStateManager.getRecentMessages).toHaveBeenCalledWith('c1', 5);
  });

  it('logs and skips on AI failure', async () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } as any;
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    Object.assign(mockStorage, {
      getLeadMessagesSince: jest.fn().mockResolvedValue([leadMsg]),
      getConversation: jest.fn().mockResolvedValue(conversation),
      getLead: jest.fn().mockResolvedValue(lead),
      createConversationMessage: jest.fn(),
      getConsecutiveAiReplies: jest.fn().mockResolvedValue(0),
    });
    mockStateManager.getRecentMessages.mockResolvedValue([leadMsg]);
    mockStateManager.addMessageToHistory.mockResolvedValue(undefined);
    const aiProvider = jest.fn().mockRejectedValue(new Error('fail'));
    const emailSender = jest.fn();
    const svc = new ConversationResponderService({
      storage: mockStorage,
      aiProvider,
      emailSender,
      logger: logger as any,
      stateManager: mockStateManager,
    });
    await svc.processNewLeadMessages();
    expect(emailSender).not.toHaveBeenCalled();
    expect(mockStorage.createConversationMessage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(mockStateManager.addMessageToHistory).toHaveBeenCalledTimes(1);
  });

  it('blocks when loop guard triggers', async () => {
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() } as any;
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    Object.assign(mockStorage, {
      getLeadMessagesSince: jest.fn().mockResolvedValue([leadMsg]),
      getConsecutiveAiReplies: jest.fn().mockResolvedValue(3),
      getConversation: jest.fn().mockResolvedValue(conversation),
      getLead: jest.fn().mockResolvedValue(lead),
      createConversationMessage: jest.fn(),
    });
    mockStateManager.getRecentMessages.mockResolvedValue([]);
    mockStateManager.addMessageToHistory.mockResolvedValue(undefined);
    const aiProvider = jest.fn();
    const emailSender = jest.fn();
    const svc = new ConversationResponderService({
      storage: mockStorage,
      aiProvider,
      emailSender,
      logger: logger as any,
      stateManager: mockStateManager,
    });
    await svc.processNewLeadMessages();
    expect(aiProvider).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
    expect(mockStorage.createConversationMessage).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(mockStateManager.addMessageToHistory).not.toHaveBeenCalled();
  });
});