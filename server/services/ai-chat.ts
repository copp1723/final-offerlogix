  import { getOpenAIClient } from "./openai";
  
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
  }
  
  export async function processCampaignChat(
    userMessage: string,
    currentStep: string,
    campaignData: any
  ): Promise<CampaignChatResponse> {
    // Check if we have API access first
    if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
      console.log("No AI API key available, using fallback response for:", userMessage);
      return processStepBasedResponse(userMessage, currentStep, campaignData);
    }
  
    const openai = getOpenAIClient();
  
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
  
    const conversationContext = `
  You are an AI Campaign Agent specializing in automotive email marketing. Your goal is to have a natural conversation with the user to gather information for creating an automotive email campaign.${personalityContext}
  
  Current step: ${currentStep}
  Current campaign data: ${JSON.stringify(campaignData)}
  
  Steps flow:
  1. campaign_type - Ask about the type of automotive campaign (new vehicle launch, service reminders, test drive follow-up, seasonal promotions, etc.)
  2. target_audience - Understand their target audience (new buyers, existing customers, specific demographics)
  3. goals - Clarify campaign goals (test drive bookings, service appointments, sales leads, customer retention)
  4. details - Gather specific details (number of emails, timing, special offers, vehicle details)
  5. complete - Confirm all information is collected
  
  Guidelines:
  - Keep responses conversational and professional
  - Ask one focused question at a time
  - Show understanding of automotive industry context
  - Suggest relevant automotive campaign ideas based on their responses
  - Be encouraging and supportive
  - When moving to the next step, naturally transition the conversation
  
  User message: "${userMessage}"
  
  Respond with helpful guidance and ask the next relevant question. If you have enough information to move to the next step, do so naturally.
  `;
  
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system", 
            content: `You are an AI Campaign Agent for automotive marketing. Respond with JSON in this exact format:
  {
    "message": "Your conversational response here",
    "nextStep": "campaign_type|target_audience|goals|details|complete",
    "campaignData": {"name": "...", "context": "...", "handoverGoals": "...", "numberOfTemplates": 5, "daysBetweenMessages": 3},
    "isComplete": false
  }
  
  Current step: ${currentStep}
  Current data: ${JSON.stringify(campaignData)}
  User message: ${userMessage}
  
  Ask natural questions to gather automotive campaign information.`,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        response_format: { type: "json_object" },
      });
  
      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error("No response from AI");
      }
  
      const parsedResponse = JSON.parse(aiResponse);
      
      return {
        message: parsedResponse.message || "Let's create your automotive email campaign! What type of campaign are you looking to create?",
        nextStep: parsedResponse.nextStep || "campaign_type",
        campaignData: parsedResponse.campaignData || campaignData,
        isComplete: parsedResponse.isComplete || false
      };
  
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
          message: "Welcome! I'm here to help you create an automotive email campaign. What type of campaign would you like to create? For example: new vehicle launch, service reminders, test drive follow-up, or seasonal promotions?",
          nextStep: "target_audience",
          campaignData: { ...campaignData, type: userMessage },
          isComplete: false
        };
        
      case "target_audience":
        return {
          message: "Great! Who is your target audience for this campaign? Are you targeting new buyers, existing customers, or a specific demographic?",
          nextStep: "goals",
          campaignData: { ...campaignData, audience: userMessage },
          isComplete: false
        };
        
      case "goals":
        return {
          message: "Perfect! What are your main goals for this campaign? For example: schedule test drives, book service appointments, generate sales leads, or improve customer retention?",
          nextStep: "details",
          campaignData: { ...campaignData, goals: userMessage },
          isComplete: false
        };
        
      case "details":
        return {
          message: "Excellent! Let me gather a few more details. How many emails would you like in this sequence, and how many days between each email?",
          nextStep: "complete",
          campaignData: { 
            ...campaignData, 
            details: userMessage,
            name: `${campaignData.type || 'Automotive'} Campaign`,
            context: `${campaignData.type || 'Automotive'} campaign targeting ${campaignData.audience || 'customers'} with goals to ${campaignData.goals || 'increase engagement'}`,
            handoverGoals: campaignData.goals || 'Increase customer engagement and drive sales',
            numberOfTemplates: 5,
            daysBetweenMessages: 3
          },
          isComplete: false
        };
        
      case "complete":
        return {
          message: "Perfect! I have all the information needed to create your automotive email campaign. The campaign will be set up with your specifications.",
          nextStep: "complete",
          campaignData: { 
            ...campaignData,
            finalDetails: userMessage
          },
          isComplete: true
        };
        
      default:
        return {
          message: "Let's start creating your automotive email campaign! What type of campaign would you like to create?",
          nextStep: "campaign_type",
          campaignData: campaignData,
          isComplete: false
        };
    }
  }