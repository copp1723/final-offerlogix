import { db } from '../db';
import { leads } from '@shared/schema';
import { sql, or, eq } from 'drizzle-orm';

async function run() {
  console.log('🧹 Cleaning up leads with blank/placeholder names...');

  // Find candidates
  const candidates = await db
    .select({ id: leads.id, email: leads.email, first: leads.firstName, last: leads.lastName, createdAt: leads.createdAt })
    .from(leads)
    .where(
      or(
        sql`${leads.firstName} IS NULL`,
        eq(leads.firstName, ''),
        eq(leads.firstName, '-'),
        eq(leads.firstName, '—')
      )
    );

  if (!candidates.length) {
    console.log('✅ No blank-name leads found.');
    process.exit(0);
  }

  console.log(`Found ${candidates.length} leads to delete:`);
  for (const c of candidates.slice(0, 20)) {
    console.log(` - ${c.first || '∅'} ${c.last || ''} <${c.email}> (${c.id})`);
  }
  if (candidates.length > 20) console.log(` ...and ${candidates.length - 20} more`);

  // Delete one-by-one to avoid ANY(array) casting issues
  let deleted = 0;
  for (const c of candidates) {
    await db.delete(leads).where(eq(leads.id, c.id));
    deleted++;
  }

  console.log(`🗑️  Deleted ${deleted} leads.`);
}

run().catch((e) => { console.error(e); process.exit(1); });

