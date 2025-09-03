import express from 'express';
import crypto from 'crypto';
import { dbV2, v2schema } from '../db.js';
import { and, eq, desc } from 'drizzle-orm';
import { makeConversationEngine } from '../services/conversation/factory';
import { normalizeMailgun } from '../services/email/inbound-normalizer';

export const inboundRouter = express.Router();

// Structured logging helper
function log(event: string, data: Record<string, any> = {}) {
  console.log(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    ...data
  }));
}

// Adapter for nested Mailgun event-data.message.headers shape
function adaptIfNested(body: any) {
  const ed = body?.['event-data'];
  const msg = ed?.message;
  const hdrs = msg?.headers || {};

  if (!ed || !msg) return body;

  return {
    // Provide both lowercase keys (for generic code) and canonical header cased keys
    'message-id': hdrs['message-id'] || hdrs['Message-Id'],
    'in-reply-to': hdrs['in-reply-to'] || hdrs['In-Reply-To'],
    references: hdrs['references'] || hdrs['References'],
    'Message-Id': hdrs['Message-Id'] || hdrs['message-id'],
    'In-Reply-To': hdrs['In-Reply-To'] || hdrs['in-reply-to'],
    'References': hdrs['References'] || hdrs['references'],

    // Provide recipient/sender to satisfy normalizer requirements
    sender: hdrs['from'] || hdrs['From'] || body.from || body.sender,
    recipient: hdrs['to'] || hdrs['To'] || body.to || body.recipient,
    from: hdrs['from'] || hdrs['From'] || body.from || body.sender,
    to: hdrs['to'] || hdrs['To'] || body.to || body.recipient,
    subject: hdrs['subject'] || hdrs['Subject'] || msg?.subject || ed?.subject,
    'body-plain': msg['body-plain'] || ed['stripped-text'],
    'body-html': msg['body-html'] || ed['stripped-html'],
    'message-headers': Array.isArray(body['message-headers']) ? body['message-headers'] : (Array.isArray(msg['message-headers']) ? msg['message-headers'] : body['message-headers']),
  };
}

export function verifyMailgunSignature(body: any, signingKey?: string): boolean {
  if (!signingKey) return false;
  const sigObj = body?.signature && typeof body.signature === 'object' ? body.signature : null;
  const timestamp = sigObj?.timestamp || body?.timestamp;
  const token = sigObj?.token || body?.token;
  const signature = sigObj?.signature || body?.signature;
  if (!timestamp || !token || !signature) return false;

  try {
    const data = `${timestamp}${token}`;
    const hmac = crypto.createHmac('sha256', signingKey).update(data).digest('hex');
    if (hmac !== signature) return false;
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(String(timestamp), 10);
    if (Number.isFinite(ts) && Math.abs(now - ts) > 15 * 60) return false;
    return true;
  } catch {
    return false;
  }
}

inboundRouter.post('/mailgun', async (req, res) => {
  try {
    log('inbound_route_start');

    const enabled = process.env.V2_MAILGUN_ENABLED === 'true';
    if (!enabled) return res.status(404).end();

    // Skip signature validation only for localhost requests with bridge header
    const isFromV1Bridge = req.headers['x-forwarded-from'] === 'v1-webhook' && 
                          (req.ip === '127.0.0.1' || req.ip === '::1' || 
                           req.socket.remoteAddress === '127.0.0.1' ||
                           req.socket.remoteAddress === '::ffff:127.0.0.1');
    
    if (!isFromV1Bridge) {
      // Accept either env var name for compatibility
      const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || process.env.MAILGUN_SIGNING_KEY;
      if (!verifyMailgunSignature(req.body, signingKey)) {
        log('inbound_invalid_signature', { hasSigningKey: !!signingKey, ip: req.ip });
        return res.status(401).json({ message: 'invalid signature' });
      }
    } else {
      log('inbound_v1_bridge', { forwarded: true });
    }

    // Apply adapter for nested payloads, then normalize
    const payload = adaptIfNested(req.body);
    // Verbose debug at handler start
    if (process.env.V2_LOG_EVENTS === 'true') {
      const hdrsArr = (payload?.['message-headers'] || payload?.messageHeaders || []) as Array<[string, string]>;
      const hdrs: Record<string, string> = {};
      if (Array.isArray(hdrsArr)) {
        for (const [k, v] of hdrsArr) hdrs[String(k).toLowerCase()] = String(v);
      }
      for (const key of ['Message-Id', 'In-Reply-To', 'References']) {
        const val = (payload as any)[key];
        if (typeof val === 'string') hdrs[key.toLowerCase()] = val;
      }
      console.log('inbound_debug', {
        from: (payload as any).sender || (payload as any).from,
        to: (payload as any).recipient || (payload as any).to,
        subject: (payload as any).subject,
        inReplyTo: hdrs['in-reply-to'],
        references: hdrs['references'],
        messageId: hdrs['message-id']
      });
    }
    let inbound;
    try {
      inbound = normalizeMailgun(payload);
    } catch (normErr) {
      // Fallback parser for unexpected payload shapes
      console.warn('normalizeMailgun_failed', { error: normErr instanceof Error ? normErr.message : String(normErr) });
      inbound = fallbackNormalize(payload);
    }

    log('inbound_normalized', {
      to: inbound.agentDomain,
      msgId: inbound.messageId
    });

    const toLocal = String(inbound.agentLocalPart || '').toLowerCase();
    const toDomain = String(inbound.agentDomain || '').toLowerCase();
    const leadEmail = String(inbound.fromEmail || '').toLowerCase();

    const [agent] = await dbV2
      .select({ id: v2schema.agents.id, name: v2schema.agents.name, domain: v2schema.agents.domain, localPart: v2schema.agents.localPart })
      .from(v2schema.agents)
      .where(and(eq(v2schema.agents.localPart, toLocal), eq(v2schema.agents.domain, toDomain)));

    if (!agent) {
      return res.status(204).end();
    }

    // Conversation linkage: In-Reply-To -> References -> (agent, lead) -> create
    let conversation: { id: string } | undefined;
    let linkage: 'in_reply_to' | 'references' | 'pair' | 'created';

    // 1) Try In-Reply-To
    if (inbound.inReplyTo) {
      const [msg] = await dbV2
        .select({ conversationId: v2schema.messages.conversationId })
        .from(v2schema.messages)
        .where(eq(v2schema.messages.messageId, inbound.inReplyTo))
        .limit(1);
      if (msg?.conversationId) {
        const [conv] = await dbV2
          .select({ id: v2schema.conversations.id })
          .from(v2schema.conversations)
          .where(eq(v2schema.conversations.id, msg.conversationId))
          .limit(1);
        if (conv) {
          conversation = conv;
          linkage = 'in_reply_to';
        }
      }
    }

    // 2) Try References (last to first)
    if (!conversation && Array.isArray(inbound.references) && inbound.references.length) {
      for (let i = inbound.references.length - 1; i >= 0; i--) {
        const ref = inbound.references[i]!;
        const [msg] = await dbV2
          .select({ conversationId: v2schema.messages.conversationId })
          .from(v2schema.messages)
          .where(eq(v2schema.messages.messageId, ref))
          .limit(1);
        if (msg?.conversationId) {
          const [conv] = await dbV2
            .select({ id: v2schema.conversations.id })
            .from(v2schema.conversations)
            .where(eq(v2schema.conversations.id, msg.conversationId))
            .limit(1);
          if (conv) {
            conversation = conv;
            linkage = 'references';
            break;
          }
        }
      }
    }

    // 3) Fallback by (agentId, leadEmail) pair
    if (!conversation) {
      const [conv] = await dbV2
        .select({ id: v2schema.conversations.id })
        .from(v2schema.conversations)
        .where(and(eq(v2schema.conversations.agentId, agent.id), eq(v2schema.conversations.leadEmail, leadEmail)))
        .orderBy(desc(v2schema.conversations.updatedAt))
        .limit(1);
      if (conv) {
        conversation = conv;
        linkage = 'pair';
      }
    }

    // 4) Create if still not found
    if (!conversation) {
      const threadId = inbound.inReplyTo || inbound.messageId || `${Date.now()}-${leadEmail}`;
      const subject = inbound.subject || '(no subject)';
      const [created] = await dbV2
        .insert(v2schema.conversations)
        .values({
          agentId: agent.id,
          leadEmail,
          threadId,
          subject,
          lastMessageId: inbound.messageId,
        })
        .returning({ id: v2schema.conversations.id });
      conversation = created;
      linkage = 'created';
    } else {
      // Keep conversation's lastMessageId updated for threading continuity
      await dbV2
        .update(v2schema.conversations)
        .set({ lastMessageId: inbound.messageId, updatedAt: new Date() })
        .where(eq(v2schema.conversations.id, conversation.id));
    }

    if (process.env.V2_LOG_EVENTS === 'true') {
      log('inbound_conversation_linked', { method: linkage, conversationId: conversation?.id, inReplyTo: inbound.inReplyTo, refs: inbound.references?.length || 0 });
    }

    if (conversation) {
      // Create ConversationEngine with proper DI factory
      const conversationEngine = makeConversationEngine();

      // Process inbound with full email data
      if (process.env.V2_LOG_EVENTS === 'true') {
        console.log('responder_start', { conversationId: conversation.id });
      }
      await conversationEngine.processInbound({
        ...inbound,
        agentId: agent.id,
        conversationId: conversation.id,
      });
    }

    log('inbound_processed', { msgId: inbound.messageId });
    return res.sendStatus(204);

  } catch (err: any) {
    log('inbound_route_error', { err: err.message, stack: err.stack });
    return res.status(500).json({ message: 'inbound processing error' });
  }
});

function fallbackNormalize(body: any) {
  const headers = (body?.['message-headers'] || body?.messageHeaders || []) as Array<[string, string]>;
  const headersObj: Record<string, string> = {};
  for (const [k, v] of headers) headersObj[String(k).toLowerCase()] = String(v);
  const get = (k: string) => headersObj[k.toLowerCase()] || body[k] || body[k.toLowerCase()];
  const to = String(get('To') || '').toLowerCase();
  const [lp, dom] = to.includes('@') ? to.split('@') : ['', ''];
  const refs = String(get('References') || '').split(/[\s<>]+/).filter(Boolean);
  return {
    agentLocalPart: lp,
    agentDomain: dom,
    fromEmail: String(get('From') || body.from || '').toLowerCase().replace(/.*<([^>]+)>.*/, '$1'),
    subject: String(get('Subject') || body.subject || ''),
    text: body.text,
    html: body.html,
    messageId: String(get('Message-Id') || get('Message-ID') || body['Message-Id'] || body.messageId || ''),
    inReplyTo: get('In-Reply-To') || null,
    references: refs,
    rawHeaders: headersObj,
  };
}
