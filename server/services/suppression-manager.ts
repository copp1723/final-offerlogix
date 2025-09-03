import { eq, and, isNull, isNotNull, gte, or, lte, count, sum, sql } from 'drizzle-orm';
import { db } from '../db';
import { emailSuppressionList, leads, type InsertEmailSuppression, type EmailSuppressionList } from '../../shared/schema';
import { logger } from '../logging/config';
import { createErrorContext } from '../utils/error-utils';

export interface SuppressionEntry {
  email: string;
  suppressionType: 'bounce' | 'complaint' | 'unsubscribe' | 'manual';
  reason?: string;
  bounceType?: 'hard' | 'soft';
  campaignId?: string;
  leadId?: string;
  clientId?: string;
  expiresAt?: Date;
}

export interface SuppressionStats {
  total: number;
  bounces: number;
  complaints: number;
  unsubscribes: number;
  manual: number;
  hardBounces: number;
  softBounces: number;
  expired: number;
}

/**
 * Add email to suppression list
 */
export async function addToSuppressionList(entry: SuppressionEntry): Promise<boolean> {
  try {
    const email = entry.email.toLowerCase().trim();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.warn(`Invalid email format for suppression: ${email}`);
      return false;
    }

    // Check if already suppressed
    const existing = await getSuppressionEntry(email, entry.clientId);
    if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
      logger.info(`Email already suppressed: ${email}`, {
        existingType: existing.suppressionType,
        newType: entry.suppressionType,
      });
      
      // Update existing entry if new suppression is more severe
      if (shouldUpdateSuppression(existing.suppressionType, entry.suppressionType)) {
        await updateSuppressionEntry(existing.id, {
          suppressionType: entry.suppressionType,
          reason: entry.reason,
          bounceType: entry.bounceType,
          campaignId: entry.campaignId,
          leadId: entry.leadId,
          suppressedAt: new Date(),
          expiresAt: entry.expiresAt,
        });
        
        logger.info(`Updated suppression entry for ${email}`, {
          from: existing.suppressionType,
          to: entry.suppressionType,
        });
      }
      return true;
    }

    // Insert new suppression entry
    await db.insert(emailSuppressionList).values({
      email,
      suppressionType: entry.suppressionType,
      reason: entry.reason,
      bounceType: entry.bounceType,
      campaignId: entry.campaignId,
      leadId: entry.leadId,
      clientId: entry.clientId,
      expiresAt: entry.expiresAt,
      suppressedAt: new Date(),
    });

    // Update lead status if applicable
    if (entry.leadId) {
      await updateLeadStatusForSuppression(entry.leadId, entry.suppressionType);
    }

    logger.info(`Added email to suppression list`, {
      email,
      type: entry.suppressionType,
      reason: entry.reason,
      bounceType: entry.bounceType,
      campaignId: entry.campaignId,
      leadId: entry.leadId,
      expiresAt: entry.expiresAt,
    });

    return true;
  } catch (error) {
    logger.error(`Failed to add email to suppression list`, {
      email: entry.email,
      type: entry.suppressionType,
      ...createErrorContext(error),
    });
    return false;
  }
}

/**
 * Remove email from suppression list
 */
export async function removeFromSuppressionList(email: string, clientId?: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const conditions = [eq(emailSuppressionList.email, normalizedEmail)];
    if (clientId) {
      conditions.push(eq(emailSuppressionList.clientId, clientId));
    }

    const result = await db.delete(emailSuppressionList)
      .where(and(...conditions));

    logger.info(`Removed email from suppression list`, {
      email: normalizedEmail,
      clientId,
      affected: result.rowCount || 0,
    });

    return (result.rowCount || 0) > 0;
  } catch (error) {
    logger.error(`Failed to remove email from suppression list`, {
      email,
      clientId,
      ...createErrorContext(error),
    });
    return false;
  }
}

/**
 * Check if email is suppressed
 */
export async function isEmailSuppressed(email: string, clientId?: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const conditions = [
      eq(emailSuppressionList.email, normalizedEmail),
      // Check if suppression hasn't expired
      or(
        isNull(emailSuppressionList.expiresAt),
        gte(emailSuppressionList.expiresAt, new Date())
      ),
    ];

    if (clientId) {
      conditions.push(eq(emailSuppressionList.clientId, clientId));
    }

    const [suppressed] = await db.select()
      .from(emailSuppressionList)
      .where(and(...conditions))
      .limit(1);

    return !!suppressed;
  } catch (error) {
    logger.error(`Failed to check email suppression`, {
      email,
      clientId,
      ...createErrorContext(error),
    });
    return false; // Fail open to avoid blocking legitimate emails
  }
}

/**
 * Get suppression entry details
 */
export async function getSuppressionEntry(email: string, clientId?: string): Promise<EmailSuppressionList | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const conditions = [eq(emailSuppressionList.email, normalizedEmail)];
    if (clientId) {
      conditions.push(eq(emailSuppressionList.clientId, clientId));
    }

    const [entry] = await db.select()
      .from(emailSuppressionList)
      .where(and(...conditions))
      .orderBy(emailSuppressionList.suppressedAt)
      .limit(1);

    return entry || null;
  } catch (error) {
    logger.error(`Failed to get suppression entry`, {
      email,
      clientId,
      ...createErrorContext(error),
    });
    return null;
  }
}

/**
 * Process bounce from webhook
 */
export async function processBounce(data: {
  email: string;
  bounceType: 'hard' | 'soft';
  reason: string;
  campaignId?: string;
  leadId?: string;
  clientId?: string;
}): Promise<void> {
  try {
    // Hard bounces are permanent, soft bounces may be temporary
    const expiresAt = data.bounceType === 'soft' 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days for soft bounces
      : undefined; // Permanent for hard bounces

    await addToSuppressionList({
      email: data.email,
      suppressionType: 'bounce',
      reason: data.reason,
      bounceType: data.bounceType,
      campaignId: data.campaignId,
      leadId: data.leadId,
      clientId: data.clientId,
      expiresAt,
    });

    logger.info(`Processed bounce for ${data.email}`, {
      bounceType: data.bounceType,
      reason: data.reason,
      permanent: data.bounceType === 'hard',
    });
  } catch (error) {
    logger.error(`Failed to process bounce`, { data, ...createErrorContext(error) });
  }
}

/**
 * Process complaint from webhook
 */
export async function processComplaint(data: {
  email: string;
  reason?: string;
  campaignId?: string;
  leadId?: string;
  clientId?: string;
}): Promise<void> {
  try {
    await addToSuppressionList({
      email: data.email,
      suppressionType: 'complaint',
      reason: data.reason || 'Spam complaint',
      campaignId: data.campaignId,
      leadId: data.leadId,
      clientId: data.clientId,
    });

    logger.info(`Processed complaint for ${data.email}`, {
      reason: data.reason,
      campaignId: data.campaignId,
    });
  } catch (error) {
    logger.error(`Failed to process complaint`, { data, ...createErrorContext(error) });
  }
}

/**
 * Process unsubscribe from webhook
 */
export async function processUnsubscribe(data: {
  email: string;
  reason?: string;
  campaignId?: string;
  leadId?: string;
  clientId?: string;
}): Promise<void> {
  try {
    await addToSuppressionList({
      email: data.email,
      suppressionType: 'unsubscribe',
      reason: data.reason || 'User unsubscribed',
      campaignId: data.campaignId,
      leadId: data.leadId,
      clientId: data.clientId,
    });

    logger.info(`Processed unsubscribe for ${data.email}`, {
      reason: data.reason,
      campaignId: data.campaignId,
    });
  } catch (error) {
    logger.error(`Failed to process unsubscribe`, { data, ...createErrorContext(error) });
  }
}

/**
 * Get suppression statistics
 */
export async function getSuppressionStats(clientId?: string): Promise<SuppressionStats> {
  try {
    const conditions = clientId ? [eq(emailSuppressionList.clientId, clientId)] : [];
    
    const [stats] = await db.select({
      total: count(),
      bounces: sum(sql`CASE WHEN ${emailSuppressionList.suppressionType} = 'bounce' THEN 1 ELSE 0 END`),
      complaints: sum(sql`CASE WHEN ${emailSuppressionList.suppressionType} = 'complaint' THEN 1 ELSE 0 END`),
      unsubscribes: sum(sql`CASE WHEN ${emailSuppressionList.suppressionType} = 'unsubscribe' THEN 1 ELSE 0 END`),
      manual: sum(sql`CASE WHEN ${emailSuppressionList.suppressionType} = 'manual' THEN 1 ELSE 0 END`),
      hardBounces: sum(sql`CASE WHEN ${emailSuppressionList.suppressionType} = 'bounce' AND ${emailSuppressionList.bounceType} = 'hard' THEN 1 ELSE 0 END`),
      softBounces: sum(sql`CASE WHEN ${emailSuppressionList.suppressionType} = 'bounce' AND ${emailSuppressionList.bounceType} = 'soft' THEN 1 ELSE 0 END`),
      expired: sum(sql`CASE WHEN ${emailSuppressionList.expiresAt} IS NOT NULL AND ${emailSuppressionList.expiresAt} < NOW() THEN 1 ELSE 0 END`)
    }).from(emailSuppressionList)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      total: Number(stats?.total || 0),
      bounces: Number(stats?.bounces || 0),
      complaints: Number(stats?.complaints || 0),
      unsubscribes: Number(stats?.unsubscribes || 0),
      manual: Number(stats?.manual || 0),
      hardBounces: Number(stats?.hardBounces || 0),
      softBounces: Number(stats?.softBounces || 0),
      expired: Number(stats?.expired || 0),
    };
  } catch (error) {
    logger.error(`Failed to get suppression stats`, { clientId, ...createErrorContext(error) });
    return {
      total: 0,
      bounces: 0,
      complaints: 0,
      unsubscribes: 0,
      manual: 0,
      hardBounces: 0,
      softBounces: 0,
      expired: 0,
    };
  }
}

/**
 * Clean up expired suppressions
 */
export async function cleanupExpiredSuppressions(): Promise<number> {
  try {
    const result = await db.delete(emailSuppressionList)
      .where(and(
        isNotNull(emailSuppressionList.expiresAt),
        lte(emailSuppressionList.expiresAt, new Date())
      ));

    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired suppressions`);
    }

    return deletedCount;
  } catch (error) {
    logger.error(`Failed to cleanup expired suppressions`, createErrorContext(error));
    return 0;
  }
}

/**
 * Get paginated suppression list
 */
export async function getSuppressionList(params: {
  clientId?: string;
  suppressionType?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: EmailSuppressionList[]; total: number }> {
  try {
    const { clientId, suppressionType, page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (clientId) conditions.push(eq(emailSuppressionList.clientId, clientId));
    if (suppressionType) conditions.push(eq(emailSuppressionList.suppressionType, suppressionType));

    const [items, [{ count: totalCount }]] = await Promise.all([
      db.select()
        .from(emailSuppressionList)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(emailSuppressionList.suppressedAt)
        .limit(limit)
        .offset(offset),
      
      db.select({ count: count() })
        .from(emailSuppressionList)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);

    return {
      items,
      total: Number(totalCount),
    };
  } catch (error) {
    logger.error(`Failed to get suppression list`, { params, ...createErrorContext(error) });
    return { items: [], total: 0 };
  }
}

/**
 * Helper function to determine if suppression should be updated
 */
function shouldUpdateSuppression(existing: string, newType: string): boolean {
  const hierarchy = ['manual', 'complaint', 'bounce', 'unsubscribe'];
  return hierarchy.indexOf(newType) < hierarchy.indexOf(existing);
}

/**
 * Update existing suppression entry
 */
async function updateSuppressionEntry(id: string, updates: Partial<EmailSuppressionList>): Promise<void> {
  await db.update(emailSuppressionList)
    .set(updates)
    .where(eq(emailSuppressionList.id, id));
}

/**
 * Update lead status when email is suppressed
 */
async function updateLeadStatusForSuppression(leadId: string, suppressionType: string): Promise<void> {
  try {
    let newStatus = 'lost';
    
    switch (suppressionType) {
      case 'bounce':
        newStatus = 'invalid_email';
        break;
      case 'complaint':
        newStatus = 'complained';
        break;
      case 'unsubscribe':
        newStatus = 'unsubscribed';
        break;
      case 'manual':
        newStatus = 'suppressed';
        break;
    }

    await db.update(leads)
      .set({ status: newStatus })
      .where(eq(leads.id, leadId));

    logger.info(`Updated lead status for suppression`, {
      leadId,
      suppressionType,
      newStatus,
    });
  } catch (error) {
    logger.error(`Failed to update lead status for suppression`, {
      leadId,
      suppressionType,
      ...createErrorContext(error),
    });
  }
}