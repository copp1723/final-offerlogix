import twilio from 'twilio';

let twilioClient: any = null;

function getTwilioClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  if (!twilioClient) {
    throw new Error("Twilio not configured - Account SID and Auth Token required");
  }
  return twilioClient;
}

export interface SMSData {
  to: string;
  message: string;
  from?: string;
}

export async function sendSMS(smsData: SMSData): Promise<any> {
  const client = getTwilioClient();
  const fromNumber = smsData.from || process.env.TWILIO_PHONE_NUMBER;

  if (!fromNumber) {
    throw new Error("Twilio phone number not configured");
  }

  try {
    const message = await client.messages.create({
      body: smsData.message,
      from: fromNumber,
      to: smsData.to
    });
    return message;
  } catch (error) {
    console.error('Twilio send error:', error);
    throw new Error('Failed to send SMS via Twilio');
  }
}

export async function sendCampaignAlert(phoneNumber: string, campaignName: string, metric: string, value: string): Promise<any> {
  const message = `OneKeel Swarm Alert: "${campaignName}" campaign ${metric}: ${value}. Check your dashboard for details.`;
  
  return sendSMS({
    to: phoneNumber,
    message: message
  });
}

export async function sendBulkSMS(smsMessages: SMSData[]): Promise<any[]> {
  const results = [];
  
  for (const sms of smsMessages) {
    try {
      const result = await sendSMS(sms);
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }
  
  return results;
}

export async function validatePhoneNumber(phoneNumber: string): Promise<{ valid: boolean, formatted?: string }> {
  const client = getTwilioClient();
  
  try {
    const lookup = await client.lookups.v1.phoneNumbers(phoneNumber).fetch();
    return {
      valid: true,
      formatted: lookup.phoneNumber
    };
  } catch (error) {
    return { valid: false };
  }
}