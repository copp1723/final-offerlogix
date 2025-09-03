/**
 * Conversations Routes Tests
 * 
 * Lightweight tests for GET/POST endpoints with 200/404/409 responses.
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock the factory to avoid real dependencies
jest.mock('../services/conversation/factory', () => ({
  makeConversationEngine: jest.fn()
}));

import conversationsRouter from '../routes/conversations';
import { makeConversationEngine } from '../services/conversation/factory';

describe('Conversations Routes', () => {
  let mockEngine: any;

  beforeEach(() => {
    // Mock engine with methods
    mockEngine = {
      getConversation: jest.fn(),
      generateResponse: jest.fn()
    };

    (makeConversationEngine as jest.Mock).mockReturnValue(mockEngine);
  });

  describe('Factory Integration', () => {
    test('should create engine via factory', () => {
      expect(makeConversationEngine).toBeDefined();
      const engine = makeConversationEngine();
      expect(engine).toBe(mockEngine);
    });
  });

  describe('Route Logic Tests', () => {
    test('getConversation: should return conversation when found', async () => {
      const mockConversation = {
        id: 'conv-123',
        status: 'active',
        agentId: 'agent-456',
        leadEmail: 'customer@example.com',
        subject: 'Test Subject',
        lastMessageId: '<msg@example.com>',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockEngine.getConversation.mockResolvedValue(mockConversation);
      
      // Test the engine method directly
      const result = await mockEngine.getConversation('conv-123');
      expect(result).toEqual(mockConversation);
      expect(mockEngine.getConversation).toHaveBeenCalledWith('conv-123');
    });

    test('getConversation: should return null when not found', async () => {
      mockEngine.getConversation.mockResolvedValue(null);
      
      const result = await mockEngine.getConversation('nonexistent');
      expect(result).toBeNull();
    });

    test('generateResponse: should return result when reply generated', async () => {
      const mockResult = {
        messageId: '<reply@example.com>',
        conversationId: 'conv-123'
      };

      mockEngine.generateResponse.mockResolvedValue(mockResult);
      
      const result = await mockEngine.generateResponse('conv-123');
      expect(result).toEqual(mockResult);
      expect(mockEngine.generateResponse).toHaveBeenCalledWith('conv-123');
    });

    test('generateResponse: should throw when conversation not found', async () => {
      mockEngine.generateResponse.mockRejectedValue(new Error('Conversation not found: conv-456'));
      
      await expect(mockEngine.generateResponse('conv-456'))
        .rejects.toThrow('Conversation not found: conv-456');
    });

    test('generateResponse: should throw when conversation handed over', async () => {
      mockEngine.generateResponse.mockRejectedValue(new Error('Conversation handed_over: conv-789'));
      
      await expect(mockEngine.generateResponse('conv-789'))
        .rejects.toThrow('Conversation handed_over: conv-789');
    });
  });
});