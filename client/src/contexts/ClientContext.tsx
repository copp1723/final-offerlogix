import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Client } from '@shared/schema';

interface ClientContextType {
  activeClient: Client | null;
  setActiveClient: (client: Client | null) => void;
  branding: BrandingConfig;
}

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  companyName: string;
  favicon: string;
  customCss: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af', 
  logoUrl: '',
  companyName: 'AutoCampaigns AI',
  favicon: '',
  customCss: ''
};

const ClientContext = createContext<ClientContextType | undefined>(undefined);

interface ClientProviderProps {
  children: ReactNode;
}

export const ClientProvider = ({ children }: ClientProviderProps) => {
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  // Fetch branding based on current domain
  const { data: brandingData } = useQuery({
    queryKey: ['/api/branding'],
    retry: false
  });

  useEffect(() => {
    if (brandingData) {
      setActiveClient(brandingData as Client);
    }
  }, [brandingData]);

  // Apply branding to document
  useEffect(() => {
    if (activeClient?.brandingConfig) {
      const branding = activeClient.brandingConfig as BrandingConfig;
      
      // Apply CSS variables
      const root = document.documentElement;
      root.style.setProperty('--primary-color', branding.primaryColor);
      root.style.setProperty('--secondary-color', branding.secondaryColor);
      
      // Apply custom CSS
      if (branding.customCss) {
        let style = document.getElementById('client-custom-css');
        if (!style) {
          style = document.createElement('style');
          style.id = 'client-custom-css';
          document.head.appendChild(style);
        }
        style.textContent = branding.customCss;
      }
      
      // Update favicon
      if (branding.favicon) {
        let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = branding.favicon;
      }
      
      // Update page title
      if (branding.companyName) {
        document.title = `${branding.companyName} - Automotive Email Campaigns`;
      }
    }
  }, [activeClient]);

  const branding = activeClient?.brandingConfig as BrandingConfig || DEFAULT_BRANDING;

  return (
    <ClientContext.Provider value={{ activeClient, setActiveClient, branding }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
};

export const useBranding = () => {
  const { branding } = useClient();
  return branding;
};
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Client } from '@shared/schema';

interface ClientContextType {
  client: Client | null;
  loading: boolean;
  error: string | null;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function useClient() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
}

interface ClientProviderProps {
  children: React.ReactNode;
}

export function ClientProvider({ children }: ClientProviderProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClient() {
      try {
        const response = await fetch('/api/branding');
        if (!response.ok) throw new Error('Failed to fetch client');
        const clientData = await response.json();
        setClient(clientData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Set default client on error
        setClient({
          id: 'default',
          name: 'AutoCampaigns AI',
          domain: 'localhost',
          brandingConfig: {
            primaryColor: '#2563eb',
            secondaryColor: '#1e40af',
            logoUrl: '',
            companyName: 'AutoCampaigns AI',
            favicon: '',
            customCss: ''
          },
          settings: {},
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } finally {
        setLoading(false);
      }
    }

    fetchClient();
  }, []);

  return (
    <ClientContext.Provider value={{ client, loading, error }}>
      {children}
    </ClientContext.Provider>
  );
}
