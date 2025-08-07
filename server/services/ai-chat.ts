import { getOpenAIClient } from "./openai";

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
  const openai = getOpenAIClient();

  const conversationContext = `
You are an AI Campaign Agent specializing in automotive email marketing. Your goal is to have a natural conversation with the user to gather information for creating an automotive email campaign.

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

    let aiResponse;
    try {
      aiResponse = JSON.parse(response.choices[0].message.content || "{}");
    } catch {
      // Fallback if JSON parsing fails
      return processStepBasedResponse(userMessage, currentStep, campaignData);
    }

    return {
      message: aiResponse.message || processStepBasedResponse(userMessage, currentStep, campaignData).message,
      nextStep: aiResponse.nextStep || getNextStep(currentStep, userMessage),
      campaignData: aiResponse.campaignData || {},
      isComplete: aiResponse.isComplete || false,
    };
  } catch (error) {
    console.error("AI chat error:", error);
    return processStepBasedResponse(userMessage, currentStep, campaignData);
  }
}

function processStepBasedResponse(
  userMessage: string,
  currentStep: string,
  campaignData: any
): CampaignChatResponse {
  const responses: Record<string, any> = {
    campaign_type: {
      message: "Great! I can help you create that campaign. Who is your main target audience for this campaign? Are you focusing on new car buyers, existing customers for service, or a specific demographic?",
      nextStep: "target_audience",
      campaignData: extractCampaignType(userMessage),
    },
    target_audience: {
      message: "Perfect! Now, what's your main goal for this campaign? Are you looking to book test drives, schedule service appointments, generate sales leads, or something else?",
      nextStep: "goals", 
      campaignData: extractTargetAudience(userMessage),
    },
    goals: {
      message: "Excellent! Let's get into the specifics. How many email messages would you like in this campaign sequence? And how many days apart should each message be sent?",
      nextStep: "details",
      campaignData: extractGoals(userMessage),
    },
    details: {
      message: "Perfect! I have all the information needed to create your automotive email campaign. Let me generate personalized email templates based on your requirements. Would you like me to proceed?",
      nextStep: "complete",
      campaignData: extractDetails(userMessage),
      isComplete: true,
    },
    complete: {
      message: "Your campaign is ready! I can now generate the email templates and set up your campaign. Would you like to review the details or proceed with creation?",
      isComplete: true,
    },
  };

  const response = responses[currentStep] || responses.campaign_type;
  
  return {
    message: response.message,
    nextStep: response.nextStep,
    campaignData: { ...campaignData, ...(response.campaignData || {}) },
    isComplete: response.isComplete || false,
  };
}

function extractCampaignType(message: string): any {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("service") || lowerMessage.includes("maintenance")) {
    return { context: "Service reminder campaign", name: "Service Maintenance Campaign" };
  } else if (lowerMessage.includes("test drive") || lowerMessage.includes("drive")) {
    return { context: "Test drive follow-up campaign", name: "Test Drive Campaign" };
  } else if (lowerMessage.includes("new") || lowerMessage.includes("launch") || lowerMessage.includes("model")) {
    return { context: "New vehicle launch campaign", name: "New Vehicle Launch" };
  } else if (lowerMessage.includes("seasonal") || lowerMessage.includes("holiday") || lowerMessage.includes("summer") || lowerMessage.includes("winter")) {
    return { context: "Seasonal promotion campaign", name: "Seasonal Promotion" };
  } else {
    return { context: `Automotive email campaign: ${message}`, name: "Custom Campaign" };
  }
}

function extractTargetAudience(message: string): any {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("new") && lowerMessage.includes("buyer")) {
    return { handoverGoals: "Target new car buyers with personalized vehicle recommendations" };
  } else if (lowerMessage.includes("existing") || lowerMessage.includes("current")) {
    return { handoverGoals: "Engage existing customers for retention and service" };
  } else if (lowerMessage.includes("young") || lowerMessage.includes("millennial")) {
    return { handoverGoals: "Target young demographic with modern vehicle features" };
  } else {
    return { handoverGoals: `Target audience: ${message}` };
  }
}

function extractGoals(message: string): any {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("test drive") || lowerMessage.includes("drive")) {
    return { handoverGoals: "Generate test drive bookings and showroom visits" };
  } else if (lowerMessage.includes("service") || lowerMessage.includes("appointment")) {
    return { handoverGoals: "Schedule service appointments and maintenance visits" };
  } else if (lowerMessage.includes("lead") || lowerMessage.includes("sales")) {
    return { handoverGoals: "Generate qualified sales leads and conversions" };
  } else {
    return { handoverGoals: `Campaign goal: ${message}` };
  }
}

function extractDetails(message: string): any {
  const details: any = {};
  
  // Extract number of emails
  const emailMatch = message.match(/(\d+)\s*(email|message|template)/i);
  if (emailMatch) {
    details.numberOfTemplates = parseInt(emailMatch[1]);
  } else {
    details.numberOfTemplates = 5; // default
  }
  
  // Extract days between messages
  const daysMatch = message.match(/(\d+)\s*day/i);
  if (daysMatch) {
    details.daysBetweenMessages = parseInt(daysMatch[1]);
  } else {
    details.daysBetweenMessages = 3; // default
  }
  
  return details;
}

function getNextStep(currentStep: string, userMessage: string): string {
  const steps = ["campaign_type", "target_audience", "goals", "details", "complete"];
  const currentIndex = steps.indexOf(currentStep);
  
  if (currentIndex < steps.length - 1) {
    return steps[currentIndex + 1];
  }
  
  return "complete";
}