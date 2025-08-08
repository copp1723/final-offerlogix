import { generateContent } from './openrouter';

interface CampaignChatResponse {
  message: string;
  nextStep?: string;
  data?: any;
  completed?: boolean;
  actions?: string[];
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
      dataField: 'templateCount'
    }
  ];

  /**
   * Process campaign creation chat conversation
   */
  static async processCampaignChat(
    userMessage: string,
    currentStep: string = 'context',
    existingData: any = {}
  ): Promise<CampaignChatResponse> {
    try {
      const stepIndex = this.campaignSteps.findIndex(step => step.id === currentStep);
      const currentStepData = this.campaignSteps[stepIndex];
      
      if (!currentStepData) {
        return {
          message: "I'm not sure what step we're on. Let's start over. What type of automotive campaign would you like to create?",
          nextStep: 'context'
        };
      }

      // Process user's response for current step
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
        const count = parseInt(userMessage) || 5;
        updatedData.templateCount = Math.min(Math.max(count, 1), 30);
      }

      // Determine next step
      const nextStepIndex = stepIndex + 1;
      const isCompleted = nextStepIndex >= this.campaignSteps.length;
      
      if (isCompleted) {
        // Generate final campaign data
        const finalCampaign = await this.generateFinalCampaign(updatedData);
        
        return {
          message: `Excellent! I've created your "${finalCampaign.name}" campaign with smart handover rules and ${finalCampaign.templateCount} email templates. Your campaign is ready to launch!`,
          completed: true,
          data: finalCampaign,
          actions: ['create_campaign', 'generate_templates']
        };
      }

      const nextStep = this.campaignSteps[nextStepIndex];
      const responseMessage = currentStepData.followUp || 
        `Got it! ${nextStep.question}`;

      return {
        message: responseMessage,
        nextStep: nextStep.id,
        data: updatedData
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
   * Convert user's natural language handover criteria into structured AI prompt
   */
  private static async convertHandoverCriteriaToPrompt(
    userInput: string, 
    campaignContext?: string,
    campaignGoals?: string,
    targetAudience?: string
  ): Promise<string> {
    try {
      const conversionPrompt = `
# ROLE: Expert Automotive Handover Intelligence Designer
You are a world-class automotive sales intelligence expert who specializes in converting natural language into precise, actionable AI handover criteria. You understand buyer psychology, sales processes, and automotive industry nuances.

## CAMPAIGN INTELLIGENCE:
**Campaign Context:** "${campaignContext || 'General automotive campaign'}"
**Campaign Goals:** "${campaignGoals || 'Generate automotive leads'}"  
**Target Audience:** "${targetAudience || 'General automotive prospects'}"
**User's Natural Language Criteria:** "${userInput}"

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

      const result = await generateContent(conversionPrompt);
      const parsed = JSON.parse(result);
      
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
        data.name = await generateContent(namePrompt);
      }

      // Generate email templates based on context and goals
      const templatePrompt = `
Create ${data.templateCount || 5} automotive email templates for this campaign:
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

      const templatesResult = await generateContent(templatePrompt);
      let templates;
      try {
        const parsed = JSON.parse(templatesResult);
        templates = parsed.templates || parsed || [];
      } catch {
        templates = [];
      }

      // Generate subject lines
      const subjectPrompt = `Generate ${data.templateCount || 5} compelling email subject lines for automotive campaign: ${data.context}. Return as JSON array of strings.`;
      const subjectsResult = await generateContent(subjectPrompt);
      let subjects;
      try {
        subjects = JSON.parse(subjectsResult);
      } catch {
        subjects = [`${data.name} - Special Offer`, `${data.name} - Update`, `${data.name} - Reminder`];
      }

      return {
        name: data.name,
        context: data.context,
        handoverGoals: data.handoverGoals,
        handoverPrompt: data.handoverPrompt,
        handoverCriteria: data.handoverCriteria,
        templateCount: data.templateCount || 5,
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
        handoverPrompt: data.handoverPrompt || this.getDefaultHandoverPrompt(),
        templateCount: data.templateCount || 5,
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
}