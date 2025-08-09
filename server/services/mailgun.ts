export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface BulkEmailResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

// --- Reliability Tunables (env overridable) ---
const MAILGUN_TIMEOUT_MS = Number(process.env.MAILGUN_TIMEOUT_MS ?? 10_000);
const MAILGUN_MAX_RETRIES = Number(process.env.MAILGUN_MAX_RETRIES ?? 3);
const MAILGUN_RETRY_BASE_MS = Number(process.env.MAILGUN_RETRY_BASE_MS ?? 200);
const MAILGUN_MAX_HTML_BYTES = Number(process.env.MAX_EMAIL_HTML_BYTES ?? 500_000); // keep in sync with execution processor
const MAILGUN_BULK_CONCURRENCY = Math.max(1, Number(process.env.MAILGUN_BULK_CONCURRENCY ?? 5));

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function backoff(attempt: number) {
  const capped = Math.min(1500, MAILGUN_RETRY_BASE_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 150);
  return capped + jitter;
}

function capHtmlSize(html?: string): string {
  if (!html) return '';
  const bytes = new TextEncoder().encode(html);
  if (bytes.length <= MAILGUN_MAX_HTML_BYTES) return html;
  const ratio = MAILGUN_MAX_HTML_BYTES / bytes.length;
  const cut = Math.max(0, Math.floor(html.length * ratio) - 1);
  return html.slice(0, cut) + '\n<!-- truncated to stay under size cap -->';
}

function toPlainText(html?: string): string {
  if (!html) return '';
  // very light HTML -> text; avoids heavy DOM work in Node
  const text = html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
                   .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                   .replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();
  return text.slice(0, 100_000); // hard cap safety
}

async function requestWithRetries(url: string, init: RequestInit): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAILGUN_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if ([408, 429].includes(res.status) || res.status >= 500) {
        if (attempt >= MAILGUN_MAX_RETRIES) return res;
        await sleep(backoff(attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= MAILGUN_MAX_RETRIES) throw err;
      await sleep(backoff(attempt));
    }
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers: Promise<void>[] = [];
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await task(items[i], i);
      } catch (e: any) {
        // @ts-ignore
        results[i] = e;
      }
    }
  };
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(run());
  await Promise.all(workers);
  return results;
}

export async function sendCampaignEmail(
  to: string,
  subject: string,
  content: string,
  variables: Record<string, any> = {},
  options: { isAutoResponse?: boolean } = {}
): Promise<boolean> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    if (!apiKey || !domain) {
      console.warn('Mailgun not configured - email not sent');
      return false;
    }

    const toAddr = (to || '').trim();
    if (!toAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
      console.warn(`Mailgun: invalid recipient '${toAddr}'`);
      return false;
    }

    const fromEmail = options.isAutoResponse 
      ? `OneKeel Swarm <noreply@${domain}>`
      : (options?.isAutoResponse === false && typeof variables?.from === 'string' ? variables.from : `OneKeel Swarm <campaigns@${domain}>`);

    const html = capHtmlSize(content || '');
    const text = toPlainText(html);

    const body = new URLSearchParams({
      from: fromEmail,
      to: toAddr,
      subject: subject,
      html,
      text,
      // RFC 8058 compliant headers for deliverability
      'h:List-Unsubscribe': `<mailto:unsubscribe@${domain}?subject=unsubscribe>, <https://${domain}/u/${encodeURIComponent(toAddr)}>`,
      'h:List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'h:Precedence': 'bulk'
    });

    const url = `https://api.mailgun.net/v3/${domain}/messages`;
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body
    };

    const response = await requestWithRetries(url, init);

    if (response.ok) {
      return true;
    } else {
      const errorText = await response.text().catch(() => '');
      console.error(`Mailgun API error ${response.status}:`, errorText);
      return false;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function sendBulkEmails(
  emails: { to: string; subject: string; content: string }[]
): Promise<BulkEmailResult> {
  const result: BulkEmailResult = {
    success: true,
    sent: 0,
    failed: 0,
    errors: []
  };

  const tasks = await runWithConcurrency(emails, MAILGUN_BULK_CONCURRENCY, async (email) => {
    try {
      const ok = await sendCampaignEmail(email.to, email.subject, email.content);
      return { ok, to: email.to };
    } catch (e: any) {
      return { ok: false, to: email.to, err: e instanceof Error ? e.message : 'Unknown error' };
    }
  });

  for (const t of tasks) {
    if (t && (t as any).ok) {
      result.sent++;
    } else {
      result.failed++;
      const to = (t as any)?.to || 'unknown';
      const msg = (t as any)?.err ? String((t as any).err) : 'Failed to send';
      result.errors.push(`Failed to send to ${to}: ${msg}`);
    }
  }

  result.success = result.failed === 0;
  return result;
}

export async function validateEmailAddresses(emails: string[]): Promise<{
  valid: string[];
  invalid: string[];
}> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    if (emailRegex.test(email.trim())) {
      valid.push(email.trim());
    } else {
      invalid.push(email.trim());
    }
  }

  return { valid, invalid };
}