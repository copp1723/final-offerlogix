import OpenAI from "openai";
import { LLMClient } from './llm-client';
import { AutomotivePromptService } from './automotive-prompts';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("AI API key not configured - need OPENROUTER_API_KEY or OPENAI_API_KEY");
    }

    openai = new OpenAI({
      apiKey,
      baseURL: process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined
    });
  }
  return openai;
}

// Resolve the correct model id based on environment and provider
function getModelId(): string {
  const envModel = process.env.AI_MODEL?.trim();
  const usingOpenRouter = !!process.env.OPENROUTER_API_KEY;

  if (envModel && envModel.length > 0) {
    // If using OpenRouter and model doesn't specify provider, default to OpenAI provider
    if (usingOpenRouter && !envModel.includes('/')) {
      return `openai/${envModel}`;
    }
    return envModel;
  }

  // Defaults
  return usingOpenRouter ? 'openai/gpt-4o' : 'gpt-4o';
}

export async function suggestCampaignGoals(context: string): Promise<string[]> {
  const prompt = `
Based on the following automotive campaign context, suggest 3 specific, actionable campaign goals that would be effective for automotive dealerships or manufacturers:

Context: ${context}

Consider automotive industry objectives like:
- Increasing test drive bookings
- Boosting service appointment scheduling
- Promoting vehicle sales and financing
- Enhancing customer loyalty and retention
- Driving dealership event attendance

Respond with a JSON object containing an array of goals:
{"goals": ["goal1", "goal2", "goal3"]}

Keep each goal concise (under 80 characters) and action-oriented.
`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: getModelId(),
      messages: [
        {
          role: "system",
          content: "You are an automotive marketing expert specializing in email campaign strategy. Provide specific, measurable goals for automotive businesses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 300
    });

    const result = JSON.parse(response.choices[0].message.content || '{"goals": []}');
    return result.goals || [];
  } catch (error) {
    console.error('Error generating campaign goals:', error);
    throw new Error('Failed to generate AI suggestions');
  }
}

export async function enhanceEmailTemplates(context: string, campaignName: string): Promise<{ templates: string[], subjectLines: string[] }> {
  const prompt = `
Create automotive email templates for a campaign named "${campaignName}" with this context: ${context}

Generate 2 professional email templates and 3 compelling subject lines specifically for automotive marketing.

Templates should include:
- Vehicle showcase elements (if applicable)
- Service appointment calls-to-action (if applicable)
- Professional automotive industry tone
- Clear next steps for customers
- Personalization placeholders like [CUSTOMER_NAME], [VEHICLE_MODEL]

Respond with JSON:
{
  "templates": ["template1", "template2"],
  "subjectLines": ["subject1", "subject2", "subject3"]
}

Keep templates under 300 words each and subject lines under 60 characters.
`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: getModelId(),
      messages: [
        {
          role: "system",
          content: "You are an automotive email marketing specialist. Create professional, engaging content that drives customer action in the automotive industry."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content || '{"templates": [], "subjectLines": []}');
    return {
      templates: result.templates || [],
      subjectLines: result.subjectLines || []
    };
  } catch (error) {
    console.error('Error enhancing templates:', error);
    throw new Error('Failed to enhance templates with AI');
  }
}

export async function suggestCampaignNames(context: string): Promise<string[]> {
  const prompt = `
Based on this automotive campaign context, suggest 5 creative and professional campaign names:

Context: ${context}

Campaign names should:
- Be memorable and catchy
- Reflect automotive industry focus
- Be under 50 characters
- Sound professional for dealerships/manufacturers
- Include action words or automotive terms when relevant

Respond with JSON:
{"names": ["name1", "name2", "name3", "name4", "name5"]}
`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: getModelId(),
      messages: [
        {
          role: "system",
          content: "You are an automotive marketing expert. Create campaign names that resonate with automotive customers and businesses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{"names": []}');
    return result.names || [];
  } catch (error) {
    console.error('Error generating campaign names:', error);
    throw new Error('Failed to generate campaign names');
  }
}

export async function generateEmailTemplates(context: string, campaignName: string, numberOfTemplates: number = 5): Promise<string[]> {
  // Use casual, specific tone like real salespeople
  const emailSystemPrompt = `You're a casual automotive salesperson writing quick emails. Write EXACTLY like these examples:

"With 140k on the clock, most '14 Silverados land somewhere in the $10k–$17k range depending on condition. Yours 4x4 or 2WD? Want me to have the team run a quick trade range?"

"$500's definitely doable for an Accord EX-L with some cash down — depends on how much you want upfront. How much were you thinking for the down payment?"

"Yeah, we can set that up no problem — just need to lock in which trim so the right truck's ready. You leaning toward V6, V8, or not fussed?"

STYLE RULES:
- Use contractions (it's, that's, you're, I'll)
- Give specific details when relevant
- Ask direct, casual questions
- Use dashes for asides — like this
- Under 80 words/4 sentences
- Sound like texting, not formal email
- NEVER reveal you're AI

Always respond with valid JSON.`;

  const prompt = `
Create ${numberOfTemplates} email templates for: ${context}

Write EXACTLY like my examples - casual, specific, helpful. 
- First: friendly opener with helpful info
- Middle: address needs with specifics  
- Last: gentle urgency

Each email:
- Under 80 words/4 sentences
- Sound like texting
- Use [Name] or [vehicleInterest] if natural
- End with simple question
- Format: minimal HTML with <br> for breaks

Return JSON:
{
  "templates": [
    {"sequence": 1, "title": "opener", "content": "..."},
    {"sequence": 2, "title": "follow", "content": "..."}
  ]
}
`;

  try {
    // Use LLMClient with enhanced system prompt
    const response = await LLMClient.generateAutomotiveContent(prompt, emailSystemPrompt);
    const result = JSON.parse(response.content || '{"templates": []}');
    return result.templates?.map((t: any) => t.content) || [];
  } catch (error) {
    console.error('Error generating email templates:', error);
    // Return basic templates as fallback
    const basicTemplates = [];
    for (let i = 1; i <= numberOfTemplates; i++) {
      basicTemplates.push(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>${campaignName} - Email ${i}</h2>
          <p>Dear [Name],</p>
          <p>We're excited to share information about our ${context}.</p>
          <p>Visit our dealership today to learn more!</p>
          <p>Best regards,<br>Your Automotive Team</p>
        </body>
        </html>
      `);
    }
    return basicTemplates;
  }
}

export async function generateSubjectLines(context: string, campaignName: string): Promise<string[]> {
  const prompt = `
Create 5 compelling email subject lines for an automotive campaign named "${campaignName}" with this context: ${context}

Subject lines should:
- Be under 60 characters
- Create urgency or curiosity
- Be relevant to automotive customers
- Avoid spam trigger words
- Include action-oriented language

Respond with JSON:
{"subjectLines": ["subject1", "subject2", "subject3", "subject4", "subject5"]}
`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: getModelId(),
      messages: [
        {
          role: "system",
          content: "You are an automotive email marketing expert. Create subject lines that maximize open rates for automotive campaigns."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{"subjectLines": []}');
    return result.subjectLines || [];
  } catch (error) {
    console.error('Error generating subject lines:', error);
    throw new Error('Failed to generate subject lines');
  }
}