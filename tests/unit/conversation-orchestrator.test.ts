import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { ConversationOrchestrator } from '../../server/services/conversation-orchestrator.js';
import { setupTestDatabase, cleanupTestDatabase } from '../utils/test-helpers.js';

// Mock the dependencies
jest.mock('../../server/services/conversation-state/ConversationIntegrationManager.js', () => ({
  conversationIntegrationManager: {
    initializeEmailReliabilityIntegration: jest.fn().mockResolvedValue(undefined),
    initializeHandoverIntegration: jest.fn().mockResolvedValue(undefined),
    processIntegrationEvent: jest.fn().mockResolvedValue(true),
    createIntegrationEvent: jest.fn().mockReturnValue({
      id: 'test-event-id',
      type: 'email_delivered',
      conversationId: 'test-conversation-id',
      leadId: 'test-lead-id',
      metadata: {},
      timestamp: new Date(),
      source: 'webhook_orchestrator'
    }),
    getIntegrationStatus: jest.fn().mockResolvedValue({
      conversationId: 'test-conversation-id',
      currentState: 'active',
      emailIntegration: { enabled: true },
      handoverIntegration: { enabled: true }
    })
  }
}));

jest.mock('../../server/storage.js', () => ({
  storage: {
    getConversationsByLead: jest.fn(),
    getConversation: jest.fn(),
    updateConversation: jest.fn()
  }
}));

jest.mock('../../server/logging/logger.js', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('ConversationOrchestrator', () => {
  let orchestrator: ConversationOrchestrator;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(async () => {
    await setupTestDatabase();
    
    orchestrator = new ConversationOrchestrator();
    
    mockRequest = {
      body: {}
    };
    
    mockResponse = {
      locals: {},
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(orchestrator.initialize()).resolves.toBeUndefined();
      
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );
      
      expect(conversationIntegrationManager.initializeEmailReliabilityIntegration).toHaveBeenCalled();
      expect(conversationIntegrationManager.initializeHandoverIntegration).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );
      
      (conversationIntegrationManager.initializeEmailReliabilityIntegration as jest.Mock)
        .mockRejectedValueOnce(new Error('Initialization failed'));

      await expect(orchestrator.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('orchestrateConversation middleware', () => {
    it('should extract conversation context from Mailgun event webhook', async () => {
      const { storage } = await import('../../server/storage.js');
      
      mockRequest.body = {
        'event-data': {
          event: 'delivered',
          recipient: 'test@example.com',
          'user-variables': {
            leadId: 'test-lead-id',
            campaignId: 'test-campaign-id'
          }
        }
      };

      (storage.getConversationsByLead as jest.Mock).mockResolvedValueOnce([
        {
          id: 'test-conversation-id',
          campaignId: 'test-campaign-id',
          status: 'active'
        }
      ]);

      await orchestrator.orchestrateConversation(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.locals).toEqual({
        conversationId: 'test-conversation-id',
        leadId: 'test-lead-id',
        campaignId: 'test-campaign-id'
      });
      
      expect(mockRequest.conversationId).toBe('test-conversation-id');
      expect(mockRequest.leadId).toBe('test-lead-id');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle inbound email webhook', async () => {
      mockRequest.body = {
        sender: 'test@example.com',
        recipient: 'noreply@company.com',
        subject: 'Test Subject'
      };

      await orchestrator.orchestrateConversation(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // For inbound emails, context is extracted during processing
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle webhook without conversation context', async () => {
      mockRequest.body = {
        'event-data': {
          event: 'delivered',
          recipient: 'unknown@example.com'
        }
      };

      await orchestrator.orchestrateConversation(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue processing on errors', async () => {
      const { storage } = await import('../../server/storage.js');
      
      mockRequest.body = {
        'event-data': {
          event: 'delivered',
          'user-variables': { leadId: 'test-lead-id' }
        }
      };

      (storage.getConversationsByLead as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      await orchestrator.orchestrateConversation(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('processConversationEvent', () => {
    it('should process email delivered event', async () => {
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      await orchestrator.processConversationEvent(
        'delivered',
        'test-conversation-id',
        'test-lead-id',
        { messageId: 'test-message-id' }
      );

      expect(conversationIntegrationManager.createIntegrationEvent).toHaveBeenCalledWith(
        'email_delivered',
        'test-conversation-id',
        { messageId: 'test-message-id' },
        'webhook_orchestrator',
        'test-lead-id'
      );

      expect(conversationIntegrationManager.processIntegrationEvent).toHaveBeenCalled();
    });

    it('should process email opened event', async () => {
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      await orchestrator.processConversationEvent(
        'opened',
        'test-conversation-id',
        'test-lead-id',
        { userAgent: 'Test Browser' }
      );

      expect(conversationIntegrationManager.createIntegrationEvent).toHaveBeenCalledWith(
        'email_opened',
        'test-conversation-id',
        { userAgent: 'Test Browser' },
        'webhook_orchestrator',
        'test-lead-id'
      );
    });

    it('should process email clicked event', async () => {
      await orchestrator.processConversationEvent(
        'clicked',
        'test-conversation-id',
        'test-lead-id',
        { url: 'https://example.com' }
      );

      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      expect(conversationIntegrationManager.createIntegrationEvent).toHaveBeenCalledWith(
        'email_clicked',
        expect.any(String),
        expect.any(Object),
        'webhook_orchestrator',
        'test-lead-id'
      );
    });

    it('should process bounced event', async () => {
      await orchestrator.processConversationEvent(
        'failed',
        'test-conversation-id',
        'test-lead-id',
        { reason: 'No such mailbox' }
      );

      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      expect(conversationIntegrationManager.createIntegrationEvent).toHaveBeenCalledWith(
        'email_bounced',
        expect.any(String),
        expect.any(Object),
        'webhook_orchestrator',
        'test-lead-id'
      );
    });

    it('should handle unknown event types', async () => {
      await orchestrator.processConversationEvent(
        'unknown',
        'test-conversation-id',
        'test-lead-id',
        {}
      );

      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      expect(conversationIntegrationManager.createIntegrationEvent).toHaveBeenCalledWith(
        'email_delivered', // Default mapping
        expect.any(String),
        expect.any(Object),
        'webhook_orchestrator',
        'test-lead-id'
      );
    });

    it('should handle processing errors gracefully', async () => {
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      (conversationIntegrationManager.processIntegrationEvent as jest.Mock)
        .mockRejectedValueOnce(new Error('Processing failed'));

      await expect(
        orchestrator.processConversationEvent(
          'delivered',
          'test-conversation-id',
          'test-lead-id',
          {}
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('getConversationStatus', () => {
    it('should return conversation status with integration status', async () => {
      const { storage } = await import('../../server/storage.js');
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      const mockConversation = {
        id: 'test-conversation-id',
        status: 'active',
        leadId: 'test-lead-id'
      };

      (storage.getConversation as jest.Mock).mockResolvedValueOnce(mockConversation);

      const status = await orchestrator.getConversationStatus('test-conversation-id');

      expect(status).toEqual({
        ...mockConversation,
        integrationStatus: expect.any(Object)
      });

      expect(storage.getConversation).toHaveBeenCalledWith('test-conversation-id');
      expect(conversationIntegrationManager.getIntegrationStatus).toHaveBeenCalledWith('test-conversation-id');
    });

    it('should handle non-existent conversation', async () => {
      const { storage } = await import('../../server/storage.js');

      (storage.getConversation as jest.Mock).mockResolvedValueOnce(null);

      const status = await orchestrator.getConversationStatus('non-existent-id');

      expect(status).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const { storage } = await import('../../server/storage.js');

      (storage.getConversation as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      const status = await orchestrator.getConversationStatus('test-conversation-id');

      expect(status).toBeNull();
    });
  });

  describe('coordinateHandover', () => {
    it('should coordinate handover successfully', async () => {
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      const result = await orchestrator.coordinateHandover(
        'test-conversation-id',
        'test-lead-id',
        { reason: 'Customer request' }
      );

      expect(result).toBe(true);
      expect(conversationIntegrationManager.createIntegrationEvent).toHaveBeenCalledWith(
        'handover_requested',
        'test-conversation-id',
        { reason: 'Customer request' },
        'conversation_orchestrator',
        'test-lead-id'
      );
    });

    it('should handle handover coordination errors', async () => {
      const { conversationIntegrationManager } = await import(
        '../../server/services/conversation-state/ConversationIntegrationManager.js'
      );

      (conversationIntegrationManager.processIntegrationEvent as jest.Mock)
        .mockRejectedValueOnce(new Error('Handover failed'));

      const result = await orchestrator.coordinateHandover(
        'test-conversation-id',
        'test-lead-id',
        {}
      );

      expect(result).toBe(false);
    });
  });
});