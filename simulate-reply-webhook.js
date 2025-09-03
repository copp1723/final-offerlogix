// Simulate reply from josh@atsglobal.ai being sent to the webhook
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

async function simulateReplyWebhook() {
  try {
    console.log('📧 Simulating reply from josh@atsglobal.ai to webhook...');
    
    // Import the inbound email service
    const { InboundEmailService } = await import('./server/services/inbound-email.js');
    
    // Get campaign and agent info for context
    const { db } = await import('./server/db.js');
    const { campaigns, aiAgentConfig } = await import('./shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const [campaign] = await db.select()
      .from(campaigns)
      .where(eq(campaigns.name, 'Kunes Macomb - 2-Way Conversation Test'));
      
    const [agent] = await db.select()
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.id, campaign.agentConfigId));
    
    console.log('📊 Using Campaign:', campaign.name);
    console.log('🤖 Using Agent:', agent.name);
    console.log('📨 Reply to: swarm@' + agent.agentEmailDomain);
    
    // Create realistic reply email data
    const timestamp = Date.now() / 1000;
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create webhook signature (for Mailgun validation)
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';
    const signatureData = `${timestamp}${token}`;
    const signature = crypto.createHmac('sha256', signingKey).update(signatureData).digest('hex');
    
    const replyEmailData = {
      sender: 'josh@atsglobal.ai',
      recipient: `swarm@${agent.agentEmailDomain}`,
      subject: 'RE: Honda Civic - Perfect Match for Your Needs!',
      'body-plain': `Hi there!

Thanks for reaching out about the Honda Civic. I'm definitely interested in learning more!

I've been looking for a reliable, fuel-efficient car and the Civic sounds like exactly what I need. I love that it has the latest safety features too.

Could you tell me:
1. What trim levels do you have available?
2. What kind of incentives are currently offered?
3. When would be a good time to schedule a test drive?

I'm particularly interested in the hybrid version if you have any on the lot.

Looking forward to hearing from you soon!

Best,
Josh`,
      'body-html': `<div>
        <p>Hi there!</p>
        
        <p>Thanks for reaching out about the Honda Civic. I'm definitely interested in learning more!</p>
        
        <p>I've been looking for a reliable, fuel-efficient car and the Civic sounds like exactly what I need. I love that it has the latest safety features too.</p>
        
        <p>Could you tell me:</p>
        <ol>
          <li>What trim levels do you have available?</li>
          <li>What kind of incentives are currently offered?</li>
          <li>When would be a good time to schedule a test drive?</li>
        </ol>
        
        <p>I'm particularly interested in the hybrid version if you have any on the lot.</p>
        
        <p>Looking forward to hearing from you soon!</p>
        
        <p>Best,<br>Josh</p>
      </div>`,
      'stripped-text': `Hi there!

Thanks for reaching out about the Honda Civic. I'm definitely interested in learning more!

I've been looking for a reliable, fuel-efficient car and the Civic sounds like exactly what I need. I love that it has the latest safety features too.

Could you tell me:
1. What trim levels do you have available?
2. What kind of incentives are currently offered?
3. When would be a good time to schedule a test drive?

I'm particularly interested in the hybrid version if you have any on the lot.

Looking forward to hearing from you soon!

Best,
Josh`,
      'stripped-html': `<div>
        <p>Hi there!</p>
        <p>Thanks for reaching out about the Honda Civic. I'm definitely interested in learning more!</p>
        <p>I've been looking for a reliable, fuel-efficient car and the Civic sounds like exactly what I need. I love that it has the latest safety features too.</p>
        <p>Could you tell me:</p>
        <ol>
          <li>What trim levels do you have available?</li>
          <li>What kind of incentives are currently offered?</li>
          <li>When would be a good time to schedule a test drive?</li>
        </ol>
        <p>I'm particularly interested in the hybrid version if you have any on the lot.</p>
        <p>Looking forward to hearing from you soon!</p>
        <p>Best,<br>Josh</p>
      </div>`,
      'message-headers': JSON.stringify([
        ['From', 'josh@atsglobal.ai'],
        ['To', `swarm@${agent.agentEmailDomain}`],
        ['Subject', 'RE: Honda Civic - Perfect Match for Your Needs!'],
        ['Message-Id', `<reply-${Date.now()}@atsglobal.ai>`],
        ['In-Reply-To', '<20250826143635.5bee98f20612186e@mg.watchdogai.us>'],
        ['References', '<20250826143635.5bee98f20612186e@mg.watchdogai.us>'],
        ['Date', new Date().toUTCString()],
        ['Content-Type', 'multipart/alternative']
      ]),
      timestamp: timestamp,
      token: token,
      signature: signature
    };
    
    console.log('📧 Reply email data prepared:', {
      sender: replyEmailData.sender,
      recipient: replyEmailData.recipient,
      subject: replyEmailData.subject,
      messageLength: replyEmailData['body-plain'].length
    });
    
    // Create mock request and response objects
    const mockReq = {
      headers: { 'content-type': 'application/json' },
      body: replyEmailData,
      ip: '127.0.0.1'
    };
    
    const mockRes = {
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      json: (data) => {
        mockRes.jsonData = data;
        console.log('📤 Webhook response:', { status: mockRes.statusCode, data });
        return mockRes;
      },
      send: (data) => {
        mockRes.textData = data;
        console.log('📤 Webhook response:', { status: mockRes.statusCode, text: data });
        return mockRes;
      },
      statusCode: 200,
      jsonData: null,
      textData: null
    };
    
    console.log('🚀 Processing reply email through webhook handler...');
    
    // Call the inbound email handler directly
    await InboundEmailService.handleInboundEmail(mockReq, mockRes);
    
    console.log('✅ Webhook processing completed!');
    console.log('📊 Response Status:', mockRes.statusCode);
    
    if (mockRes.statusCode === 200) {
      console.log('\n🎯 Phase 2 Complete: Reply processed successfully!');
      console.log('📋 Next: Check if AI auto-response was generated and sent');
      return true;
    } else {
      console.log('\n❌ Webhook processing failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Reply webhook simulation failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

simulateReplyWebhook().then(result => {
  if (result) {
    console.log('\n🚀 Reply webhook simulation successful!');
  } else {
    console.log('\n💥 Reply webhook simulation failed');
  }
  process.exit(result ? 0 : 1);
});