/**
 * Client Branding Service
 * Manages dynamic client-specific branding and configuration
 */

import { db } from '../db';
import { clients } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  companyName: string;
  favicon: string;
  customCss: string;
  emailTemplateColors?: {
    headerBackground: string;
    buttonColor: string;
    accentColor: string;
  };
}

export interface ClientConfig {
  id: string;
  name: string;
  domain: string;
  brandingConfig: BrandingConfig;
  settings: Record<string, any>;
  active: boolean;
}

export class ClientBrandingService {
  private static readonly DEFAULT_BRANDING: BrandingConfig = {
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    logoUrl: '/logo.svg',
    companyName: 'MailMind',
    favicon: '',
    customCss: '',
    emailTemplateColors: {
      headerBackground: '#2563eb',
      buttonColor: '#1e40af',
      accentColor: '#3b82f6'
    }
  };

  /**
   * Get client branding by domain
   */
  static async getBrandingByDomain(domain: string): Promise<ClientConfig> {
    try {
      // Try to find client by exact domain match
      let [client] = await db.select()
        .from(clients)
        .where(eq(clients.domain, domain))
        .limit(1);

      // Fall back to default client if no domain match
      if (!client) {
        [client] = await db.select()
          .from(clients)
          .where(eq(clients.name, 'Default Client'))
          .limit(1);
      }

      if (client) {
        return {
          id: client.id,
          name: client.name,
          domain: client.domain || domain,
          brandingConfig: this.mergeBrandingConfig(client.brandingConfig as any),
          settings: client.settings as Record<string, any>,
          active: client.active
        };
      }

      // Return default configuration if no client found
      return this.getDefaultClientConfig(domain);
      
    } catch (error) {
      console.error('Error fetching client branding:', error);
      return this.getDefaultClientConfig(domain);
    }
  }

  /**
   * Get client branding by client ID
   */
  static async getBrandingById(clientId: string): Promise<ClientConfig | null> {
    try {
      const [client] = await db.select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      if (!client) {
        return null;
      }

      return {
        id: client.id,
        name: client.name,
        domain: client.domain || 'localhost',
        brandingConfig: this.mergeBrandingConfig(client.brandingConfig as any),
        settings: client.settings as Record<string, any>,
        active: client.active
      };
      
    } catch (error) {
      console.error('Error fetching client branding by ID:', error);
      return null;
    }
  }

  /**
   * Update client branding configuration
   */
  static async updateBranding(clientId: string, brandingConfig: Partial<BrandingConfig>): Promise<boolean> {
    try {
      const existingClient = await this.getBrandingById(clientId);
      if (!existingClient) {
        return false;
      }

      const updatedBranding = {
        ...existingClient.brandingConfig,
        ...brandingConfig
      };

      await db.update(clients)
        .set({ 
          brandingConfig: updatedBranding,
          updatedAt: new Date()
        })
        .where(eq(clients.id, clientId));

      return true;
      
    } catch (error) {
      console.error('Error updating client branding:', error);
      return false;
    }
  }

  /**
   * Generate CSS variables for client branding
   */
  static generateBrandingCSS(branding: BrandingConfig): string {
    return `
      :root {
        --primary-color: ${branding.primaryColor};
        --secondary-color: ${branding.secondaryColor};
        --company-name: "${branding.companyName}";
        --email-header-bg: ${branding.emailTemplateColors?.headerBackground || branding.primaryColor};
        --email-button-color: ${branding.emailTemplateColors?.buttonColor || branding.secondaryColor};
        --email-accent-color: ${branding.emailTemplateColors?.accentColor || branding.primaryColor};
      }
      
      .btn-primary {
        background-color: var(--primary-color);
        border-color: var(--primary-color);
      }
      
      .btn-primary:hover {
        background-color: var(--secondary-color);
        border-color: var(--secondary-color);
      }
      
      .header-logo {
        background-image: url('${branding.logoUrl}');
      }
      
      ${branding.customCss || ''}
    `.trim();
  }

  /**
   * Merge provided branding config with defaults
   */
  private static mergeBrandingConfig(providedConfig: Partial<BrandingConfig>): BrandingConfig {
    return {
      ...this.DEFAULT_BRANDING,
      ...providedConfig,
      emailTemplateColors: {
        ...this.DEFAULT_BRANDING.emailTemplateColors!,
        ...(providedConfig.emailTemplateColors || {})
      }
    };
  }

  /**
   * Get default client configuration
   */
  private static getDefaultClientConfig(domain: string): ClientConfig {
    return {
      id: 'default',
      name: 'MailMind',
      domain,
      brandingConfig: this.DEFAULT_BRANDING,
      settings: {},
      active: true
    };
  }

  /**
   * Validate branding configuration
   */
  static validateBrandingConfig(config: Partial<BrandingConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.primaryColor && !this.isValidColor(config.primaryColor)) {
      errors.push('Primary color must be a valid hex color');
    }

    if (config.secondaryColor && !this.isValidColor(config.secondaryColor)) {
      errors.push('Secondary color must be a valid hex color');
    }

    if (config.companyName && config.companyName.length > 100) {
      errors.push('Company name must be 100 characters or less');
    }

    if (config.logoUrl && !this.isValidUrl(config.logoUrl)) {
      errors.push('Logo URL must be a valid URL');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private static isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return url.startsWith('/') && url.length > 1; // Allow relative URLs
    }
  }
}
