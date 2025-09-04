import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { makeConversationEngine } from '../services/conversation/factory';
import { dbV2, v2schema } from '../db.js';

const router = Router();

// POST /v2/conversations/:id/reply → engine.generateResponse(id) (ignore body)
router.post('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const engine = makeConversationEngine();
    
    await engine.generateResponse(id);
    // Fetch latest lastMessageId for response context
    const [conv] = await dbV2
      .select({ id: v2schema.conversations.id, lastMessageId: v2schema.conversations.lastMessageId })
      .from(v2schema.conversations)
      .where(eq(v2schema.conversations.id, id))
      .limit(1);

    res.json({
      success: true,
      messageId: conv?.lastMessageId || null,
      conversationId: id
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Conversation not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    if (error instanceof Error && error.message.includes('handed_over')) {
      return res.status(409).json({
        success: false,
        error: 'Conversation already handed over'
      });
    }
    
    console.error('[ConversationRoutes] generateResponse error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /v2/conversations/:id → engine.getConversation(id)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const engine = makeConversationEngine();
    
    const conversation = await engine.getConversation(id);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('[ConversationRoutes] getConversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /v2/conversations
// Returns recent conversations for observability/debug UI.
// Optional query params: agentId, status, limit (default 50), includeMessageCounts
router.get('/', async (req, res) => {
  try {
    const { agentId, status, includeMessageCounts } = req.query as {
      agentId?: string;
      status?: string;
      includeMessageCounts?: string;
    };
    const limit = Math.min(parseInt(String((req.query as any).limit ?? '50'), 10) || 50, 200);

    const whereClauses = [] as any[];
    if (agentId) whereClauses.push(eq(v2schema.conversations.agentId, agentId));
    if (status) whereClauses.push(eq(v2schema.conversations.status, status));

    let conversations;

    if (includeMessageCounts === 'true') {
      // Query with detailed message counts
      const result = await dbV2.execute(sql`
        SELECT
          c.id,
          c.agent_id,
          c.lead_email,
          c.subject,
          c.status,
          c.message_count,
          c.last_message_id,
          c.created_at,
          c.updated_at,
          COUNT(CASE WHEN m.sender = 'agent' THEN 1 END) as agent_messages,
          COUNT(CASE WHEN m.sender = 'lead' THEN 1 END) as lead_messages
        FROM conversations_v2 c
        LEFT JOIN messages_v2 m ON c.id = m.conversation_id
        ${agentId ? sql`WHERE c.agent_id = ${agentId}` : sql``}
        ${status ? sql`${agentId ? sql`AND` : sql`WHERE`} c.status = ${status}` : sql``}
        GROUP BY c.id, c.agent_id, c.lead_email, c.subject, c.status, c.message_count, c.last_message_id, c.created_at, c.updated_at
        ORDER BY c.updated_at DESC
        LIMIT ${limit}
      `);

      conversations = result.rows.map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        leadEmail: row.lead_email,
        subject: row.subject,
        status: row.status,
        messageCount: parseInt(row.message_count) || 0,
        lastMessageId: row.last_message_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        agentMessages: parseInt(row.agent_messages) || 0,
        leadMessages: parseInt(row.lead_messages) || 0,
        hasResponses: (parseInt(row.agent_messages) || 0) > 0 && (parseInt(row.lead_messages) || 0) > 0
      }));
    } else {
      // Simple query without detailed message counts
      conversations = await dbV2
        .select({
          id: v2schema.conversations.id,
          agentId: v2schema.conversations.agentId,
          leadEmail: v2schema.conversations.leadEmail,
          subject: v2schema.conversations.subject,
          status: v2schema.conversations.status,
          messageCount: v2schema.conversations.messageCount,
          lastMessageId: v2schema.conversations.lastMessageId,
          createdAt: v2schema.conversations.createdAt,
          updatedAt: v2schema.conversations.updatedAt,
        })
        .from(v2schema.conversations)
        .where(whereClauses.length ? and(...whereClauses) : undefined as any)
        .orderBy(desc(v2schema.conversations.updatedAt))
        .limit(limit);
    }

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('[ConversationRoutes] listConversations error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /v2/conversations/:id/messages
// Returns messages for a conversation ordered by createdAt asc
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await dbV2
      .select({
        id: v2schema.messages.id,
        conversationId: v2schema.messages.conversationId,
        content: v2schema.messages.content,
        sender: v2schema.messages.sender,
        status: v2schema.messages.status,
        messageId: v2schema.messages.messageId,
        inReplyTo: v2schema.messages.inReplyTo,
        references: v2schema.messages.references,
        isHandoverMessage: v2schema.messages.isHandoverMessage,
        createdAt: v2schema.messages.createdAt,
      })
      .from(v2schema.messages)
      .where(eq(v2schema.messages.conversationId, id))
      .orderBy(v2schema.messages.createdAt);

    res.json({ success: true, messages });
  } catch (error) {
    console.error('[ConversationRoutes] getMessages error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /v2/conversations/debug
// Lightweight HTML view for safe, read-only monitoring during campaigns
router.get('/debug', async (req, res) => {
  if (process.env.V2_DEBUG_VIEW_ENABLED !== 'true') {
    return res.status(403).send('Debug view disabled');
  }
  try {
    const limit = Math.min(parseInt(String((req.query as any).limit ?? '20'), 10) || 20, 100);
    const conversations = await dbV2
      .select({
        id: v2schema.conversations.id,
        agentId: v2schema.conversations.agentId,
        leadEmail: v2schema.conversations.leadEmail,
        subject: v2schema.conversations.subject,
        status: v2schema.conversations.status,
        updatedAt: v2schema.conversations.updatedAt,
      })
      .from(v2schema.conversations)
      .orderBy(desc(v2schema.conversations.updatedAt))
      .limit(limit);

    // Fetch last 5 messages for each conversation
    const byConv: Record<string, { id: string; sender: string; content: string; createdAt: Date; status: string }[]> = {};
    for (const c of conversations) {
      const msgs = await dbV2
        .select({
          id: v2schema.messages.id,
          sender: v2schema.messages.sender,
          content: v2schema.messages.content,
          status: v2schema.messages.status,
          createdAt: v2schema.messages.createdAt,
        })
        .from(v2schema.messages)
        .where(eq(v2schema.messages.conversationId, c.id))
        .orderBy(desc(v2schema.messages.createdAt))
        .limit(5);
      byConv[c.id] = msgs.reverse();
    }

    const esc = (s: any) => String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const rows = conversations.map(c => {
      const msgs = byConv[c.id] || [];
      const msgHtml = msgs.map(m => `
        <div class="msg ${m.sender}">
          <div class="meta">${esc(m.sender)} • ${new Date(m.createdAt).toLocaleString()} • ${esc(m.status)}</div>
          <pre>${esc(m.content)}</pre>
        </div>
      `).join('');
      return `
        <section class="conv">
          <div class="header">
            <div class="subject">${esc(c.subject)}</div>
            <div class="lead">${esc(c.leadEmail)}</div>
            <div class="status">${esc(c.status)} • ${new Date(c.updatedAt).toLocaleString()}</div>
          </div>
          <div class="messages">${msgHtml || '<em>No messages yet</em>'}</div>
        </section>
      `;
    }).join('\n');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="5" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OfferLogix V2 • Conversations Debug</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px; background: #f7fafc; }
      h1 { margin: 0 0 12px; font-size: 18px; }
      .conv { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 0 0 12px; }
      .header { display: grid; grid-template-columns: 1fr auto; gap: 8px; border-bottom: 1px solid #edf2f7; padding-bottom: 8px; margin-bottom: 8px; }
      .subject { font-weight: 600; }
      .lead { color: #4a5568; }
      .status { color: #718096; font-size: 12px; }
      .messages { display: flex; flex-direction: column; gap: 6px; }
      .msg { border-left: 3px solid #cbd5e0; padding: 6px 8px; background: #f9fafb; }
      .msg.agent { border-left-color: #4299e1; background: #ebf8ff; }
      .msg.lead { border-left-color: #48bb78; background: #f0fff4; }
      .meta { font-size: 12px; color: #4a5568; margin-bottom: 4px; }
      pre { white-space: pre-wrap; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .small { color: #718096; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <h1>Recent Conversations (limit ${limit})</h1>
      <div class="small">Auto-refreshing every 5s</div>
    </div>
    ${rows || '<p>No conversations yet</p>'}
  </body>
  </html>`);
  } catch (error) {
    console.error('[ConversationRoutes] debugView error:', error);
    res.status(500).send('Debug view error');
  }
});

export default router;
