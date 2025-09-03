// Fix campaign-lead assignment and launch campaign
const API_BASE = 'https://ccl-3-final.onrender.com';
const campaignId = 'ccc9d43b-cf58-49f1-89e1-2fc366468dac';

async function fixCampaignAndLaunch() {
  console.log('=== FIXING CAMPAIGN LEAD ASSIGNMENT AND LAUNCHING ===\n');

  try {
    // 1. Get all leads to find Josh
    console.log('🔍 Finding Josh leads...');
    const leadsResponse = await fetch(`${API_BASE}/api/leads`, {
      headers: {
        'Authorization': 'Bearer test-token' // SKIP_AUTH=true should handle this
      }
    });

    const leadsData = await leadsResponse.json();
    console.log('Raw leads response:', leadsData);
    
    const leads = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
    console.log(`Found ${leads.length} leads total`);
    
    if (leads.length === 0) {
      console.log('❌ No leads found in API response');
      return;
    }
    
    // Find Josh Global (the one with 2024 Toyota Prius)
    const joshLead = leads.find(lead => 
      lead.email === 'josh@atsglobal.ai' && 
      lead.vehicleInterest === '2024 Toyota Prius'
    );

    if (!joshLead) {
      console.log('❌ Josh lead with 2024 Toyota Prius not found!');
      return;
    }

    console.log(`✅ Found Josh lead: ${joshLead.id} (${joshLead.firstName} ${joshLead.lastName})`);
    console.log(`   - Email: ${joshLead.email}`);
    console.log(`   - Vehicle: ${joshLead.vehicleInterest}`);
    console.log(`   - Current campaign: ${joshLead.campaignId || 'NONE'}`);

    // 2. Update Josh's lead to assign to the campaign
    if (joshLead.campaignId !== campaignId) {
      console.log('🔧 Assigning Josh to Toyota Prius campaign...');
      const updateResponse = await fetch(`${API_BASE}/api/leads/${joshLead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          ...joshLead,
          campaignId: campaignId
        })
      });

      if (updateResponse.ok) {
        console.log('✅ Josh assigned to campaign successfully');
      } else {
        const error = await updateResponse.text();
        console.log('❌ Failed to assign Josh to campaign:', error);
        return;
      }
    } else {
      console.log('✅ Josh is already assigned to the campaign');
    }

    // 3. Launch the campaign
    console.log('\n🚀 Launching campaign...');
    const launchResponse = await fetch(`${API_BASE}/api/campaigns/${campaignId}/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({})
    });

    const launchResult = await launchResponse.json();
    
    if (launchResponse.ok) {
      console.log('✅ Campaign launch API call succeeded!');
      console.log('📊 Execution result:', JSON.stringify(launchResult, null, 2));
      
      if (launchResult.execution && launchResult.execution.emailsSent > 0) {
        console.log('\n🎉 SUCCESS: EMAIL SENT!');
        console.log(`📧 ${launchResult.execution.emailsSent} email(s) sent to josh@atsglobal.ai`);
        console.log('📬 Check josh@atsglobal.ai inbox and spam folder');
      } else {
        console.log('\n❌ Campaign launched but no emails were sent');
        console.log('🔍 Execution details:', launchResult.execution);
        console.log('📋 Errors:', launchResult.execution?.errors);
      }
    } else {
      console.log('❌ Campaign launch failed:', launchResult.message);
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
}

fixCampaignAndLaunch();