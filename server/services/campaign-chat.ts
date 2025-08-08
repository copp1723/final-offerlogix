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
      followUp: 'Great! Tell me more about your campaign goals and target audience.'
    },
    {
      id: 'name',
      question: "What would you like to name this campaign?",
      dataField: 'name'
    },
    {
      id: 'goals',
      question: "What are your main goals for this campaign? (e.g., generate test drives, increase service bookings, promote new models)",
      dataField: 'handoverGoals'
    },
    {
      id: 'handover_criteria',
      question: "When do you want leads to be handed over to your sales team? Describe the signals that indicate a customer is ready (e.g., 'when they ask about pricing', 'when they want to schedule a test drive', 'when they seem urgent or ready to buy')",
      dataField: 'handoverCriteria',
      followUp: 'Perfect! I\'ll create smart handover rules based on what you described.'
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

      // Special processing for handover criteria
      if (currentStep === 'handover_criteria') {
        const handoverPrompt = await this.convertHandoverCriteriaToPrompt(userMessage);
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
  private static async convertHandoverCriteriaToPrompt(userInput: string): Promise<string> {
    try {
      const conversionPrompt = `
You are an expert at converting natural language handover criteria into structured automotive AI prompts.

USER INPUT: "${userInput}"

Convert this into a structured handover prompt that an AI can use to detect when customers should be handed over to sales. The prompt should:
1. Identify specific keywords and phrases to watch for
2. Define behavioral signals that indicate readiness
3. Set urgency levels based on language used
4. Include automotive-specific buying signals

Return a JSON object with this structure:
{
  "handoverPrompt": "Detailed prompt for AI to use when evaluating handover situations",
  "keywords": ["list", "of", "trigger", "words"],
  "signals": ["behavioral", "signals", "to", "detect"],
  "urgencyIndicators": ["immediate", "urgent", "language"],
  "automotiveContext": ["vehicle", "specific", "buying", "signals"]
}

Focus on automotive industry context like test drives, financing, trade-ins, pricing inquiries, and service appointments.`;

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
   * Get default handover prompt for fallback
   */
  private static getDefaultHandoverPrompt(): string {
    return `You are an automotive sales intelligence AI. Monitor customer conversations for these handover signals:

IMMEDIATE HANDOVER TRIGGERS:
- Price inquiries: "what does it cost", "how much", "price", "payment"
- Purchase intent: "ready to buy", "want to purchase", "I'll take it"
- Scheduling requests: "test drive", "appointment", "visit dealership"
- Urgency indicators: "today", "now", "ASAP", "immediately"
- Human requests: "speak to someone", "talk to human", "real person"

QUALIFICATION SIGNALS:
- Financing discussions: "loan", "financing", "monthly payment", "down payment" 
- Trade-in mentions: "trade in", "current vehicle", "sell my car"
- Specific model interest: mentions of specific vehicle models, years, features
- Timeline discussions: "when available", "delivery", "how soon"

EVALUATE:
- Conversation length and engagement level
- Qualification score based on responses
- Urgency level from language used
- Buying stage progression

HANDOVER when customer shows 2+ triggers or qualification score >75.`;
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