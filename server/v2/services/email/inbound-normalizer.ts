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
  
  // Additional fields from Mailgun
  'stripped-text'?: string;       // Text with signatures removed
  'stripped-html'?: string;       // HTML with signatures removed
}

// ============================================================================
// EMAIL ADDRESS PARSING
// ============================================================================

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
  if (body['message-headers']) {
    for (const [key, value] of body['message-headers']) {
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
 * Parse References header into array
 */
function parseReferences(referencesHeader?: string): string[] {
  if (!referencesHeader || typeof referencesHeader !== 'string') {
    return [];
  }
  
  // References format: "<msg1@domain> <msg2@domain> <msg3@domain>"
  const references = referencesHeader
    .trim()
    .split(/\s+/)
    .map(ref => ref.trim())
    .filter(ref => ref.length > 0 && ref.includes('@'))
    .map(ref => {
      // Ensure proper <> wrapping
      if (!ref.startsWith('<') || !ref.endsWith('>')) {
        return ref.includes('<') && ref.includes('>') ? ref : `<${ref}>`;
      }
      return ref;
    });
  
  return references;
}

/**
 * Clean and validate Message-ID format
 */
function normalizeMessageId(messageId?: string): string {
  if (!messageId || typeof messageId !== 'string') {
    throw new Error('Missing Message-ID header');
  }
  
  let cleaned = messageId.trim();
  
  // Ensure proper <> wrapping
  if (!cleaned.startsWith('<') || !cleaned.endsWith('>')) {
    cleaned = `<${cleaned}>`;
  }
  
  // Basic validation
  if (!cleaned.includes('@')) {
    throw new Error(`Invalid Message-ID format: ${cleaned}`);
  }
  
  return cleaned;
}

// ============================================================================
// MAIN NORMALIZER
// ============================================================================

/**
 * Normalize Mailgun webhook payload into InboundEmail
 */
export function normalizeMailgun(body: any): InboundEmail {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid webhook body');
  }
  
  const mailgunBody = body as MailgunWebhookBody;
  
  // Extract required fields - handle both formats (recipient/sender OR to/from)
  const recipient = mailgunBody.recipient || (mailgunBody as any).to;
  const sender = mailgunBody.sender || (mailgunBody as any).from;
  const subject = mailgunBody.subject;
  
  if (!recipient || !sender || !subject) {
    throw new Error('Missing required fields: recipient/to, sender/from, or subject');
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
    const messageId = normalizeMessageId(headers['message-id'] || mailgunBody['Message-Id']);
    
    // Parse In-Reply-To
    const inReplyToRaw = headers['in-reply-to'] || mailgunBody['In-Reply-To'];
    const inReplyTo = inReplyToRaw ? normalizeMessageId(inReplyToRaw) : null;
    
    // Parse References chain
    const referencesRaw = headers['references'] || mailgunBody['References'];
    const references = parseReferences(referencesRaw);
    
    // If in-reply-to missing but References present, set inReplyTo = last(refs) for resilience
    let finalInReplyTo = inReplyTo;
    if (!finalInReplyTo && references.length > 0) {
      finalInReplyTo = references[references.length - 1];
    }
    
    // Choose best content (prefer stripped versions, fall back to full)
    const text = mailgunBody['stripped-text'] || mailgunBody['body-plain'];
    const html = mailgunBody['stripped-html'] || mailgunBody['body-html'];
    
    if (!text && !html) {
      throw new Error('No email content found (text or html)');
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
 * Validate normalized email for completeness
 */
export function validateInboundEmail(email: InboundEmail): void {
  const required = ['agentLocalPart', 'agentDomain', 'fromEmail', 'subject', 'messageId'];
  
  for (const field of required) {
    const value = email[field as keyof InboundEmail];
    if (!value || typeof value !== 'string' || !value.trim()) {
      throw new Error(`Invalid or missing field: ${field}`);
    }
  }
  
  // Must have either text or html content
  if (!email.text && !email.html) {
    throw new Error('Email must have either text or html content');
  }
  
  // Validate email formats
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const fullAgentEmail = `${email.agentLocalPart}@${email.agentDomain}`;
  
  if (!emailRegex.test(fullAgentEmail)) {
    throw new Error(`Invalid agent email format: ${fullAgentEmail}`);
  }
  
  if (!emailRegex.test(email.fromEmail)) {
    throw new Error(`Invalid sender email format: ${email.fromEmail}`);
  }
  
  // Validate Message-ID format
  if (!email.messageId.includes('@') || !email.messageId.startsWith('<') || !email.messageId.endsWith('>')) {
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
