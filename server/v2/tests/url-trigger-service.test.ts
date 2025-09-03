/**
 * URL Trigger Service Tests
 */

import { describe, it, expect } from 'vitest';
import { checkUrlTriggers, extractUrlTriggerConfig, formatUrlTriggers } from '../services/url-triggers/url-trigger-service.js';

describe('URL Trigger Service', () => {
  describe('checkUrlTriggers', () => {
    it('should match trade-in URL trigger', () => {
      const config = {
        tradeInUrl: {
          enabled: true,
          url: 'https://dealership.com/trade-in',
          message: 'Check out our trade-in calculator:'
        }
      };

      const matches = checkUrlTriggers(config, "What's my 2019 Honda Civic worth as a trade-in?");

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('tradeInUrl');
      expect(matches[0].url).toBe('https://dealership.com/trade-in');
      expect(matches[0].message).toBe('Check out our trade-in calculator:');
      expect(matches[0].matchedKeyword).toBe('trade-in');
    });

    it('should match scheduler URL trigger', () => {
      const config = {
        schedulerUrl: {
          enabled: true,
          url: 'https://calendly.com/dealership/test-drive',
          message: 'Book your test drive here:'
        }
      };

      const matches = checkUrlTriggers(config, "Can I schedule a test drive for this weekend?");

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('schedulerUrl');
      expect(matches[0].url).toBe('https://calendly.com/dealership/test-drive');
      expect(matches[0].matchedKeyword).toBe('schedule');
    });

    it('should match financing URL trigger', () => {
      const config = {
        financingUrl: {
          enabled: true,
          url: 'https://dealership.com/pre-qualify',
          message: 'Get pre-qualified for financing:'
        }
      };

      const matches = checkUrlTriggers(config, "What financing options do you have?");

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('financingUrl');
      expect(matches[0].matchedKeyword).toBe('financing');
    });

    it('should match multiple triggers in one message', () => {
      const config = {
        tradeInUrl: {
          enabled: true,
          url: 'https://dealership.com/trade-in',
          message: 'Check trade-in value:'
        },
        financingUrl: {
          enabled: true,
          url: 'https://dealership.com/financing',
          message: 'Financing options:'
        }
      };

      const matches = checkUrlTriggers(config, "I want to trade in my car and need financing options");

      expect(matches).toHaveLength(2);
      expect(matches.map(m => m.type)).toContain('tradeInUrl');
      expect(matches.map(m => m.type)).toContain('financingUrl');
    });

    it('should not match disabled triggers', () => {
      const config = {
        tradeInUrl: {
          enabled: false,
          url: 'https://dealership.com/trade-in',
          message: 'Check trade-in value:'
        }
      };

      const matches = checkUrlTriggers(config, "What's my car worth for trade-in?");

      expect(matches).toHaveLength(0);
    });

    it('should not match when URL is empty', () => {
      const config = {
        tradeInUrl: {
          enabled: true,
          url: '',
          message: 'Check trade-in value:'
        }
      };

      const matches = checkUrlTriggers(config, "What's my car worth for trade-in?");

      expect(matches).toHaveLength(0);
    });

    it('should match custom triggers', () => {
      const config = {
        customUrls: [
          {
            trigger: 'warranty',
            url: 'https://dealership.com/warranty',
            message: 'Learn about warranty:',
            enabled: true
          }
        ]
      };

      const matches = checkUrlTriggers(config, "What warranty coverage do you offer?");

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('custom');
      expect(matches[0].matchedKeyword).toBe('warranty');
    });
  });

  describe('formatUrlTriggers', () => {
    it('should format single URL trigger', () => {
      const matches = [
        {
          type: 'tradeInUrl',
          url: 'https://dealership.com/trade-in',
          message: 'Check out our trade-in calculator:',
          matchedKeyword: 'trade-in'
        }
      ];

      const formatted = formatUrlTriggers(matches);

      expect(formatted).toBe('\n\nCheck out our trade-in calculator: https://dealership.com/trade-in');
    });

    it('should format multiple URL triggers', () => {
      const matches = [
        {
          type: 'tradeInUrl',
          url: 'https://dealership.com/trade-in',
          message: 'Trade-in calculator:',
          matchedKeyword: 'trade-in'
        },
        {
          type: 'financingUrl',
          url: 'https://dealership.com/financing',
          message: 'Financing options:',
          matchedKeyword: 'financing'
        }
      ];

      const formatted = formatUrlTriggers(matches);

      expect(formatted).toBe('\n\nTrade-in calculator: https://dealership.com/trade-in\n\nFinancing options: https://dealership.com/financing');
    });

    it('should return empty string for no matches', () => {
      const formatted = formatUrlTriggers([]);
      expect(formatted).toBe('');
    });
  });

  describe('extractUrlTriggerConfig', () => {
    it('should extract URL trigger config from campaign', () => {
      const campaign = {
        urlTriggers: {
          tradeInUrl: {
            enabled: true,
            url: 'https://dealership.com/trade-in',
            message: 'Trade-in calculator:'
          }
        }
      };

      const config = extractUrlTriggerConfig(campaign);

      expect(config.tradeInUrl?.enabled).toBe(true);
      expect(config.tradeInUrl?.url).toBe('https://dealership.com/trade-in');
    });

    it('should return default config when no triggers configured', () => {
      const campaign = {};

      const config = extractUrlTriggerConfig(campaign);

      expect(config.tradeInUrl?.enabled).toBe(false);
      expect(config.schedulerUrl?.enabled).toBe(false);
      expect(config.financingUrl?.enabled).toBe(false);
    });
  });
});
