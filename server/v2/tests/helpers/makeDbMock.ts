/**
 * Database Mock Factory for V2 Tests
 * 
 * Creates a proper mock that mimics Drizzle's chainable API:
 * - select().from().where().limit()
 * - insert().values().returning()
 * - update().set().where()
 * - transaction() support
 * 
 * Supports idempotency test cases:
 * - Case 1: .limit() returns [] → new message path
 * - Case 2: .limit() returns [{ id: 'exists' }] → duplicate path
 */

import { jest } from '@jest/globals';

export interface DbMockConfig {
  // Configure responses for different scenarios
  existingMessages?: any[];
  existingConversations?: any[];
  insertReturns?: any[];
  updateReturns?: any[];
  transactionBehavior?: 'success' | 'rollback';
}

export interface DbMock {
  select: jest.MockedFunction<any>;
  insert: jest.MockedFunction<any>;
  update: jest.MockedFunction<any>;
  transaction: jest.MockedFunction<any>;
  // Reset helpers
  reset: () => void;
  setConfig: (config: DbMockConfig) => void;
}

/**
 * Create a Drizzle-compatible database mock
 */
export function makeDbMock(initialConfig: DbMockConfig = {}): DbMock {
  let config = { ...initialConfig };
  
  // Mock functions
  const mockSelect = jest.fn();
  const mockInsert = jest.fn();
  const mockUpdate = jest.fn();
  const mockTransaction = jest.fn();

  // Helper to reset all mocks
  const reset = () => {
    mockSelect.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();
    mockTransaction.mockClear();
    setupMockBehavior();
  };

  // Helper to update configuration
  const setConfig = (newConfig: DbMockConfig) => {
    config = { ...config, ...newConfig };
    setupMockBehavior();
  };

  // Setup the chainable mock behavior
  const setupMockBehavior = () => {
    let queryContext = { table: '', operation: '' };

    // SELECT chain: select().from().where().limit()
    mockSelect.mockImplementation((fields?: any) => {
      // Detect query type based on fields
      if (fields && fields.status) {
        queryContext = { table: 'conversations', operation: 'status_check' };
      } else {
        queryContext = { table: 'messages', operation: 'idempotency_check' };
      }

      return {
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            // Create the chainable query object
            const queryObj = {
              limit: jest.fn().mockImplementation((...args: any[]) => {
                const limitCount = args[0] as number | undefined;

                if (queryContext.operation === 'idempotency_check') {
                  // Idempotency case logic for messages
                  if (config.existingMessages !== undefined) {
                    const messages = config.existingMessages;
                    return Promise.resolve(limitCount ? messages.slice(0, limitCount) : messages);
                  }
                  return Promise.resolve([]);
                } else if (queryContext.operation === 'status_check') {
                  // Conversation status check
                  if (config.existingConversations && config.existingConversations.length > 0) {
                    const conversations = config.existingConversations;
                    return Promise.resolve(limitCount ? conversations.slice(0, limitCount) : conversations);
                  }
                  return Promise.resolve([]);
                }

                return Promise.resolve([]);
              }),
              orderBy: jest.fn().mockImplementation(() => ({
                limit: jest.fn().mockImplementation((...args: any[]) => {
                  const limitCount = args[0] as number | undefined;
                  // For conversation history queries
                  const conversations = config.existingConversations || [
                    { messageId: '<msg-1@example.com>' },
                    { messageId: '<msg-2@example.com>' }
                  ];
                  return Promise.resolve(limitCount ? conversations.slice(0, limitCount) : conversations);
                })
              }))
            };

            // For direct await (conversation status queries)
            if (queryContext.operation === 'status_check') {
              return Promise.resolve(config.existingConversations || []);
            }

            return queryObj;
          })
        }))
      };
    });

    // INSERT chain: insert().values().returning()
    mockInsert.mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => ({
        returning: jest.fn().mockImplementation(() => {
          const returns = config.insertReturns || [{ id: 'mock-insert-id' }];
          return Promise.resolve(returns);
        }),
        onConflictDoUpdate: jest.fn().mockImplementation(() => ({
          returning: jest.fn().mockImplementation(() => {
            const returns = config.insertReturns || [{ id: 'mock-upsert-id' }];
            return Promise.resolve(returns);
          })
        }))
      }))
    }));

    // UPDATE chain: update().set().where()
    mockUpdate.mockImplementation(() => ({
      set: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => {
          const returns = config.updateReturns || [];
          return Promise.resolve(returns);
        })
      }))
    }));

    // TRANSACTION support
    mockTransaction.mockImplementation(async (...args: any[]) => {
      const callback = args[0] as (tx: any) => Promise<any>;
      if (config.transactionBehavior === 'rollback') {
        throw new Error('Mock transaction rollback');
      }

      // Create a transaction context with the same mock structure
      const txMock = {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate
      };

      return await callback(txMock);
    });
  };

  // Initialize mock behavior
  setupMockBehavior();

  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
    reset,
    setConfig
  };
}

/**
 * Preset configurations for common test scenarios
 */
export const DB_MOCK_PRESETS = {
  // New message scenario - no existing messages
  NEW_MESSAGE: {
    existingMessages: [],
    insertReturns: [{ id: 'new-msg-123' }]
  },
  
  // Duplicate message scenario - existing message found
  DUPLICATE_MESSAGE: {
    existingMessages: [{ id: 'existing-msg-456' }],
    insertReturns: []
  },
  
  // Active conversation with history
  ACTIVE_CONVERSATION: {
    existingMessages: [],
    existingConversations: [
      { messageId: '<msg-1@example.com>', content: 'Hello' },
      { messageId: '<msg-2@example.com>', content: 'How can I help?' }
    ],
    insertReturns: [{ id: 'conv-msg-789' }]
  },
  
  // Handed over conversation
  HANDED_OVER_CONVERSATION: {
    existingMessages: [],
    existingConversations: [
      { status: 'handed_over', agentId: 'agent-1', leadEmail: 'test@example.com' }
    ]
  }
};

/**
 * Create a mock with a preset configuration
 */
export function makeDbMockWithPreset(preset: keyof typeof DB_MOCK_PRESETS): DbMock {
  return makeDbMock(DB_MOCK_PRESETS[preset]);
}
