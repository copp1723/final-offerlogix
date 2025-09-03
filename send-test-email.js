// Send test email from Kunes Macomb to josh@atsglobal.ai
import dotenv from 'dotenv';
dotenv.config();

async function sendTestEmail() {
  try {
    console.log('📧 Sending test email from Kunes Macomb to josh@atsglobal.ai...');
    
    // Import the Mailgun service
    const { mailgunService } = await import('./server/services/email/mailgun-service.js');
    
    // Get campaign and lead info
    const { db } = await import('./server/db.js');
    const { campaigns, leads, aiAgentConfig } = await import('./shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Get our test campaign
    const [campaign] = await db.select()
      .from(campaigns)
      .where(eq(campaigns.name, 'Kunes Macomb - 2-Way Conversation Test'));
      
    if (!campaign) {
      console.log('❌ Test campaign not found');
      return false;
    }
    
    // Get Josh lead
    const [lead] = await db.select()
      .from(leads)
      .where(eq(leads.email, 'josh@atsglobal.ai'));
      
    if (!lead) {
      console.log('❌ Josh lead not found');
      return false;
    }
    
    // Get AI agent config
    const [agent] = await db.select()
      .from(aiAgentConfig)
      .where(eq(aiAgentConfig.id, campaign.agentConfigId));
    
    console.log('📊 Campaign:', campaign.name);
    console.log('👤 Lead:', lead.email);
    console.log('🤖 Agent:', agent.name, '(' + agent.agentEmailDomain + ')');
    
    // Create HTML email template
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Kunes Auto Group of Macomb</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your Honda Connection</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <h2 style="color: #1e3c72; margin-top: 0;">Honda Civic - Perfect Match for Your Needs!</h2>
          
          <p>Hello Josh,</p>
          
          <p>I hope this message finds you well! I'm reaching out from Kunes Auto Group of Macomb regarding your interest in Honda vehicles.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #2a5298; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #1e3c72;">Why Choose the Honda Civic?</p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>Outstanding fuel efficiency</li>
              <li>Honda's legendary reliability</li>
              <li>Advanced Honda Sensing safety features</li>
              <li>Modern technology and connectivity</li>
              <li>Perfect for daily commuting and weekend adventures</li>
            </ul>
          </div>
          
          <p>I'd love to help you explore the Civic lineup and find the perfect trim level for your needs. We have several in stock and can arrange a test drive at your convenience.</p>
          
          <p><strong>Would you be interested in learning more about current incentives or scheduling a visit?</strong></p>
          
          <div style="background: #2a5298; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 16px; font-weight: bold;">Ready to Test Drive?</p>
            <p style="margin: 10px 0 0 0;">Simply reply to this email and let's get started!</p>
          </div>
          
          <p>Best regards,<br>
          <strong>Kunes Auto Group of Macomb</strong><br>
          <em>Your Honda Connection</em></p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>This is a test email for the 2-way conversation system proof.</p>
        </div>
      </div>
    `;
    
    // Prepare email data
    const emailData = {
      to: 'josh@atsglobal.ai',
      subject: 'Honda Civic - Perfect Match for Your Needs!',
      html: emailHTML,
      from: `swarm@${agent.agentEmailDomain}`,
      replyTo: `swarm@${agent.agentEmailDomain}`,
      // Add metadata for tracking
      'o:tag': ['test-campaign', 'kunes-macomb', '2way-conversation-proof'],
      'o:campaign': campaign.id,
      'v:lead_id': lead.id,
      'v:campaign_id': campaign.id,
      'v:agent_domain': agent.agentEmailDomain,
      'v:message_type': 'initial_outreach'
    };
    
    console.log('📨 Sending email with data:', {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      replyTo: emailData.replyTo
    });
    
    // Send the email
    const result = await mailgunService.sendEmail(emailData);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      console.log('📊 Status:', result.status);
      
      // Update campaign state if needed
      console.log('\n🎯 Email delivery initiated:');
      console.log('- From: swarm@' + agent.agentEmailDomain);
      console.log('- To: josh@atsglobal.ai');
      console.log('- Campaign:', campaign.name);
      console.log('- Next Step: Wait for reply from josh@atsglobal.ai');
      
      return {
        success: true,
        messageId: result.messageId,
        campaign,
        lead,
        agent
      };
    } else {
      console.log('❌ Email send failed:', result.error);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

sendTestEmail().then(result => {
  if (result) {
    console.log('\n🚀 Phase 1 Complete: Outbound email sent successfully!');
    console.log('📋 Next: Reply from josh@atsglobal.ai to test webhook processing');
  } else {
    console.log('\n💥 Failed to send test email');
  }
  process.exit(result ? 0 : 1);
});