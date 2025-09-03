/**
 * Email Threading Types for MailMind V2
 * 
 * Core contracts for deterministic email threading with agent identity.
 */

// ============================================================================
// AGENT IDENTITY
// ============================================================================

export interface AgentIdentity {
  id: string;
  name: string;        // "Riley Donovan"
  domain: string;      // "kunesmacomb.kunesauto.vip"
  localPart: string;   // "riley"
}

// ============================================================================
// EMAIL OPERATIONS
// ============================================================================

export interface OutboundArgs {
  agent: AgentIdentity;
  to: string;
  subject: string;
  html: string;                 // Already sanitized upstream
  inReplyTo?: string;           // lastMessageId from conversation
  references?: string[];        // Prior message chain
  conversationId?: string;      // For database updates
  messageId?: string;           // Pre-generated Message-ID
}

export interface OutboundResult {
  messageId: string;            // Generated Message-ID
  conversationId: string;       // Created or updated conversation
}

export interface InboundEmail {
  agentLocalPart: string;       // Parsed from "To" header
  agentDomain: string;          // Parsed from "To" header
  fromEmail: string;            // Lead email address (normalized)
  subject: string;              // Email subject line
  text?: string;                // Plain text content
  html?: string;                // HTML content
  messageId: string;            // Email Message-ID header
  inReplyTo?: string | null;    // In-Reply-To header value
  references?: string[];        // Parsed References chain
  rawHeaders: Record<string, string>; // All email headers
}

// ============================================================================
// TRANSPORT LAYER
// ============================================================================

export interface EmailTransportPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

// Alias used by tests and transport adapters
export type RawEmailPayload = EmailTransportPayload;

export interface EmailTransportResult {
  id: string;                   // Provider message ID
}

export interface EmailTransport {
  sendRaw(payload: EmailTransportPayload): Promise<EmailTransportResult>;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface EmailTransportError extends Error {
  code: 'RATE_LIMIT' | 'INVALID_DOMAIN' | 'REJECTED' | 'NETWORK_ERROR' | 'UNKNOWN';
  retryable: boolean;
  retryAfter?: number;           // Seconds to wait before retry
  providerResponse?: any;        // Original error from transport
}

export { ThreadingError } from './ThreadingError';

// ============================================================================
// THREADING DIAGNOSTICS
// ============================================================================

export interface ThreadDiagnostic {
  conversationId: string;
  messageCount: number;
  chainIntegrity: 'complete' | 'broken' | 'missing_links';
  duplicateMessageIds: string[];
  chronologyIssues: Array<{
    messageId: string;
    issue: 'out_of_order' | 'missing_parent';
  }>;
  lastMessageId?: string;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface ConversationLookup {
  agentId: string;
  leadEmail: string;
  threadId?: string;             // Optional thread identifier
  subject?: string;              // For subject-based threading
}

export interface ConversationResult {
  conversationId: string;
  threadId: string;
  lastMessageId?: string;
  isNewConversation: boolean;
}
