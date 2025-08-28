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
      // Show friendly page with manual unsubscribe form
      return res.status(200).send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Unsubscribe</h2>
          <p>We couldn't verify this unsubscribe link. You can still unsubscribe by entering your email below.</p>
          <form method="POST" action="/unsubscribe" style="margin-top:16px;">
            <input type="email" name="email" placeholder="your@email.com" required style="padding:8px; width: 70%;" />
            <button type="submit" style="padding:8px 12px;">Unsubscribe</button>
          </form>
          <p style="margin-top:12px; color:#666; font-size: 14px;">If you continue to receive unwanted emails, please contact support.</p>
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
      res.status(200).send(`
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2>Unsubscribe</h2>
          <p>${result.error || 'We could not process your link.'}</p>
          <p>You can still unsubscribe by entering your email below.</p>
          <form method="POST" action="/unsubscribe" style="margin-top:16px;">
            <input type="email" name="email" placeholder="your@email.com" required style="padding:8px; width: 70%;" />
            <button type="submit" style="padding:8px 12px;">Unsubscribe</button>
          </form>
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
    // Accept token from body or query (RFC 8058 clients often POST to the same URL)
    const token = (req.body && (req.body.token || req.body.Token)) || (req.query && (req.query.token as string));
    const email = (req.body && (req.body.email || req.body.Email)) as string | undefined;
    
    // Branch: support direct email unsubscribe (no token)
    if (!token && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, error: 'Invalid email format' });
      }
      try {
        const lead = await storage.getLeadByEmail(email.trim());
        if (lead) {
          await storage.updateLead(lead.id, { 
            status: 'unsubscribed', 
            unsubscribedAt: new Date(), 
            unsubscribeReason: 'user_request_manual' 
          });
        } else {
          await storage.createLead({ 
            email: email.trim(), 
            status: 'unsubscribed', 
            leadSource: 'unsubscribe_manual', 
            unsubscribedAt: new Date(), 
            unsubscribeReason: 'user_request_manual' 
          } as any);
        }
        return res.json({ success: true, message: 'Successfully unsubscribed', email: email.trim() });
      } catch (e) {
        console.error('Manual unsubscribe error:', e);
        return res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }

    if (!token || typeof token !== 'string') {
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
    // Decode and validate token with multiple fallbacks for legacy links
    const tryParsers = [
      () => JSON.parse(Buffer.from(token, 'base64url').toString()),
      () => JSON.parse(Buffer.from(decodeURIComponent(token), 'base64url').toString()),
      () => JSON.parse(Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')),
    ];

    let decoded: UnsubscribeToken | null = null;
    for (const parse of tryParsers) {
      try {
        const val = parse();
        if (val && typeof val === 'object') { decoded = val as UnsubscribeToken; break; }
      } catch {}
    }

    // As a last resort, if token decodes straight to an email address
    if (!decoded) {
      try {
        const raw = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
          decoded = { email: raw.trim(), domain: (process.env.MAILGUN_DOMAIN || '').trim() || 'unknown', timestamp: Date.now() };
        }
      } catch {}
    }

    if (!decoded) {
      return { success: false, error: 'Invalid or corrupted token' };
    }
    
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
        unsubscribedAt: new Date(),
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
        unsubscribedAt: new Date(),
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
