/**
 * V2 Handover API Routes
 * 
 * Handles handover brief retrieval and management.
 */

import { Router } from 'express';
import { eq, and, isNotNull } from 'drizzle-orm';
import { dbV2, v2schema } from '../db.js';

const router = Router();

// ============================================================================
// GET HANDOVER BRIEF
// ============================================================================

router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const [conversation] = await dbV2
      .select({
        id: v2schema.conversations.id,
        leadEmail: v2schema.conversations.leadEmail,
        status: v2schema.conversations.status,
        handoverReason: v2schema.conversations.handoverReason,
        handoverAt: v2schema.conversations.handoverAt,
        handoverBrief: v2schema.conversations.handoverBrief,
        agentId: v2schema.conversations.agentId,
        subject: v2schema.conversations.subject,
      })
      .from(v2schema.conversations)
      .where(
        and(
          eq(v2schema.conversations.id, conversationId),
          eq(v2schema.conversations.status, 'handed_over')
        )
      );
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Handover not found or conversation not handed over'
      });
    }
    
    if (!conversation.handoverBrief) {
      return res.status(404).json({
        success: false,
        error: 'Handover brief not available for this conversation'
      });
    }
    
    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        leadEmail: conversation.leadEmail,
        subject: conversation.subject,
        handoverAt: conversation.handoverAt,
        handoverReason: conversation.handoverReason,
      },
      brief: conversation.handoverBrief
    });
  } catch (error) {
    console.error('Error fetching handover brief:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch handover brief'
    });
  }
});

// ============================================================================
// LIST PENDING HANDOVERS
// ============================================================================

router.get('/pending', async (req, res) => {
  try {
    const { agentId } = req.query;
    
    let query = dbV2
      .select({
        id: v2schema.conversations.id,
        leadEmail: v2schema.conversations.leadEmail,
        subject: v2schema.conversations.subject,
        handoverAt: v2schema.conversations.handoverAt,
        handoverReason: v2schema.conversations.handoverReason,
        agentId: v2schema.conversations.agentId,
        hasHandoverBrief: v2schema.conversations.handoverBrief,
      })
      .from(v2schema.conversations)
      .where(eq(v2schema.conversations.status, 'handed_over'))
      .orderBy(v2schema.conversations.handoverAt);
    
    if (agentId) {
      query = query.where(
        and(
          eq(v2schema.conversations.status, 'handed_over'),
          eq(v2schema.conversations.agentId, agentId as string)
        )
      );
    }
    
    const handovers = await query;
    
    res.json({
      success: true,
      handovers: handovers.map(h => ({
        ...h,
        hasHandoverBrief: !!h.hasHandoverBrief
      }))
    });
  } catch (error) {
    console.error('Error fetching pending handovers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending handovers'
    });
  }
});

// ============================================================================
// GET FORMATTED HANDOVER BRIEF (Human-Readable)
// ============================================================================

router.get('/conversation/:conversationId/formatted', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const [conversation] = await dbV2
      .select({
        handoverBrief: v2schema.conversations.handoverBrief,
        leadEmail: v2schema.conversations.leadEmail,
        subject: v2schema.conversations.subject,
        handoverAt: v2schema.conversations.handoverAt,
      })
      .from(v2schema.conversations)
      .where(
        and(
          eq(v2schema.conversations.id, conversationId),
          eq(v2schema.conversations.status, 'handed_over'),
          isNotNull(v2schema.conversations.handoverBrief)
        )
      );
    
    if (!conversation || !conversation.handoverBrief) {
      return res.status(404).json({
        success: false,
        error: 'Handover brief not found'
      });
    }
    
    const brief = conversation.handoverBrief as any;
    
    // Format as human-readable text
    const formattedBrief = `
# Lead Handover Brief

**Generated:** ${brief.generatedAt}
**Handover Reason:** ${brief.handoverReason}

## 1. Lead Identification
- **Name:** ${brief.leadName || 'Not provided'}
- **Contact:** ${brief.leadEmail}
- **Vehicle:** ${brief.vehicleInfo || 'Not specified'}
- **Source:** ${brief.campaignSource}
- **Purchase Window:** ${brief.purchaseWindow || 'Timeline unclear'}

## 2. Conversation Summary
${brief.conversationSummary}

**Key Intents:** ${brief.keyIntents.join(', ')}

## 3. Relationship-Building Intel
- **Communication Style:** ${brief.communicationStyle}
- **Priorities:** ${brief.priorities.join('; ')}
${brief.competitiveContext ? `- **Competitive Context:** ${brief.competitiveContext}` : ''}

## 4. Sales Strategy & Engagement Tips
${brief.salesStrategy.map((s: string) => `- ${s}`).join('\n')}

## 5. Closing Strategies
**Urgency Level:** ${brief.urgencyLevel.toUpperCase()}

${brief.closingStrategies.map((s: string) => `- ${s}`).join('\n')}

---
*This brief was automatically generated from conversation analysis.*
    `.trim();
    
    res.json({
      success: true,
      formattedBrief,
      brief
    });
  } catch (error) {
    console.error('Error formatting handover brief:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to format handover brief'
    });
  }
});

export default router;
