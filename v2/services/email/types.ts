/**
 * MailMind V2 - Email Service Types
 * Deterministic email threading with transport-agnostic interface.
 */

// ============================================================================
// AGENT IDENTITY
// ============================================================================
export interface AgentIdentity {
  id: string;
  name: string;
  domain: string;
  localPart: string;
}

// ============================================================================
// OUTBOUND EMAIL
// ============================================================================
export interface OutboundArgs {
  agent: AgentIdentity;
  to: string;
  subject: string;
  html: string;                 // already sanitized upstream
  inReplyTo?: string;           // lastMessageId from conversation
  references?: string[];        // prior message chain (Message-Id tokens)
}

export interface OutboundResult {
  messageId: string;            // the Message-Id used for this outbound
}

// ============================================================================
// INBOUND EMAIL
// ============================================================================
export interface InboundEmail {
  agentLocalPart: string;       // parsed from "To" header
  agentDomain: string;          // parsed from "To" header
  fromEmail: string;            // lead/sender email address
  subject: string;
  text?: string;
  html?: string;
  messageId: string;            // Message-ID header (as received)
  inReplyTo?: string | null;    // In-Reply-To header (as received)
  references?: string[];        // parsed References header chain (tokens)
  rawHeaders: Record<string, string>;
}

// ============================================================================
// TRANSPORT INTERFACE
// ============================================================================
export interface RawEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export interface EmailTransport {
  sendRaw(payload: RawEmailPayload): Promise<{ id: string }>;
}

// ============================================================================
// CONVERSATION CONTEXT (DB-shape helpers for engine integration)
// ============================================================================
export interface ConversationContext {
  id: string;
  agentId: string;
  leadEmail: string;
  subject: string;
  threadId: string;
  lastMessageId?: string | null;
}

export interface ConversationLookupResult {
  conversation: ConversationContext;
  isNew: boolean;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  content: string;
  sender: 'agent' | 'lead';
  messageId?: string; // may be undefined until transport completes
  inReplyTo?: string | null;
  references?: string | null;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
}
