import logger from '../logging/logger';

/**
 * Twilio SMS Service
 * Stub implementation for SMS functionality
 */
export interface SMSParams {
  to: string;
  message: string;
}

export const sendSMS = async (params: SMSParams): Promise<void> => {
  try {
    logger.info('SMS sending requested (stub implementation)', {
      to: params.to,
      messageLength: params.message.length
    });

    // TODO: Implement actual Twilio SMS sending
    // For now, just log the SMS request
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 SMS TO: ${params.to}`);
      console.log(`📱 MESSAGE: ${params.message}`);
    }

    logger.info('SMS sent successfully (stub)', { to: params.to });
  } catch (error) {
    logger.error('SMS sending failed', { 
      to: params.to, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
};

export default { sendSMS };