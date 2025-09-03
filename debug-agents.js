import { dbV2, v2schema } from './server/v2/db.ts';
import { eq } from 'drizzle-orm';

async function checkAgentsAndCampaigns() {
  console.log('=== V2 AGENTS ===');
  const agents = await dbV2.select().from(v2schema.agents);
  agents.forEach(agent => {
    console.log(`Agent: ${agent.name} (${agent.id})`);
    console.log(`  Domain: ${agent.domain}`);
    console.log(`  Local: ${agent.localPart}`);
    console.log(`  Active: ${agent.isActive}`);
    console.log('');
  });

  console.log('=== V2 CAMPAIGNS ===');
  const campaigns = await dbV2.select().from(v2schema.campaigns);
  campaigns.forEach(campaign => {
    console.log(`Campaign: ${campaign.name} (${campaign.id})`);
    console.log(`  Agent ID: ${campaign.agentId}`);
    console.log(`  Status: ${campaign.status}`);
    console.log('');
  });

  console.log('=== CAMPAIGN-AGENT MAPPING ===');
  const campaignAgents = await dbV2
    .select({
      campaignName: v2schema.campaigns.name,
      campaignStatus: v2schema.campaigns.status,
      agentName: v2schema.agents.name,
      agentDomain: v2schema.agents.domain,
      agentActive: v2schema.agents.isActive
    })
    .from(v2schema.campaigns)
    .innerJoin(v2schema.agents, eq(v2schema.campaigns.agentId, v2schema.agents.id));
  
  campaignAgents.forEach(mapping => {
    console.log(`${mapping.campaignName} (${mapping.campaignStatus}) -> ${mapping.agentName} @ ${mapping.agentDomain} (active: ${mapping.agentActive})`);
  });

  console.log('=== LEADS SAMPLE ===');
  const leads = await dbV2.select().from(v2schema.leads).limit(5);
  leads.forEach(lead => {
    console.log(`Lead: ${lead.email} (${lead.id})`);
    console.log(`  Campaign: ${lead.campaignId}`);
    console.log(`  Agent: ${lead.agentId}`);
    console.log(`  Status: ${lead.status}`);
    console.log(`  Sequence Index: ${lead.sequenceIndex}`);
    console.log(`  Initial Sent: ${lead.initialSentAt}`);
    console.log(`  Next Send: ${lead.nextSendAt}`);
    console.log('');
  });
}

checkAgentsAndCampaigns().catch(console.error);
