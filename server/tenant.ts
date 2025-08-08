import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { clients } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface TenantRequest extends Request {
  clientId?: string;
  client?: any;
}

export const tenantMiddleware = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    let clientId = null;
    
    // 1. Try to get client from subdomain
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    
    if (subdomain && subdomain !== 'localhost' && subdomain !== '127' && !subdomain.includes(':')) {
      const [client] = await db.select().from(clients).where(eq(clients.domain, subdomain));
      if (client) {
        clientId = client.id;
      }
    }
    
    // 2. Try to get client from custom domain
    if (!clientId && host) {
      const [client] = await db.select().from(clients).where(eq(clients.domain, host));
      if (client) {
        clientId = client.id;
      }
    }
    
    // 3. Try to get client from x-tenant-id header
    if (!clientId && req.headers['x-tenant-id']) {
      clientId = req.headers['x-tenant-id'] as string;
    }
    
    // 4. (Future) API key based tenant resolution
    
    // 5. Default client fallback (idempotent)
    if (!clientId) {
      // Prefer lookup by domain to avoid mismatch on name changes
      let [defaultClient] = await db.select().from(clients).where(eq(clients.domain, 'localhost'));

      if (!defaultClient) {
        // Attempt insert with ON CONFLICT DO NOTHING to avoid unique violations
        const inserted = await db.insert(clients)
          .values({
            name: 'Default Client',
            domain: 'localhost',
            brandingConfig: {
              primaryColor: '#2563eb',
              secondaryColor: '#1e40af',
              logoUrl: '',
              companyName: 'OneKeel Swarm',
              favicon: '',
              customCss: ''
            },
            settings: {}
          })
          // Drizzle PG helper; ignored if domain already exists
          .onConflictDoNothing()
          .returning();

        if (inserted.length) {
          defaultClient = inserted[0];
        } else {
          // Fetch existing row created previously (race-safe)
            [defaultClient] = await db.select().from(clients).where(eq(clients.domain, 'localhost'));
        }
      }

      if (defaultClient) {
        clientId = defaultClient.id;
      }
    }
    
    // Set client context
    req.clientId = clientId as string | undefined;
    
    // Get full client data
    if (clientId) {
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId as string));
      req.client = client;
    }
    
    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    next(error);
  }
};

// Helper function to ensure queries are scoped to tenant
export const withTenant = (clientId: string) => {
  return { clientId };
};

