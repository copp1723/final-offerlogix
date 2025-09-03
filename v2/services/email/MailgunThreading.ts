// server/v2/services/conversation/ConversationEngine.ts
export interface ConversationDeps {
  db: any;
  loadHistory: (conversationId: string) => Promise<any[]>;
  openai: any;
  logger?: (event: string, meta: Record<string, any>) => void;
}

export class ConversationEngine {
  constructor(private deps: ConversationDeps) {}

  private logEvent(event: string, data: Record<string, any>) {
    const logData = { timestamp: new Date().toISOString(), event, ...data };
    if (this.deps.logger) {
      this.deps.logger(event, logData);
    } else {
      // Structured logging for observability
      // eslint-disable-next-line no-console
      console.log(`[V2][ConversationEngine] ${JSON.stringify(logData)}`);
    }
  }

  async getConversation(id: string) {
    const [row] = await this.deps.db
      .select({
        id: v2schema.conversations.id,
        agentId: v2schema.conversations.agentId,
        leadEmail: v2schema.conversations.leadEmail,
        subject: v2schema.conversations.subject,
        status: v2schema.conversations.status,
        lastMessageId: v2schema.conversations.lastMessageId,
        updatedAt: v2schema.conversations.updatedAt
      })
      .from(v2schema.conversations)
      .where(eq(v2schema.conversations.id, id))
      .limit(1);
    return row || null;
  }

  // ... existing static methods and other class members ...
}


// server/v2/services/conversation/factory.ts
import { ConversationEngine } from './ConversationEngine';

export function makeConversationEngine() {
  const loadHistory = async (conversationId: string) => {
    // ... implementation ...
  };

  return new ConversationEngine({
    db,
    openai,
    loadHistory,
    logger: (event, meta) => {
      // default lightweight logger; replace with AgentOps/observability sink if desired
      // keep single line JSON for easy grep
      if (process.env.V2_LOG_EVENTS === 'true') {
        // eslint-disable-next-line no-console
        console.log(`[V2][CE][${event}] ${JSON.stringify(meta)}`);
      }
    },
  });
}


// server/v2/routes/conversations.ts
import express from 'express';
import { makeConversationEngine } from '../services/conversation/factory';

export const conversationsRouter = express.Router();
const engine = makeConversationEngine();

// Manual reply trigger (ignores text for now; engine signature doesn't consume it)
conversationsRouter.post('/:id/reply', async (req, res) => {
  const { id } = req.params;
  try {
    const result: any = await engine.generateResponse(id);
    return res.status(200).json({
      messageId: result?.messageId ?? null,
      handover: Boolean(result?.handover)
    });
  } catch (err: any) {
    if (err?.code === 'HANDOVER_LOCKED') {
      return res.status(409).json({ message: 'Conversation handed over' });
    }
    if (err?.code === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    return res.status(500).json({ message: 'Internal error' });
  }
});

// Minimal getter
conversationsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const convo = await engine.getConversation(id);
  if (!convo) return res.status(404).json({ message: 'Not found' });
  return res.status(200).json(convo);
});


// server/v2/routes/index.ts
import { Router } from 'express';
import { conversationsRouter } from './conversations';
// ... other imports ...

export const v2 = Router();

// ... other router mounts ...

v2.use('/conversations', conversationsRouter);
