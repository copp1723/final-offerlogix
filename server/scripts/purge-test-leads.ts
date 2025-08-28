import { storage } from '../storage';

function isTestDemoLead(l: any): boolean {
  const fn = (l.firstName || '').trim();
  const ln = (l.lastName || '').trim();
  const email = (l.email || '').toLowerCase();
  const phone = (l.phone || '').trim();

  if (!fn && !ln) return true; // blank names
  if (/^test/i.test(fn) || /^test/i.test(ln)) return true;
  if (['buyer','lead'].includes(ln.toLowerCase())) return true;
  if (email === 'test.buyer@example.com') return true;
  if (/^test\+.+@example\.com$/.test(email)) return true;
  if (/^conv\+.+@example\.com$/.test(email)) return true;
  if (fn === 'Jordan' && ln === 'Lee') return true;
  if (phone === '+1-555-0100' || phone === '+1-555-0201') return true;
  return false;
}

async function run() {
  console.log('🧹 Purging test/demo leads, keeping only the 4 most recent batch leads...');

  const leads = await storage.getLeads();
  // Keep list: the 4 batch names
  const keepNames = new Set([
    'Ava Martinez',
    'Noah Kim',
    'Mia Thompson',
    'Liam Nguyen',
  ]);

  // Identify delete candidates
  const toDelete = leads.filter(l => isTestDemoLead(l) && !keepNames.has(`${l.firstName || ''} ${l.lastName || ''}`.trim()));

  console.log(`Found ${toDelete.length} leads to delete.`);
  for (const l of toDelete) {
    // Delete conversations first to satisfy foreign keys
    const convos = await storage.getConversationsByLead(l.id);
    for (const c of convos) {
      await storage.deleteConversation(c.id);
    }
    await storage.deleteLead(l.id);
    console.log(`🗑️  Deleted lead ${l.firstName || '∅'} ${l.lastName || ''} <${l.email}> and ${convos.length} conversations.`);
  }

  console.log('✅ Purge complete.');
}

run().catch((e)=>{ console.error(e); process.exit(1); });

