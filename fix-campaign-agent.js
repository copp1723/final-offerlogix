// Fix campaign to properly link to the active AI agent
import dotenv from 'dotenv';
dotenv.config();

async function fixCampaignAgent() {
  try {
    console.log('🔧 Fixing campaign agent link...');
    
    const { db } = await import('./server/db.js');
    const { campaigns, aiAgentConfig } = await import('./shared/schema.js');
    const { eq, and } = await import('drizzle-orm');
    
    // Get the active Kunes agent
    const [activeAgent] = await db.select()
      .from(aiAgentConfig)
      .where(
        and(
          eq(aiAgentConfig.isActive, true),
          eq(aiAgentConfig.agentEmailDomain, 'kunesmacomb.kunesauto.vip')
        )
      );
    
    if (!activeAgent) {
      console.log('❌ Active Kunes agent not found');
      return false;
    }
    
    console.log('🤖 Found active agent:', activeAgent.name, '(ID:', activeAgent.id + ')');
    
    // Update the test campaign to link to this agent
    const [updatedCampaign] = await db.update(campaigns)
      .set({ agentConfigId: activeAgent.id })
      .where(eq(campaigns.name, 'Kunes Macomb - 2-Way Conversation Test'))
      .returning();
    
    if (updatedCampaign) {
      console.log('✅ Campaign updated successfully!');
      console.log('📧 Campaign:', updatedCampaign.name);
      console.log('🔗 Agent ID:', updatedCampaign.agentConfigId);
      
      return {
        campaign: updatedCampaign,
        agent: activeAgent
      };
    } else {
      console.log('❌ Failed to update campaign');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

fixCampaignAgent().then(result => {
  if (result) {
    console.log('\n✅ Campaign-Agent link fixed! Ready to send email.');
  } else {
    console.log('\n💥 Failed to fix campaign-agent link');
  }
  process.exit(result ? 0 : 1);
});