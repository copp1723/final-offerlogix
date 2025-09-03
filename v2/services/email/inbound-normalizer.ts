/**
 * Inbound Email Normalizer
 *
 * Normalizes Mailgun webhook payloads into consistent InboundEmail format.
 * Handles both JSON fields and MIME header parsing.
 */

import type { InboundEmail } from './types';

// ============================================================================
// MAILGUN PAYLOAD INTERFACES
// ============================================================================

interface MailgunWebhookBody {
  // Core fields (always present)
  recipient: string;              // "riley@kunesmacomb.kunesauto.vip"
  sender: string;                 // "lead@example.com"
  subject: string;                // Email subject

  // Content fields
  'body-plain'?: string;          // Plain text body
  'body-html'?: string;           // HTML body

  // Headers (two possible formats)
  'message-headers'?: Array<[string, string]>; // [["Message-Id", "value"], ...]
  'Message-Id'?: string;          // Direct field access
  'In-Reply-To'?: string;         // Direct field access
  'References'?: string;          // Direct field access

  // Alternative content fields
  'stripped-text'?: string;       // Mailgun stripped text
  'stripped-html'?: string;       // Mailgun stripped HTML

  // Webhook metadata
  timestamp?: number;
  token?: string;
  signature?: string;

  // Allow additional fields
  [key: string]: any;
}

/**
 * Parse email address from various formats
 * Handles: "user@domain.com", "Name <user@domain.com>", etc.
 */
function parseEmailAddress(input: string): { email: string; name?: string } {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid email input');
  }

  const trimmed = input.trim();

  // Format: "Name <user@domain.com>"
  const nameEmailMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (nameEmailMatch) {
    const [, name, email] = nameEmailMatch;
    return {
      email: email.toLowerCase().trim(),
      name: name.trim().replace(/^["']|["']$/g, '') // Remove quotes
    };
  }

  // Format: "user@domain.com"
  const emailMatch = trimmed.match(/^([^@\s]+@[^@\s]+\.[^@\s]+)$/);
  if (emailMatch) {
    return {
      email: emailMatch[1].toLowerCase().trim()
    };
  }

  throw new Error(`Invalid email format: ${input}`);
}

/**
 * Parse domain and local part from email address
 */
function parseEmailParts(email: string): { localPart: string; domain: string } {
  const normalized = email.toLowerCase().trim();
  const atIndex = normalized.lastIndexOf('@');

  if (atIndex === -1) {
    throw new Error(`Invalid email format: ${email}`);
  }

  return {
    localPart: normalized.substring(0, atIndex),
    domain: normalized.substring(atIndex + 1)
  };
}

// ============================================================================
// HEADER PARSING
// ============================================================================

/**
 * Extract headers from Mailgun payload (handles both formats)
 */
function extractHeaders(body: MailgunWebhookBody): Record<string, string> {
  const headers: Record<string, string> = {};

  // Format 1: message-headers array
  const rawHeaders = (body as any)['message-headers'] ?? (body as any)['messageHeaders'];
  let headerPairs: Array<[string, string]> | null = null;
  if (Array.isArray(rawHeaders)) {
    headerPairs = rawHeaders as Array<[string, string]>;
  } else if (typeof rawHeaders === 'string') {
    try {
      const parsed = JSON.parse(rawHeaders);
      if (Array.isArray(parsed)) headerPairs = parsed as Array<[string, string]>;
    } catch {
      // ignore parse error; will rely on direct fields
    }
  }
  if (Array.isArray(headerPairs)) {
    for (const [key, value] of headerPairs) {
      if (typeof key === 'string' && typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      }
    }
  }

  // Format 2: Direct field access (override array values)
  const directHeaders = [
    'Message-Id',
    'In-Reply-To',
    'References',
    'Date',
    'Content-Type'
  ];

  for (const headerName of directHeaders) {
    const value = body[headerName as keyof MailgunWebhookBody];
    if (typeof value === 'string') {
      headers[headerName.toLowerCase()] = value;
    }
  }

  return headers;
}

/**
 * Normalize Message-ID format
 */
function normalizeMessageId(messageId: string): string {
  if (!messageId || typeof messageId !== 'string') {
    throw new Error('Invalid Message-ID');
  }

  const trimmed = messageId.trim();

  // Ensure angle brackets
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return trimmed;
  }

  return `<${trimmed}>`;
}

/**
 * Parse References header into array of Message-IDs
 */
function parseReferences(references?: string): string[] {
  if (!references || typeof references !== 'string') {
    return [];
  }

  // Split on whitespace and angle brackets, filter empty strings
  const refs = references
    .split(/[\s<>]+/)
    .filter(Boolean)
    .map(ref => ref.includes('@') ? normalizeMessageId(ref) : null)
    .filter(Boolean) as string[];

  return refs;
}

/**
 * Determine threading context from headers
 */
function determineThreadingContext(headers: Record<string, string>, references: string[]): {
  finalInReplyTo: string | null;
  isReply: boolean;
} {
  const inReplyTo = headers['in-reply-to'];
  const hasReferences = references.length > 0;

  // If we have In-Reply-To, use it
  if (inReplyTo) {
    return {
      finalInReplyTo: normalizeMessageId(inReplyTo),
      isReply: true
    };
  }

  // If we have References but no In-Reply-To, use the last Reference
  if (hasReferences) {
    return {
      finalInReplyTo: references[references.length - 1],
      isReply: true
    };
  }

  // No threading context
  return {
    finalInReplyTo: null,
    isReply: false
  };
}

/**
 * Normalize Mailgun webhook payload into InboundEmail
 */
export function normalizeMailgun(body: any): InboundEmail {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid webhook body');
  }

  const mailgunBody = body as MailgunWebhookBody;

  // Extract and validate required fields
  if (!mailgunBody.recipient || !mailgunBody.sender || !mailgunBody.subject) {
    throw new Error('Missing required fields: recipient, sender, or subject');
  }

  try {
    // Parse recipient (agent) email
    const recipientInfo = parseEmailAddress(mailgunBody.recipient);
    const agentParts = parseEmailParts(recipientInfo.email);

    // Parse sender (lead) email
    const senderInfo = parseEmailAddress(mailgunBody.sender);

    // Extract headers
    const headers = extractHeaders(mailgunBody);

    // Get Message-ID (required)
    const messageIdRaw = headers['message-id'] || mailgunBody['Message-Id'];
    if (!messageIdRaw) {
      throw new Error('Missing Message-ID in email payload');
    }
    const messageId = normalizeMessageId(messageIdRaw);

    // Parse In-Reply-To
    const inReplyToRaw = headers['in-reply-to'] || mailgunBody['In-Reply-To'];

    // Parse References chain
    const referencesRaw = headers['references'] || mailgunBody['References'];
    const references = parseReferences(referencesRaw);

    // Determine final threading context
    const headersWithInReplyTo = { ...headers, 'in-reply-to': inReplyToRaw || '' };
    const { finalInReplyTo } = determineThreadingContext(headersWithInReplyTo, references);

    // Extract content (prefer stripped versions, fallback to full)
    const text = mailgunBody['stripped-text'] || mailgunBody['body-plain'];
    const html = mailgunBody['stripped-html'] || mailgunBody['body-html'];

    // Validate we have some content
    if (!text && !html) {
      console.warn('No content found in email payload');
    }

    // Build normalized result
    const normalized: InboundEmail = {
      agentLocalPart: agentParts.localPart,
      agentDomain: agentParts.domain,
      fromEmail: senderInfo.email, // Already lowercased in parseEmailAddress
      subject: mailgunBody.subject.trim(),
      text: text?.trim(),
      html: html?.trim(),
      messageId,
      inReplyTo: finalInReplyTo,
      references,
      rawHeaders: headers
    };

    return normalized;

  } catch (error) {
    throw new Error(
      `Failed to normalize Mailgun payload: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate normalized InboundEmail
 */
export function validateInboundEmail(email: InboundEmail): void {
  const required = ['agentLocalPart', 'agentDomain', 'fromEmail', 'subject', 'messageId'];

  for (const field of required) {
    if (!email[field as keyof InboundEmail]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.fromEmail)) {
    throw new Error(`Invalid fromEmail format: ${email.fromEmail}`);
  }

  const agentEmail = `${email.agentLocalPart}@${email.agentDomain}`;
  if (!emailRegex.test(agentEmail)) {
    throw new Error(`Invalid agent email format: ${agentEmail}`);
  }

  // Validate Message-ID format
  if (!email.messageId.startsWith('<') || !email.messageId.endsWith('>')) {
    throw new Error(`Invalid Message-ID format: ${email.messageId}`);
  }
}

/**
 * Clean and sanitize email content
 */
export function sanitizeContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  return content
    .trim()
    .replace(/\r\n/g, '\n')        // Normalize line endings
    .replace(/[ \t]+$/gm, '')        // Trim trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n')    // Collapse excessive newlines
    .substring(0, 50000);          // Reasonable content limit
}
