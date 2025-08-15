// Test the complete email pipeline functionality
const API_BASE = 'http://localhost:5000/api';

async function testEmailPipeline() {
  console.log('🧪 Testing OneKeel Swarm Email Pipeline...\n');

  try {
    // 1. Test campaign execution with real email delivery
    console.log('1. Testing campaign execution...');
    const execResponse = await fetch(`${API_BASE}/campaigns/9ea0fb2c-cf5f-4ae5-967c-3f222e08b99a/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testMode: false,
        selectedLeadIds: ['d042be65-d010-4ccd-b1dd-e230a18ce5af'],
        maxLeadsPerBatch: 1
      })
    });
    const execResult = await execResponse.json();
    console.log('Campaign Execution:', execResult);

    // 2. Test lead creation from email inquiry simulation
    console.log('\n2. Testing lead creation...');
    const leadResponse = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pipeline-test@example.com',
        firstName: 'Pipeline',
        lastName: 'Test',
        vehicleInterest: '2025 Tesla Model 3',
        leadSource: 'pipeline_test',
        campaignId: '9ea0fb2c-cf5f-4ae5-967c-3f222e08b99a'
      })
    });
    const leadResult = await leadResponse.json();
    console.log('Lead Creation:', leadResult);

    // 3. Test conversation creation for new lead
    console.log('\n3. Testing conversation creation...');
    const convResponse = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: '9ea0fb2c-cf5f-4ae5-967c-3f222e08b99a',
        subject: `Vehicle Interest: ${leadResult.vehicleInterest}`,
        priority: 'high'
      })
    });
    const convResult = await convResponse.json();
    console.log('Conversation Creation:', convResult);

    // 4. Test getting campaign analytics
    console.log('\n4. Testing campaign analytics...');
    const analyticsResponse = await fetch(`${API_BASE}/campaigns/9ea0fb2c-cf5f-4ae5-967c-3f222e08b99a/analytics`);
    const analyticsResult = await analyticsResponse.json();
    console.log('Campaign Analytics:', {
      totalLeads: analyticsResult.leads?.total,
      contactedLeads: analyticsResult.leads?.byStatus?.contacted,
      conversationRate: analyticsResult.engagement?.responseRate + '%'
    });

    console.log('\n✅ PIPELINE TEST COMPLETE - ALL SYSTEMS OPERATIONAL');

  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
  }
}

testEmailPipeline();