// Debug campaign setup to find the issue
import dotenv from 'dotenv';
dotenv.config();

async function debugCampaign() {
  try {
    console.log('🔍 Debugging campaign setup...');
    
    const { db } = await import('./server/db.js');
    const { campaigns, leads, aiAgentConfig } = await import('./shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get our test campaign
    const [campaign] = await db.select()
      .from(campaigns)
      .where(eq(campaigns.name, 'Kunes Macomb - 2-Way Conversation Test'));
      
    console.log('📧 Campaign:', JSON.stringify(campaign, null, 2));
    
    // Get Josh lead
    const [lead] = await db.select()
      .from(leads)
      .where(eq(leads.email, 'josh@atsglobal.ai'));
      
    console.log('👤 Lead:', JSON.stringify(lead, null, 2));
    
    // Try to get AI agent config if campaign has the ID
    if (campaign && campaign.aiAgentConfigId) {
      const [agent] = await db.select()
        .from(aiAgentConfig)
        .where(eq(aiAgentConfig.id, campaign.aiAgentConfigId));
      
      console.log('🤖 Agent:', JSON.stringify(agent, null, 2));
    } else {
      console.log('❌ Campaign missing aiAgentConfigId:', campaign?.aiAgentConfigId);
      
      // Let's check all available agents
      const allAgents = await db.select().from(aiAgentConfig);
      console.log('🔍 All available agents:', JSON.stringify(allAgents, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugCampaign();