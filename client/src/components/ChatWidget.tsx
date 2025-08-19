import { useEffect, useRef } from 'react';

interface ChatWidgetProps {
  campaignId?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'default' | 'dark';
  autoOpen?: boolean;
  autoOpenDelay?: number;
  debug?: boolean;
}

declare global {
  interface Window {
    OfferLogixChat?: {
      open: () => void;
      close: () => void;
      minimize: () => void;
      sendUserMessage: (message: string) => void;
      isReady: () => boolean;
    };
    OfferLogixChatWidget?: any;
  }
}

export default function ChatWidget({
  campaignId = 'demo-campaign',
  position = 'bottom-right',
  theme = 'default',
  autoOpen = false,
  autoOpenDelay = 5000,
  debug = false
}: ChatWidgetProps) {
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const widgetLoadedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple widget instances
    if (widgetLoadedRef.current || window.OfferLogixChat) {
      return;
    }

    // Create and configure the script element
    const script = document.createElement('script');
    script.src = '/offerlogix-chat-widget.js';
    script.setAttribute('data-offerlogix-campaign-id', campaignId);
    script.setAttribute('data-offerlogix-api-url', window.location.origin);
    script.setAttribute('data-offerlogix-position', position);
    script.setAttribute('data-offerlogix-theme', theme);
    script.setAttribute('data-offerlogix-auto-open', autoOpen.toString());
    script.setAttribute('data-offerlogix-auto-open-delay', autoOpenDelay.toString());
    script.setAttribute('data-offerlogix-debug', debug.toString());

    // Add event listeners for widget lifecycle
    const handleWidgetReady = (event: CustomEvent) => {
      console.log('OfferLogix Chat Widget is ready!', event.detail);
    };

    const handleScriptLoad = () => {
      widgetLoadedRef.current = true;
      console.log('Chat widget script loaded successfully');
    };

    const handleScriptError = (error: Event) => {
      console.error('Failed to load chat widget script:', error);
    };

    script.addEventListener('load', handleScriptLoad);
    script.addEventListener('error', handleScriptError);
    window.addEventListener('offerLogixChatReady', handleWidgetReady as EventListener);

    // Append script to document head
    document.head.appendChild(script);
    scriptRef.current = script;

    // Cleanup function
    return () => {
      // Remove event listeners
      script.removeEventListener('load', handleScriptLoad);
      script.removeEventListener('error', handleScriptError);
      window.removeEventListener('offerLogixChatReady', handleWidgetReady as EventListener);

      // Remove script from DOM
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }

      // Remove widget from DOM
      const widgetElement = document.getElementById('offerlogix-chat-widget');
      if (widgetElement) {
        widgetElement.remove();
      }

      // Clean up global variables
      if (window.OfferLogixChat) {
        delete window.OfferLogixChat;
      }
      if (window.OfferLogixChatWidget) {
        delete window.OfferLogixChatWidget;
      }

      widgetLoadedRef.current = false;
    };
  }, [campaignId, position, theme, autoOpen, autoOpenDelay, debug]);

  // This component doesn't render anything visible - the widget renders itself
  return null;
}

// Export some utility functions for interacting with the widget
export const chatWidgetAPI = {
  open: () => {
    if (window.OfferLogixChat?.isReady()) {
      window.OfferLogixChat.open();
    }
  },
  close: () => {
    if (window.OfferLogixChat?.isReady()) {
      window.OfferLogixChat.close();
    }
  },
  minimize: () => {
    if (window.OfferLogixChat?.isReady()) {
      window.OfferLogixChat.minimize();
    }
  },
  sendMessage: (message: string) => {
    if (window.OfferLogixChat?.isReady()) {
      window.OfferLogixChat.sendUserMessage(message);
    }
  },
  isReady: () => {
    return window.OfferLogixChat?.isReady() || false;
  }
};