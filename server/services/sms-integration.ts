import { sendSMS, SMSData } from './twilio';
import { db } from '../db';
import { leads } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface SMSCampaignData {
  campaignId: string;
  leadId: string;
  message: string;
  optInMessage?: string;
}

export class SMSIntegrationService {
  // Send SMS opt-in request
  public async sendOptInRequest(leadId: string, campaignId: string, optInMessage?: string): Promise<boolean> {
    try {
      const [lead] = await db.select()
        .from(leads)
        .where(eq(leads.id, leadId));

      if (!lead || !lead.phone) {
        throw new Error('Lead not found or phone number missing');
      }

      const message = optInMessage || 
        "Would you like to continue this conversation via text? Reply YES to receive SMS updates about your automotive interests.";

      const smsData: SMSData = {
        to: lead.phone,
        message: message
      };

      await sendSMS(smsData);
      
      // Update lead to track SMS opt-in sent
      await db.update(leads)
        .set({ 
          notes: `${lead.notes || ''}\n[SMS] Opt-in request sent: ${new Date().toISOString()}`,
          updatedAt: new Date()
        })
        .where(eq(leads.id, leadId));

      console.log(`📱 SMS opt-in request sent to lead: ${leadId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending SMS opt-in request:', error);
      return false;
    }
  }

  // Process SMS opt-in response (YES/NO)
  public async processOptInResponse(phoneNumber: string, response: string): Promise<boolean> {
    try {
      const normalizedResponse = response.trim().toLowerCase();
      const isOptIn = ['yes', 'y', 'ok', 'sure', 'yeah'].includes(normalizedResponse);

      // Find lead by phone number
      const [lead] = await db.select()
        .from(leads)
        .where(eq(leads.phone, phoneNumber));

      if (!lead) {
        console.warn(`Lead not found for phone number: ${phoneNumber}`);
        return false;
      }

      // Update lead with opt-in status
      const optInStatus = isOptIn ? 'opted-in' : 'opted-out';
      await db.update(leads)
        .set({ 
          tags: [...(lead.tags || []), `sms-${optInStatus}`],
          notes: `${lead.notes || ''}\n[SMS] Opt-in response: ${response} (${optInStatus}) - ${new Date().toISOString()}`,
          updatedAt: new Date()
        })
        .where(eq(leads.id, lead.id));

      // Send confirmation message
      const confirmationMessage = isOptIn 
        ? "Great! You're now signed up for SMS updates. We'll keep you informed about your automotive interests."
        : "No problem! You won't receive SMS updates. You can still reach us via email anytime.";

      await sendSMS({
        to: phoneNumber,
        message: confirmationMessage
      });

      console.log(`📱 SMS opt-in processed for ${phoneNumber}: ${optInStatus}`);
      return isOptIn;
    } catch (error) {
      console.error('❌ Error processing SMS opt-in response:', error);
      return false;
    }
  }

  // Send campaign SMS to opted-in leads
  public async sendCampaignSMS(campaignData: SMSCampaignData): Promise<boolean> {
    try {
      const [lead] = await db.select()
        .from(leads)
        .where(eq(leads.id, campaignData.leadId));

      if (!lead || !lead.phone) {
        throw new Error('Lead not found or phone number missing');
      }

      // Check if lead has opted in for SMS
      const hasOptedIn = lead.tags?.includes('sms-opted-in');
      if (!hasOptedIn) {
        console.warn(`Lead ${campaignData.leadId} has not opted in for SMS`);
        return false;
      }

      const smsData: SMSData = {
        to: lead.phone,
        message: campaignData.message
      };

      await sendSMS(smsData);

      // Log SMS sent
      await db.update(leads)
        .set({ 
          notes: `${lead.notes || ''}\n[SMS] Campaign message sent: ${new Date().toISOString()}`,
          updatedAt: new Date()
        })
        .where(eq(leads.id, campaignData.leadId));

      console.log(`📱 Campaign SMS sent to lead: ${campaignData.leadId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending campaign SMS:', error);
      return false;
    }
  }

  // Get SMS status for a lead
  public async getSMSStatus(leadId: string): Promise<{
    hasPhone: boolean;
    optInSent: boolean;
    optInStatus: 'pending' | 'opted-in' | 'opted-out' | 'unknown';
  }> {
    try {
      const [lead] = await db.select()
        .from(leads)
        .where(eq(leads.id, leadId));

      if (!lead) {
        return {
          hasPhone: false,
          optInSent: false,
          optInStatus: 'unknown'
        };
      }

      const hasPhone = !!lead.phone;
      const optInSent = lead.notes?.includes('[SMS] Opt-in request sent') || false;
      
      let optInStatus: 'pending' | 'opted-in' | 'opted-out' | 'unknown' = 'unknown';
      if (lead.tags?.includes('sms-opted-in')) {
        optInStatus = 'opted-in';
      } else if (lead.tags?.includes('sms-opted-out')) {
        optInStatus = 'opted-out';
      } else if (optInSent) {
        optInStatus = 'pending';
      }

      return {
        hasPhone,
        optInSent,
        optInStatus
      };
    } catch (error) {
      console.error('❌ Error getting SMS status:', error);
      return {
        hasPhone: false,
        optInSent: false,
        optInStatus: 'unknown'
      };
    }
  }

  // Generate SMS version of email content
  public generateSMSContent(emailContent: string, leadName?: string): string {
    // Strip HTML and shorten for SMS
    const textContent = emailContent.replace(/<[^>]*>/g, '').trim();
    const maxLength = 160; // SMS character limit
    
    let smsContent = textContent;
    
    // Add personal greeting if name provided
    if (leadName) {
      smsContent = `Hi ${leadName}! ${smsContent}`;
    }
    
    // Truncate if too long
    if (smsContent.length > maxLength - 20) { // Leave room for "... More info via email"
      smsContent = smsContent.substring(0, maxLength - 30) + '... More info via email.';
    }
    
    return smsContent;
  }
}

// Export singleton instance
export const smsIntegration = new SMSIntegrationService();