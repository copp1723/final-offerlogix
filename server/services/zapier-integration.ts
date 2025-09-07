import crypto from 'crypto';

export interface ZapierWebhookPayload {
  event: 'lead_created' | 'lead_updated' | 'lead_status_changed';
  timestamp: string;
  lead: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    vehicleInterest?: string;
    leadSource?: string;
    status?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  };
  campaign?: {
    id: string;
    name: string;
  };
  metadata?: {
    previousStatus?: string;
    changedFields?: string[];
  };
}

export interface ZapierIntegrationConfig {
  webhookUrl?: string;
  secretKey?: string;
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
}

export class ZapierIntegrationService {
  private config: ZapierIntegrationConfig;

  constructor() {
    this.config = {
      webhookUrl: process.env.ZAPIER_WEBHOOK_URL,
      secretKey: process.env.ZAPIER_SECRET_KEY,
      enabled: process.env.ZAPIER_INTEGRATION_ENABLED === 'true',
      timeoutMs: parseInt(process.env.ZAPIER_TIMEOUT_MS || '5000'),
      maxRetries: parseInt(process.env.ZAPIER_MAX_RETRIES || '3')
    };
  }

  /**
   * Check if the Zapier integration is properly configured and enabled
   */
  isConfigured(): boolean {
    return this.config.enabled && !!this.config.webhookUrl;
  }

  /**
   * Send a lead event to Zapier webhook
   */
  async sendLeadEvent(payload: ZapierWebhookPayload): Promise<{
    success: boolean;
    status?: number;
    error?: string;
    attempts: number;
  }> {
    if (!this.isConfigured()) {
      console.log('Zapier integration not configured or disabled');
      return { success: false, error: 'Integration not configured', attempts: 0 };
    }

    const webhookUrl = this.config.webhookUrl!;
    let attempts = 0;
    let lastError: string | undefined;

    // Add signature if secret key is configured
    const finalPayload = this.addSignature(payload);

    for (let i = 0; i < this.config.maxRetries; i++) {
      attempts++;
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'OneKeel-OfferLogix/1.0',
            'X-Webhook-Source': 'onekeel-offerlogix'
          },
          body: JSON.stringify(finalPayload),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
          console.log(`Zapier webhook sent successfully: ${payload.event} for lead ${payload.lead.id}`);
          return { success: true, status: response.status, attempts };
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
          console.warn(`Zapier webhook failed (attempt ${i + 1}): ${lastError}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Zapier webhook error (attempt ${i + 1}):`, lastError);
      }

      // Wait before retry (exponential backoff)
      if (i < this.config.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }

    console.error(`Zapier webhook failed after ${attempts} attempts: ${lastError}`);
    return { success: false, error: lastError, attempts };
  }

  /**
   * Send lead created event
   */
  async sendLeadCreated(lead: any, campaign?: any): Promise<void> {
    const payload: ZapierWebhookPayload = {
      event: 'lead_created',
      timestamp: new Date().toISOString(),
      lead: this.formatLeadData(lead),
      campaign: campaign ? { id: campaign.id, name: campaign.name } : undefined
    };

    await this.sendLeadEvent(payload);
  }

  /**
   * Send lead updated event
   */
  async sendLeadUpdated(lead: any, changedFields: string[], previousStatus?: string): Promise<void> {
    const payload: ZapierWebhookPayload = {
      event: 'lead_updated',
      timestamp: new Date().toISOString(),
      lead: this.formatLeadData(lead),
      metadata: {
        changedFields,
        previousStatus
      }
    };

    await this.sendLeadEvent(payload);
  }

  /**
   * Send lead status changed event
   */
  async sendLeadStatusChanged(lead: any, previousStatus: string): Promise<void> {
    const payload: ZapierWebhookPayload = {
      event: 'lead_status_changed',
      timestamp: new Date().toISOString(),
      lead: this.formatLeadData(lead),
      metadata: {
        previousStatus
      }
    };

    await this.sendLeadEvent(payload);
  }

  /**
   * Format lead data for webhook payload
   */
  private formatLeadData(lead: any): ZapierWebhookPayload['lead'] {
    return {
      id: lead.id,
      email: lead.email,
      firstName: lead.firstName || undefined,
      lastName: lead.lastName || undefined,
      phoneNumber: lead.phoneNumber || undefined,
      vehicleInterest: lead.vehicleInterest || undefined,
      leadSource: lead.leadSource || undefined,
      status: lead.status || undefined,
      notes: lead.notes || undefined,
      createdAt: lead.createdAt || new Date().toISOString(),
      updatedAt: lead.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Add HMAC signature to payload if secret key is configured
   */
  private addSignature(payload: ZapierWebhookPayload): any {
    if (!this.config.secretKey) {
      return payload;
    }

    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(payloadString)
      .digest('hex');

    return {
      ...payload,
      signature: `sha256=${signature}`
    };
  }

  /**
   * Test the webhook connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Integration not configured' };
    }

    const testPayload: ZapierWebhookPayload = {
      event: 'lead_created',
      timestamp: new Date().toISOString(),
      lead: {
        id: 'test-lead-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'Lead',
        phoneNumber: '+1234567890',
        vehicleInterest: 'Test Vehicle',
        leadSource: 'test',
        status: 'new',
        notes: 'This is a test webhook from OneKeel OfferLogix',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    const startTime = Date.now();
    const result = await this.sendLeadEvent(testPayload);
    const responseTime = Date.now() - startTime;

    return {
      success: result.success,
      error: result.error,
      responseTime
    };
  }

  /**
   * Get current configuration status
   */
  getConfigStatus(): {
    configured: boolean;
    enabled: boolean;
    webhookUrl?: string;
    hasSecretKey: boolean;
  } {
    return {
      configured: this.isConfigured(),
      enabled: this.config.enabled,
      webhookUrl: this.config.webhookUrl ? this.maskUrl(this.config.webhookUrl) : undefined,
      hasSecretKey: !!this.config.secretKey
    };
  }

  /**
   * Mask webhook URL for logging/display purposes
   */
  private maskUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}***`;
    } catch {
      return 'Invalid URL';
    }
  }
}

// Export singleton instance
export const zapierIntegration = new ZapierIntegrationService();

