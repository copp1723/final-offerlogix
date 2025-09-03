import { ConversationStateManager } from '../../server/services/conversation-state/ConversationStateManager';

const mockStorage: any = {};
jest.mock('../../server/storage', () => ({ storage: mockStorage }));

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../server/logging/logger', () => mockLogger);

describe('ConversationStateManager cleanupAbandonedConversations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cleans up abandoned conversations and logs', async () => {
    mockStorage.cleanupAbandonedConversations = jest.fn().mockResolvedValue(2);
    const manager = new ConversationStateManager();
    const count = await manager.cleanupAbandonedConversations(1);
    expect(count).toBe(2);
    expect(mockStorage.cleanupAbandonedConversations).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up abandoned conversations', { count: 2 });
  });

  it('handles cleanup errors gracefully', async () => {
    const error = new Error('Database error');
    mockStorage.cleanupAbandonedConversations = jest.fn().mockRejectedValue(error);
    const manager = new ConversationStateManager();
    const count = await manager.cleanupAbandonedConversations(1);
    expect(count).toBe(0);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to cleanup abandoned conversations', { error });
  });

  it('does not log when no conversations are cleaned', async () => {
    mockStorage.cleanupAbandonedConversations = jest.fn().mockResolvedValue(0);
    const manager = new ConversationStateManager();
    const count = await manager.cleanupAbandonedConversations(1);
    expect(count).toBe(0);
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});