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
  logoUrl: '/onekeel-logo.svg',
  companyName: 'OneKeel.ai',
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
  const { data: brandingData, isLoading } = useQuery({
    queryKey: ['/api/branding'],
    queryFn: async () => {
      const response = await fetch('/api/branding');
      if (!response.ok) {
        throw new Error('Failed to fetch branding');
      }
      return response.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  useEffect(() => {
    if (brandingData && !isLoading) {
      setActiveClient(brandingData as Client);
    }
  }, [brandingData, isLoading]);

  // Apply branding to document
  useEffect(() => {
    const branding = (activeClient?.brandingConfig as BrandingConfig) || DEFAULT_BRANDING;

    try {
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

      // Update page title with dynamic branding
      const title = branding.companyName
        ? `${branding.companyName} - Email Campaign Intelligence`
        : 'MailMind - Email Campaign Intelligence';
      document.title = title;

      // Set meta description for SEO
      let metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.content = `${branding.companyName || 'MailMind'} - AI-powered automotive email campaign management and lead intelligence platform.`;

    } catch (error) {
      console.error('Error applying client branding:', error);
      // Fallback to default branding on error
      document.title = 'MailMind - Email Campaign Intelligence';
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

