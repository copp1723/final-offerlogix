import { db } from '../db';
import { templates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { Template, InsertTemplate } from '@shared/schema';

export class TemplateModel {
  static async findByCampaignId(campaignId: string): Promise<Template[]> {
    return db.select().from(templates).where(eq(templates.campaignId, campaignId));
  }

  static async create(template: InsertTemplate): Promise<Template> {
    const [record] = await db.insert(templates).values(template).returning();
    return record;
  }

  static async findById(id: string): Promise<Template | undefined> {
    const [record] = await db.select().from(templates).where(eq(templates.id, id));
    return record;
  }

  static async update(id: string, updates: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [record] = await db
      .update(templates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return record;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db.delete(templates).where(eq(templates.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}