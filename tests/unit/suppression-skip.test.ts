/**
 * Tests for skipping suppressed leads in ExecutionProcessor
 */

jest.mock('../../server/storage', () => ({
  storage: {
    updateLead: jest.fn(),
    updateCampaign: jest.fn(),
  },
}));

jest.mock('../../server/services/suppression-manager', () => ({
  isEmailSuppressed: jest.fn(),
}));

import { ExecutionProcessor } from '../../server/services/campaign-execution/ExecutionProcessor';
import { isEmailSuppressed } from '../../server/services/suppression-manager';

describe('ExecutionProcessor suppression handling', () => {
  it('skips sending to suppressed leads', async () => {
    (isEmailSuppressed as jest.Mock).mockResolvedValue(true);
    const processor = new ExecutionProcessor();
    const sendSpy = jest
      .spyOn<any, any>(processor as any, 'sendWithReliability')
      .mockResolvedValue(true);

    const campaign: any = {
      id: 'c1',
      name: 'Test',
      templates: [{ subject: 'Hi', content: 'Hello' }],
      clientId: 'client1',
    };
    const lead: any = {
      id: 'l1',
      email: 'test@example.com',
      firstName: 'Test',
    };

    const result = await processor.processEmailSequence(campaign, [lead], 0, { batchSize: 1, delayBetweenEmails: 0 });

    expect(result.emailsSent).toBe(0);
    expect(result.emailsFailed).toBe(0);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(isEmailSuppressed).toHaveBeenCalledWith('test@example.com', 'client1');
  });

  it('sends to non-suppressed leads', async () => {
    (isEmailSuppressed as jest.Mock).mockResolvedValue(false);
    const processor = new ExecutionProcessor();
    const sendSpy = jest
      .spyOn<any, any>(processor as any, 'sendWithReliability')
      .mockResolvedValue(true);

    // Mock the Supermemory integration
    jest.doMock('../../server/integrations/supermemory', () => ({
      MemoryMapper: {
        writeMailEvent: jest.fn().mockResolvedValue(true),
      },
    }));

    const campaign: any = {
      id: 'c1',
      name: 'Test Campaign',
      templates: [{ subject: 'Hi', content: 'Hello {{firstName}}' }],
      clientId: 'client1',
    };
    const lead: any = {
      id: 'l1',
      email: 'test@example.com',
      firstName: 'John',
    };

    const result = await processor.processEmailSequence(campaign, [lead], 0, { 
      batchSize: 1, 
      delayBetweenEmails: 0,
      testMode: true 
    });

    expect(result.emailsSent).toBe(1);
    expect(result.emailsFailed).toBe(0);
    expect(sendSpy).toHaveBeenCalled();
    expect(isEmailSuppressed).toHaveBeenCalledWith('test@example.com', 'client1');
  });

  it('handles mixed suppressed and non-suppressed leads', async () => {
    const processor = new ExecutionProcessor();
    const sendSpy = jest
      .spyOn<any, any>(processor as any, 'sendWithReliability')
      .mockResolvedValue(true);

    // Mock suppression check - first lead suppressed, second not
    (isEmailSuppressed as jest.Mock)
      .mockResolvedValueOnce(true)  // first lead suppressed
      .mockResolvedValueOnce(false); // second lead not suppressed

    const campaign: any = {
      id: 'c1',
      name: 'Test Campaign',
      templates: [{ subject: 'Hi', content: 'Hello {{firstName}}' }],
      clientId: 'client1',
    };
    const leads: any[] = [
      { id: 'l1', email: 'suppressed@example.com', firstName: 'Jane' },
      { id: 'l2', email: 'valid@example.com', firstName: 'John' },
    ];

    const result = await processor.processEmailSequence(campaign, leads, 0, { 
      batchSize: 2, 
      delayBetweenEmails: 0,
      testMode: true 
    });

    expect(result.emailsSent).toBe(1); // Only one email sent
    expect(result.emailsFailed).toBe(0);
    expect(sendSpy).toHaveBeenCalledTimes(1); // Only called for non-suppressed lead
    expect(isEmailSuppressed).toHaveBeenCalledTimes(2);
  });

  it('logs warnings for suppressed emails', async () => {
    (isEmailSuppressed as jest.Mock).mockResolvedValue(true);
    const processor = new ExecutionProcessor();
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const campaign: any = {
      id: 'c1',
      name: 'Test',
      templates: [{ subject: 'Hi', content: 'Hello' }],
      clientId: 'client1',
    };
    const lead: any = {
      id: 'l1',
      email: 'test@example.com',
      firstName: 'Test',
    };

    await processor.processEmailSequence(campaign, [lead], 0, { batchSize: 1, delayBetweenEmails: 0 });

    expect(consoleSpy).toHaveBeenCalledWith('Skipping suppressed email to test@example.com');
    
    consoleSpy.mockRestore();
  });
});