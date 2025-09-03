// Quick script to check campaign sequence status
const API_BASE = 'https://ccl-3-final.onrender.com';

async function checkCampaignStatus() {
  try {
    // Get a sample of leads to check their sequence progress
    const response = await fetch(`${API_BASE}/v2/conversations?limit=10&includeMessageCounts=true`);
    const data = await response.json();
    
    console.log('=== CAMPAIGN SEQUENCE STATUS ===\n');
    
    if (data.success && data.conversations) {
      data.conversations.forEach(conv => {
        console.log(`Lead: ${conv.leadEmail}`);
        console.log(`  Messages: ${conv.messageCount || 1}`);
        console.log(`  Subject: ${conv.subject}`);
        console.log(`  Status: ${conv.status}`);
        console.log(`  Last Updated: ${new Date(conv.updatedAt).toLocaleString()}`);
        console.log('');
      });
    }
    
    // Check if campaign runner is working
    console.log('=== TESTING CAMPAIGN RUNNER ===');
    const runnerResponse = await fetch(`${API_BASE}/v2/campaigns/execute-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (runnerResponse.ok) {
      const result = await runnerResponse.json();
      console.log('✅ Campaign runner executed successfully');
      console.log('Result:', result);
    } else {
      console.log('❌ Campaign runner failed:', runnerResponse.status);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCampaignStatus();
