/**
 * Unit tests for Campaign Orchestrator
 */

import { CampaignOrchestrator, CampaignExecutionOptions, CampaignExecutionResult } from '../../server/services/campaign-execution/CampaignOrchestrator';

// Mock all external dependencies
jest.mock('../../server/storage', () => ({
  storage: {
    getCampaign: jest.fn(),
    getLeads: jest.fn(),
    updateCampaign: jest.fn(),
    updateLead: jest.fn(),
  }
}));

jest.mock('../../server/services/websocket', () => ({
  webSocketService: {
    broadcast: jest.fn(),
    emit: jest.fn(),
  }
}));

jest.mock('../../server/services/user-notification', () => ({
  userNotificationService: {
    sendNotification: jest.fn(),
  }
}));

// Mock the dynamically imported modules
jest.mock('../../server/services/campaign-execution/ExecutionProcessor', () => ({
  ExecutionProcessor: jest.fn().mockImplementation(() => ({
    processLeadBatch: jest.fn(),
    validateCampaign: jest.fn(),
  }))
}));

jest.mock('../../server/services/campaign-execution/LeadAssignmentService', () => ({
  LeadAssignmentService: jest.fn().mockImplementation(() => ({
    assignLeadsToCampaign: jest.fn(),
    getEligibleLeads: jest.fn(),
  }))
}));

import { storage } from '../../server/storage';
import { webSocketService } from '../../server/services/websocket';
import { userNotificationService } from '../../server/services/user-notification';

describe('CampaignOrchestrator', () => {
  let orchestrator: CampaignOrchestrator;

  beforeEach(() => {
    orchestrator = new CampaignOrchestrator();
    jest.clearAllMocks();
  });

  describe('executeCampaign', () => {
    const mockCampaign = {
      id: 'campaign-123',
      name: 'Test Campaign',
      status: 'active',
      templates: [
        { id: 'template-1', subject: 'Welcome!', content: 'Hello {firstName}!' }
      ],
      numberOfTemplates: 1,
      daysBetweenMessages: 3
    };

    const mockLeads = [
      {
        id: 'lead-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'new'
      },
      {
        id: 'lead-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        status: 'new'
      }
    ];

    it('should successfully execute a campaign with valid options', async () => {
      // Setup mocks
      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);
      (storage.getLeads as jest.Mock).mockResolvedValue(mockLeads);

      // Mock the ExecutionProcessor and LeadAssignmentService
      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      const { LeadAssignmentService } = await import('../../server/services/campaign-execution/LeadAssignmentService');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      const mockLeadAssignmentService = new LeadAssignmentService();
      
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({ valid: true });
      (mockLeadAssignmentService.getEligibleLeads as jest.Mock).mockResolvedValue(mockLeads);
      (mockExecutionProcessor.processLeadBatch as jest.Mock).mockResolvedValue({
        success: true,
        emailsSent: 2,
        emailsFailed: 0
      });

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123',
        testMode: false
      };

      const result = await orchestrator.executeCampaign(options);

      expect(result.success).toBe(true);
      expect(result.emailsSent).toBe(2);
      expect(result.emailsFailed).toBe(0);
      expect(result.totalLeads).toBe(2);
    });

    it('should handle test mode execution', async () => {
      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);
      (storage.getLeads as jest.Mock).mockResolvedValue(mockLeads.slice(0, 1)); // Only one lead for test

      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      const { LeadAssignmentService } = await import('../../server/services/campaign-execution/LeadAssignmentService');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      const mockLeadAssignmentService = new LeadAssignmentService();
      
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({ valid: true });
      (mockLeadAssignmentService.getEligibleLeads as jest.Mock).mockResolvedValue([mockLeads[0]]);
      (mockExecutionProcessor.processLeadBatch as jest.Mock).mockResolvedValue({
        success: true,
        emailsSent: 1,
        emailsFailed: 0
      });

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123',
        testMode: true
      };

      const result = await orchestrator.executeCampaign(options);

      expect(result.success).toBe(true);
      expect(result.testMode).toBe(true);
      expect(result.totalLeads).toBe(1);
    });

    it('should handle campaign execution with selected lead IDs', async () => {
      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const selectedLeads = [mockLeads[0]]; // Only first lead
      
      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      const { LeadAssignmentService } = await import('../../server/services/campaign-execution/LeadAssignmentService');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      const mockLeadAssignmentService = new LeadAssignmentService();
      
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({ valid: true });
      (mockLeadAssignmentService.getEligibleLeads as jest.Mock).mockResolvedValue(selectedLeads);
      (mockExecutionProcessor.processLeadBatch as jest.Mock).mockResolvedValue({
        success: true,
        emailsSent: 1,
        emailsFailed: 0
      });

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123',
        selectedLeadIds: ['lead-1']
      };

      const result = await orchestrator.executeCampaign(options);

      expect(result.success).toBe(true);
      expect(result.totalLeads).toBe(1);
      expect(mockLeadAssignmentService.getEligibleLeads).toHaveBeenCalledWith(
        'campaign-123',
        expect.objectContaining({
          selectedLeadIds: ['lead-1']
        })
      );
    });

    it('should handle campaign validation failures', async () => {
      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({
        valid: false,
        errors: ['Missing email templates', 'Invalid configuration']
      });

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123'
      };

      const result = await orchestrator.executeCampaign(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing email templates');
      expect(result.errors).toContain('Invalid configuration');
    });

    it('should handle campaign not found error', async () => {
      (storage.getCampaign as jest.Mock).mockResolvedValue(null);

      const options: CampaignExecutionOptions = {
        campaignId: 'nonexistent-campaign'
      };

      const result = await orchestrator.executeCampaign(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Campaign not found');
    });

    it('should handle execution processor errors', async () => {
      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      const { LeadAssignmentService } = await import('../../server/services/campaign-execution/LeadAssignmentService');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      const mockLeadAssignmentService = new LeadAssignmentService();
      
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({ valid: true });
      (mockLeadAssignmentService.getEligibleLeads as jest.Mock).mockResolvedValue(mockLeads);
      (mockExecutionProcessor.processLeadBatch as jest.Mock).mockRejectedValue(
        new Error('Email service unavailable')
      );

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123'
      };

      const result = await orchestrator.executeCampaign(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email service unavailable');
    });

    it('should respect maxLeadsPerBatch setting', async () => {
      const manyLeads = Array.from({ length: 100 }, (_, i) => ({
        id: `lead-${i}`,
        firstName: `User${i}`,
        email: `user${i}@example.com`,
        status: 'new'
      }));

      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      const { LeadAssignmentService } = await import('../../server/services/campaign-execution/LeadAssignmentService');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      const mockLeadAssignmentService = new LeadAssignmentService();
      
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({ valid: true });
      (mockLeadAssignmentService.getEligibleLeads as jest.Mock).mockResolvedValue(manyLeads);
      (mockExecutionProcessor.processLeadBatch as jest.Mock).mockResolvedValue({
        success: true,
        emailsSent: 25,
        emailsFailed: 0
      });

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123',
        maxLeadsPerBatch: 25
      };

      await orchestrator.executeCampaign(options);

      // Should process leads in batches of 25
      expect(mockExecutionProcessor.processLeadBatch).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([]),
        expect.objectContaining({
          batchSize: 25
        })
      );
    });

    it('should emit websocket notifications during execution', async () => {
      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      const { LeadAssignmentService } = await import('../../server/services/campaign-execution/LeadAssignmentService');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      const mockLeadAssignmentService = new LeadAssignmentService();
      
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({ valid: true });
      (mockLeadAssignmentService.getEligibleLeads as jest.Mock).mockResolvedValue(mockLeads);
      (mockExecutionProcessor.processLeadBatch as jest.Mock).mockResolvedValue({
        success: true,
        emailsSent: 2,
        emailsFailed: 0
      });

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123'
      };

      await orchestrator.executeCampaign(options);

      expect(webSocketService.broadcast).toHaveBeenCalledWith(
        'campaign_execution_started',
        expect.objectContaining({
          campaignId: 'campaign-123'
        })
      );

      expect(webSocketService.broadcast).toHaveBeenCalledWith(
        'campaign_execution_completed',
        expect.objectContaining({
          campaignId: 'campaign-123',
          success: true
        })
      );
    });

    it('should send user notifications on completion', async () => {
      (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { ExecutionProcessor } = await import('../../server/services/campaign-execution/ExecutionProcessor');
      const { LeadAssignmentService } = await import('../../server/services/campaign-execution/LeadAssignmentService');
      
      const mockExecutionProcessor = new ExecutionProcessor();
      const mockLeadAssignmentService = new LeadAssignmentService();
      
      (mockExecutionProcessor.validateCampaign as jest.Mock).mockResolvedValue({ valid: true });
      (mockLeadAssignmentService.getEligibleLeads as jest.Mock).mockResolvedValue(mockLeads);
      (mockExecutionProcessor.processLeadBatch as jest.Mock).mockResolvedValue({
        success: true,
        emailsSent: 2,
        emailsFailed: 0
      });

      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123'
      };

      await orchestrator.executeCampaign(options);

      expect(userNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'campaign_completed',
          data: expect.objectContaining({
            campaignId: 'campaign-123',
            emailsSent: 2
          })
        })
      );
    });
  });

  describe('scheduleCampaign', () => {
    it('should schedule a campaign for future execution', async () => {
      const scheduleAt = new Date(Date.now() + 3600000); // 1 hour from now
      
      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123',
        scheduleAt
      };

      const result = await orchestrator.scheduleCampaign(options);

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.message).toContain('scheduled');
    });

    it('should reject scheduling in the past', async () => {
      const scheduleAt = new Date(Date.now() - 3600000); // 1 hour ago
      
      const options: CampaignExecutionOptions = {
        campaignId: 'campaign-123',
        scheduleAt
      };

      const result = await orchestrator.scheduleCampaign(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });
  });

  describe('cancelExecution', () => {
    it('should cancel a scheduled execution', async () => {
      // First schedule an execution
      const scheduleAt = new Date(Date.now() + 3600000);
      const scheduleResult = await orchestrator.scheduleCampaign({
        campaignId: 'campaign-123',
        scheduleAt
      });

      // Then cancel it
      const cancelResult = await orchestrator.cancelExecution(scheduleResult.executionId!);

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.message).toContain('cancelled');
    });

    it('should handle canceling non-existent execution', async () => {
      const result = await orchestrator.cancelExecution('nonexistent-execution');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getExecutionStatus', () => {
    it('should return status of active execution', async () => {
      // Schedule an execution first
      const scheduleAt = new Date(Date.now() + 3600000);
      const scheduleResult = await orchestrator.scheduleCampaign({
        campaignId: 'campaign-123',
        scheduleAt
      });

      const status = await orchestrator.getExecutionStatus(scheduleResult.executionId!);

      expect(status).toMatchObject({
        id: scheduleResult.executionId,
        campaignId: 'campaign-123',
        status: 'pending'
      });
    });

    it('should return null for non-existent execution', async () => {
      const status = await orchestrator.getExecutionStatus('nonexistent-execution');

      expect(status).toBeNull();
    });
  });
});