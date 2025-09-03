/**
 * URL Trigger Service
 * 
 * Automatically sends relevant URLs when customers ask about specific topics.
 * Similar to handover triggers but sends helpful links instead of routing to humans.
 */

export interface UrlTriggerConfig {
  tradeInUrl?: { enabled: boolean; url: string; message: string };
  schedulerUrl?: { enabled: boolean; url: string; message: string };
  financingUrl?: { enabled: boolean; url: string; message: string };
  inventoryUrl?: { enabled: boolean; url: string; message: string };
  warrantyUrl?: { enabled: boolean; url: string; message: string };
  customUrls?: Array<{ trigger: string; url: string; message: string; enabled: boolean }>;
}

export interface UrlTriggerMatch {
  type: string;
  url: string;
  message: string;
  matchedKeyword: string;
}

/**
 * Extract URL trigger configuration from campaign data
 */
export function extractUrlTriggerConfig(campaign: any): UrlTriggerConfig {
  return campaign?.urlTriggers || campaign?.url_triggers || {
    tradeInUrl: { enabled: false, url: '', message: '' },
    schedulerUrl: { enabled: false, url: '', message: '' },
    financingUrl: { enabled: false, url: '', message: '' },
    inventoryUrl: { enabled: false, url: '', message: '' },
    warrantyUrl: { enabled: false, url: '', message: '' },
    customUrls: []
  };
}

/**
 * Check if user message matches any URL triggers and return matched URLs
 */
export function checkUrlTriggers(config: UrlTriggerConfig, userMessage: string): UrlTriggerMatch[] {
  const userText = userMessage.toLowerCase();
  const matches: UrlTriggerMatch[] = [];

  // Define trigger patterns
  const triggerPatterns = [
    {
      key: 'tradeInUrl',
      config: config.tradeInUrl,
      keywords: ['trade', 'trade-in', 'trade in', 'current car', 'my car', 'old car', 'worth', 'value', 'appraise', 'sell my car'],
      defaultMessage: 'Check out our trade-in calculator:'
    },
    {
      key: 'schedulerUrl', 
      config: config.schedulerUrl,
      keywords: ['appointment', 'schedule', 'available', 'availability', 'visit', 'when', 'book', 'reserve', 'test drive', 'demo'],
      defaultMessage: 'Book your appointment here:'
    },
    {
      key: 'financingUrl',
      config: config.financingUrl,
      keywords: ['financing', 'finance', 'loan', 'credit', 'payment', 'monthly', 'qualify', 'pre-qualify', 'approve', 'bank', 'lender'],
      defaultMessage: 'Get pre-qualified for financing:'
    },
    {
      key: 'inventoryUrl',
      config: config.inventoryUrl,
      keywords: ['inventory', 'in stock', 'available cars', 'what do you have', 'selection', 'models', 'colors', 'options'],
      defaultMessage: 'Browse our current inventory:'
    },
    {
      key: 'warrantyUrl',
      config: config.warrantyUrl,
      keywords: ['warranty', 'coverage', 'protection', 'service plan', 'extended warranty', 'guarantee'],
      defaultMessage: 'Learn about our warranty options:'
    }
  ];

  // Check built-in triggers
  for (const pattern of triggerPatterns) {
    if (pattern.config?.enabled && pattern.config.url) {
      const matchedKeyword = pattern.keywords.find(keyword => userText.includes(keyword));
      if (matchedKeyword) {
        matches.push({
          type: pattern.key,
          url: pattern.config.url,
          message: pattern.config.message || pattern.defaultMessage,
          matchedKeyword
        });
      }
    }
  }

  // Check custom triggers
  if (config.customUrls && config.customUrls.length > 0) {
    for (const customTrigger of config.customUrls) {
      if (customTrigger.enabled && customTrigger.url && userText.includes(customTrigger.trigger.toLowerCase())) {
        matches.push({
          type: 'custom',
          url: customTrigger.url,
          message: customTrigger.message || 'Here\'s a helpful link:',
          matchedKeyword: customTrigger.trigger
        });
      }
    }
  }

  return matches;
}

/**
 * Format URL triggers into email content
 */
export function formatUrlTriggers(matches: UrlTriggerMatch[]): string {
  if (matches.length === 0) return '';

  let content = '';
  for (const match of matches) {
    content += `\n\n${match.message} ${match.url}`;
  }

  return content;
}

/**
 * Log URL trigger events for analytics
 */
export function logUrlTriggerEvent(conversationId: string, matches: UrlTriggerMatch[], logger?: any) {
  if (matches.length === 0) return;

  const logData = {
    conversationId,
    triggeredUrls: matches.map(m => ({
      type: m.type,
      url: m.url,
      matchedKeyword: m.matchedKeyword
    })),
    totalMatches: matches.length
  };

  if (logger) {
    logger('url_triggers_matched', logData);
  } else {
    console.log('[URL Triggers]', logData);
  }
}
