// Create Josh as a lead via API
const API_BASE = 'https://ccl-3-final.onrender.com';
const campaignId = 'ccc9d43b-cf58-49f1-89e1-2fc366468dac';

async function createJoshLead() {
  console.log('=== CREATING JOSH AS A LEAD ===\n');

  // 1. Create Josh as a lead
  const leadData = {
    email: 'josh@atsglobal.ai',
    firstName: 'Josh',
    lastName: 'Global',
    vehicleInterest: '2024 Toyota Prius',
    leadSource: 'Campaign Test',
    status: 'new',
    campaignId: campaignId
  };

  try {
    console.log('📝 Creating lead:', leadData.email);
    const createResponse = await fetch(`${API_BASE}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Using SKIP_AUTH=true
      },
      body: JSON.stringify(leadData)
    });

    const createResult = await createResponse.json();
    
    if (createResponse.ok) {
      console.log('✅ Lead created successfully:', createResult.id);
      
      // 2. Now launch the campaign
      console.log('\n🚀 Launching campaign with Josh assigned...');
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
        console.log('✅ Campaign launched successfully!');
        console.log('📊 Execution result:', launchResult);
        
        if (launchResult.execution && launchResult.execution.emailsSent > 0) {
          console.log('\n🎉 SUCCESS: Email sent to josh@atsglobal.ai!');
          console.log('📧 Check inbox and spam folder');
        } else {
          console.log('\n❌ Campaign launched but no emails were sent');
          console.log('🔍 Check execution details:', launchResult.execution);
        }
      } else {
        console.log('❌ Campaign launch failed:', launchResult.message);
      }
      
    } else {
      console.log('❌ Failed to create lead:', createResult.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createJoshLead();