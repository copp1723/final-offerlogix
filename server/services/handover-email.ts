import { sendCampaignEmail } from './mailgun';

export interface HandoverEvaluation {
  shouldHandover: boolean;
  reason: string;
  score: number;
  triggeredCriteria: string[];
  nextActions: string[];
  recommendedAgent: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface HandoverEmailData {
  conversationId: string;
  evaluation: HandoverEvaluation;
  lead?: any;
  conversation?: any;
  campaignName?: string;
}

export class HandoverEmailService {
  /**
   * Send handover notification email to sales team
   */
  static async sendHandoverNotification(data: HandoverEmailData): Promise<boolean> {
    try {
      const { evaluation, lead, conversation, campaignName } = data;
      
      // Get recipient email (in production, this would come from user settings)
      const recipientEmail = process.env.HANDOVER_EMAIL || 'sales@onekeelswarm.com';
      const fromEmail = process.env.EMAIL_FROM || 'swarm@mg.watchdogai.us';
      
      // Generate handover email content
      const emailContent = this.generateHandoverEmail(data);
      
      // Send email via Mailgun
      const success = await sendCampaignEmail(
        recipientEmail,
        `🚨 Urgent Handover Required - ${lead?.firstName || 'Customer'} Ready to Purchase`,
        emailContent
      );
      
      console.log(`Handover email sent: ${success ? 'SUCCESS' : 'FAILED'}`);
      return success;
      
    } catch (error) {
      console.error('Failed to send handover email:', error);
      return false;
    }
  }

  /**
   * Generate professional handover email content
   */
  private static generateHandoverEmail(data: HandoverEmailData): string {
    const { evaluation, lead, conversation, campaignName } = data;
    
    const leadInfo = lead ? {
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      email: lead.email,
      phone: lead.phone || 'Not provided',
      vehicle: lead.vehicleInterest || 'Not specified',
      source: lead.leadSource || 'Unknown'
    } : {
      name: 'Unknown Customer',
      email: 'Not available',
      phone: 'Not provided',
      vehicle: 'Not specified',
      source: 'Conversation'
    };

    const urgencyColor = evaluation.urgencyLevel === 'high' ? '#dc2626' : 
                        evaluation.urgencyLevel === 'medium' ? '#ea580c' : '#16a34a';
    
    const urgencyIcon = evaluation.urgencyLevel === 'high' ? '🔥' : 
                       evaluation.urgencyLevel === 'medium' ? '⚠️' : '📋';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Handover Notification</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 20px; text-align: center; }
        .urgency-badge { display: inline-block; background: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 30px; }
        .lead-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0; }
        .field { margin-bottom: 12px; }
        .label { font-weight: 600; color: #374151; margin-bottom: 4px; }
        .value { color: #6b7280; }
        .criteria-list { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0; }
        .actions-list { background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; padding: 15px; margin: 15px 0; }
        .score { font-size: 24px; font-weight: bold; color: ${urgencyColor}; text-align: center; margin: 10px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        ul { margin: 0; padding-left: 20px; }
        li { margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="urgency-badge">${urgencyIcon} ${evaluation.urgencyLevel.toUpperCase()} PRIORITY</div>
            <h1 style="margin: 0; font-size: 28px;">Customer Handover Required</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">OneKeel Swarm Intelligence Alert</p>
        </div>
        
        <div class="content">
            <div class="score">Qualification Score: ${evaluation.score}/100</div>
            
            <div class="lead-card">
                <h3 style="margin-top: 0; color: #1f2937;">Customer Information</h3>
                <div class="field">
                    <div class="label">Name:</div>
                    <div class="value">${leadInfo.name}</div>
                </div>
                <div class="field">
                    <div class="label">Email:</div>
                    <div class="value">${leadInfo.email}</div>
                </div>
                <div class="field">
                    <div class="label">Phone:</div>
                    <div class="value">${leadInfo.phone}</div>
                </div>
                <div class="field">
                    <div class="label">Vehicle Interest:</div>
                    <div class="value">${leadInfo.vehicle}</div>
                </div>
                <div class="field">
                    <div class="label">Campaign:</div>
                    <div class="value">${campaignName || 'Direct Inquiry'}</div>
                </div>
                <div class="field">
                    <div class="label">Source:</div>
                    <div class="value">${leadInfo.source}</div>
                </div>
            </div>

            <div class="criteria-list">
                <h4 style="margin-top: 0; color: #92400e;">🎯 Handover Reason</h4>
                <p style="margin: 0; font-weight: 600;">${evaluation.reason}</p>
                <h4 style="color: #92400e;">Triggered Criteria:</h4>
                <ul>
                    ${evaluation.triggeredCriteria.map((criteria: string) => `<li>${criteria.replace('_', ' ').toUpperCase()}</li>`).join('')}
                </ul>
            </div>

            <div class="actions-list">
                <h4 style="margin-top: 0; color: #065f46;">✅ Recommended Next Actions</h4>
                <ul>
                    ${evaluation.nextActions.map((action: string) => `<li>${action}</li>`).join('')}
                </ul>
            </div>

            <div style="text-align: center;">
                <a href="https://ccl-3-final.onrender.com/conversations/${data.conversationId}" class="cta-button">
                    View Full Conversation
                </a>
            </div>

            <div style="background: #fffbeb; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin-top: 20px;">
                <strong>Recommended Agent:</strong> ${evaluation.recommendedAgent.toUpperCase()} DEPARTMENT<br>
                <strong>Urgency Level:</strong> ${evaluation.urgencyLevel.toUpperCase()}<br>
                <strong>Response Time:</strong> ${evaluation.urgencyLevel === 'high' ? 'IMMEDIATE (within 15 minutes)' : 
                                                 evaluation.urgencyLevel === 'medium' ? 'Priority (within 1 hour)' : 'Standard (within 4 hours)'}
            </div>
        </div>
        
        <div class="footer">
            <p>This handover was automatically generated by OneKeel Swarm AI Intelligence</p>
            <p>Conversation ID: ${data.conversationId}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate text version for email clients that don't support HTML
   */
  private static generateTextHandover(data: HandoverEmailData): string {
    const { evaluation, lead, conversation, campaignName } = data;
    
    const leadInfo = lead ? {
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      email: lead.email,
      phone: lead.phone || 'Not provided',
      vehicle: lead.vehicleInterest || 'Not specified'
    } : {
      name: 'Unknown Customer',
      email: 'Not available',
      phone: 'Not provided',
      vehicle: 'Not specified'
    };

    return `
URGENT HANDOVER NOTIFICATION - OneKeel Swarm

${evaluation.urgencyLevel.toUpperCase()} PRIORITY CUSTOMER READY FOR HANDOVER

CUSTOMER DETAILS:
- Name: ${leadInfo.name}
- Email: ${leadInfo.email}
- Phone: ${leadInfo.phone}
- Vehicle Interest: ${leadInfo.vehicle}
- Campaign: ${campaignName || 'Direct Inquiry'}

HANDOVER ANALYSIS:
- Qualification Score: ${evaluation.score}/100
- Reason: ${evaluation.reason}
- Triggered Criteria: ${evaluation.triggeredCriteria.join(', ')}
- Recommended Agent: ${evaluation.recommendedAgent.toUpperCase()}
- Urgency Level: ${evaluation.urgencyLevel.toUpperCase()}

NEXT ACTIONS:
${evaluation.nextActions.map((action: string) => `- ${action}`).join('\n')}

CONVERSATION LINK:
https://ccl-3-final.onrender.com/conversations/${data.conversationId}

This handover was automatically generated by OneKeel Swarm AI.
Conversation ID: ${data.conversationId}
Generated: ${new Date().toLocaleString()}
`;
  }
}