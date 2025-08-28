/**
 * Mailgun Adapter (non-breaking)
 *
 * Purpose: Provide a single, normalized interface for sending emails.
 * This file only wraps the existing low-level Mailgun utilities in server/services/mailgun.ts.
 * It does NOT modify any current routes/usages. Safe to add.
 */

import type { EmailOptions } from './mailgun';
import { sendCampaignEmail, sendBulkEmails } from './mailgun';

export type NormalizedSendResult = {
  success: boolean;
  error?: string;
};

export type NormalizedBulkResult = {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
};

/**
 * Send a single email with a normalized return shape.
 *
 * Note: This delegates to server/services/mailgun.ts sendCampaignEmail which returns boolean.
 * If it returns false, we surface a generic error message (no change to underlying behavior).
 */
export async function sendOneNormalized(
  to: string,
  subject: string,
  content: string,
  variables: Record<string, any> = {},
  options: { isAutoResponse?: boolean; domainOverride?: string } = {}
): Promise<NormalizedSendResult> {
  try {
    const ok = await sendCampaignEmail(to, subject, content, variables, options);
    return ok ? { success: true } : { success: false, error: 'Failed to send email' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown send error' };
  }
}

/**
 * Send bulk emails with a normalized return shape (matches low-level util).
 *
 * This simply forwards to server/services/mailgun.ts sendBulkEmails and returns the same shape.
 */
export async function sendBulkNormalized(
  emails: { to: string; subject: string; content: string }[]
): Promise<NormalizedBulkResult> {
  const result = await sendBulkEmails(emails);
  return {
    success: result.success,
    sent: result.sent,
    failed: result.failed,
    errors: result.errors,
  };
}

/**
 * Convenience helper: map EmailOptions -> adapter args.
 * This is optional sugar for future callers.
 */
export async function sendEmailOptionsNormalized(
  opts: EmailOptions & { variables?: Record<string, any>; options?: { isAutoResponse?: boolean; domainOverride?: string } }
): Promise<NormalizedSendResult> {
  const { to, subject, html, text, from, variables, options } = opts;
  // The low-level util expects a single content string; prefer html, fallback to text
  const content = String(html ?? text ?? '');
  const vars = { ...(variables || {}), ...(from ? { from } : {}) };
  return sendOneNormalized(Array.isArray(to) ? to[0] : to, subject, content, vars, options);
}

