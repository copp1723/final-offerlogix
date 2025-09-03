import { generateEmailTemplates } from "./openai";
import { storage } from "../storage";
import type { Template, InsertTemplate } from "@shared/schema";

export async function generateCampaignTemplates(campaignId: string, count: number = 3): Promise<Template[]> {
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) {
    throw new Error("campaign_not_found");
  }

  try {
    const aiTemplates = await generateEmailTemplates(campaign.context, campaign.name, count);
    const generated: Template[] = [];

    if (!aiTemplates || aiTemplates.length === 0) {
      aiTemplates.push({});
    }

    for (const tpl of aiTemplates.slice(0, count)) {
      const subject = typeof tpl.subject === "string" && tpl.subject.trim() ? tpl.subject : `Campaign ${campaign.name}`;
      const bodyHtml = typeof tpl.content === "string" && tpl.content.trim() ? tpl.content : "";
      const bodyText = typeof tpl.text === "string" && tpl.text.trim()
        ? tpl.text
        : bodyHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();

      if (!bodyHtml.trim() && !bodyText.trim()) {
        throw new Error("ai_generation_failed");
      }

      const insert: InsertTemplate = {
        campaignId,
        subject,
        bodyHtml,
        bodyText,
      } as InsertTemplate;

      const template = await storage.createTemplate(insert);
      generated.push(template);
    }

    return generated;
  } catch (error) {
    throw new Error("ai_generation_failed");
  }
}