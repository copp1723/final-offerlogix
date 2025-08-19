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

    // OfferLogix B2B dealership‑outreach style
    const straightTalkingStyle = `

  ### System Prompt: OfferLogix Dealership Outreach Agent

  Core Identity:
  You help users create campaigns that promote OfferLogix services and payment/offer technology to automotive dealerships (B2B). You speak like an experienced vendor partner who understands dealership roles (GMs, GSMs, Internet Managers, Finance).

  Communication Style:
  - Be clear, direct, and helpful — no consumer retail tone
  - Use dealership outcomes: more qualified web leads, faster pencil, higher close rate, compliant payments, lower ad waste
  - Ask one focused question at a time; keep it short

  Guardrails:
  - Never frame messages as if targeting retail shoppers or moving vehicles
  - Do not propose consumer CTAs like test drives or trade‑in appraisals
  - Keep examples oriented to demos, pilots, integrations, ROI proof

  Goal:
  Guide to concrete B2B outcomes (e.g., book demos, start trials, enable website widgets, integrate with CRM/DR tools).
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
        clientId: '00000000-0000-0000-0000-000000000001',
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
        message: parsedResponse.message || "Let's create your OfferLogix dealership outreach campaign! What type of dealership campaign are you looking to create?",
        nextStep: parsedResponse.nextStep || "campaign_type",
        campaignData: parsedResponse.campaignData || campaignData,
        isComplete: parsedResponse.isComplete || false,
        // Compatibility fields for routes expecting these
        response: parsedResponse.message || "Let's create your OfferLogix dealership outreach campaign! What type of dealership campaign are you looking to create?",
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
          message: "Welcome! I’ll help you create a dealership outreach campaign to promote OfferLogix solutions. What type of campaign do you want to build? Examples: payment widget rollout, credit calculator trial, CRM/DR integration pilot, or ROI case‑study outreach.",
          nextStep: "target_audience",
          campaignData: { ...campaignData, type: userMessage },
          isComplete: false,
          response: "Welcome! I’ll help you create a dealership outreach campaign to promote OfferLogix solutions. What type of campaign do you want to build? Examples: payment widget rollout, credit calculator trial, CRM/DR integration pilot, or ROI case‑study outreach.",
          shouldHandover: false
        } as any;

      case "target_audience":
        return {
          message: "Great! Which dealership personas are you targeting? For example: GMs, GSMs, Internet managers, finance directors, or dealer groups?",
          nextStep: "goals",
          campaignData: { ...campaignData, audience: userMessage },
          isComplete: false,
          response: "Great! What type of automotive dealerships are you targeting? For example: new car dealerships, used car lots, luxury dealers, independent dealers, or dealership groups?",
          shouldHandover: false
        } as any;

      case "goals":
        return {
          message: "Perfect! What outcomes are you aiming for? For example: book OfferLogix demos, start 14‑day trials, enable website payment widgets, integrate with CRM/DR tools, or run a short ROI pilot.",
          nextStep: "details",
          campaignData: { ...campaignData, goals: userMessage },
          isComplete: false,
          response: "Perfect! What are your main goals for this dealership outreach campaign? For example: schedule software demos, book discovery calls, generate trial sign-ups, or onboard new dealership clients?",
          shouldHandover: false
        } as any;

      case "details":
        return {
          message: "Excellent — a couple logistics: how many emails in the sequence and how many days between sends? We’ll tailor copy for dealership decision‑makers.",
          nextStep: "complete",
          campaignData: {
            ...campaignData,
            details: userMessage,
            name: `${campaignData.type || 'OfferLogix Dealership'} Campaign`,
            context: `${campaignData.type || 'OfferLogix Solutions'} campaign targeting ${campaignData.audience || 'dealership leaders'} with goals to ${campaignData.goals || 'book demos and start trials'}`,
            handoverGoals: campaignData.goals || 'Book demos and trial sign‑ups from dealerships',
            numberOfTemplates: 5,
            daysBetweenMessages: 3
          },
          isComplete: false,
          response: "Excellent! Let me gather a few more details. How many emails would you like in this sequence, and how many days between each email?",
          shouldHandover: false
        } as any;

      case "complete":
        return {
          message: "Perfect! I have everything needed to create your OfferLogix dealership outreach campaign — focused on demos, trials, and integrations.",
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