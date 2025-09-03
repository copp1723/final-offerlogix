// Check the actual database state of leads to understand the sequence issue
const API_BASE = 'https://ccl-3-final.onrender.com';

async function checkLeadDatabaseState() {
  try {
    console.log('=== CHECKING ACTUAL LEAD DATABASE STATE ===\n');
    
    // We need to check the leads_v2 table, but there's no direct API for that
    // Let's infer from conversation data and check a specific campaign
    
    // First, get a campaign ID
    const campaignsResponse = await fetch(`${API_BASE}/v2/campaigns`);
    const campaignsData = await campaignsResponse.json();
    
    if (!campaignsData.success || !campaignsData.campaigns.length) {
      console.log('❌ No campaigns found');
      return;
    }
    
    const campaign = campaignsData.campaigns[0];
    console.log(`Checking campaign: ${campaign.name} (${campaign.id})`);
    console.log(`Agent: ${campaign.agentId}`);
    console.log('');
    
    // Get conversations for this agent (which represent leads that have been contacted)
    const convsResponse = await fetch(`${API_BASE}/v2/conversations?agentId=${campaign.agentId}&limit=10`);
    const convsData = await convsResponse.json();
    
    if (!convsData.success || !convsData.conversations.length) {
      console.log('❌ No conversations found for this agent');
      return;
    }
    
    console.log(`Found ${convsData.conversations.length} conversations (contacted leads):`);
    console.log('');
    
    convsData.conversations.forEach((conv, idx) => {
      console.log(`${idx + 1}. ${conv.leadEmail}`);
      console.log(`   Messages: ${conv.messageCount}`);
      console.log(`   Last Updated: ${new Date(conv.updatedAt).toLocaleString()}`);
      console.log(`   Status: ${conv.status}`);
      
      // Calculate expected next send dates
      const lastUpdate = new Date(conv.updatedAt);
      const daysSinceLastUpdate = Math.floor((new Date() - lastUpdate) / (1000 * 60 * 60 * 24));
      
      console.log(`   Days since last update: ${daysSinceLastUpdate}`);
      
      if (conv.messageCount === 1 && daysSinceLastUpdate >= 3) {
        console.log(`   🔥 SHOULD BE DUE FOR DAY 3 FOLLOW-UP!`);
      } else if (conv.messageCount === 1 && daysSinceLastUpdate < 3) {
        console.log(`   ⏳ Day 3 follow-up due in ${3 - daysSinceLastUpdate} days`);
      } else if (conv.messageCount > 1) {
        console.log(`   ✅ Sequence progressing (${conv.messageCount} messages)`);
      }
      
      console.log('');
    });
    
    // Check the campaign sequence
    const campaignResponse = await fetch(`${API_BASE}/v2/campaigns/${campaign.id}`);
    const campaignData = await campaignResponse.json();
    
    if (campaignData.success && campaignData.campaign.sequence) {
      console.log('=== CAMPAIGN SEQUENCE ===');
      campaignData.campaign.sequence.forEach((step, idx) => {
        console.log(`Step ${idx + 1}: Day ${step.offsetDays} - "${step.subject}"`);
      });
      console.log('');
    }
    
    console.log('=== DIAGNOSIS ===');
    console.log('If leads have only 1 message and it\'s been 3+ days:');
    console.log('1. Either nextSendAt was not set correctly during initial send');
    console.log('2. Or the campaign runner is not processing scheduled sends');
    console.log('3. Or there\'s a bug in the lead selection logic (which we fixed)');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkLeadDatabaseState();
