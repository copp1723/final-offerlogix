import express from 'express';
import { db } from '../db';
import { clients } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { TenantRequest } from '../tenant';

const router = express.Router();

// Get email settings for current client
router.get('/', async (req: TenantRequest, res) => {
  try {
    const clientId = req.clientId;
    if (!clientId) {
      return res.status(400).json({ message: "Client context required" });
    }

    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const settings = client.settings as any || {};
    const emailSettings = {
      campaignSenderName: settings.campaignSenderName || process.env.EMAIL_SENDER_NAME || 'OneKeel Swarm',
      handoverSenderName: settings.handoverSenderName || process.env.HANDOVER_SENDER_NAME || 'OneKeel Swarm Sales Alert',
      fromEmail: process.env.MAILGUN_FROM_EMAIL || 'swarm@mg.watchdogai.us'
    };

    res.json(emailSettings);
  } catch (error) {
    console.error('Email settings fetch error:', error);
    res.status(500).json({ message: "Failed to fetch email settings" });
  }
});

// Update email settings for current client
router.post('/', async (req: TenantRequest, res) => {
  try {
    const clientId = req.clientId;
    if (!clientId) {
      return res.status(400).json({ message: "Client context required" });
    }

    const { campaignSenderName, handoverSenderName } = req.body;

    if (!campaignSenderName || !handoverSenderName) {
      return res.status(400).json({ message: "Campaign sender name and handover sender name are required" });
    }

    // Validate sender names (basic validation)
    if (campaignSenderName.length > 100 || handoverSenderName.length > 100) {
      return res.status(400).json({ message: "Sender names must be 100 characters or less" });
    }

    // Basic sanitization - remove potentially dangerous characters
    const sanitize = (name: string) => name.replace(/[<>]/g, '').trim();
    const safeCampaignName = sanitize(campaignSenderName);
    const safeHandoverName = sanitize(handoverSenderName);

    // Update client settings
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const currentSettings = client.settings as any || {};
    const updatedSettings = {
      ...currentSettings,
      campaignSenderName: safeCampaignName,
      handoverSenderName: safeHandoverName,
      updatedAt: new Date().toISOString()
    };

    await db.update(clients)
      .set({ 
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(clients.id, clientId));

    res.json({ 
      success: true, 
      message: "Email settings updated successfully",
      settings: {
        campaignSenderName: safeCampaignName,
        handoverSenderName: safeHandoverName,
        fromEmail: process.env.MAILGUN_FROM_EMAIL || 'swarm@mg.watchdogai.us'
      }
    });
  } catch (error) {
    console.error('Email settings update error:', error);
    res.status(500).json({ message: "Failed to update email settings" });
  }
});

export default router;