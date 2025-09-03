export class OpenRouterClient {
  constructor(private key: string, private model = process.env.OPENROUTER_MODEL || 'gpt-4.1-mini') {}

  async chatJSON(args: {
    system: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    user: string;
  }) {
    const body = {
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: args.system },
        ...args.history,
        { role: 'user', content: args.user },
      ],
    };
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`openrouter ${r.status}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content ?? '';
  }
}

