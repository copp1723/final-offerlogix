import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }
  return openai;
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
      model: "gpt-4o",
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
      model: "gpt-4o",
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
      model: "gpt-4o",
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