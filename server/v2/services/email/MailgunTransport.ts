export class MailgunTransport {
  constructor(private cfg: { domain: string; base: string; key: string }) {}

  async sendRaw(payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    headers?: Record<string, string>;
    domain?: string; // Override domain for multi-tenant sending
  }): Promise<{ id: string }> {
    const form = new URLSearchParams();
    form.append('from', payload.from);
    form.append('to', payload.to);
    form.append('subject', payload.subject);
    form.append('html', payload.html);
    if (payload.headers) {
      for (const [k, v] of Object.entries(payload.headers)) {
        form.append(`h:${k}`, v);
      }
    }

    // Use override domain for multi-tenant sending, with validation
    const sendingDomain = payload.domain || this.cfg.domain;
    const allowedDomains = (process.env.MAILGUN_ALLOWED_DOMAINS || '').split(',').map(d => d.trim()).filter(Boolean);
    
    // Add default domain to allowed list
    if (this.cfg.domain) {
      allowedDomains.push(this.cfg.domain);
    }
    
    if (allowedDomains.length > 0 && !allowedDomains.includes(sendingDomain)) {
      throw new Error(`Blocked send: domain ${sendingDomain} not in MAILGUN_ALLOWED_DOMAINS`);
    }

    const r = await fetch(`${this.cfg.base}/${sendingDomain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`api:${this.cfg.key}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    if (!r.ok) throw new Error(`mailgun ${r.status}`);
    const j = (await r.json()) as any;
    return { id: j.id };
  }
}

