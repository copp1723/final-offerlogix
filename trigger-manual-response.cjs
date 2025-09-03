// Manual trigger to simulate your reply and get AI response immediately
const fetch = require('node-fetch');

async function triggerResponse() {
  console.log('🚀 Manually triggering AI response to your reply...');
  
  const payload = {
    sender: 'josh@atsglobal.ai',
    recipient: 'swarm@kunesmacomb.kunesauto.vip', 
    subject: 'Re: Honda Civic - Perfect Match for Your Needs!',
    'stripped-text': 'Yes, I\'m very interested! Can we schedule a test drive this week?',
    timestamp: Math.floor(Date.now() / 1000),
    token: 'dummy-token-for-manual-test',
    signature: 'dummy-signature'
  };

  try {
    const response = await fetch('https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Status:', response.status);
    const result = await response.text();
    console.log('Response:', result);
    
    if (response.status === 200) {
      console.log('✅ SUCCESS - Check your email for AI response!');
    } else {
      console.log('❌ Still failing:', result);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

triggerResponse();