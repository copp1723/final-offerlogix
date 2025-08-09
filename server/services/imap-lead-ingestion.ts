/**
 * IMAP Lead Ingestion Service - Lane B for new lead processing
 * Handles OEM forms, Cars.com/Autotrader leads, website contact forms
 * Separate from Mailgun campaign replies (Lane A)
 */

import imaps, { ImapSimple } from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import { storage } from '../storage';
import { parseLeadEmail, validateLeadData, shouldProcessForLeadIngestion } from './lead-ingestion-parser';
import { updateIMAPHealth, recordIMAPMessage, recordIMAPError } from '../routes/health-imap';

// Reliability tuning knobs
const IMAP_CONNECT_TIMEOUT_MS = Number(process.env.IMAP_CONNECT_TIMEOUT_MS ?? 10000);
const IMAP_AUTH_TIMEOUT_MS = Number(process.env.IMAP_AUTH_TIMEOUT_MS ?? 5000);
const IMAP_IDLE_FALLBACK_MS = Number(process.env.IMAP_IDLE_FALLBACK_MS ?? 60000);
const IMAP_MAX_MSG_SIZE_BYTES = Number(process.env.IMAP_MAX_MSG_SIZE_BYTES ?? 5_000_000);

export class IMAPLeadIngestionService {
  private connection: ImapSimple | null = null;
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastProcessedUid = 0;
  private connectionStartTime: Date | null = null;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('IMAP lead ingestion already running');
      return;
    }

    // Check configuration
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
      console.log('IMAP lead ingestion not started - configuration missing');
      console.log('Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD to enable lead ingestion');
      updateIMAPHealth({ connected: false });
      return;
    }

    const config = {
      imap: {
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST,
        port: Number(process.env.IMAP_PORT) || 993,
        tls: process.env.IMAP_SECURE !== 'false',
        tlsOptions: {
          rejectUnauthorized: false
        },
        authTimeout: IMAP_AUTH_TIMEOUT_MS,
        connTimeout: IMAP_CONNECT_TIMEOUT_MS,
      }
    };

    try {
      console.log(`Connecting to IMAP: ${config.imap.host} as ${config.imap.user}`);
      this.connection = await imaps.connect(config);
      
      const folder = process.env.IMAP_FOLDER || 'INBOX';
      await this.connection.openBox(folder);
      
      this.isRunning = true;
      this.connectionStartTime = new Date();
      
      console.log(`IMAP lead ingestion connected to ${folder}`);
      updateIMAPHealth({ 
        connected: true,
        connectionUptime: 0
      });

      // Start monitoring
      this.startPeriodicCheck();
      
      // Enable IDLE if supported and configured
      if (process.env.IMAP_IDLE !== 'false' && this.connection.imap) {
        this.connection.imap.on('mail', (numNewMails: number) => {
          console.log(`IMAP: ${numNewMails} new messages`);
          this.checkForNewMessages();
        });
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start IMAP lead ingestion:', errorMsg);
      recordIMAPError(`Connection failed: ${errorMsg}`);
      updateIMAPHealth({ connected: false });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    updateIMAPHealth({ connected: false });
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.connection) {
      try {
        await this.connection.end();
      } catch (error) {
        console.error('Error closing IMAP connection:', error);
      }
      this.connection = null;
    }
    
    console.log('IMAP lead ingestion stopped');
  }

  private startPeriodicCheck() {
    const intervalMs = Number(process.env.IMAP_POLL_INTERVAL_MS) || 60000;
    const loop = async () => {
      await this.checkForNewMessages();
      this.checkInterval = setTimeout(loop, intervalMs + Math.floor(Math.random() * 2500)) as unknown as NodeJS.Timeout;
    };
    this.checkInterval = setTimeout(loop, 1000) as unknown as NodeJS.Timeout;
    
    // Initial check
    setTimeout(() => this.checkForNewMessages(), 2000);
  }

  private async checkForNewMessages(): Promise<void> {
    if (!this.connection || !this.isRunning) return;

    try {
      // Search for unread messages
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false,
        struct: true
      };

      const messages = await this.connection.search(searchCriteria, fetchOptions);
      console.log(`IMAP: Found ${messages.length} unread messages`);

      // Filter out oversized messages to avoid memory pressure
      const safeMessages = messages.filter(m => {
        const size = m.attributes?.size || 0;
        if (size > IMAP_MAX_MSG_SIZE_BYTES) {
          console.warn(`Skipping oversized message UID ${m.attributes?.uid} (${size} bytes)`);
          return false;
        }
        return true;
      });

      for (const message of safeMessages) {
        await this.processMessage(message);
      }

      // Update health status
      if (this.connectionStartTime) {
        const uptime = Date.now() - this.connectionStartTime.getTime();
        updateIMAPHealth({ connectionUptime: uptime });
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking for new messages:', errorMsg);
      recordIMAPError(`Check failed: ${errorMsg}`);
    }
  }

  private async processMessage(message: any): Promise<void> {
    try {
      const uid = message.attributes.uid;
      
      // Skip if already processed
      if (uid <= this.lastProcessedUid) return;

      const all = message.parts.find((part: any) => part.which === '');
      if (!all?.body) return;

      const controller = new AbortController();
      const parseTimeout = setTimeout(() => controller.abort(), 8000);
      let parsed: ParsedMail;
      try {
        parsed = await simpleParser(all.body, { skipHtmlToText: false });
      } finally {
        clearTimeout(parseTimeout);
      }
      
      // Extract recipients for domain guard
      const toAddresses = [
        ...(parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : []),
        ...(parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
      ].map(addr => typeof addr === 'string' ? addr : addr.text || '');

      console.log(`Processing: "${parsed.subject}" from ${parsed.from?.text}`);

      // Domain guard - skip Mailgun lane emails
      if (!shouldProcessForLeadIngestion(parsed.subject || '', parsed.from?.text || '', toAddresses)) {
        console.log('Skipping - belongs to Mailgun campaign lane');
        await this.markAsProcessed(uid, 'skipped_mailgun_lane');
        return;
      }

      // Parse lead data
      const leadData = parseLeadEmail({
        subject: parsed.subject || '',
        html: parsed.html || '',
        text: parsed.text || '',
        from: parsed.from?.text || ''
      });

      // Validate lead quality
      const validation = validateLeadData(leadData);
      if (!validation.valid) {
        console.log(`Lead validation failed: ${validation.issues.join(', ')}`);
        await this.markAsProcessed(uid, 'validation_failed');
        return;
      }

      // Create or update lead
      let lead;
      if (leadData.email) {
        const existingLead = await storage.getLeadByEmail(leadData.email);
        if (existingLead) {
          // Update existing lead with new info
          lead = await storage.updateLead(existingLead.id, {
            firstName: leadData.firstName || existingLead.firstName,
            lastName: leadData.lastName || existingLead.lastName,
            phone: leadData.phone || existingLead.phone,
            vehicleInterest: leadData.vehicleInterest || existingLead.vehicleInterest,
            leadSource: leadData.leadSource || existingLead.leadSource
          });
          console.log(`Updated existing lead: ${leadData.email}`);
        } else {
          // Create new lead
          lead = await storage.createLead({
            email: leadData.email,
            firstName: leadData.firstName,
            lastName: leadData.lastName,
            phone: leadData.phone,
            vehicleInterest: leadData.vehicleInterest,
            leadSource: leadData.leadSource || 'email_inbound',
            status: 'new'
          });
          console.log(`Created new lead: ${leadData.email}`);
        }
      }

      if (lead) {
        // Create conversation for this email
        const conversation = await storage.createConversation({
          subject: parsed.subject || 'Email Inquiry',
          status: 'active'
        });

        // Add the email as first message
        await storage.createConversationMessage({
          conversationId: conversation.id,
          senderId: lead.id,
          content: parsed.text || parsed.html || '',
          messageType: 'email'
        });

        // Write to Supermemory if available
        try {
          const { MemoryMapper } = await import('../integrations/supermemory');
          await MemoryMapper.writeLeadMessage({
            type: 'lead_msg',
            clientId: 'default', // or use lead.clientId if available
            campaignId: undefined,
            leadEmail: leadData.email || '',
            content: `New lead from email: ${parsed.subject || ''}\n\nContent: ${parsed.text || parsed.html || ''}`,
            meta: {
              source: 'email_ingestion',
              emailSubject: parsed.subject,
              emailFrom: parsed.from?.text,
              emailDate: parsed.date,
              leadSource: leadData.leadSource
            }
          });
        } catch (error) {
          console.log('Supermemory not available for lead ingestion:', error);
        }
      }

      // Mark as processed
      await this.markAsProcessed(uid, 'processed');
      recordIMAPMessage(uid);
      this.lastProcessedUid = Math.max(this.lastProcessedUid, uid);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error processing IMAP message:', errorMsg);
      recordIMAPError(`Message processing failed: ${errorMsg}`);
    }
  }

  private async markAsProcessed(uid: number, reason: string): Promise<void> {
    if (!this.connection) return;

    try {
      // Mark as read
      await this.connection.addFlags(uid, ['\\Seen']);

      // Optionally move to processed folder
      const processedFolder = process.env.IMAP_MOVE_PROCESSED;
      if (processedFolder && reason === 'processed') {
        try {
          await this.connection.moveMessage(uid, processedFolder);
        } catch (err) {
          console.error(`Failed moving UID ${uid} to processed folder:`, err);
        }
      }

      // Optionally move failed to separate folder
      const failedFolder = process.env.IMAP_MOVE_FAILED;
      if (failedFolder && reason.includes('failed')) {
        try {
          await this.connection.moveMessage(uid, failedFolder);
        } catch (err) {
          console.error(`Failed moving UID ${uid} to failed folder:`, err);
        }
      }

    } catch (error) {
      console.error('Error marking message as processed:', error);
    }
  }
}

// Export singleton instance
export const imapLeadIngestionService = new IMAPLeadIngestionService();