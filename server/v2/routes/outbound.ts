import express from 'express';
import { eq } from 'drizzle-orm';
import { dbV2, v2schema } from '../db.js';
import { makeConversationEngine } from '../services/conversation/factory';

export const outboundRouter = express.Router();

type OutboundBody = {
  agentId: string;
  to: string;
  subject: string;
  html: string;
  conversationId?: string;
};

type OutboundResponse = {
  messageId: string;
  conversationId: string;
  from: string;
  replyTo: string;
};

outboundRouter.post('/test', async (req, res) => {
  const enabled = process.env.V2_MAILGUN_ENABLED === 'true';
  if (!enabled) return res.status(404).end();
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'disabled in production' });

  const { agentId, to, subject, html, conversationId } = req.body as OutboundBody;
  if (!agentId || !to || !subject || !html) return res.status(400).json({ message: 'missing fields' });

  const [agent] = await dbV2
    .select({ id: v2schema.agents.id, name: v2schema.agents.name, domain: v2schema.agents.domain, localPart: v2schema.agents.localPart })
    .from(v2schema.agents)
    .where(eq(v2schema.agents.id, agentId));
  if (!agent) return res.status(404).json({ message: 'agent not found' });

  // Use DI factory to construct ConversationEngine (env guards included)
  const engine = makeConversationEngine();

  // Delegate sending via engine using DI mailer
  const result = await engine.sendManualEmail({
    agent: { id: agent.id, name: agent.name, domain: agent.domain, localPart: agent.localPart },
    to,
    subject,
    html,
    conversationId,
  } as any);

  const fromIdentity = `${agent.name} <${agent.localPart}@${agent.domain}>`;
  const replyTo = fromIdentity;
  const payload: OutboundResponse = { messageId: result.messageId, conversationId: result.conversationId, from: fromIdentity, replyTo };
  return res.json(payload);
});
