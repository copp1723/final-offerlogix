interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function generateAutomotiveContent(
  type: 'templates' | 'subjects' | 'goals',
  context: string,
  campaignName?: string
): Promise<any> {
  const { LLMClient } = await import('./llm-client.js');
  
  let prompt = '';
  
  switch (type) {
    case 'templates':
      prompt = `Generate 3 automotive email templates for a campaign named "${campaignName}" with the following context: ${context}. 
      Include vehicle showcases, service reminders, and test drive follow-ups. 
      Each template should have a subject, body, and call-to-action.
      Respond with JSON in this format: { "templates": [{"subject": "string", "body": "string", "cta": "string"}] }`;
      break;
    
    case 'subjects':
      prompt = `Generate 5 compelling email subject lines for an automotive campaign named "${campaignName}" with context: ${context}.
      Focus on automotive industry best practices and customer engagement.
      Respond with JSON in this format: { "subjectLines": ["string"] }`;
      break;
    
    case 'goals':
      prompt = `Generate 3 specific, measurable goals for an automotive email campaign with context: ${context}.
      Focus on automotive industry KPIs like test drives, service appointments, and sales.
      Respond with JSON in this format: { "goals": ["string"] }`;
      break;
  }

  try {
    const response = await LLMClient.generateAutomotiveContent(prompt);
    return JSON.parse(response.content);
  } catch (error) {
    console.error('Automotive content generation error:', error);
    // Retry with strict mode if initial attempt fails
    try {
      const retryResponse = await LLMClient.generateContent(prompt, { 
        json: true, 
        temperature: 0.2 
      });
      return JSON.parse(retryResponse);
    } catch (retryError) {
      console.error('Automotive content retry failed:', retryError);
      throw new Error('Failed to generate automotive content after retry');
    }
  }
}

export async function generateContent(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error("OpenRouter API key not found");
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'OneKeel Swarm',
      },
      body: JSON.stringify({
  model: 'openai/gpt-5-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an expert automotive campaign specialist helping create high-quality marketing campaigns and handover prompts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenRouter generateContent error:', error);
    return "Unable to generate content at this time.";
  }
}
