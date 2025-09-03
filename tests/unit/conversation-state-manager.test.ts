import { ConversationStateManager } from '../../server/services/conversation-state/ConversationStateManager';
import type { ConversationMessage } from '@shared/schema';

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: class RedisMock {
      private store = new Map<string, string[]>();
      on() { return this; }
      rpush(key: string, ...vals: string[]) {
        const list = this.store.get(key) || [];
        list.push(...vals);
        this.store.set(key, list);
        return Promise.resolve(list.length);
      }
      ltrim(key: string, start: number, stop: number) {
        const list = this.store.get(key) || [];
        const len = list.length;
        const norm = (i: number) => {
          if (i < 0) i = len + i;
          if (i < 0) i = 0;
          if (i >= len) i = len - 1;
          return i;
        };
        if (len === 0) return Promise.resolve('OK');
        start = norm(start);
        stop = norm(stop);
        this.store.set(key, list.slice(start, stop + 1));
        return Promise.resolve('OK');
      }
      lrange(key: string, start: number, stop: number) {
        const list = this.store.get(key) || [];
        const len = list.length;
        const norm = (i: number) => {
          if (i < 0) i = len + i;
          if (i < 0) i = 0;
          if (i >= len) i = len - 1;
          return i;
        };
        if (len === 0) return Promise.resolve([] as string[]);
        start = norm(start);
        stop = norm(stop);
        return Promise.resolve(list.slice(start, stop + 1));
      }
      del(key: string) {
        this.store.delete(key);
        return Promise.resolve(1);
      }
      expire(key: string, seconds: number) {
        return Promise.resolve(1);
      }
    }
  };
});

jest.mock('../../server/storage', () => ({
  storage: { getConversationMessages: jest.fn().mockResolvedValue([]) }
}));

describe('ConversationStateManager context', () => {
  it('stores and retrieves last 5 messages', async () => {
    const manager = new ConversationStateManager();
    const conversationId = 'c1';
    for (let i = 1; i <= 6; i++) {
      const msg: ConversationMessage = {
        id: `m${i}`,
        conversationId,
        senderId: 's',
        content: `msg${i}`,
        messageType: 'text',
        isFromAI: 0,
        createdAt: new Date(),
      } as any;
      await manager.addMessageToHistory(msg);
    }
    const ctx = await manager.getRecentMessages(conversationId);
    expect(ctx).toHaveLength(5);
    expect(ctx.map(m => m.id)).toEqual(['m2','m3','m4','m5','m6']);
  });

  it('falls back to storage when Redis fails', async () => {
    const manager = new ConversationStateManager();
    const mockMessages = [
      { id: 'm1', conversationId: 'c1', content: 'test' } as ConversationMessage
    ];
    
    const storage = (await import('../../server/storage')).storage;
    (storage.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);

    // Redis should be empty, so it should fall back to storage
    const messages = await manager.getRecentMessages('c1', 3);
    expect(messages).toEqual(mockMessages);
    expect(storage.getConversationMessages).toHaveBeenCalledWith('c1', 3);
  });
});