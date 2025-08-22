import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

interface UnsubscribeToken {
  email: string;
  domain: string;
  timestamp: number;
}

/**
 * One-click unsubscribe handler for RFC 8058 compliance
 * Supports both GET (link clicks) and POST (one-click) methods
 */
router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Invalid Unsubscribe Link</h2>
          <p>This unsubscribe link is invalid or has expired.</p>
          <p>If you continue to receive unwanted emails, please contact us directly.</p>
        </body></html>
      `);
    }

    const result = await processUnsubscribe(token);
    
    if (result.success) {
      res.send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Successfully Unsubscribed</h2>
          <p>You have been successfully unsubscribed from our mailing list.</p>
          <p>Email: <strong>${result.email}</strong></p>
          <p>You will no longer receive marketing emails from us.</p>
          <p>If you continue to receive emails, please contact our support team.</p>
        </body></html>
      `);
    } else {
      res.status(400).send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Unsubscribe Failed</h2>
          <p>${result.error}</p>
          <p>Please try again or contact our support team.</p>
        </body></html>
      `);
    }
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send(`
      <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
        <h2>Error Processing Unsubscribe</h2>
        <p>An error occurred while processing your unsubscribe request.</p>
        <p>Please try again later or contact our support team.</p>
      </body></html>
    `);
  }
});

/**
 * One-click unsubscribe POST handler (RFC 8058)
 * This is called automatically by email clients when users click "Unsubscribe"
 */
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const result = await processUnsubscribe(token);
    
    if (result.success) {
      res.json({ success: true, message: 'Successfully unsubscribed', email: result.email });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('One-click unsubscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Process unsubscribe request
 */
async function processUnsubscribe(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    // Decode and validate token
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString()) as UnsubscribeToken;
    
    if (!decoded.email || !decoded.domain || !decoded.timestamp) {
      return { success: false, error: 'Invalid token format' };
    }

    // Check token age (valid for 30 days)
    const tokenAge = Date.now() - decoded.timestamp;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    if (tokenAge > maxAge) {
      return { success: false, error: 'Token has expired' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(decoded.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    // Find and update lead status
    const lead = await storage.getLeadByEmail(decoded.email);
    
    if (lead) {
      // Update lead to unsubscribed status
      await storage.updateLead(lead.id, { 
        status: 'unsubscribed',
        unsubscribedAt: new Date().toISOString(),
        unsubscribeReason: 'user_request'
      });
      
      console.log(`Lead unsubscribed: ${decoded.email}`);
    } else {
      // Create a suppression record even if lead doesn't exist
      // This prevents future emails to this address
      await storage.createLead({
        email: decoded.email,
        status: 'unsubscribed',
        leadSource: 'unsubscribe_suppression',
        unsubscribedAt: new Date().toISOString(),
        unsubscribeReason: 'user_request'
      } as any);
      
      console.log(`Suppression record created: ${decoded.email}`);
    }

    return { success: true, email: decoded.email };
    
  } catch (error) {
    console.error('Token processing error:', error);
    return { success: false, error: 'Invalid or corrupted token' };
  }
}

/**
 * Health check for unsubscribe service
 */
router.get('/unsubscribe/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'unsubscribe' });
});

export default router;
