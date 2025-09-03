// Create complete test campaign for Kunes Macomb targeting josh@atsglobal.ai
import dotenv from 'dotenv';
dotenv.config();

async function createTestCampaign() {
  try {
    console.log('🎯 Creating test campaign for 2-way conversation proof...');
    
    // Import the database instance
    const { db } = await import('./server/db.js');
    
    // Get the Default Client (which has the Kunes Macomb agent)
    const clientQuery = `SELECT id, name FROM clients WHERE name = 'Default Client' LIMIT 1`;
    const clientResult = await db.execute(clientQuery);
    
    if (clientResult.rows.length === 0) {
      console.log('❌ Default Client not found');
      return false;
    }
    
    const client = clientResult.rows[0];
    console.log('📊 Using Client:', client.name, '(ID:', client.id + ')');
    
    // Get the active Kunes Macomb AI agent
    const agentQuery = `
      SELECT id, name, agent_email_domain 
      FROM ai_agent_config 
      WHERE client_id = $1 AND is_active = true 
      AND agent_email_domain LIKE '%kunesmacomb%'
      LIMIT 1
    `;
    const agentResult = await db.execute(agentQuery, [client.id]);
    
    if (agentResult.rows.length === 0) {
      console.log('❌ Active Kunes Macomb agent not found');
      return false;
    }
    
    const agent = agentResult.rows[0];
    console.log('🤖 Using Agent:', agent.name, '(Domain:', agent.agent_email_domain + ')');
    
    // Check if josh@atsglobal.ai already exists as a lead
    const existingLeadQuery = `
      SELECT id, email FROM leads 
      WHERE email = 'josh@atsglobal.ai' AND client_id = $1
    `;
    const existingLeadResult = await db.execute(existingLeadQuery, [client.id]);
    
    let leadId;
    if (existingLeadResult.rows.length > 0) {
      leadId = existingLeadResult.rows[0].id;
      console.log('📋 Using existing Josh lead (ID:', leadId + ')');
    } else {
      // Create josh@atsglobal.ai as a lead
      const createLeadQuery = `
        INSERT INTO leads (email, first_name, last_name, phone, notes, client_id, created_at)
        VALUES ('josh@atsglobal.ai', 'Josh', 'Test', '+1-555-TEST', 'Test lead for 2-way conversation proof', $1, NOW())
        RETURNING id, email
      `;
      const leadResult = await db.execute(createLeadQuery, [client.id]);
      leadId = leadResult.rows[0].id;
      console.log('👤 Created Josh lead (ID:', leadId + ')');
    }
    
    // Check if test campaign already exists
    const existingCampaignQuery = `
      SELECT id, name FROM campaigns 
      WHERE name LIKE '%2-Way Conversation Test%' AND client_id = $1
    `;
    const existingCampaignResult = await db.execute(existingCampaignQuery, [client.id]);
    
    let campaignId;
    if (existingCampaignResult.rows.length > 0) {
      campaignId = existingCampaignResult.rows[0].id;
      console.log('📧 Using existing campaign (ID:', campaignId + ')');
    } else {
      // Create test campaign
      const createCampaignQuery = `
        INSERT INTO campaigns (
          name, 
          context, 
          target_audience, 
          client_id, 
          ai_agent_config_id,
          status,
          created_at
        )
        VALUES (
          'Kunes Macomb - 2-Way Conversation Test', 
          'Test complete conversation system with Honda Civic inquiry and responses', 
          'Honda Civic prospects', 
          $1, 
          $2,
          'active',
          NOW()
        )
        RETURNING id, name
      `;
      const campaignResult = await db.execute(createCampaignQuery, [client.id, agent.id]);
      campaignId = campaignResult.rows[0].id;
      console.log('📧 Created test campaign (ID:', campaignId + ')');
    }
    
    // Associate the lead with the campaign
    const leadCampaignQuery = `
      INSERT INTO lead_campaign_state (lead_id, campaign_id, followup_state)
      VALUES ($1, $2, 'active')
      ON CONFLICT (lead_id, campaign_id) DO NOTHING
      RETURNING lead_id, campaign_id
    `;
    await db.execute(leadCampaignQuery, [leadId, campaignId]);
    console.log('🔗 Associated Josh lead with test campaign');
    
    console.log('\n✅ Test Campaign Setup Complete:');
    console.log('- Campaign ID:', campaignId);
    console.log('- Lead ID:', leadId);
    console.log('- Agent Domain:', agent.agent_email_domain);
    console.log('- Target Email: josh@atsglobal.ai');
    console.log('- From Email: swarm@kunesmacomb.kunesauto.vip');
    
    return {
      campaignId,
      leadId,
      agentDomain: agent.agent_email_domain,
      clientId: client.id
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