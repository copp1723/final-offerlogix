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
    
    // 4. For API routes, try to get from x-api-key header (future implementation)
    // This would require an API keys table and lookup
    
    // 5. Default client for development/fallback
    if (!clientId) {
      // Get or create default client
      let [defaultClient] = await db.select().from(clients).where(eq(clients.name, 'Default Client'));
      
      if (!defaultClient) {
        [defaultClient] = await db.insert(clients).values({
          name: 'Default Client',
          domain: 'localhost',
          brandingConfig: {
            primaryColor: '#2563eb',
            secondaryColor: '#1e40af',
            logoUrl: '',
            companyName: 'AutoCampaigns AI',
            favicon: '',
            customCss: ''
          },
          settings: {}
        }).returning();
      }
      
      clientId = defaultClient.id;
    }
    
    // Set client context
    req.clientId = clientId;
    
    // Get full client data
    if (clientId) {
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
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

