import { createHmac, randomUUID } from 'crypto';

export function signMailgun(payload: any, ts: string, key: string) {
  const timestamp = ts || Math.floor(Date.now() / 1000).toString();
  const token = randomUUID();
  const signature = createHmac('sha256', key).update(timestamp + token).digest('hex');
  return {
    headers: { 'content-type': 'application/json' },
    body: {
      signature: { timestamp, token, signature },
      'event-data': payload,
    },
  };
}