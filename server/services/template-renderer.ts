import { storage } from '../storage';
import { type Template } from '@shared/schema';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

interface TemplateVariables {
  [key: string]: string;
}

export async function selectTemplate(campaignId: number): Promise<Template | null> {
  const templates = await storage.getTemplatesByCampaign(campaignId.toString());
  if (templates.length === 0) {
    return null;
  }
  await evaluateTemplateWinner(templates);
  return chooseTemplate(templates);
}

export function chooseTemplate(templates: Template[]): Template {
  const winner = templates.find(t => t.isWinner);
  if (winner) return winner;
  const minSent = Math.min(...templates.map(t => t.sentCount ?? 0));
  const candidates = templates.filter(t => (t.sentCount ?? 0) === minSent);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function evaluateTemplateWinner(templates: Template[]): Promise<void> {
  const totalSent = templates.reduce((sum, t) => sum + (t.sentCount ?? 0), 0);
  if (totalSent < 30) return;
  const sorted = templates
    .filter(t => (t.sentCount ?? 0) > 0)
    .sort((a, b) => b.openCount / (b.sentCount || 1) - a.openCount / (a.sentCount || 1));
  if (sorted.length < 2) return;
  const best = sorted[0];
  const second = sorted[1];
  const bestRate = best.openCount / (best.sentCount || 1);
  const secondRate = second.openCount / (second.sentCount || 1);
  if (bestRate - secondRate >= 0.1) {
    await storage.markTemplateWinner(best.id, best.campaignId);
    templates.forEach(t => (t.isWinner = t.id === best.id));
  }
}

function validateTemplateVariables(variables: TemplateVariables): void {
  for (const [key, value] of Object.entries(variables)) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error(`Invalid variable key: ${key}`);
    }
    if (typeof value !== 'string') {
      throw new Error(`Variable value must be string: ${key}`);
    }
    if (value.includes('<script') || value.includes('javascript:') || value.includes('onload=')) {
      throw new Error(`Potentially malicious content in variable: ${key}`);
    }
  }
}

export function renderTemplate(template: Template, variables: TemplateVariables = {}): string {
  validateTemplateVariables(variables);
  let renderedContent = template.bodyHtml;
  for (const [key, value] of Object.entries(variables)) {
    const sanitizedValue = purify.sanitize(value, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href']
    });
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    renderedContent = renderedContent.replace(regex, sanitizedValue);
  }
  const finalContent = purify.sanitize(renderedContent, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'style', 'class']
  });
  return finalContent;
}