import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage module to avoid importing real DB and path aliases
vi.mock('../../storage', () => {
  const fns: any = {
    getLeadByEmail: vi.fn(),
    getConversationsByLead: vi.fn(),
    createConversation: vi.fn(),
    createConversationMessage: vi.fn(),
    getConversationMessages: vi.fn(),
    getActiveAiAgentConfig: vi.fn(),
    createHandover: vi.fn(),
    getCampaign: vi.fn(),
    getLeadsByCampaign: vi.fn(),
  };
  return { storage: fns };
});

// Mock OpenRouter and Mailgun reply
vi.mock('../call-openrouter', () => ({ callOpenRouterJSON: vi.fn() }));
vi.mock('../mailgun-threaded', () => ({ sendThreadedReply: vi.fn(async () => true) }));

describe('InboundEmailService AI loop', async () => {
  const { InboundEmailService } = await import('../inbound-email');
  const storageMod: any = await import('../../storage');
  const openrouter: any = await import('../call-openrouter');
  const mailgunThread: any = await import('../mailgun-threaded');

  const baseEvent = {
    sender: 'lead@example.com',
    recipient: 'campaign-123@mg.example.com',
    subject: 'Re: Hello',
    'body-plain': 'I am interested',
    'stripped-text': 'I am interested',
    'message-headers': JSON.stringify([[ 'Message-Id', '<abc@mg>' ]])
  } as any;

  const conversation = { id: 'c1' } as any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('replies when should_reply=true and handover=false', async () => {
    storageMod.storage.getCampaign.mockResolvedValue({ id: '123' });
    storageMod.storage.getLeadsByCampaign.mockResolvedValue([{ id: 'lead1', email: 'lead@example.com' }]);
    storageMod.storage.getConversationsByLead.mockResolvedValue([]);
    storageMod.storage.createConversation.mockResolvedValue(conversation);
    storageMod.storage.createConversationMessage.mockResolvedValue({});
    storageMod.storage.getConversationMessages.mockResolvedValue([]);
    storageMod.storage.getActiveAiAgentConfig.mockResolvedValue({ agentEmailDomain: 'mg.example.com' });

    openrouter.callOpenRouterJSON.mockResolvedValue({ should_reply: true, handover: false, reply_subject: 'Re: Hello', reply_body_html: '<p>Hi</p>' });

    const req: any = { headers: { 'content-type': 'application/json' }, body: { ...baseEvent, timestamp: Date.now(), token: 't', signature: 's' } };
    vi.spyOn(InboundEmailService as any, 'verifyMailgunSignature').mockReturnValue(true);
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await InboundEmailService.handleInboundEmail(req, res);

    expect(mailgunThread.sendThreadedReply).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Email processed and replied' });
  });

  it('creates handover when handover=true', async () => {
    storageMod.storage.getCampaign.mockResolvedValue({ id: '123' });
    storageMod.storage.getLeadsByCampaign.mockResolvedValue([{ id: 'lead1', email: 'lead@example.com' }]);
    storageMod.storage.getConversationsByLead.mockResolvedValue([{ id: 'c1' }]);
    storageMod.storage.createConversationMessage.mockResolvedValue({});
    storageMod.storage.getConversationMessages.mockResolvedValue([]);

    openrouter.callOpenRouterJSON.mockResolvedValue({ should_reply: false, handover: true, rationale: 'handover' });

    const req: any = { headers: { 'content-type': 'application/json' }, body: { ...baseEvent, timestamp: Date.now(), token: 't', signature: 's' } };
    vi.spyOn(InboundEmailService as any, 'verifyMailgunSignature').mockReturnValue(true);
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await InboundEmailService.handleInboundEmail(req, res);
    expect(storageMod.storage.createHandover).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Handover created' });
  });
});

