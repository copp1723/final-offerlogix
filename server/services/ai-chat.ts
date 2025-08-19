  import { LLMClient } from "./llm-client";
  import { CampaignPromptService } from "./campaign-prompts";
  import { getAiChatSchemaPrompt } from "./prompt-schemas";
  import { kbAIIntegration } from "./kb-ai-integration";
  
  function getPersonalityGuidance(personality: string): string {
    const guidance: Record<string, string> = {
      'GRUMPY': 'Be direct and slightly impatient but still helpful. Use phrases like "Look," "Listen," "Fine," and push for quick decisions.',
      'ENTHUSIASTIC': 'Be very excited and energetic! Use exclamation points and show genuine enthusiasm about automotive campaigns.',
      'LAID_BACK': 'Be relaxed and casual. Use phrases like "No worries," "Take your time," and don\'t push too hard.',
      'PROFESSIONAL': 'Maintain formal professionalism and demonstrate expertise with clear, structured responses.'
    };
    return guidance[personality.toUpperCase()] || guidance['PROFESSIONAL'];
  }
  
  interface CampaignChatResponse {
    message: string;
    nextStep?: string;
    campaignData?: any;
    isComplete?: boolean;
    // Compatibility fields for existing routes
    response?: string;
    shouldHandover?: boolean;
  }
  
  export async function processCampaignChat(
    userMessage: string,
    currentStep: string,
    campaignData: any,
    context?: any
  ): Promise<CampaignChatResponse> {
    // Require OpenRouter for chat widget AI; fall back to rule-based if unavailable
    if (!process.env.OPENROUTER_API_KEY) {
      console.log("No OpenRouter API key available, using fallback response for:", userMessage);
      return processStepBasedResponse(userMessage, currentStep, campaignData);
    }
  
    // Get active AI agent configuration to apply personality
    let personalityContext = "";
    try {
      const { storage } = await import('../storage');
      const activeConfig = await storage.getActiveAiAgentConfig();
      if (activeConfig?.personality) {
        personalityContext = `
  
  ## PERSONALITY CONTEXT:
  You have a ${activeConfig.personality} personality. Adapt your responses accordingly:
  ${getPersonalityGuidance(activeConfig.personality)}`;
      }
    } catch (error) {
      console.warn("Could not load AI agent configuration:", error);
    }

    // Standardized campaign creation system prompt used across features
    const basePrompt = CampaignPromptService.getCampaignCreationPrompt();

    // Straight-Talking Automotive Pro style (per demo request)
    const straightTalkingStyle = `

  ### System Prompt: The Straight-Talking Automotive Pro

  Core Identity:
  You are an experienced sales professional. You're knowledgeable, direct, and genuinely helpful - not a pushy salesperson. You talk like a real person who knows OfferLogix and knows dealers, and understands that picking a vendor is a big decision.

  Communication Style:
  - Be real. Talk like you would to a friend who's asking for car advice
  - Be direct. No fluff, no corporate speak
  - Be helpful. Figure out what they actually need and point them in the right direction
  - Be conversational. Short sentences. Natural flow. Like you're texting a friend

  How You Engage:
  - Ask one simple question at a time
  - Listen and build on what they tell you
  - Don't jump straight to selling

  What You DON'T Do:
  - No marketing speak
  - No five-in-one questions
  - Don't ignore what they just told you
  - Don't sound like a robot
  - Don't be overly enthusiastic about everything

  Goal:
  Have a normal conversation that helps them figure out what they actually want. If they're ready to move forward, make it easy. If they're not, give them something useful and stay in touch.
  `;

    const systemPrompt = `${basePrompt}
  ${personalityContext}
  ${straightTalkingStyle}

  ${getAiChatSchemaPrompt()}`;

    // Fetch KB context without requiring a real campaign (uses client 'default', optional campaignId if provided)
    let kbContextBlock = '';
    try {
      const typicalSteps = new Set(["welcome","campaign_type","target_audience","goals","details","complete"]);
      const campaignId = currentStep && !typicalSteps.has(currentStep) ? currentStep : undefined;
      const kb = await kbAIIntegration.getCampaignChatContextWithKB({
        clientId: 'default',
        campaignId,
        userTurn: userMessage,
        context: typeof campaignData === 'object' ? campaignData?.context : undefined,
        goals: typeof campaignData === 'object' ? campaignData?.handoverGoals : undefined
      });
      if (kb?.hasKBData && kb.kbContext) {
        const trimmed = kb.kbContext.slice(0, 2000);
        kbContextBlock = `\n\nKnowledge Base Context (truncated):\n${trimmed}\n`;
      }
    } catch (e) {
      console.warn('KB context unavailable for chat widget:', e);
    }

    const userPayload = `Current step or campaignId: ${currentStep}
  Current campaign data (includes any KB context if available): ${JSON.stringify(campaignData)}
  User message: ${userMessage}
  ${kbContextBlock}

  Guidelines:
  - Keep responses conversational and professional
  - Ask one focused question at a time
  - Show understanding of automotive industry context
  - Suggest relevant automotive campaign ideas based on their responses
  - Be encouraging and supportive
  - When moving to the next step, naturally transition the conversation`;

    try {
      const { content } = await LLMClient.generate({
        model: 'openai/gpt-5-chat',
        system: systemPrompt,
        user: userPayload,
        json: true,
        temperature: 0.3,
        maxTokens: 900
      });

      const parsedResponse = JSON.parse(content || '{}');

      return {
        message: parsedResponse.message || "Let's create your automotive email campaign! What type of campaign are you looking to create?",
        nextStep: parsedResponse.nextStep || "campaign_type",
        campaignData: parsedResponse.campaignData || campaignData,
        isComplete: parsedResponse.isComplete || false,
        // Compatibility fields for routes expecting these
        response: parsedResponse.message || "Let's create your automotive email campaign! What type of campaign are you looking to create?",
        shouldHandover: false
      } as any;

    } catch (error) {
      console.error("AI chat error:", error);
      return processStepBasedResponse(userMessage, currentStep, campaignData);
    }
  }
  
  function processStepBasedResponse(userMessage: string, currentStep: string, campaignData: any): CampaignChatResponse {
    // Fallback logic for when AI is not available
    switch (currentStep) {
      case "welcome":
      case "campaign_type":
        return {
          message: "Welcome! I'm here to help you create an outreach campaign to connect with automotive dealerships. What type of dealership outreach campaign would you like to create? For example: credit calculator software demo, payment calculator trial, dealership management tools, or seasonal software promotions?",
          nextStep: "target_audience",
          campaignData: { ...campaignData, type: userMessage },
          isComplete: false,
          response: "Welcome! I'm here to help you create an outreach campaign to connect with automotive dealerships. What type of dealership outreach campaign would you like to create? For example: credit calculator software demo, payment calculator trial, dealership management tools, or seasonal software promotions?",
          shouldHandover: false
        } as any;

      case "target_audience":
        return {
          message: "Great! What type of automotive dealerships are you targeting? For example: new car dealerships, used car lots, luxury dealers, independent dealers, or dealership groups?",
          nextStep: "goals",
          campaignData: { ...campaignData, audience: userMessage },
          isComplete: false,
          response: "Great! What type of automotive dealerships are you targeting? For example: new car dealerships, used car lots, luxury dealers, independent dealers, or dealership groups?",
          shouldHandover: false
        } as any;

      case "goals":
        return {
          message: "Perfect! What are your main goals for this dealership outreach campaign? For example: schedule software demos, book discovery calls, generate trial sign-ups, or onboard new dealership clients?",
          nextStep: "details",
          campaignData: { ...campaignData, goals: userMessage },
          isComplete: false,
          response: "Perfect! What are your main goals for this dealership outreach campaign? For example: schedule software demos, book discovery calls, generate trial sign-ups, or onboard new dealership clients?",
          shouldHandover: false
        } as any;

      case "details":
        return {
          message: "Excellent! Let me gather a few more details. How many emails would you like in this sequence, and how many days between each email?",
          nextStep: "complete",
          campaignData: {
            ...campaignData,
            details: userMessage,
            name: `${campaignData.type || 'OfferLogix Dealership'} Campaign`,
            context: `${campaignData.type || 'OfferLogix Software'} campaign targeting ${campaignData.audience || 'automotive dealerships'} with goals to ${campaignData.goals || 'generate software trials'}`,
            handoverGoals: campaignData.goals || 'Generate software demos and trial sign-ups from automotive dealerships',
            numberOfTemplates: 5,
            daysBetweenMessages: 3
          },
          isComplete: false,
          response: "Excellent! Let me gather a few more details. How many emails would you like in this sequence, and how many days between each email?",
          shouldHandover: false
        } as any;

      case "complete":
        return {
          message: "Perfect! I have all the information needed to create your dealership outreach campaign. The campaign will be set up to connect with automotive dealerships and promote OfferLogix software solutions.",
          nextStep: "complete",
          campaignData: {
            ...campaignData,
            finalDetails: userMessage
          },
          isComplete: true,
          response: "Perfect! I have all the information needed to create your dealership outreach campaign. The campaign will be set up to connect with automotive dealerships and promote OfferLogix software solutions.",
          shouldHandover: false
        } as any;

      default:
        return {
          message: "Let's start creating your automotive email campaign! What type of campaign would you like to create?",
          nextStep: "campaign_type",
          campaignData: campaignData,
          isComplete: false,
          response: "Let's start creating your automotive email campaign! What type of campaign would you like to create?",
          shouldHandover: false
        } as any;
    }
  }