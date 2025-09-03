// Check lead sequence status to debug the duplicate Message-ID issue
const API_BASE = 'https://ccl-3-final.onrender.com';

async function debugLeadStatus() {
  try {
    console.log('=== DEBUGGING LEAD SEQUENCE STATUS ===\n');
    
    // Get some conversations to check lead status
    const response = await fetch(`${API_BASE}/v2/conversations?limit=5`);
    const data = await response.json();
    
    if (data.success && data.conversations) {
      for (const conv of data.conversations) {
        console.log(`Lead: ${conv.leadEmail}`);
        console.log(`  Conversation ID: ${conv.id}`);
        console.log(`  Agent ID: ${conv.agentId}`);
        console.log(`  Messages: ${conv.messageCount}`);
        console.log(`  Last Updated: ${new Date(conv.updatedAt).toLocaleString()}`);
        
        // Get messages for this conversation
        const msgResponse = await fetch(`${API_BASE}/v2/conversations/${conv.id}/messages`);
        const msgData = await msgResponse.json();
        
        if (msgData.success && msgData.messages) {
          console.log(`  Message Details:`);
          msgData.messages.forEach((msg, idx) => {
            console.log(`    ${idx + 1}. ${msg.sender}: ${msg.content.substring(0, 50)}...`);
            console.log(`       Status: ${msg.status}, Created: ${new Date(msg.createdAt).toLocaleString()}`);
          });
        }
        console.log('');
      }
    }
    
    console.log('=== EXPECTED BEHAVIOR ===');
    console.log('Since emails were sent on 8/29/2025:');
    console.log('- Day 0: 8/29 (SENT)');
    console.log('- Day 3: 9/1 (TODAY - should be sending)');
    console.log('- Day 6: 9/4');
    console.log('- Day 11: 9/9');
    console.log('- Day 12: 9/10');
    console.log('- Day 14: 9/12');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugLeadStatus();
