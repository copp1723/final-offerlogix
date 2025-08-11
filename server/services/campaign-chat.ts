import { LLMClient } from './llm-client';
import { MemoryMapper } from '../integrations/supermemory';
import { getCampaignChatContext } from './memory-orchestrator';

import * as crypto from 'crypto';

interface CampaignChatResponse {
  message: string;
  nextStep?: string;
  data?: any;
  completed?: boolean;
  actions?: string[];
  suggestions?: string[];
  progress?: { stepIndex: number; total: number; percent: number };
  memoryInfluence?: { rag: boolean; optimization: boolean; summary?: string };
}

interface CampaignStep {
  id: string;
  question: string;
  dataField: string;
  followUp?: string;
}

export class CampaignChatService {
  private static campaignSteps: CampaignStep[] = [
    {
      id: 'context',
      question: "What type of automotive campaign would you like to create? (e.g., new vehicle launch, service reminders, test drive promotion)",
      dataField: 'context',
      followUp: 'Perfect! Tell me more about your goals and what you want to achieve.'
    },
    {
      id: 'goals',
      question: "What are your main goals for this campaign? What do you want customers to do?",
      dataField: 'handoverGoals',
      followUp: 'Excellent! That gives me a clear picture of what you want to accomplish.'
    },
    {
      id: 'target_audience',
      question: "Who is your target audience? (e.g., existing customers, new prospects, specific demographics)",
      dataField: 'targetAudience',
      followUp: 'Great! Understanding your audience helps me create better content.'
    },
    {
      id: 'name',
      question: "What would you like to name this campaign?",
      dataField: 'name',
      followUp: 'Perfect name! Now that I understand your campaign goals and audience...'
    },
    {
      id: 'handover_criteria',
      question: "When do you want leads to be handed over to your sales team? Based on your goals, describe the signals that show a customer is ready (e.g., 'when they ask about pricing', 'when they want to schedule a test drive', 'when they seem urgent or ready to buy')",
      dataField: 'handoverCriteria',
      followUp: 'Perfect! I\'ll create smart handover rules based on what you described and your campaign goals.'
    },
    {
      id: 'email_templates',
      question: "How many email templates would you like in your sequence? (1-30 templates)",
      dataField: 'numberOfTemplates'
    },
    {
      id: 'lead_upload',
      question: 'Please upload your lead list CSV now. Required columns: email, first_name, last_name (optional: phone, vehicle_interest). Let me know once it\'s uploaded.',
      dataField: 'leadListConfirmation',
      followUp: 'Great — I\'ve captured your lead list details.'
    },
    {
      id: 'email_cadence',
      question: 'How many days would you like between each email send? (Enter a number 1–30)',
      dataField: 'daysBetweenMessages',
      followUp: 'Perfect cadence. Shorter intervals keep attention, longer builds anticipation.'
    },
    {
      id: 'content_generation',
      question: 'I\'m ready to generate your full email sequence. Shall I generate the content now?',
      dataField: 'contentGenerationConfirmed',
      followUp: 'Generating high-quality automotive email content now...'
    },
    {
      id: 'review_launch',
      question: 'Review complete. Would you like to launch this campaign now?',
      dataField: 'readyToLaunch',
      followUp: 'Everything is prepared.'
    }
  ];

  // Quick reply suggestions by step
  private static suggestionsByStep: Record<string, string[]> = {
    context: ["New vehicle launch", "Service reminders", "Test drive follow-up"],
    goals: ["Book test drives", "Book service", "Get trade-in leads"],
    target_audience: ["New prospects", "Current owners", "Leads with SUV interest"],
  email_templates: ["3", "5", "7"],
  lead_upload: ["Uploaded", "Lead list ready", "Here it is"],
  email_cadence: ["3", "5", "7"],
  content_generation: ["Yes", "Generate now"],
  review_launch: ["Launch now", "Yes launch", "Activate campaign"],
  };
  // TODO: suggestionsByStep is a static mutable object; in multi-user scenarios this could cause cross-session bleed.
  // Consider cloning per conversation instance or returning a new array each time to avoid mutation side-effects.

  // NEW: Generic acknowledgement / non-substantive responses that should NOT advance the wizard
  private static genericAcks = [
    'ok','okay','k','kk','great','thanks','thank you','cool','yes','yep','sure','awesome','now what','what now','what next','next','continue','go on','fine','good','roger','understood','got it','sounds good','alright'
  ];

  /**
   * Parse an initial rich context message to extract campaign name, normalized context, audience hints, etc.
   */
  private static parseInitialContext(input: string): {
    name?: string;
    normalizedContext?: string;
    targetAudience?: string;
    audienceSegments?: string[];
    summaryLine?: string;
  confidence?: number;
  } {
    if (!input) return {};
    const raw = input.trim();
    const out: any = {};
    // Extract a campaign name marker
    const nameMatch = raw.match(/campaign name\s*[:\-]*\s*(\*\*|"|“)?([^\n*"”]{3,80})(\*\*|"|”)?/i);
    if (nameMatch) {
      out.name = nameMatch[2].trim();
    } else {
      // Try quoted phrase at start
      const quoted = raw.match(/^"([^"\n]{3,80})"/);
      if (quoted) out.name = quoted[1].trim();
    }
    // Normalize context: remove labeled prefixes
    let contextSection = raw;
    contextSection = contextSection.replace(/campaign name[^\n]*\n?/i, '');
    contextSection = contextSection.replace(/context\s*&?\s*strategy\s*[:\-]*/i, '');
    contextSection = contextSection.replace(/context\s*[:\-]*/i, '');
    contextSection = contextSection.replace(/strategy\s*[:\-]*/i, '');
    contextSection = contextSection.replace(/\*\*/g, '');
    contextSection = contextSection.replace(/\s{2,}/g, ' ').trim();
    if (contextSection) out.normalizedContext = contextSection;

    // Audience extraction heuristics (expanded)
    const audienceHints: string[] = [];
    const lower = raw.toLowerCase();
    const audienceMap: Record<string,string> = {
      'student': 'students',
      'first-time': 'first-time buyers',
      'first time': 'first-time buyers',
      'commuter': 'commuter buyers',
      'rideshare': 'ride-share drivers',
      'low-funnel': 'low-funnel shoppers',
      'in-market': 'in‑market shoppers',
      'previously interacted': 'previously engaged non-converters',
      'not converted': 'previously engaged non-converters',
      'repeat buyer': 'repeat buyers',
      'lease return': 'lease return prospects'
    };
    for (const k of Object.keys(audienceMap)) {
      if (lower.includes(k)) audienceHints.push(audienceMap[k]);
    }
    // Generic pattern: phrases starting with 'targeting' or 'target' capturing up to punctuation
    const targetingMatch = lower.match(/targeting\s+([^\.\n;:]{5,80})/);
    if (targetingMatch) {
      audienceHints.push(targetingMatch[1].trim());
    }
    if (audienceHints.length) {
      const uniq = Array.from(new Set(audienceHints.map(a => a.replace(/[\.,;]+$/,'').trim())));
      out.targetAudience = uniq.join(', ');
      out.audienceSegments = uniq.map(a => ({ name: a })).map(s => s.name); // segments names only; later converted
    }

    // Build summary line
    if (out.name || out.normalizedContext) {
      const ctxShort = this.compactify(out.normalizedContext || '', 120);
      out.summaryLine = `${out.name ? out.name + ' — ' : ''}${ctxShort}`.trim();
    }
  // Confidence heuristic: name (0.3) + audience (0.3) + angle cues (0.2) + length richness (0.2 / 0.1)
  let conf = 0;
  if (out.name) conf += 0.3;
  if (out.targetAudience) conf += 0.3;
  const lowerAll = raw.toLowerCase();
  if (/(flash|overstock|liquidation|clearance|trade|finance|urgent|limited|inventory)/.test(lowerAll)) conf += 0.2;
  if (raw.length > 140) conf += 0.2; else if (raw.length > 70) conf += 0.1;
  out.confidence = Math.min(1, conf);
    return out;
  }

  /** Compact text preserving semantic cues */
  private static compactify(text: string, max = 160): string {
    if (!text) return '';
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1).replace(/[ ,;:-]+$/,'') + '…';
  }

  /** Extract goal statements with numeric targets from freeform text */
  private static extractGoals(text: string): { category: string; value: number; text: string }[] {
    if (!text) return [];
    const goals: { category: string; value: number; text: string }[] = [];
    const patterns: { re: RegExp; category: string }[] = [
      { re: /(move|sell)\s+(\d{1,4})\s+(units|cars|sedans|vehicles)/i, category: 'units' },
      { re: /(book|schedule)\s+(\d{1,4})\s+(test[- ]?drives?)/i, category: 'test_drives' },
      { re: /(generate|get|capture)\s+(\d{1,4})\s+(leads)/i, category: 'leads' },
      { re: /(secure|generate|get)\s+(\d{1,4})\s+(finance|credit)\s+(apps|applications)/i, category: 'finance_apps' },
      { re: /(capture|get|generate)\s+(\d{1,4})\s+(trade[- ]?in|tradein|trade)\s+(appraisals?|valuations?)/i, category: 'trade_ins' }
    ];
    for (const { re, category } of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const value = parseInt(m[2], 10);
        if (!isNaN(value)) goals.push({ category, value, text: m[0].trim() });
      }
    }
    // Deduplicate by category keep highest value (assumption)
    const dedup: Record<string, { category: string; value: number; text: string }> = {};
    for (const g of goals) {
      if (!dedup[g.category] || dedup[g.category].value < g.value) dedup[g.category] = g;
    }
    return Object.values(dedup);
  }

    // Parse template count from digits or number words (supports 1–30)
    private static parseTemplateCount(input: string): number | null {
      if (!input) return null;
      const str = input.toLowerCase().replace(/[,.!]/g, ' ').trim();

      // 1) Prefer explicit digits in the text
      const digitMatch = str.match(/(^|\s)([0-9]{1,2})(?=\s|$)/);
      if (digitMatch) {
        const n = parseInt(digitMatch[2], 10);
        if (!isNaN(n)) return n;
      }

      // 2) Number words up to 30
      const ones: Record<string, number> = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9
      };
      const teens: Record<string, number> = {
        'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19
      };
      const tens: Record<string, number> = { 'twenty': 20, 'thirty': 30 };

      const tokens = str.replace(/-/g, ' ').split(/\s+/).filter(Boolean);

      // Direct single-word matches (ones/teens/tens)
      for (const t of tokens) {
        if (t in ones) return ones[t];
        if (t in teens) return teens[t];
        if (t in tens) return tens[t];
      }

      // Hyphenated or spaced composites like "twenty one"
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t in tens) {
          let total = tens[t];
          const next = tokens[i + 1];
          if (next && next in ones) total += ones[next];
          return total;
        }
      }

      return null;
    }

    // Generic "number-ish" parser supporting digits and number words (1–30) plus phrases like "every three days" and "every other day"
    private static parseNumberish(input: string): number | null {
      if (!input) return null;
      const str = input.toLowerCase().replace(/[,.!]/g, ' ').trim();

      // "every other day" or "qod"
      if (/\bevery\s+other\s+day\b/.test(str) || /\bqod\b/.test(str)) return 2;

      // direct digits
      const digitMatch = str.match(/(^|\s)([0-9]{1,2})(?=\s|$)/);
      if (digitMatch) {
        const n = parseInt(digitMatch[2], 10);
        if (!isNaN(n)) return n;
      }

      // number words up to 30
      const ones: Record<string, number> = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9
      };
      const teens: Record<string, number> = {
        'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19
      };
      const tens: Record<string, number> = { 'twenty': 20, 'thirty': 30 };

      const tokens = str.replace(/-/g, ' ').split(/\s+/).filter(Boolean);

      // phrases like "every three days"
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'every' && (tokens[i+2] === 'day' || tokens[i+2] === 'days')) {
          const next = tokens[i+1];
          if (next in ones) return ones[next];
          if (next in teens) return teens[next];
          if (next in tens) return tens[next];
          const num = parseInt(next || '', 10);
          if (!isNaN(num)) return num;
        }
      }

      // single-word matches
      for (const t of tokens) {
        if (t in ones) return ones[t];
        if (t in teens) return teens[t];
        if (t in tens) return tens[t];
      }

      // composites like "twenty one"
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t in tens) {
          let total = tens[t];
          const next = tokens[i + 1];
          if (next && next in ones) total += ones[next];
          return total;
        }
      }
      return null;
    }

    // Extract structured segments from a rich audience description. Supports **Bold** markers and bullet sections.
    private static detectSegmentsFromAudience(text: string): { name: string; description?: string }[] {
      if (!text) return [];
      const out: { name: string; description?: string }[] = [];
      const boldRe = /\*\*(.+?)\*\*/g;
      let m: RegExpExecArray | null;
      while ((m = boldRe.exec(text)) !== null) {
        const name = m[1].trim();
        // Grab description following the bold label on the same bullet/line
        const after = text.slice(m.index + m[0].length).split(/\n|\*/)[0];
        out.push({ name, description: after.trim().replace(/^[:\-–]\s*/, '') });
      }
      // Fallback: lines that look like titled bullets
      if (out.length === 0) {
        const lines = text.split('\n');
        for (const line of lines) {
          const lm = line.match(/^\s*[\-\*\u2022]\s*([A-Z][A-Za-z0-9'\s]+):\s*(.+)$/);
          if (lm) out.push({ name: lm[1].trim(), description: lm[2].trim() });
        }
      }
      return out.slice(0, 6); // safety cap
    }

    // Build a compact RAG context string from supermemory results
    private static buildRagContext(r: any, maxChars = 800): string {
      if (!r || !Array.isArray(r.results) || r.results.length === 0) return '';
      const parts: string[] = [];
      for (const item of r.results.slice(0, 3)) {
        const title = item?.metadata?.name || item?.metadata?.title || '';
        const content = (item?.content || '').toString();
        const snippet = content.length > 300 ? content.slice(0, 300) + '…' : content;
        parts.push((title ? `[${title}] ` : '') + snippet);
      }
      let ctx = parts.join('\n---\n');
      if (ctx.length > maxChars) ctx = ctx.slice(0, maxChars) + '…';
      return ctx;
    }

    // Preflight validation before content generation. Returns not-ok with a coaching message if something is off.
    private static preflightValidate(data: any): { ok: boolean; message?: string; suggestions?: string[] } {
      const suggestions: string[] = [];
      const segCount = Array.isArray(data.segments) ? data.segments.length : 0;
      const tmplCount = data.numberOfTemplates ? Number(data.numberOfTemplates) : null;

      if (segCount > 1 && (tmplCount === null || tmplCount < 5)) {
        suggestions.push('Increase templates to 6–9 so each segment has coverage', 'Or confirm shared copy across all segments');
        return {
          ok: false,
          message: `You're running ${segCount} audience segments with only ${tmplCount ?? 'N/A'} templates. That’s too thin for differentiated messaging.`,
          suggestions,
        };
      }

      if (!data.handoverCriteria || (typeof data.handoverCriteria === 'string' && data.handoverCriteria.trim().length < 10)) {
        suggestions.push('Choose triggers: pricing pressure, test‑drive scheduling, financing readiness, trade‑in with VIN/miles');
        return {
          ok: false,
          message: 'We still need concrete handover triggers before generating content.',
          suggestions,
        };
      }

      // Warn but do not block on demo/very small lead lists
      if (data.leadList && (Array.isArray(data.leadList) ? data.leadList.length : (data.leadList.total || 0)) <= 1) {
        // not blocking; just suggestion
        suggestions.push('Lead list looks like a sample; proceed without launch or add more leads');
      }

      return { ok: true, suggestions };
    }


  // Heuristic + lightweight semantic guard to decide if we should advance
  private static async isSubstantiveAnswer(step: CampaignStep, userMessage: string): Promise<boolean> {
    if (!userMessage) return false;
    const msg = userMessage.trim().toLowerCase();
    // Step-specific early acceptance BEFORE generic ack filtering so short affirmatives work
    if (step.id === 'content_generation') {
      if (/(^|\b)(yes|yep|yeah|sure|generate|go|start|do it|create|ok|okay)(\b|$)/i.test(msg)) return true;
    }
    if (step.id === 'review_launch') {
      if (/(^|\b)(yes|yep|yeah|launch|activate|start|go live|go|ok|okay)(\b|$)/i.test(msg)) return true;
    }
    if (step.id === 'name') {
      // Accept concise branded names (allow 2-6 tokens, alphanumeric, at least one letter)
      const raw = userMessage.trim();
      const hasLetter = /[a-zA-Z]/.test(raw);
      const tokenCount = raw.split(/\s+/).filter(Boolean).length;
      if (hasLetter && raw.length >= 3 && raw.length <= 80 && tokenCount <= 8) {
        return true;
      }
    }
    // Very short or generic acknowledgement
    if (msg.length < 8 && /^(ok|k|kk|yes|yep|sure|fine)$/i.test(msg)) return false;
    if (this.genericAcks.includes(msg)) return false;
    // Contains a question asking what to do next
    if (/what\s+(now|next)/i.test(msg)) return false;

    // For numeric template count step allow digits or number words (1-30)
    if (step.id === 'email_templates') {
      const n = this.parseTemplateCount(msg);
      return n !== null && n >= 1 && n <= 30;
    }

    if (step.id === 'lead_upload') {
      // Accept confirmations or mention of leads
      if (/uploaded|done|finished|complete|here|attached|lead list|csv/i.test(msg)) return true;
      if (/\b\d+\b/.test(msg) && /lead/i.test(msg)) return true;
      return false;
    }

    if (step.id === 'email_cadence') {
      const n = this.parseNumberish(msg);
      return n !== null && n >= 1 && n <= 30;
    }

    if (step.id === 'content_generation') {
      return /(yes|generate|go|start|do it|create)/i.test(msg);
    }

    if (step.id === 'review_launch') {
      return /(launch|yes|activate|start|go live)/i.test(msg);
    }

    // Lightweight keyword expectation per step
    const expectations: Record<string,string[]> = {
      context: ['launch','service','test','drive','reminder','promotion','sale','campaign','event'],
      goals: ['lead','drive','book','test','appointment','trade','sale','traffic','engagement','nurture','convert'],
      target_audience: ['customer','prospect','buyer','owner','audience','demographic','shopper','segment'],
      name: ['campaign','drive','event','sale','offer'],
      handover_criteria: ['when','if','after','criteria','trigger','signal','ask','schedule','pricing','price','finance','test'],
    };

    const expected = expectations[step.id];
    if (expected) {
      const hit = expected.some(k => msg.includes(k));
      if (hit) return true;
    }

    // As a last resort, (guarded) mini LLM classification for richness when message is short
  if (step.id !== 'name' && msg.split(/\s+/).length < 4) return false; // still too short for other steps

    try {
      const cls = await LLMClient.generate({
        model: 'openai/gpt-4o-mini',
        system: 'You classify if a user answer provides meaningful, campaign-specific information for a step. Reply with ONLY yes or no.',
        user: `Step: ${step.id} (expects ${step.dataField}). User answer: "${userMessage}". Is this a substantive, campaign-informative answer (not just acknowledgement)?`,
        temperature: 0
      });
      return /^yes/i.test(cls.content || '');
    } catch {
      return msg.length > 12; // simple fallback
    }
  }

  /**
   * Process campaign creation chat conversation
   */
  static async processCampaignChat(
    userMessage: string,
    currentStep: string = 'context',
    existingData: any = {}
  ): Promise<CampaignChatResponse> {
    try {
      const runId = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      const startMs = Date.now();
      const metrics = { runId, ragHit: 0, preflightBlocks: 0, ackRejected: 0, substantivePassed: 0, llmRetries: 0 };

      // Centralized orchestration for RAG + optimization hints
      const vehicleKeywords = this.extractVehicleKeywords(userMessage + ' ' + (existingData.context || ''));
      const { ragContext, optimizationHints, raw } = await getCampaignChatContext({
        clientId: existingData.clientId || 'default',
        campaignId: existingData.id,
        userTurn: userMessage,
        context: existingData.context,
        goals: existingData.handoverGoals,
        vehicleKeywords
      });
      if (ragContext) metrics.ragHit++;

      const stepIndex = this.campaignSteps.findIndex(step => step.id === currentStep);
      const currentStepData = this.campaignSteps[stepIndex];

      if (!currentStepData) {
        return {
          message: "I'm not sure what step we're on. Let's start over. What type of automotive campaign would you like to create?",
          nextStep: 'context',
          suggestions: this.suggestionsByStep['context'] || []
        };
      }

      // BEFORE accepting the answer, validate substantiveness
  const substantive = await this.isSubstantiveAnswer(currentStepData, userMessage);
      if (!substantive) {
        metrics.ackRejected++;
        const retryQuestion = currentStepData.question;
        const coaching: Record<string,string> = {
          context: 'Please give a descriptive automotive campaign type with purpose or scenario (e.g., "Labor Day weekend clearance focused on trade-ins and same‑day financing").',
          goals: 'List 1-3 concrete business outcomes (e.g., "increase test drives", "increase trade-in appraisals", "revive inactive SUV leads").',
          target_audience: 'Describe who you want to reach (segments, demographics, intent signals, ownership stage, etc.).',
          name: 'Provide a short, branded campaign name you would present internally or to leadership.',
          handover_criteria: 'Describe the exact conversational signals that mean a sales rep should take over (pricing pressure, scheduling requests, urgency, financing readiness, trade-in specifics, etc.).',
          email_templates: 'Enter a number 1–30 indicating how many emails you want in the sequence.'
        };
        const response = {
          message: `I need a bit more detail before we move on. ${coaching[currentStepData.id] || ''}\n\n${retryQuestion}`.trim(),
          nextStep: currentStepData.id,
          data: existingData, // do NOT update yet
          actions: ['retry'],
          suggestions: this.suggestionsByStep[currentStepData.id] || [],
          progress: {
            stepIndex: stepIndex, // unchanged
            total: this.campaignSteps.length,
            percent: Math.round((stepIndex / this.campaignSteps.length) * 100)
          },
          memoryInfluence: { rag: !!ragContext, optimization: false, summary: !!ragContext ? 'Past campaign knowledge referenced' : undefined }
        };
        console.log('[campaign-chat]', { runId, stage: 'coach', step: currentStepData.id, metrics, durationMs: Date.now() - startMs });
        return response;
      }

      // Process user's substantive response for current step
      const updatedData = { ...existingData };
      // Write the raw step interaction to Supermemory (fire and forget)
      try {
        MemoryMapper.writeCampaignStep?.({
          type: 'campaign_step',
          clientId: updatedData.clientId || 'default',
          campaignId: updatedData.id,
          stepId: currentStepData.id,
            content: userMessage,
          meta: { step: currentStepData.id, ts: Date.now() }
        });
      } catch {}
      updatedData[currentStepData.dataField] = userMessage;
      metrics.substantivePassed++;

      // SPECIAL: Enhanced parsing & bootstrap when the first (context) step is answered
      if (currentStep === 'context') {
        const parsed = this.parseInitialContext(userMessage);
        if (parsed.name && !updatedData.name) updatedData.name = parsed.name;
        if (parsed.normalizedContext) updatedData.context = parsed.normalizedContext; // replace raw with normalized
        if (parsed.targetAudience && !updatedData.targetAudience) updatedData.targetAudience = parsed.targetAudience;
        if (parsed.audienceSegments?.length && !updatedData.segments) updatedData.segments = parsed.audienceSegments.map(a => ({ name: a }));
        // Keep raw for reference
        updatedData._rawContextInput = userMessage;
        updatedData._bootstrapSummary = parsed.summaryLine;
        updatedData._contextConfidence = parsed.confidence;
        // Auto goal extraction
        const detectedGoals = this.extractGoals(userMessage);
        if (detectedGoals.length) {
          const goalSentence = detectedGoals.map(g => g.text).join('; ');
          updatedData.handoverGoals = goalSentence;
          updatedData.campaignGoals = goalSentence;
          updatedData._autoGoalsExtracted = true;
        }
        if (!Array.isArray(updatedData._usedOpeners)) updatedData._usedOpeners = [];
  // TODO: Before persisting campaign data, strip internal underscore-prefixed fields (_rawContextInput, _bootstrapSummary,
  // _contextConfidence, _autoGoalsExtracted, _usedOpeners) so they do not leak into stored campaign objects or APIs.
      }

      if (currentStep === 'goals') {
        updatedData.campaignGoals = userMessage;
        updatedData.handoverGoals = userMessage; // legacy alias for compatibility
        // Attempt to extract implicit audience from goals phrasing (e.g., 'Targeting low-funnel customers who...')
        const lowerGoals = userMessage.toLowerCase();
        if (!updatedData.targetAudience) {
          const targetingMatch = lowerGoals.match(/targeting\s+([^\.\n;:]{5,120})/);
          if (targetingMatch) {
            const inferred = targetingMatch[1].replace(/who\s+have|that\s+have|which\s+have/i,'').trim();
            if (inferred.length > 5) {
              updatedData.targetAudience = inferred;
              updatedData._audienceInferredFromGoals = true;
            }
          }
        }
      }
      if (currentStep === 'target_audience') {
        const segs = this.detectSegmentsFromAudience(userMessage);
        if (segs.length) updatedData.segments = segs;
      }
      // Special processing for handover criteria - uses campaign context and goals
      if (currentStep === 'handover_criteria') {
        const handoverPrompt = await this.convertHandoverCriteriaToPrompt(
          userMessage,
          updatedData.context,
          updatedData.handoverGoals,
          updatedData.targetAudience
        );
        updatedData.handoverPrompt = handoverPrompt;
      }

      // Special processing for template count
      if (currentStep === 'email_templates') {
        const parsed = this.parseTemplateCount(userMessage);
        const count = parsed !== null ? parsed : 5;
        updatedData.numberOfTemplates = Math.min(Math.max(count, 1), 30);
      }

      if (currentStep === 'lead_upload') {
        // Expect client to have populated updatedData.leadList previously via separate upload API
        // Provide a minimal summary if none exists
        if (!updatedData.leadList && existingData.leadList) {
          updatedData.leadList = existingData.leadList;
        }
      }

      if (currentStep === 'email_cadence') {
        const n = this.parseNumberish(userMessage);
        if (n !== null && n >= 1 && n <= 30) {
          updatedData.daysBetweenMessages = n;
        }
      }

      if (currentStep === 'content_generation') {
        // Preflight gating before generation
        const pf = this.preflightValidate(updatedData);
        if (!pf.ok) {
          metrics.preflightBlocks++;
          return {
            message: `${pf.message}\n\n${pf.suggestions?.length ? 'Suggestions:\n- ' + pf.suggestions.join('\n- ') : ''}\n\nShall we adjust the settings above or proceed anyway?`,
            nextStep: currentStep, // do not advance
            data: updatedData,
            actions: ['retry'],
            suggestions: this.suggestionsByStep[currentStep] || [],
            progress: {
              stepIndex,
              total: this.campaignSteps.length,
              percent: Math.round((stepIndex / this.campaignSteps.length) * 100)
            }
          };
        }
        try {
          const generation = await this.generateFinalCampaign({ ...updatedData }, ragContext);
          updatedData.templates = generation.templates;
          updatedData.subjectLines = generation.subjectLines;
          updatedData.numberOfTemplates = generation.numberOfTemplates;
          if (!updatedData.name) updatedData.name = generation.name;
        } catch (e) {
          console.warn('Failed mid content_generation', e);
        }
      }

      const isLaunchCommand = currentStep === 'review_launch';

      // Determine next step
      // Determine next step index with optional goals skipping
      let nextStepIndex = stepIndex + 1;
      let skippingGoals = false;
  if (currentStep === 'context' && (updatedData as any)._autoGoalsExtracted) {
        // If the very next step is goals, skip it
        const nextCandidate = this.campaignSteps[nextStepIndex];
        if (nextCandidate && nextCandidate.id === 'goals') {
          nextStepIndex++;
          skippingGoals = true;
        }
      }
      // If we just captured goals and inferred audience, skip explicit target_audience step
      if (currentStep === 'goals' && (updatedData as any)._audienceInferredFromGoals) {
        const candidate = this.campaignSteps[nextStepIndex];
        if (candidate && candidate.id === 'target_audience') {
          nextStepIndex++;
        }
      }
      const nextStep = this.campaignSteps[nextStepIndex];
      const isCompleted = isLaunchCommand || nextStepIndex >= this.campaignSteps.length;

      if (isCompleted) {
        // Ensure final campaign has templates/content
        let finalCampaign = { ...updatedData } as any;
  if (!finalCampaign.templates || finalCampaign.templates.length === 0) {
          finalCampaign = await this.generateFinalCampaign(finalCampaign, ragContext);
        }

        // Persist campaign summary + templates into memory graph (non-blocking)
        try {
          if (Array.isArray(finalCampaign.templates)) {
            for (const t of finalCampaign.templates.slice(0, Math.min(8, finalCampaign.templates.length))) {
              MemoryMapper.writeTemplate?.({
                type: 'email_template',
                clientId: finalCampaign.clientId || 'default',
                campaignId: finalCampaign.id,
                name: t.subject || 'Template',
                html: t.content || t.html || '',
                meta: { subject: t.subject, origin: 'campaign_chat', ts: Date.now() }
              });
            }
          }
          MemoryMapper.writeCampaignSummary?.({
            type: 'campaign_summary',
            clientId: finalCampaign.clientId || 'default',
            campaignId: finalCampaign.id || 'pending',
            summary: `Name: ${finalCampaign.name}\nContext: ${finalCampaign.context}\nGoals: ${finalCampaign.handoverGoals}\nAudience: ${finalCampaign.targetAudience}`,
            meta: { templates: finalCampaign.templates?.length || 0, ts: Date.now() }
          });
        } catch {}

        // Calculate final progress
        const progress = {
          stepIndex: this.campaignSteps.length,
          total: this.campaignSteps.length,
          percent: 100
        };

        // Broadcast completion via WebSocket
        this.broadcastProgress(null, this.campaignSteps.length, this.campaignSteps.length, 100);

        const leadCount = finalCampaign.leadList?.total || finalCampaign.leadList?.length || 0;
        console.log('[campaign-chat]', { runId, stage: 'complete', metrics, durationMs: Date.now() - startMs });
        return {
          message: `Review complete! "${finalCampaign.name}" has ${finalCampaign.numberOfTemplates || finalCampaign.templateCount || 5} templates${leadCount ? ` and ${leadCount} leads` : ''}. Type "Launch" to activate or edit any step before launching.`,
          completed: true,
          data: finalCampaign,
            actions: ['create_campaign', 'ready_to_launch'],
          progress,
          suggestions: this.suggestionsByStep['review_launch'] || [],
          memoryInfluence: { rag: !!ragContext, optimization: false, summary: !!ragContext ? 'Past campaign knowledge referenced' : undefined }
        };
      }
      // nextStep already defined

      // NEW: attempt dynamic LLM-generated conversational response instead of always using static followUp
      let responseMessage: string | null = null;

      // If we are advancing FROM the context step to goals, we want a deterministic, high-signal coaching style message.
  if (currentStep === 'context' && (nextStep?.id === 'goals' || skippingGoals)) {
        const nm = updatedData.name || 'Your Campaign';
        const audience = updatedData.targetAudience ? updatedData.targetAudience : (Array.isArray(updatedData.segments) && updatedData.segments.length ? updatedData.segments.map((s: any) => s.name).join(', ') : 'target buyers');
        // Build an angle descriptor from context heuristics
        const angleBits: string[] = [];
        const ctxLower = (updatedData.context || '').toLowerCase();
        if (/overstock|too many|excess|inventory|stack(ed)?/.test(ctxLower)) angleBits.push('overstock inversion');
        if (/flash|limited|urgent|hurry|clock|until/i.test(ctxLower)) angleBits.push('flash urgency');
        if (/he paid too much|paid too much|overpaid/.test(ctxLower)) angleBits.push('“he overpaid so you save” angle');
        if (/sedan|suv|truck|coupe|crossover/.test(ctxLower)) {
          const m = ctxLower.match(/sedan|suv|truck|coupe|crossover/);
          if (m) angleBits.push(`${m[0]} focus`);
        }
        const angle = angleBits.length ? angleBits.join(' + ') : 'value + urgency positioning';

        // Goal prompt with options
        const goalQuestion = `${nextStep.question}`; // verbatim for whichever step we landed on
        // Determine a vehicle-aware units noun for examples (e.g., trucks, SUVs, sedans)
        const unitsNoun = this.pickUnitsNoun(vehicleKeywords, ctxLower);
        const exampleLine = (skippingGoals
          ? `If refining goals, include a parenthetical like (Adjust goals if needed: Move more ${unitsNoun}; Book more test drives).`
          : `Include 3–5 example goal snippets in parentheses separated by semicolons (e.g., Move more ${unitsNoun}; Book more test drives; Generate more leads) but DO NOT number them.`);
        // Attempt LLM-generated conversational confirmation for higher variability & intelligence
        try {
          const llmUser = `You are an expert automotive campaign strategist.
We have just parsed the user's initial raw context for a campaign.
Return ONE short conversational confirmation (55-85 words) that:
1) Naturally paraphrases what they're trying to do (campaign name, angle, audience) WITHOUT sounding robotic
2) Softly checks understanding (vary language; avoid previously used openers: ${(updatedData._usedOpeners || []).join(' | ') || 'NONE'})
3) ${(skippingGoals ? 'Briefly affirms inferred goals and transitions forward. Offer a lightweight chance to refine.' : 'Coaches them to give 1–3 concrete outcome goals with target numbers')}
4) Ends EXACTLY with the next step question verbatim: ${goalQuestion}
5) ${exampleLine}
6) No markdown, no quotes.

DATA:
CampaignName: ${nm}
Audience: ${audience}
Angle: ${angle}
RawContext: ${this.compactify(updatedData._rawContextInput || updatedData.context || '', 220)}
 AutoGoals: ${(updatedData as any)._autoGoalsExtracted ? (updatedData.handoverGoals || '') : 'NONE'}
 ContextConfidence: ${(updatedData as any)._contextConfidence ?? 'n/a'}
`;
          const gen = await LLMClient.generate({
            model: 'openai/gpt-4o-mini',
            system: 'You produce concise, varied, authentic automotive marketing assistant replies. Keep it human, strategic, and focused. No markdown.',
            user: llmUser,
            temperature: 0.8,
            maxTokens: 260
          });
          const txt = (gen.content || '').trim();
          if (txt && txt.toLowerCase().includes(goalQuestion.substring(0, 10).toLowerCase())) {
            responseMessage = txt;
          }
        } catch (e) {
          // swallow and fallback
        }
        if (!responseMessage) {
          // High-quality variation fallback (only if dynamic LLM generation failed)
          const baseCtx = this.compactify(updatedData.context, 160);
          const goalExamples = `Move more ${unitsNoun}; Book more test drives; Generate more leads`;
          const variants = skippingGoals ? [
            `Let me reflect this back: "${nm}" — ${baseCtx} aimed at ${audience} with a ${angle} angle. Auto-derived goals: ${updatedData.handoverGoals}. Adjust if needed. ${goalQuestion}`,
            `Quick confirmation on "${nm}": ${baseCtx} for ${audience}, leaning on a ${angle} position. Goals detected: ${updatedData.handoverGoals}. Want tweaks? ${goalQuestion}`,
            `Context snapshot: "${nm}" targets ${audience}; angle: ${angle}. Current goals → ${updatedData.handoverGoals}. Refine or move on? ${goalQuestion}`
          ] : [
            `Alright, I think I see what you're going for: "${nm}" — ${baseCtx} targeting ${audience} with a ${angle} play. If that's right, spell out concrete outcomes (e.g., ${goalExamples}). ${goalQuestion}`,
            `Got the gist of "${nm}": ${baseCtx}. Audience focus: ${audience}. Feels like a ${angle} narrative. What measurable outcomes do you want (e.g., ${goalExamples})? ${goalQuestion}`,
            `Reading this as: "${nm}" for ${audience} leveraging a ${angle} angle. Confirm by giving 1–3 outcome goals (e.g., ${goalExamples}). ${goalQuestion}`,
            `Working hypothesis: campaign "${nm}" = ${angle} positioning to engage ${audience}. Lock it in with specific outcome goals (e.g., ${goalExamples}). ${goalQuestion}`,
            `Current interpretation of "${nm}": ${baseCtx}. Audience: ${audience}. Angle vector: ${angle}. Clarify success targets (e.g., ${goalExamples}). ${goalQuestion}`
          ];
          // Deterministic pick based on simple hash to avoid repetition across sessions with same context
          const hash = Array.from(`${nm}|${baseCtx}|${audience}|${angle}`).reduce((acc,c)=>acc + c.charCodeAt(0),0);
          responseMessage = variants[hash % variants.length];
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[campaign-chat] Using fallback variant (LLM generation failed earlier). Provide OPENROUTER_API_KEY for richer dynamic copy.');
          }
        }
        const openerSample = responseMessage.split(/\s+/).slice(0,6).join(' ');
        if (!updatedData._usedOpeners.includes(openerSample)) updatedData._usedOpeners.push(openerSample);

        // Override goal suggestions dynamically to more numeric, outcome-based examples
        if (!skippingGoals) {
          this.suggestionsByStep.goals = [
            `Move more ${unitsNoun}`,
            'Book more test drives',
            'Generate more leads',
            'Secure more finance apps',
            'Capture more trade-in appraisals'
          ];
        } else {
          // Build audience suggestions dynamically from context/keywords
          this.suggestionsByStep.target_audience = this.buildAudienceSuggestions(vehicleKeywords, ctxLower);
        }
      }
  if (!responseMessage) {
        try {
          const llmUserPrompt = `You are an automotive campaign creation assistant.
Collected data so far (JSON): ${JSON.stringify(updatedData)}
User just answered the step "${currentStepData.id}" with: "${userMessage}".
Next step id: ${nextStep.id}
Next step question: ${nextStep.question}
Return ONLY a short (<=60 words) natural conversational reply that:
1) Acknowledges their last answer in automotive-specific terms
2) (If applicable) briefly adds one helpful insight or suggestion
3) Ends by asking exactly the next step question verbatim: ${nextStep.question}
Do NOT wrap in quotes. No JSON. No markdown.`;
          const llm = await LLMClient.generate({
            model: 'openai/gpt-4o-mini',
            system: 'You are a concise, helpful automotive campaign strategist. Keep replies professional and specific to automotive marketing. Never hallucinate data not provided.',
    user: (ragContext ? `${llmUserPrompt}\n\nRAG_CONTEXT:\n${ragContext}${optimizationHints?`\nOPTIMIZATION_HINTS:\n${optimizationHints}`:''}` : llmUserPrompt),
            temperature: 0.4,
            maxTokens: 220
          });
          responseMessage = llm.content?.trim();
          // Basic guard: ensure it includes the next step question; else fallback
          if (!responseMessage || !responseMessage.toLowerCase().includes(nextStep.question.substring(0, 8).toLowerCase())) {
            responseMessage = null;
          }
        } catch (e) {
          console.warn('Dynamic step LLM response failed, falling back to template:', e);
        }
      }

      if (!responseMessage) {
        responseMessage = currentStepData.followUp || `Got it! ${nextStep.question}`;
      }

      // Ensure responseMessage ends with the next step question
      if (!responseMessage.toLowerCase().trim().endsWith(nextStep.question.toLowerCase().trim())) {
        responseMessage += ` ${nextStep.question}`;
      }

      // Calculate progress
      const progress = {
        stepIndex: nextStepIndex,
        total: this.campaignSteps.length,
        percent: Math.round((nextStepIndex / this.campaignSteps.length) * 100)
      };

      // Broadcast progress via WebSocket
      this.broadcastProgress(null, nextStepIndex, this.campaignSteps.length, progress.percent);

      console.log('[campaign-chat]', { runId, stage: 'advance', nextStep: nextStep.id, metrics, durationMs: Date.now() - startMs });
      return {
        message: responseMessage,
        nextStep: nextStep.id,
        data: updatedData,
        actions: ["continue"],
        suggestions: this.suggestionsByStep[nextStep.id] || [],
        progress,
        memoryInfluence: {
          rag: !!ragContext,
          optimization: !!optimizationHints,
          summary: (ragContext && optimizationHints) ? 'Past campaigns + performance hints applied' : (ragContext ? 'Past campaign knowledge applied' : (optimizationHints ? 'Performance hints applied' : undefined))
        }
      };

    } catch (error) {
      console.error('Campaign chat processing error:', error);
      return {
        message: "I encountered an issue. Let me help you create your campaign. What type of automotive campaign are you looking for?",
        nextStep: 'context'
      };
    }
  }

  /**
   * Broadcast progress updates via WebSocket
   */
  private static broadcastProgress(campaignId: string | null, stepIndex: number, total: number, percent: number) {
    try {
      // Import WebSocket service dynamically to avoid circular imports
      const broadcast = require('./websocket')?.broadcastMessage;
      if (broadcast) {
        broadcast('campaignChat:progress', { campaignId, stepIndex, total, percent });
      }
    } catch (error) {
      console.warn('Failed to broadcast campaign progress:', error);
    }
  }

  /**
   * Helper to safely parse JSON with fallbacks
   */
  private static coerceJson<T>(content: string, fallback: T): T {
    try {
      const parsed = JSON.parse(content);
      // Ensure arrays are actually arrays and strings aren't too long
      if (Array.isArray(fallback) && !Array.isArray(parsed)) {
        return fallback;
      }
      if (typeof fallback === 'string' && typeof parsed === 'string' && parsed.length > 1000) {
        return (parsed.substring(0, 1000) + '...') as T;
      }
      return parsed;
    } catch {
      return fallback;
    }
  }

  /**
   * Convert user's natural language handover criteria into structured AI prompt
   */
  private static async convertHandoverCriteriaToPrompt(
    userInput: string,
    campaignContext?: string,
    campaignGoals?: string,
    targetAudience?: string
  ): Promise<string> {
    try {
      // Obtain RAG + optimization via centralized orchestrator (non-blocking if it fails)
      let contextSection = '';
      try {
        const { ragContext } = await getCampaignChatContext({
          clientId: 'default',
          userTurn: userInput,
          context: campaignContext,
          goals: campaignGoals,
          vehicleKeywords: this.extractVehicleKeywords(userInput + ' ' + (campaignContext || ''))
        });
        if (ragContext) {
          contextSection = `\n## RETRIEVED CONTEXT FROM PAST CAMPAIGNS:\n${ragContext}\nUse this historical data to inform your handover criteria generation.\n`;
        }
      } catch {}

      const conversionPrompt = `
# ROLE: Expert Automotive Handover Intelligence Designer
You are a world-class automotive sales intelligence expert who specializes in converting natural language into precise, actionable AI handover criteria. You understand buyer psychology, sales processes, and automotive industry nuances.

## CAMPAIGN INTELLIGENCE:
**Campaign Context:** "${campaignContext || 'General automotive campaign'}"
**Campaign Goals:** "${campaignGoals || 'Generate automotive leads'}"
**Target Audience:** "${targetAudience || 'General automotive prospects'}"
**User's Natural Language Criteria:** "${userInput}"

${contextSection}

## YOUR MISSION:
Transform the user's informal handover criteria into a sophisticated AI evaluation prompt that captures the essence of buyer readiness for THIS specific campaign context.

## EVALUATION FRAMEWORK:
Consider these automotive buyer journey stages:
1. **Awareness** (just browsing, general interest)
2. **Consideration** (comparing options, seeking information)
3. **Intent** (serious about purchasing, specific needs)
4. **Decision** (ready to buy, urgency signals)

## REQUIRED OUTPUT:
Generate a comprehensive handover evaluation prompt that includes:

### CAMPAIGN-SPECIFIC TRIGGERS:
- Extract keywords from user criteria and map to buyer stages
- Prioritize signals that align with campaign goals
- Include audience-specific language patterns

### CONTEXTUAL QUALIFICATION:
- Define qualification thresholds based on campaign objectives
- Specify conversation depth requirements
- Set engagement quality benchmarks

### URGENCY DETECTION:
- Temporal language indicating immediate need
- Competitive pressure signals
- Decision-making timeline indicators

### BEHAVIORAL ANALYSIS:
- Question patterns showing serious intent
- Information-seeking behaviors aligned with purchase readiness
- Emotional indicators (excitement, urgency, concern resolution)

Return ONLY this JSON structure:
{
  "handoverPrompt": "Comprehensive AI evaluation prompt for this specific campaign context with detailed triggers, scoring criteria, and handover conditions",
  "campaignSpecific": true,
  "triggerKeywords": ["specific", "campaign-relevant", "trigger", "words"],
  "qualificationCriteria": ["measurable", "campaign-aligned", "readiness", "signals"],
  "urgencyIndicators": ["time-sensitive", "decision-ready", "language"],
  "scoringThresholds": {"qualification": 75, "urgency": 85, "handover": 80},
  "reasoning": "Brief explanation of why these criteria align with campaign goals and audience"
}

CRITICAL: The handover prompt must be laser-focused on the specific campaign context and goals provided.`;

      const { content } = await LLMClient.generateAutomotiveContent(conversionPrompt);
      const parsed = this.coerceJson(content, { handoverPrompt: this.getDefaultHandoverPrompt() });

      return parsed.handoverPrompt || this.getDefaultHandoverPrompt();

    } catch (error) {
      console.error('Failed to convert handover criteria:', error);
      return this.getDefaultHandoverPrompt();
    }
  }

  /**
   * Generate final campaign with all AI-enhanced content
   */
  private static async generateFinalCampaign(data: any, ragContext: string = ''): Promise<any> {
    try {
      // Generate campaign name if not provided
      if (!data.name || data.name.length < 3) {
        const namePrompt = `Generate a catchy, professional name for an automotive campaign.
Context: ${data.context}
Goals: ${data.handoverGoals || data.campaignGoals}
${ragContext ? `Past campaign hints:\n${ragContext}\n` : ''}
Return only the campaign name, no quotes or extra text.`;
        const { content } = await LLMClient.generateAutomotiveContent(namePrompt);
        data.name = content.trim().replace(/^"|"$/g, ''); // Remove quotes if present
      }

      const segHint = Array.isArray(data.segments) && data.segments.length ? `\nAudience Segments: ${data.segments.map((s: any) => s.name).join(', ')}` : '';
      const templatePrompt = `
Create ${data.numberOfTemplates || 5} automotive email templates for this campaign:
Context: ${data.context}
Goals: ${data.handoverGoals || data.campaignGoals}
Handover Criteria: ${data.handoverCriteria}${segHint}
${ragContext ? `\nPast campaigns context:\n${ragContext}\n` : ''}

Each template should:
- Be automotive industry focused
- Include personalization placeholders like [Name] and [vehicleInterest]
- Progress from introduction to call-to-action
- Be professional but engaging
- Include automotive-specific offers or information

Return JSON array of template objects with "subject" and "content" fields.`;

      const { content: templatesResult } = await LLMClient.generateAutomotiveContent(templatePrompt);
      let templates: any[] = this.coerceJson<any[]>(templatesResult, [] as any[]);
      if ((!Array.isArray(templates)) || templates.length === 0) {
        templates = [
          { subject: `Welcome to ${data.name}`, content: `Hi [Name], welcome to our ${data.context} campaign!` }
        ];
      }

      // Generate subject lines
      const subjectPrompt = `Generate ${data.numberOfTemplates || 5} compelling email subject lines for automotive campaign: ${data.context}.
${ragContext ? `Past campaigns context:\n${ragContext}\n` : ''}Return as JSON array of strings.`;
      const { content: subjectsResult } = await LLMClient.generateAutomotiveContent(subjectPrompt);
      let subjects = this.coerceJson(subjectsResult, [`${data.name} - Special Offer`, `${data.name} - Update`, `${data.name} - Reminder`]);

      return {
        name: data.name,
        context: data.context,
        handoverGoals: data.handoverGoals,
        targetAudience: data.targetAudience,
        handoverPrompt: data.handoverPrompt,
        handoverCriteria: data.handoverCriteria,
        numberOfTemplates: data.numberOfTemplates || 5,
        templates: templates,
        subjectLines: subjects,
        status: 'draft',
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to generate final campaign:', error);
      return {
        name: data.name || 'New Automotive Campaign',
        context: data.context || 'General automotive campaign',
        handoverGoals: data.handoverGoals || 'Generate leads and drive sales',
        targetAudience: data.targetAudience || 'General automotive prospects',
        handoverPrompt: data.handoverPrompt || this.getDefaultHandoverPrompt(),
        numberOfTemplates: data.numberOfTemplates || 5,
        templates: [],
        subjectLines: [],
        status: 'draft'
      };
    }
  }

  /**
   * Get enhanced default handover prompt for fallback
   */
  private static getDefaultHandoverPrompt(): string {
    return `# AUTOMOTIVE SALES INTELLIGENCE EVALUATION SYSTEM

## YOUR ROLE:
You are an expert automotive sales intelligence AI analyzing customer conversations to identify optimal handover moments. Your mission is to detect genuine buying interest and qualification signals with precision.

## HANDOVER EVALUATION FRAMEWORK:

### IMMEDIATE HANDOVER TRIGGERS (Score: 90-100)
**High-Intent Purchase Signals:**
- Direct purchase language: "ready to buy", "want to purchase", "I'll take it", "let's move forward"
- Pricing commitment: "what's the best price", "can you match this price", "what's my payment"
- Scheduling urgency: "today", "this weekend", "ASAP", "how soon can I"
- Human escalation: "speak to someone", "talk to a person", "manager", "sales rep"

### STRONG QUALIFICATION SIGNALS (Score: 75-89)
**Serious Consideration Indicators:**
- Financial readiness: "financing options", "down payment", "monthly payment", "lease terms"
- Vehicle specificity: mentions specific models, years, trim levels, colors, features
- Comparison shopping: "versus", "compared to", "better than", competitor mentions
- Trade-in discussions: "trade my current car", "trade value", "what's it worth"
- Timeline establishment: "when available", "delivery time", "how long"

### MODERATE INTEREST SIGNALS (Score: 50-74)
**Developing Interest Indicators:**
- Information gathering: detailed feature questions, specification requests
- Availability checks: "do you have", "in stock", "on the lot"
- Appointment interest: "come look", "visit", "see it", "test drive" (without urgency)
- General pricing: "how much", "price range", "cost" (without commitment language)

### EVALUATION CRITERIA:
1. **Conversation Depth**: 8+ meaningful exchanges indicate serious engagement
2. **Question Quality**: Specific, detailed questions show genuine interest
3. **Response Speed**: Quick replies suggest active engagement
4. **Language Intensity**: Emotional language ("love", "perfect", "exactly") indicates strong interest
5. **Multiple Signal Types**: Customers showing 2+ different signal categories are handover-ready

### HANDOVER DECISION MATRIX:
- **Score 90-100**: Immediate handover (within 5 minutes)
- **Score 80-89**: Priority handover (within 15 minutes)
- **Score 75-79**: Standard handover (within 30 minutes)
- **Score 50-74**: Continue nurturing, reassess in 24 hours
- **Below 50**: Standard marketing sequence

### SPECIAL CONSIDERATIONS:
- **Urgency Language**: "today", "now", "immediately" = automatic +10 points
- **Competitor Mentions**: Active shopping = automatic +5 points
- **Emotional Indicators**: Excitement or frustration = manual review
- **Technical Questions**: Deep product knowledge needs = specialist referral

**HANDOVER TRIGGER**: Execute handover when score ≥ 80 OR any immediate trigger is detected.`;
  }

  /**
   * Pick a vehicle-aware noun for unit-based examples (trucks, SUVs, sedans, vehicles)
   */
  private static pickUnitsNoun(vehicleKeywords: string[], ctxLower: string): string {
    const has = (k: string) => (ctxLower.includes(k) || vehicleKeywords.includes(k));
    if (has('truck')) return 'trucks';
    if (has('suv')) return 'SUVs';
    if (has('sedan')) return 'sedans';
    return 'vehicles';
  }

  /**
   * Build target audience quick suggestions based on detected vehicle focus
   */
  private static buildAudienceSuggestions(vehicleKeywords: string[], ctxLower: string): string[] {
    const has = (k: string) => (ctxLower.includes(k) || vehicleKeywords.includes(k));
    if (has('truck')) {
      return [
        'Contractors & trades',
        'Fleet & small business',
        'Towing/hauling needs',
        'Outdoor & utility buyers'
      ];
    }
    if (has('suv')) {
      return [
        'Families & carpoolers',
        'Weekend adventurers',
        'Safety & space seekers',
        'Upgrade intenders from compact cars'
      ];
    }
    if (has('sedan')) {
      return [
        'Commuters & first-time buyers',
        'Budget-focused shoppers',
        'Credit rebuild shoppers'
      ];
    }
    return [
      'New prospects',
      'Current owners',
      'Leads with recent site activity'
    ];
  }


  /**
   * Get current campaign creation progress
   */
  static getCampaignProgress(currentStep: string): any {
    const stepIndex = this.campaignSteps.findIndex(step => step.id === currentStep);
    const totalSteps = this.campaignSteps.length;

    return {
      currentStep: stepIndex + 1,
      totalSteps,
      progress: Math.round(((stepIndex + 1) / totalSteps) * 100),
      stepName: currentStep
    };
  }

  /**
   * Extract vehicle-related keywords from user input for better RAG retrieval
   */
  private static extractVehicleKeywords(text: string): string[] {
    const vehicleTypes = ['truck','suv','sedan','coupe','convertible','wagon','hatchback','minivan','crossover','van'];
    const brands = ['ford','toyota','honda','chevrolet','chevy','nissan','hyundai','kia','subaru','mazda','volkswagen','vw','ram','dodge','bmw','mercedes','jeep','gmc'];
    const trims = ['awd','4wd','fx4','z71','lt','xlt','lariat','trail','sport','off-road','platinum','limited','denali','trs','trd','tremor'];
    const saleSignals = ['clearance','closeout','rebate','price drop','last year','previous model','leftover','demo','cpo','certified','blowout','inventory reduction'];
    const keywords: string[] = [];
    const lower = (text || '').toLowerCase();

    // years
    const years = lower.match(/\b20(1\d|2\d)\b/g);
    if (years) keywords.push(...Array.from(new Set(years)));

    for (const t of vehicleTypes) if (lower.includes(t)) keywords.push(t);
    for (const b of brands) if (lower.includes(b)) keywords.push(b);
    for (const tr of trims) if (lower.includes(tr)) keywords.push(tr);
    for (const s of saleSignals) if (lower.includes(s)) keywords.push(s);

    return Array.from(new Set(keywords));
  }
}