/**
 * Migrate legacy campaign templates/subjects to V2 sequence by name match.
 *
 * For each V2 campaign with empty sequence, attempt to find a legacy campaign
 * (shared.schema.ts -> campaigns) with the same name. If found, map its
 * templates[] (content/subject) into a sequence with offsets spaced by
 * daysBetweenMessages, starting at 0.
 */

import { dbV2, v2schema } from '../db.js';
import { db } from '../../db.js';
import { campaigns as v1Campaigns } from '../../../shared/schema.ts';
import { eq } from 'drizzle-orm';

export async function migrateByName() {
  // Load V2 campaigns with empty sequence
  const v2 = await dbV2
    .select({ id: v2schema.campaigns.id, name: v2schema.campaigns.name, sequence: v2schema.campaigns.sequence })
    .from(v2schema.campaigns);

  let updated = 0;

  for (const c of v2) {
    const current: any[] = (c.sequence as any) || [];
    if (current.length) continue;

    // Find matching v1 campaign by name
    const [v1] = await db.select().from(v1Campaigns).where(eq(v1Campaigns.name, c.name));
    if (!v1) continue;

    const templates: Array<{ content: string; subject: string }> = (v1.templates as any) || [];
    const gap = Number(v1.daysBetweenMessages || 2);
    if (!templates.length) continue;

    const sequence = templates.slice(0, 7).map((t, idx) => ({
      offsetDays: idx * gap,
      subject: t.subject,
      template: t.content,
    }));

    await dbV2.update(v2schema.campaigns)
      .set({ sequence, updatedAt: new Date() })
      .where(eq(v2schema.campaigns.id, c.id));
    updated++;
  }

  console.log(`V2 sequence migration complete. Updated: ${updated}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateByName().catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
}
