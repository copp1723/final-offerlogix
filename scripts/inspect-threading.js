// Inspect threading-related data for a given lead email
// Usage: node scripts/inspect-threading.js <leadEmail> [limit]
import dotenv from 'dotenv';
dotenv.config();

import { db } from '../server/db.js';
import { eq, desc } from 'drizzle-orm';
import { leads, conversations, conversationMessages, emailDeliveryEvents } from '../shared/schema.js';

async function main() {
  const leadEmail = process.argv[2] || process.env.LEAD_EMAIL;
  const limit = Number(process.argv[3] || 10);
  if (!leadEmail) {
    console.error('Usage: node scripts/inspect-threading.js <leadEmail> [limit]');
    process.exit(1);
  }

  console.log(`🔎 Inspecting threading for lead: ${leadEmail}`);

  const [lead] = await db.select().from(leads).where(eq(leads.email, leadEmail));
  if (!lead) {
    console.error('❌ Lead not found');
    process.exit(1);
  }
  console.log(`👤 Lead ID: ${lead.id}  Campaign: ${lead.campaignId || 'n/a'}`);

  const convs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .orderBy(desc(conversations.createdAt));

  if (!convs.length) {
    console.log('ℹ️ No conversations found for this lead');
  }

  for (const conv of convs) {
    console.log(`\n🧵 Conversation ${conv.id}  Subject: ${conv.subject}`);
    const msgs = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conv.id))
      .orderBy(conversationMessages.createdAt)
      .limit(limit);

    for (const m of msgs) {
      const role = m.isFromAI ? 'AI' : 'Lead';
      const created = new Date(m.createdAt).toISOString();
      console.log(` - ${created}  ${role}  type=${m.messageType}  providerMessageId=${m.providerMessageId || '-'}  id=${m.id}`);
    }
  }

  console.log(`\n📬 Recent Mailgun events for ${leadEmail}`);
  const events = await db
    .select()
    .from(emailDeliveryEvents)
    .where(eq(emailDeliveryEvents.recipientEmail, leadEmail))
    .orderBy(desc(emailDeliveryEvents.timestamp))
    .limit(limit);

  for (const e of events) {
    const ts = new Date(e.timestamp).toISOString();
    console.log(` - ${ts} ${e.eventType} message-id=${e.messageId || '-'} campaign=${e.campaignId || '-'} lead=${e.leadId || '-'} `);
    if (e.metadata?.userVariables) {
      console.log(`   user-variables: ${JSON.stringify(e.metadata.userVariables)}`);
    }
  }
}

main().catch((e) => {
  console.error('Error inspecting threading:', e);
  process.exit(1);
});

