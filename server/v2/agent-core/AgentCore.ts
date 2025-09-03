export interface LLMResult { reply: string; handover: boolean; reason: string }

type HistoryItem = { role: 'user' | 'assistant'; content: string };

export class AgentCore {
  constructor(
    private deps: {
      fetchJSON: (body: any) => Promise<any>;
      sanitizer: (s: string) => string;
    },
  ) {}

  renderPrompt(globalPrompt: string, vars: Record<string, string>): string {
    let out = String(globalPrompt ?? '');
    for (const [k, v] of Object.entries(vars || {})) {
      const re = new RegExp(`\\{\\{\n?\t?${escapeRegExp(k)}\n?\t?\\}}`, 'g');
      out = out.replace(re, String(v ?? ''));
    }
    return out;
  }

  async generate(params: {
    agentId: string;
    globalPrompt: string;
    vars: Record<string, string>;
    history: Array<HistoryItem>;
    userText: string;
  }): Promise<LLMResult> {
    const systemBase = this.renderPrompt(params.globalPrompt, params.vars);
    const baseSystem = `${systemBase}\n\nYou are an assistant that must output strict JSON with shape {"reply": string, "handover": boolean, "reason": string}. Keep reply under 120 words.`;

    const first = await this.callModel({
      system: baseSystem,
      history: params.history,
      user: params.userText,
    });

    const parsed1 = this.tryParse(first);
    if (parsed1) {
      return this.postProcess(parsed1);
    }

    const retrySystem = `${baseSystem}\n\nYou MUST respond with JSON only. Do not include any prose or code fences.`;
    const second = await this.callModel({
      system: retrySystem,
      history: params.history,
      user: params.userText,
    });
    const parsed2 = this.tryParse(second);
    if (parsed2) {
      return this.postProcess(parsed2);
    }

    return this.postProcess({
      reply: 'Thanks—looping in a specialist.',
      handover: true,
      reason: 'malformed_output',
    });
  }

  private async callModel(args: { system: string; history: HistoryItem[]; user: string }): Promise<string> {
    const body = {
      system: args.system,
      history: args.history,
      user: args.user,
      response_format: { type: 'json_object' },
    };
    const res = await this.deps.fetchJSON(body);
    // fetchJSON should return string content (model message content)
    return typeof res === 'string' ? res : JSON.stringify(res);
  }

  private tryParse(input: string): LLMResult | null {
    try {
      const obj = JSON.parse(input);
      if (
        obj &&
        typeof obj.reply === 'string' &&
        typeof obj.handover === 'boolean' &&
        typeof obj.reason === 'string'
      ) {
        return { reply: obj.reply, handover: obj.handover, reason: obj.reason };
      }
      return null;
    } catch {
      return null;
    }
  }

  private postProcess(result: LLMResult): LLMResult {
    const cappedReply = capWords(result.reply ?? '', 120);
    const cappedReason = capWords(result.reason ?? '', 120);
    const reply = this.deps.sanitizer(cappedReply);
    const reason = this.deps.sanitizer(cappedReason);
    return { reply, reason, handover: !!result.handover };
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capWords(s: string, limit: number): string {
  const words = String(s || '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= limit) return s.trim();
  return words.slice(0, limit).join(' ').trim();
}

