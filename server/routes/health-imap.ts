/**
 * IMAP Health Check - Monitor lead ingestion email system
 */

import { Router } from 'express';

const router = Router();

interface IMAPHealthStatus {
  connected: boolean;
  lastMessageTimestamp?: string;
  lastProcessedUid?: number;
  connectionUptime?: number;
  messagesProcessed?: number;
  errors?: string[];
}

// Global IMAP status tracking
let imapHealthStatus: IMAPHealthStatus = {
  connected: false,
  messagesProcessed: 0,
  errors: []
};

export function updateIMAPHealth(status: Partial<IMAPHealthStatus>) {
  imapHealthStatus = { ...imapHealthStatus, ...status };
}

export function recordIMAPMessage(uid: number) {
  imapHealthStatus.lastProcessedUid = uid;
  imapHealthStatus.lastMessageTimestamp = new Date().toISOString();
  imapHealthStatus.messagesProcessed = (imapHealthStatus.messagesProcessed || 0) + 1;
}

export function recordIMAPError(error: string) {
  if (!imapHealthStatus.errors) imapHealthStatus.errors = [];
  imapHealthStatus.errors.push(`${new Date().toISOString()}: ${error}`);
  // Keep only last 5 errors
  if (imapHealthStatus.errors.length > 5) {
    imapHealthStatus.errors = imapHealthStatus.errors.slice(-5);
  }
}

router.get('/imap', (req, res) => {
  try {
    const hasConfig = !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);
    
    if (!hasConfig) {
      return res.json({
        ok: false,
        details: {
          status: 'not_configured',
          message: 'IMAP credentials not configured',
          config_needed: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASSWORD']
        }
      });
    }
    
    // Check if last message is recent (within 24 hours is considered healthy)
    const lastMessageAge = imapHealthStatus.lastMessageTimestamp 
      ? Date.now() - new Date(imapHealthStatus.lastMessageTimestamp).getTime()
      : null;
    
    const isStale = lastMessageAge && lastMessageAge > 24 * 60 * 60 * 1000;
    
    const healthDetails = {
      connected: imapHealthStatus.connected,
      status: imapHealthStatus.connected ? 'active' : 'disconnected',
      lastMessageAge: lastMessageAge ? `${Math.round(lastMessageAge / 1000 / 60)} minutes ago` : 'never',
      messagesProcessed: imapHealthStatus.messagesProcessed || 0,
      lastProcessedUid: imapHealthStatus.lastProcessedUid,
      configuration: {
        host: process.env.IMAP_HOST,
        user: process.env.IMAP_USER,
        folder: process.env.IMAP_FOLDER || 'INBOX',
        idle_enabled: process.env.IMAP_IDLE !== 'false'
      },
      recentErrors: imapHealthStatus.errors?.slice(-3) || []
    };
    
    const isHealthy = imapHealthStatus.connected && !isStale;
    
    res.json({
      ok: isHealthy,
      details: healthDetails
    });
    
  } catch (error) {
    res.status(500).json({
      ok: false,
      details: {
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;