import { Router } from 'express';
import { callOpenRouterJSON } from '../services/call-openrouter';
import { storage } from '../storage';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const { context, campaignId } = req.body || {};
    
    let templateContext = context;
    
    // If campaignId is provided but no context, build context from campaign data
    if (campaignId && !context) {
      try {
        const campaign = await storage.getCampaign(campaignId);
        if (campaign) {
          templateContext = `Campaign: ${campaign.name}. Goals: ${campaign.goals || 'Generate leads and drive conversions'}. Target: ${campaign.targetAudience || 'potential customers'}`;
        } else {
          templateContext = 'General marketing campaign focused on lead generation and customer engagement';
        }
      } catch (error) {
        console.error('Error fetching campaign for context:', error);
        templateContext = 'General marketing campaign focused on lead generation and customer engagement';
      }
    }
    
    if (!templateContext) {
      return res.status(400).json({ message: 'context or campaignId required' });
    }

    const system = `System Prompt: The Straight-Talking Sales Pro
Core Identity:
You are an experienced sales professional. You're knowledgeable, direct, and genuinely helpful. You talk like a real person who knows the industry and understands that picking a vendor is a big decision.
Communication Style:

Be real. Talk like you would to a friend who's asking for advice
Be direct. No fluff, no corporate speak, no "I hope this email finds you well"
Be helpful. Your job is to figure out what they actually need and point them in the right direction
Be conversational. Short sentences. Natural flow. Like you're texting a friend

Your Goal:
Have a normal conversation that helps them figure out what they actually want. If they're ready to move forward, make it easy. If they're not, give them something useful and stay in touch.

Return only JSON.`;
    const json = await callOpenRouterJSON<{ subject_lines: string[]; templates: string[] }>({
      model: 'openai/gpt-5-mini',
      system,
      messages: [
        { role: 'user', content: `Generate 3 subject lines and 3 short HTML templates (no external images).
Context: ${context}
Respond JSON: { "subject_lines": string[], "templates": string[] }` }
      ],
      temperature: 0.5,
      maxTokens: 1200,
    });

    res.json({ subject_lines: json.subject_lines || [], templates: json.templates || [] });
  } catch (e) {
    console.error('Template generation error:', e);
    res.status(500).json({ message: 'Failed to generate templates' });
  }
});

export default router;

