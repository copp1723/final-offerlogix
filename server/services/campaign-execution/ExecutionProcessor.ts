import { storage } from '../../storage';
// Removed mailgunService import - using dynamic import instead
import type { Campaign, Lead } from '../../../shared/schema';
import { isEmailSuppressed } from '../suppression-manager';
import { and, eq } from 'drizzle-orm';

// Reliability tuning knobs (env overrides supported)
const MAILGUN_MAX_RETRIES = Number(process.env.MAILGUN_MAX_RETRIES ?? 3);
const MAILGUN_RETRY_BASE_MS = Number(process.env.MAILGUN_RETRY_BASE_MS ?? 200);
const BATCH_CONCURRENCY = Math.max(1, Number(process.env.EXECUTION_BATCH_CONCURRENCY ?? 10));
const MAX_EMAIL_HTML_BYTES = Number(process.env.MAX_EMAIL_HTML_BYTES ?? 500_000); // ~500KB

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function backoff(attempt: number) {
  const capped = Math.min(1500, MAILGUN_RETRY_BASE_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 150);
  return capped + jitter;
}

export interface ProcessingOptions {
  batchSize?: number;
  delayBetweenEmails?: number;
  testMode?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  emailsSent: number;
  emailsFailed: number;
  errors: string[];
  executionId: string;
}

export class ExecutionProcessor {
  
  async processEmailSequence(
    campaign: Campaign,
    leads: Lead[],
    templateIndex: number = 0,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const { 
      batchSize = 50, 
      delayBetweenEmails = 1000, 
      testMode = false 
    } = options;

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errors: string[] = [];
    let emailsSent = 0;
    let emailsFailed = 0;

    try {
      // Get campaign templates (they're already parsed objects, not JSON strings)
      let templates: any[] = [];
      
      if (Array.isArray(campaign.templates)) {
        templates = campaign.templates;
      } else if (typeof campaign.templates === 'string') {
        try {
          templates = JSON.parse(campaign.templates);
        } catch (error) {
          throw new Error('Invalid email templates JSON in campaign');
        }
      } else {
        templates = [];
      }
      
      if (!Array.isArray(templates) || templates.length === 0) {
        throw new Error('Campaign has no email templates');
      }

      if (templateIndex >= templates.length) {
        throw new Error(`Template index ${templateIndex} is out of range`);
      }

      const template = templates[templateIndex];
      
      // Dedupe leads by email (case-insensitive) and drop obviously invalid emails
      const emailSeen = new Set<string>();
      const filteredLeads = leads.filter(l => {
        const email = (l.email || '').trim();
        const lower = email.toLowerCase();
        const isValid = /.+@.+\..+/.test(email);
        if (!email || !isValid) {
          errors.push(`Skipped invalid email for lead ${l.id}`);
          return false;
        }
        if (emailSeen.has(lower)) return false;
        emailSeen.add(lower);
        return true;
      });

      // Process leads in batches
      const batches = this.createBatches(filteredLeads, batchSize);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} leads) - Template: ${template.subject || template.title || 'Email Template'}`);

        // Run the batch with concurrency limiter and await concrete results
        const batchResults = await this.runWithConcurrency(
          batch,
          BATCH_CONCURRENCY,
          (lead) => this.sendEmailToLead(campaign, lead, template, testMode)
        );

        // Process batch results
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const lead = batch[i];

          if (result && (result as any).skipped) {
            // Already logged in sendEmailToLead
            continue;
          } else if (result && (result as any).success) {
            emailsSent++;

            // Update lead status
            try {
              await storage.updateLead(lead.id, {
                status: 'contacted'
              });
            } catch (updateError) {
              console.error(`Failed to update lead ${lead.id}:`, updateError);
            }
          } else {
            emailsFailed++;
            const errorMessage = (result as any)?.error || 'Unknown error';
            errors.push(`Failed to send email to ${lead.email}: ${errorMessage}`);
          }
        }

        // Add delay between batches (except for the last batch)
        if (batchIndex < batches.length - 1) {
          await this.delay(Math.max(0, delayBetweenEmails));
        }
      }

      // Update campaign metrics
      try {
        const currentMetrics: any = {}; // Note: performanceMetrics field doesn't exist in schema
        
        const updatedMetrics = {
          ...currentMetrics,
          totalEmailsSent: (currentMetrics.totalEmailsSent || 0) + emailsSent,
          lastExecutionDate: new Date(),
          executionCount: (currentMetrics.executionCount || 0) + 1,
          templatesSent: {
            ...currentMetrics.templatesSent,
            [templateIndex]: (currentMetrics.templatesSent?.[templateIndex] || 0) + emailsSent
          }
        };

        await storage.updateCampaign(campaign.id, {
          status: 'active'
        });
      } catch (updateError) {
        console.error('Failed to update campaign metrics:', updateError);
        errors.push('Failed to update campaign metrics');
      }

      return {
  // Mark success ONLY if at least one email sent. This prevents false positives when every send fails.
  success: emailsSent > 0,
        emailsSent,
        emailsFailed,
        errors,
        executionId
      };

    } catch (error) {
      console.error('Email sequence processing failed:', error);
      return {
        success: false,
        emailsSent: 0,
        emailsFailed: leads.length,
        errors: [error instanceof Error ? error.message : 'Unknown processing error'],
        executionId
      };
    }
  }

  private async sendEmailToLead(
    campaign: Campaign,
    lead: Lead,
    template: any,
    testMode: boolean
  ): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
      // Skip suppressed emails
      const suppressed = await isEmailSuppressed(lead.email, (campaign as any).clientId);
      if (suppressed) {
        console.warn(`Skipping suppressed email to ${lead.email}`);
        return { success: true, skipped: true };
      }

      // Personalize email content
      const personalizedSubject = this.personalizeContent(template.subject || campaign.name, lead);
      const personalizedContent = this.personalizeContent(template.content || template.body || '', lead);
      const emailData = {
        to: lead.email,
        subject: testMode ? `[TEST] ${personalizedSubject}` : personalizedSubject,
        html: this.capHtmlSize(this.formatEmailContent(personalizedContent))
      };

      // Retry mail send on transient failures
      const { storage } = await import('../../storage.js');
      // Prefer per-campaign agent if set; fallback to active config
      const campaignAgent = (campaign as any).agentConfigId ? await storage.getAiAgentConfig((campaign as any).agentConfigId).catch(() => undefined as any) : undefined as any;
      const activeCfg = campaignAgent || await storage.getActiveAiAgentConfig().catch(() => undefined as any);

      // Load V2 agent identity if available
      let agentIdentity: { name: string; local_part: string; domain: string } | null = null;
      let effectiveDomain = (activeCfg as any)?.agentEmailDomain || process.env.MAILGUN_DOMAIN;
      
      try {
        const { dbV2, v2schema } = await import('../../v2/db.js');
        
        if (effectiveDomain) {
          // Try to find V2 agent for this domain
          const [agent] = await dbV2
            .select({ 
              name: v2schema.agents.name,
              localPart: v2schema.agents.localPart,
              domain: v2schema.agents.domain
            })
            .from(v2schema.agents)
            .where(eq(v2schema.agents.domain, String(effectiveDomain).trim()))
            .limit(1);
          
          if (agent) {
            agentIdentity = {
              name: agent.name,
              local_part: agent.localPart,
              domain: agent.domain
            };
            effectiveDomain = agent.domain; // Use agent's exact domain
          }
        }
      } catch (error) {
        console.warn('Could not load V2 agent identity:', error);
      }

      // Use V2 identity helper for consistent From/Reply-To headers
      let fromHeader: string;
      if (agentIdentity) {
        const { buildAgentEmailIdentity } = await import('../../v2/services/email/identity.js');
        const identity = buildAgentEmailIdentity(agentIdentity);
        fromHeader = identity.fromHeader;
      } else {
        // Fallback for legacy campaigns without V2 agents
        let senderName = (activeCfg as any)?.fromName?.trim() || '';
        if (!senderName && (activeCfg as any)?.systemPrompt) {
          const m = String((activeCfg as any).systemPrompt).match(/\bYou are\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\b/);
          if (m && m[1]) senderName = m[1].trim();
        }
        if (!senderName) senderName = 'Riley Donovan'; // Default to Riley instead of OneKeel Swarm

        // Derive local part from sender name  
        const personalMatch = /^(\p{L}+)/u.exec(senderName || '');
        const looksPersonal = !!(senderName && /\s/.test(senderName));
        const localPart = looksPersonal && personalMatch ? personalMatch[1].toLowerCase() : 'riley';
        
        fromHeader = effectiveDomain ? `${senderName} <${localPart}@${effectiveDomain}>` : senderName;
      }

      // Bridge to V2: pre-generate Message-Id branded to agent domain and pre-store pending message
      let preGeneratedMessageId: string | undefined;
      
      if (agentIdentity && effectiveDomain) {
        try {
          const { randomUUID } = await import('crypto');
          preGeneratedMessageId = `<${randomUUID()}@${effectiveDomain}>`;
          
          const { dbV2, v2schema } = await import('../../v2/db.js');
          // Look up V2 agent by localPart + domain
          const [agent] = await dbV2
            .select({ id: v2schema.agents.id })
            .from(v2schema.agents)
            .where(and(
              eq(v2schema.agents.localPart, agentIdentity.local_part),
              eq(v2schema.agents.domain, agentIdentity.domain)
            ));
          
          if (agent) {
            // Upsert conversation
            const threadId = preGeneratedMessageId;
            const leadEmail = (lead.email || '').toLowerCase();
            const inserted = await dbV2
              .insert(v2schema.conversations)
              .values({
                agentId: agent.id,
                leadEmail,
                threadId,
                subject: personalizedSubject,
                lastMessageId: preGeneratedMessageId,
              })
              .onConflictDoUpdate({
                target: [v2schema.conversations.agentId, v2schema.conversations.leadEmail, v2schema.conversations.threadId],
                set: { lastMessageId: preGeneratedMessageId, updatedAt: new Date() },
              })
              .returning({ id: v2schema.conversations.id });
            const conversationId = inserted?.[0]?.id;
            if (conversationId) {
              await dbV2.insert(v2schema.messages).values({
                conversationId,
                content: personalizedContent,
                sender: 'agent',
                messageId: preGeneratedMessageId,
                status: 'pending',
              });
            }
          }
        } catch (e) {
          // Best-effort only; do not block the send on V2 bridging
          console.warn('V2 bridge (pre-store message) skipped:', e instanceof Error ? e.message : e);
        }
      }

      const success = await this.sendWithReliability(
        emailData.to,
        emailData.subject,
        emailData.html,
        campaign.id,
        lead.id,
        (campaign as any).clientId,
        effectiveDomain, // Use effective domain (agent's domain)
        fromHeader, // Pass complete From header instead of senderName
        preGeneratedMessageId
      );
      
      const result = { success, error: success ? undefined : 'Failed to send email' };
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      console.log(`✅ Email sent to ${lead.email} for campaign ${campaign.name}`);
      
      // Store email send in Supermemory for AI recall
      try {
        const { MemoryMapper } = await import('../../integrations/supermemory/index.js');
        await MemoryMapper.writeMailEvent({
          type: 'mail_event',
          clientId: campaign.clientId || 'default',
          campaignId: campaign.id,
          leadEmail: lead.email,
          content: `Email sent: ${emailData.subject}\nCampaign: ${campaign.name}\nTemplate: ${template.title || template.subject || 'Email Template'}`,
          meta: {
            event: 'sent',
            subject: emailData.subject,
            campaignName: campaign.name,
            templateTitle: template.title || template.subject || 'Email Template',
            sentAt: new Date().toISOString(),
            testMode
          }
        });
      } catch (error) {
        console.warn('Failed to store email send in Supermemory:', error);
      }
      
      return { success: true };

    } catch (error) {
      console.error(`❌ Failed to send email to ${lead.email}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error' 
      };
    }
  }

  // Concurrency limiter for batch processing
  private async runWithConcurrency<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers: Promise<void>[] = [];

    const runWorker = async () => {
      while (next < items.length) {
        const current = next++;
        try {
          results[current] = await task(items[current], current);
        } catch (e) {
          // propagate failure shape if caller expects it
          results[current] = e;
        }
      }
    };

    for (let i = 0; i < Math.min(limit, items.length); i++) {
      workers.push(runWorker());
    }
    await Promise.all(workers);
    return results;
  }

  // Format email content with proper spacing and structure
  private formatEmailContent(content: string): string {
    if (!content) return '';
    
    // Convert line breaks to HTML breaks for email
    let formatted = content
      // Convert double line breaks to proper paragraph spacing
      .replace(/\n\n/g, '<br><br>')
      // Convert single line breaks to HTML breaks
      .replace(/\n/g, '<br>')
      // Clean up excessive spacing
      .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    
    // Ensure proper paragraph structure for long content
    if (!formatted.includes('<br>') && formatted.length > 50) {
      // Add breaks for long single paragraphs
      formatted = formatted.replace(/\. ([A-Z])/g, '.<br><br>$1');
    }
    
    return formatted;
  }

  // Bound HTML size for email
  private capHtmlSize(html: string): string {
    if (!html) return '';
    // Quick byte-length cap without heavy parsing
    const encoder = new TextEncoder();
    const bytes = encoder.encode(html);
    if (bytes.length <= MAX_EMAIL_HTML_BYTES) return html;
    // Truncate conservatively at character boundary
    const ratio = MAX_EMAIL_HTML_BYTES / bytes.length;
    const cut = Math.max(0, Math.floor(html.length * ratio) - 1);
    return html.slice(0, cut) + '\n<!-- truncated to stay under size cap -->';
  }

  // Extract dealership name from agent config name
  private extractDealershipName(agentName?: string): string {
    if (!agentName) return 'Riley Donovan';

    // Remove "AI Assistant" suffix from names like "Kunes Toyota of Galesburg AI Assistant"
    const cleaned = agentName.replace(/\s*AI\s*Assistant$/i, '').trim();

    // If it's a Kunes dealership, return the clean name (case-insensitive check)
    if (cleaned.toLowerCase().includes('kunes')) {
      return cleaned;
    }

    // Default fallback to agent name instead of generic brand
    return 'Riley Donovan';
  }

  // Reliable email sending via queue system
  private async sendWithReliability(
    to: string,
    subject: string,
    html: string,
    campaignId: string,
    leadId: string,
    clientId?: string,
    domainOverride?: string,
    fromHeader?: string, // Accept complete From header instead of senderName
    preMessageId?: string
  ): Promise<boolean> {
    try {
      // Try to use the reliable email service first
      const { sendReliableCampaignEmail } = await import('../reliable-email-service.js');

      console.log('✉️ Initial Send Params', {
        to,
        from: fromHeader,
        subject,
        campaignId,
      });

      const result = await sendReliableCampaignEmail({
        to,
        subject,
        content: html,
        campaignId,
        leadId,
        clientId,
        domainOverride,
        // Mailbox lock for initial sends: campaigns@ for continuity (use env domain if override missing)
        from: fromHeader,
        threadingHeaders: preMessageId ? { 'Message-Id': preMessageId } : undefined,
        priority: 1, // Campaign emails get normal priority
        metadata: {
          source: 'campaign_execution',
          processor: 'ExecutionProcessor',
          fromHeader,
        },
      });

      return result.success;
    } catch (error) {
      // Fallback to direct mailgun if reliable service fails
      console.warn('Reliable email service unavailable, falling back to direct send:', error);
      
      const { sendCampaignEmail, mailgunAuthIsSuppressed } = await import('../mailgun.js');
      let attempt = 0;
      while (true) {
        attempt++;
        try {
          if (mailgunAuthIsSuppressed()) {
            // Abort early if we know auth is currently invalid to prevent noisy retries
            return false;
          }
          const fbFrom = fromHeader ? { from: fromHeader } : {};
          const ok = await sendCampaignEmail(
            to,
            subject,
            html,
            fbFrom,
            { domainOverride, threadingHeaders: preMessageId ? { 'Message-Id': preMessageId } : undefined }
          );
          if (ok) return true;
          if (attempt >= MAILGUN_MAX_RETRIES) return false;
        } catch (err) {
          if (attempt >= MAILGUN_MAX_RETRIES) return false;
        }
        await sleep(backoff(attempt));
      }
    }
  }

  private personalizeContent(content: string, lead: Lead): string {
    if (!content) return '';

    return content
      .replace(/\[firstName\]/g, lead.firstName || 'Customer')
      .replace(/\[Name\]/g, lead.firstName || 'Customer')
      .replace(/\[name\]/g, lead.firstName || 'Customer')
      .replace(/\[lastName\]/g, lead.lastName || '')
      .replace(/\[email\]/g, lead.email)
      .replace(/\[vehicleInterest\]/g, lead.vehicleInterest || 'our vehicles')
      .replace(/\[phone\]/g, lead.phone || '')
      .replace(/\{\{firstName\}\}/g, lead.firstName || 'Customer')
      .replace(/\{\{first_name\}\}/g, lead.firstName || 'Customer')
      .replace(/\{\{lastName\}\}/g, lead.lastName || '')
      .replace(/\{\{last_name\}\}/g, lead.lastName || '')
      .replace(/\{\{email\}\}/g, lead.email)
      .replace(/\{\{vehicleInterest\}\}/g, lead.vehicleInterest || 'our vehicles')
      .replace(/\{\{vehicle_interest\}\}/g, lead.vehicleInterest || 'our vehicles')
      .replace(/\{\{phone\}\}/g, lead.phone || '')
      .replace(/\{\{source\}\}/g, lead.leadSource || 'website');
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateEmailLimits(campaignId: string, leadCount: number): Promise<{
    valid: boolean;
    message?: string;
    dailyLimit?: number;
    dailySent?: number;
  }> {
    try {
      // Check daily email limits (implement your business logic here)
      const dailyLimit = 1000; // Example: 1000 emails per day per campaign
      
      // Get today's sent emails for this campaign
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return { valid: false, message: 'Campaign not found' };
      }

      const metrics = {}; // Note: performanceMetrics field doesn't exist in schema
      
      const dailySent = 0; // Note: metrics field doesn't exist in schema
      const remainingQuota = dailyLimit - dailySent;

      if (leadCount > remainingQuota) {
        return {
          valid: false,
          message: `Email limit exceeded. Daily limit: ${dailyLimit}, already sent: ${dailySent}, requested: ${leadCount}`,
          dailyLimit,
          dailySent
        };
      }

      return { valid: true, dailyLimit, dailySent };

    } catch (error) {
      console.error('Email limit validation error:', error);
      return { 
        valid: false, 
        message: 'Failed to validate email limits' 
      };
    }
  }
}

export const executionProcessor = new ExecutionProcessor();
