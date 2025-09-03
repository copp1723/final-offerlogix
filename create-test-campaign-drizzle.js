// Create complete test campaign for Kunes Macomb targeting josh@atsglobal.ai using Drizzle ORM
import dotenv from 'dotenv';
dotenv.config();

async function createTestCampaign() {
  try {
    console.log('🎯 Creating test campaign for 2-way conversation proof...');
    
    // Import the database instance and schema
    const { db } = await import('./server/db.js');
    const { clients, aiAgentConfig, leads, campaigns, leadCampaignStates } = await import('./shared/schema.js');
    const { eq, and } = await import('drizzle-orm');
    
    // Get the Default Client (which has the Kunes Macomb agent)
    const [client] = await db.select().from(clients).where(eq(clients.name, 'Default Client'));
    
    if (!client) {
      console.log('❌ Default Client not found');
      return false;
    }
    
    console.log('📊 Using Client:', client.name, '(ID:', client.id + ')');
    
    // Get the active Kunes Macomb AI agent
    const [agent] = await db.select()
      .from(aiAgentConfig)
      .where(
        and(
          eq(aiAgentConfig.clientId, client.id),
          eq(aiAgentConfig.isActive, true)
        )
      );
    
    if (!agent) {
      console.log('❌ Active AI agent not found');
      return false;
    }
    
    console.log('🤖 Using Agent:', agent.name, '(Domain:', agent.agentEmailDomain + ')');
    
    // Check if josh@atsglobal.ai already exists as a lead
    let existingLead = await db.select()
      .from(leads)
      .where(
        and(
          eq(leads.email, 'josh@atsglobal.ai'),
          eq(leads.clientId, client.id)
        )
      );
    
    let leadId;
    if (existingLead.length > 0) {
      leadId = existingLead[0].id;
      console.log('📋 Using existing Josh lead (ID:', leadId + ')');
    } else {
      // Create josh@atsglobal.ai as a lead
      const [newLead] = await db.insert(leads).values({
        email: 'josh@atsglobal.ai',
        firstName: 'Josh',
        lastName: 'Test',
        phone: '+1-555-TEST',
        notes: 'Test lead for 2-way conversation proof',
        clientId: client.id
      }).returning();
      
      leadId = newLead.id;
      console.log('👤 Created Josh lead (ID:', leadId + ')');
    }
    
    // Check if test campaign already exists
    const existingCampaigns = await db.select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.clientId, client.id),
          eq(campaigns.name, 'Kunes Macomb - 2-Way Conversation Test')
        )
      );
    
    let campaignId;
    if (existingCampaigns.length > 0) {
      campaignId = existingCampaigns[0].id;
      console.log('📧 Using existing campaign (ID:', campaignId + ')');
    } else {
      // Create test campaign
      const [newCampaign] = await db.insert(campaigns).values({
        name: 'Kunes Macomb - 2-Way Conversation Test',
        context: 'Test complete conversation system with Honda Civic inquiry and responses',
        targetAudience: 'Honda Civic prospects',
        clientId: client.id,
        aiAgentConfigId: agent.id,
        status: 'active'
      }).returning();
      
      campaignId = newCampaign.id;
      console.log('📧 Created test campaign (ID:', campaignId + ')');
    }
    
    // Associate the lead with the campaign
    try {
      await db.insert(leadCampaignStates).values({
        leadId: leadId,
        campaignId: campaignId,
        followupState: 'active'
      }).onConflictDoNothing();
      
      console.log('🔗 Associated Josh lead with test campaign');
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        console.log('🔗 Josh lead already associated with test campaign');
      } else {
        throw error;
      }
    }
    
    console.log('\n✅ Test Campaign Setup Complete:');
    console.log('- Campaign ID:', campaignId);
    console.log('- Lead ID:', leadId);
    console.log('- Agent Domain:', agent.agentEmailDomain);
    console.log('- Target Email: josh@atsglobal.ai');
    console.log('- From Email: swarm@' + agent.agentEmailDomain);
    
    return {
      campaignId,
      leadId,
      agentDomain: agent.agentEmailDomain,
      clientId: client.id,
      agent
    };
    
  } catch (error) {
    console.error('❌ Test campaign creation failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

createTestCampaign().then(result => {
  if (result) {
    console.log('\n🚀 Ready to execute test campaign and prove 2-way conversation works!');
  } else {
    console.log('\n💥 Failed to create test campaign setup');
  }
  process.exit(result ? 0 : 1);
});