/**
 * V2 Campaign Runner
 *
 * Sends due multi-touch emails based on campaigns_v2.sequence and
 * per-lead tracking fields (sequence_index, initial_sent_at, next_send_at).
 */

import { dbV2, v2schema } from '../db.js';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { makeConversationEngine } from '../services/conversation/factory.js';
import { AgentCore } from '../services/agent/AgentCore';

type SequenceStep = { offsetDays: number; subject: string; template: string };

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function runCampaignSequences(campaignIds?: string[]) {
  const engine = makeConversationEngine();
  const agentCore = new AgentCore();

  // 1) Load active campaigns, optionally filter by provided IDs
  const campaigns = await dbV2
    .select({
      id: v2schema.campaigns.id,
      agentId: v2schema.campaigns.agentId,
      name: v2schema.campaigns.name,
      sequence: v2schema.campaigns.sequence,
      status: v2schema.campaigns.status,
    })
    .from(v2schema.campaigns)
    .where(
      campaignIds?.length
        ? and(eq(v2schema.campaigns.status, 'active'), inArray(v2schema.campaigns.id, campaignIds))
        : eq(v2schema.campaigns.status, 'active')
    );

  const now = new Date();

  for (const campaign of campaigns) {
    const steps = (campaign.sequence as unknown as SequenceStep[]) || [];
    if (!steps.length) continue; // no sequence configured

    // 2) Find leads that are due to send next step
    //    Case A: next_send_at <= now
    //    Case B: no next_send_at and sequence_index == 0 and offsetDays == 0 → send immediately
    const leadsDueA = await dbV2
      .select({
        id: v2schema.leads.id,
        email: v2schema.leads.email,
        sequenceIndex: v2schema.leads.sequenceIndex,
        initialSentAt: v2schema.leads.initialSentAt,
        nextSendAt: v2schema.leads.nextSendAt,
        createdAt: v2schema.leads.createdAt,
      })
      .from(v2schema.leads)
      .where(
        and(
          eq(v2schema.leads.campaignId, campaign.id),
          eq(v2schema.leads.agentId, campaign.agentId),
          eq(v2schema.leads.status, 'active'),
          lte(v2schema.leads.nextSendAt, now as any)
        )
      );

    const leadsDueB = steps[0]?.offsetDays === 0
      ? await dbV2
          .select({
            id: v2schema.leads.id,
            email: v2schema.leads.email,
            sequenceIndex: v2schema.leads.sequenceIndex,
            initialSentAt: v2schema.leads.initialSentAt,
            nextSendAt: v2schema.leads.nextSendAt,
            createdAt: v2schema.leads.createdAt,
          })
          .from(v2schema.leads)
          .where(
            and(
              eq(v2schema.leads.campaignId, campaign.id),
              eq(v2schema.leads.agentId, campaign.agentId),
              eq(v2schema.leads.status, 'active'),
              eq(v2schema.leads.sequenceIndex, 0),
              isNull(v2schema.leads.nextSendAt),
              isNull(v2schema.leads.initialSentAt) // Only leads that haven't been sent yet
            )
          )
      : [];

    const leadsDue = [...leadsDueA, ...leadsDueB];
    if (!leadsDue.length) {
      continue;
    }

    // Load agent identity and variables once per campaign
    const agent = await engine['deps'].loadAgent(campaign.agentId);

    for (const lead of leadsDue) {
      const stepIndex = lead.sequenceIndex ?? 0;
      if (stepIndex >= steps.length) continue; // done

      const step = steps[stepIndex];
      if (!step) continue;

      // If we don't have initialSentAt yet and this is step 0 and not scheduled yet,
      // initialize nextSendAt based on createdAt + offsetDays (but only if offsetDays > 0)
      if (!lead.initialSentAt && stepIndex === 0 && lead.nextSendAt == null && step.offsetDays > 0) {
        const due = addDays(new Date(lead.createdAt as any), step.offsetDays);
        await dbV2
          .update(v2schema.leads)
          .set({ nextSendAt: due })
          .where(eq(v2schema.leads.id, lead.id));
        continue; // will send when due in future runs
      }

      // For offsetDays: 0, send immediately without scheduling
      if (!lead.initialSentAt && stepIndex === 0 && step.offsetDays === 0) {
        console.log(`📧 Sending immediate message (offsetDays=0) to ${lead.email} for campaign step ${stepIndex}`);
        // Continue to send logic below
      }

      // Build content with variable injection
      const html = agentCore.injectVariables(step.template, agent.vars);

      // Send the email via conversation engine
      try {
        const result = await engine.sendManualEmail({
          agent: agent.identity,
          to: lead.email,
          subject: step.subject,
          html,
        } as any);

        // Update lead sequence pointers
        const nowTs = new Date();
        const nextIndex = stepIndex + 1;
        const nextStep = steps[nextIndex];

        const updates: Partial<typeof v2schema.leads.$inferInsert> = {
          sequenceIndex: nextIndex,
          lastActivityAt: nowTs,
        } as any;

        if (!lead.initialSentAt) {
          (updates as any).initialSentAt = nowTs;
        }

        if (nextStep) {
          // Calculate next send date from initial send date + next step's offset
          const initialDate = (lead.initialSentAt ?? nowTs) as Date;
          (updates as any).nextSendAt = addDays(new Date(initialDate), nextStep.offsetDays);
        } else {
          (updates as any).nextSendAt = null; // sequence finished
        }

        await dbV2
          .update(v2schema.leads)
          .set(updates)
          .where(eq(v2schema.leads.id, lead.id));

        // Increment campaign counters minimally
        await dbV2
          .update(v2schema.campaigns)
          .set({
            totalSent: sql`${v2schema.campaigns.totalSent} + 1`,
            updatedAt: nowTs,
          })
          .where(eq(v2schema.campaigns.id, campaign.id));

        // Optional: log success
        if (process.env.V2_LOG_EVENTS === 'true') {
          console.log(JSON.stringify({
            event: 'sequence_step_sent',
            campaignId: campaign.id,
            leadId: lead.id,
            to: lead.email,
            stepIndex,
            messageId: result.messageId,
            conversationId: result.conversationId,
            at: nowTs.toISOString(),
          }));
        }
      } catch (err) {
        console.warn('Sequence send failed:', {
          campaignId: campaign.id,
          leadId: lead.id,
          stepIndex,
          error: err instanceof Error ? err.message : String(err),
        });
        // Leave nextSendAt intact so the runner can retry or operator can fix
      }
    }
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2).filter(Boolean);
  runCampaignSequences(ids.length ? ids : undefined)
    .then(() => {
      console.log('V2 campaign runner completed');
    })
    .catch((e) => {
      console.error('V2 campaign runner error:', e);
      process.exit(1);
    });
}
