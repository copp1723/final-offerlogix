/**
 * MailMind V2 - Email Services
 * 
 * Main exports for the V2 email threading and normalization services.
 */

// Core services
export { MailgunThreading } from './MailgunThreading';
export { normalizeMailgun } from './inbound-normalizer';

// Types and interfaces
export type {
  AgentIdentity,
  OutboundArgs,
  OutboundResult,
  InboundEmail,
  EmailTransport,
  RawEmailPayload,
  ConversationContext,
  ConversationLookupResult,
  MessageRecord,
} from './types';
