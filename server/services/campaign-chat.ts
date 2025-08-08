import { LLMClient } from './llm-client';
import { searchForCampaignChat, campaignChatPrompt } from '../integrations/supermemory';

interface CampaignChatResponse {
  message: string;
  nextStep?: string;
  data?: any;
  completed?: boolean;
  actions?: string[];
  suggestions?: string[];
  progress?: { stepIndex: number; total: number; percent: number };
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

  // NEW: Generic acknowledgement / non-substantive responses that should NOT advance the wizard
  private static genericAcks = [
    'ok','okay','k','kk','great','thanks','thank you','cool','yes','yep','sure','awesome','now what','what now','what next','next','continue','go on','fine','good','roger','understood','got it','sounds good','alright'
  ];

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


  // Heuristic + lightweight semantic guard to decide if we should advance
  private static async isSubstantiveAnswer(step: CampaignStep, userMessage: string): Promise<boolean> {
    if (!userMessage) return false;
    const msg = userMessage.trim().toLowerCase();
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
      const n = parseInt(msg, 10);
      return !isNaN(n) && n >= 1 && n <= 30;
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
    if (msg.split(/\s+/).length < 4) return false; // still too short

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
      // Get relevant past campaign data from Supermemory for context
      let ragResults: any = null;
      try {
        const clientId = existingData.clientId || 'default';

        ragResults = await searchForCampaignChat({
          clientId,
          campaignId: existingData.id,
          userTurn: userMessage,
          detectedType: existingData.context,
          vehicleKeywords: this.extractVehicleKeywords(userMessage + ' ' + (existingData.context || ''))
        });
      } catch (error) {
        console.warn('Failed to retrieve past campaigns from Supermemory:', error);
      }
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
        const retryQuestion = currentStepData.question;
        const coaching: Record<string,string> = {
          context: 'Please give a descriptive automotive campaign type with purpose or scenario (e.g., "Labor Day weekend clearance focused on trade-ins and same‑day financing").',
          goals: 'List 1-3 concrete business outcomes (e.g., "book 40 test drives", "increase trade-in appraisals", "revive inactive SUV leads").',
          target_audience: 'Describe who you want to reach (segments, demographics, intent signals, ownership stage, etc.).',
          name: 'Provide a short, branded campaign name you would present internally or to leadership.',
          handover_criteria: 'Describe the exact conversational signals that mean a sales rep should take over (pricing pressure, scheduling requests, urgency, financing readiness, trade-in specifics, etc.).',
          email_templates: 'Enter a number 1–30 indicating how many emails you want in the sequence.'
        };
        return {
          message: `I need a bit more detail before we move on. ${coaching[currentStepData.id] || ''}\n\n${retryQuestion}`.trim(),
          nextStep: currentStepData.id,
          data: existingData, // do NOT update yet
          actions: ['retry'],
          suggestions: this.suggestionsByStep[currentStepData.id] || [],
          progress: {
            stepIndex: stepIndex, // unchanged
            total: this.campaignSteps.length,
            percent: Math.round((stepIndex / this.campaignSteps.length) * 100)
          }
        };
      }

      // Process user's substantive response for current step
      const updatedData = { ...existingData };
      updatedData[currentStepData.dataField] = userMessage;

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
        const n = parseInt(userMessage, 10);
        if (!isNaN(n) && n >= 1 && n <= 30) {
          updatedData.daysBetweenMessages = n;
        }
      }

      if (currentStep === 'content_generation') {
        try {
          const generation = await this.generateFinalCampaign({ ...updatedData });
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
      const nextStepIndex = stepIndex + 1;
      const nextStep = this.campaignSteps[nextStepIndex];
      const isCompleted = isLaunchCommand || nextStepIndex >= this.campaignSteps.length;

      if (isCompleted) {
        // Ensure final campaign has templates/content
        let finalCampaign = { ...updatedData } as any;
        if (!finalCampaign.templates || finalCampaign.templates.length === 0) {
          finalCampaign = await this.generateFinalCampaign(finalCampaign);
        }

        // Calculate final progress
        const progress = {
          stepIndex: this.campaignSteps.length,
          total: this.campaignSteps.length,
          percent: 100
        };

        // Broadcast completion via WebSocket
        this.broadcastProgress(null, this.campaignSteps.length, this.campaignSteps.length, 100);

        const leadCount = finalCampaign.leadList?.total || finalCampaign.leadList?.length || 0;
        return {
          message: `Review complete! "${finalCampaign.name}" has ${finalCampaign.numberOfTemplates || finalCampaign.templateCount || 5} templates${leadCount ? ` and ${leadCount} leads` : ''}. Type "Launch" to activate or edit any step before launching.`,
          completed: true,
          data: finalCampaign,
            actions: ['create_campaign', 'ready_to_launch'],
          progress,
          suggestions: this.suggestionsByStep['review_launch'] || []
        };
      }
      // nextStep already defined

      // NEW: attempt dynamic LLM-generated conversational response instead of always using static followUp
      let responseMessage: string | null = null;
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
          model: 'openai/gpt-5-mini',
          system: 'You are a concise, helpful automotive campaign strategist. Keep replies friendly, professional, and specific to automotive marketing. Never hallucinate data not provided.',
          user: llmUserPrompt,
          temperature: 0.6,
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

      return {
        message: responseMessage,
        nextStep: nextStep.id,
        data: updatedData,
        actions: ["continue"],
        suggestions: this.suggestionsByStep[nextStep.id] || [],
        progress
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
      // obtain ragResults locally here to avoid undefined reference
      let ragResults: any = null;
      try {
        ragResults = await searchForCampaignChat({
          clientId: 'default',
          campaignId: undefined,
          userTurn: userInput,
          detectedType: campaignContext,
          vehicleKeywords: this.extractVehicleKeywords(userInput + ' ' + (campaignContext || ''))
        });
      } catch (e) {
        // silent fallback
      }
      let contextSection = '';
      if (ragResults && ragResults.results && ragResults.results.length > 0) {
        const snippets = ragResults.results.map((r: any) => ({
          title: r.metadata?.name || r.metadata?.title,
          content: r.content
        }));
        contextSection = `\n## RETRIEVED CONTEXT FROM PAST CAMPAIGNS:\n${snippets.map((s: any) => `${s.title ? `${s.title}: ` : ''}${s.content}`).join('\n---\n')}\nUse this historical data to inform your handover criteria generation.\n`;
      }

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
  private static async generateFinalCampaign(data: any): Promise<any> {
    try {
      // Generate campaign name if not provided
      if (!data.name || data.name.length < 3) {
        const namePrompt = `Generate a catchy, professional name for an automotive campaign. Context: ${data.context}. Goals: ${data.handoverGoals}. Return only the campaign name, no quotes or extra text.`;
        const { content } = await LLMClient.generateAutomotiveContent(namePrompt);
        data.name = content.trim().replace(/^"|"$/g, ''); // Remove quotes if present
      }

      // Generate email templates based on context and goals
      const templatePrompt = `
Create ${data.numberOfTemplates || 5} automotive email templates for this campaign:
Context: ${data.context}
Goals: ${data.handoverGoals}
Handover Criteria: ${data.handoverCriteria}

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
      const subjectPrompt = `Generate ${data.numberOfTemplates || 5} compelling email subject lines for automotive campaign: ${data.context}. Return as JSON array of strings.`;
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
    const vehicleTypes = ['truck', 'suv', 'sedan', 'coupe', 'convertible', 'wagon', 'hatchback', 'minivan', 'crossover'];
    const brands = ['ford', 'toyota', 'honda', 'chevrolet', 'nissan', 'hyundai', 'kia', 'subaru', 'mazda', 'volkswagen'];
    const keywords: string[] = [];

    const lowerText = text.toLowerCase();

    vehicleTypes.forEach(type => {
      if (lowerText.includes(type)) keywords.push(type);
    });

    brands.forEach(brand => {
      if (lowerText.includes(brand)) keywords.push(brand);
    });

    return keywords;
  }
}