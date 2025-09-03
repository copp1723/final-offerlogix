/**
 * ConversationEngine Factory
 * 
 * Creates ConversationEngine instances with proper dependency injection.
 * Keeps routes thin and avoids direct MailgunThreading imports.
 */

import { ConversationEngine } from './ConversationEngine';
import { AgentCore } from '../agent/AgentCore';
import { MailgunThreading } from '../email/MailgunThreading';
import { MailgunTransport } from '../email/MailgunTransport';
import { dbV2 } from '../../db.js';
import { loadAgent, loadHistory } from './ConversationHelpers';

export function makeConversationEngine(): ConversationEngine {
  // Environment validation: throw early if critical vars missing
  const enabled = process.env.V2_MAILGUN_ENABLED === 'true';
  
  if (enabled) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY required when V2_MAILGUN_ENABLED=true');
    }
    
    // V2 uses per-agent domains with an allow-list. MAILGUN_DOMAIN is optional.
    if (!process.env.MAILGUN_API_KEY) {
      throw new Error('MAILGUN_API_KEY required when V2_MAILGUN_ENABLED=true');
    }
    
    if (!process.env.MAILGUN_SIGNING_KEY) {
      throw new Error('MAILGUN_SIGNING_KEY required when V2_MAILGUN_ENABLED=true');
    }
  }

  // Create transport
  const transport = new MailgunTransport({
    // Default domain is optional; individual sends will override with agent.domain
    domain: process.env.MAILGUN_DOMAIN_DEFAULT || process.env.MAILGUN_DOMAIN || '',
    base: process.env.MAILGUN_BASE || 'https://api.mailgun.net/v3',
    key: process.env.MAILGUN_API_KEY || '',
  });

  // Create AgentCore with real LLM integration (future: OpenRouter)
  // For now, keep mock behavior but ready for real LLM
  const agentCore = new AgentCore();

  // Create mailer
  const mailer = new MailgunThreading(transport);

  // Create optional logger based on V2_LOG_EVENTS environment
  const logger = process.env.V2_LOG_EVENTS === 'true' 
    ? (event: string, meta: Record<string, any>) => {
        console.log(JSON.stringify({ event, ...meta }));
      }
    : undefined;

  return new ConversationEngine({
    db: dbV2,
    agentCore,
    mailer,
    loadAgent,
    loadHistory,
    logger
  });
}
