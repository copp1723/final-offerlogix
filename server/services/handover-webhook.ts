import crypto from 'crypto';

export interface HandoverWebhookOptions {
  url: string;
  secret?: string;
  timeoutMs?: number;
  maxAttempts?: number;
}

export async function sendHandoverWebhook(payload: any, options: HandoverWebhookOptions): Promise<{ delivered: boolean; status?: number; error?: string; attempts: number[] }> {
  const { url, secret, timeoutMs = 4000, maxAttempts = 3 } = options;
  const bodyNoSig = { ...payload };
  let signature: string | undefined;
  if (secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(bodyNoSig));
    signature = hmac.digest('base64');
  }
  const finalBody = { ...bodyNoSig, signature };
  const attempts: number[] = [];
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalBody),
        signal: controller.signal
      });
      clearTimeout(t);
      attempts.push(res.status);
      if (res.ok) return { delivered: true, status: res.status, attempts };
    } catch (e) {
      attempts.push(-1);
    }
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
  }
  return { delivered: false, error: 'Failed to deliver after retries', attempts };
}
