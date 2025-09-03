import { getLatestTemplate, renderTemplate } from '../../server/services/template-renderer';
import { storage } from '../../server/storage';
import { type Template } from '@shared/schema';

// Mock storage
jest.mock('../../server/storage', () => ({
  storage: {
    getTemplatesByCampaign: jest.fn(),
  }
}));

describe('Template Renderer', () => {
  const mockTemplates: Template[] = [
    {
      id: '1',
      campaignId: '1',
      subject: 'Test Subject 1',
      bodyHtml: 'Hello {{firstName}}!',
      bodyText: 'Hello {{firstName}}!',
      version: 1,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-01T00:00:00Z')
    },
    {
      id: '2',
      campaignId: '1',
      subject: 'Test Subject 2',
      bodyHtml: 'Hi {{firstName}} {{lastName}}!',
      bodyText: 'Hi {{firstName}} {{lastName}}!',
      version: 1,
      createdAt: new Date('2023-01-02T00:00:00Z'),
      updatedAt: new Date('2023-01-02T00:00:00Z')
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestTemplate', () => {
    it('should return the most recent template for a campaign', async () => {
      (storage.getTemplatesByCampaign as jest.Mock).mockResolvedValue(mockTemplates);

      const result = await getLatestTemplate(1);

      expect(result).toEqual(mockTemplates[1]); // Most recent by createdAt
      expect(storage.getTemplatesByCampaign).toHaveBeenCalledWith('1');
    });

    it('should return null when no templates exist for campaign', async () => {
      (storage.getTemplatesByCampaign as jest.Mock).mockResolvedValue([]);

      const result = await getLatestTemplate(999);

      expect(result).toBeNull();
    });

    it('should call getTemplatesByCampaign with correct campaign ID', async () => {
      (storage.getTemplatesByCampaign as jest.Mock).mockResolvedValue(mockTemplates);

      const result = await getLatestTemplate(1);

      expect(result).toEqual(mockTemplates[1]);
      expect(storage.getTemplatesByCampaign).toHaveBeenCalledWith('1');
      expect(result?.campaignId).toBe('1');
    });
  });

  describe('renderTemplate', () => {
    const template: Template = {
      id: '1',
      campaignId: '1',
      subject: 'Test Subject',
      bodyHtml: 'Hello {{firstName}} {{lastName}}! Your email is {{email}}.',
      bodyText: 'Hello {{firstName}} {{lastName}}! Your email is {{email}}.',
      version: 1,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-01T00:00:00Z')
    };

    it('should render template with variables', () => {
      const variables = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Hello John Doe! Your email is john@example.com.');
    });

    it('should handle missing variables gracefully', () => {
      const variables = {
        firstName: 'John'
      };

      const result = renderTemplate(template, variables);

      expect(result).toContain('John');
      expect(result).toContain('{{lastName}}'); // Unreplaced variable
      expect(result).toContain('{{email}}'); // Unreplaced variable
    });

    it('should sanitize HTML in variables to prevent XSS', () => {
      const variables = {
        firstName: '<script>alert("xss")</script>',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const result = renderTemplate(template, variables);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("xss")');
      expect(result).toContain('Doe'); // Safe content should remain
    });

    it('should allow safe HTML tags', () => {
      const variables = {
        firstName: '<strong>John</strong>',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const result = renderTemplate(template, variables);

      expect(result).toContain('<strong>John</strong>');
      expect(result).toContain('Doe');
    });

    it('should validate variable keys', () => {
      const variables = {
        '': 'empty key',
        firstName: 'John'
      };

      expect(() => renderTemplate(template, variables)).toThrow('Invalid variable key');
    });

    it('should validate variable values are strings', () => {
      const variables = {
        firstName: 123 as any,
        lastName: 'Doe'
      };

      expect(() => renderTemplate(template, variables)).toThrow('Variable value must be string');
    });

    it('should detect potentially malicious content', () => {
      const variables = {
        firstName: 'John<script>alert("xss")</script>',
        lastName: 'Doe'
      };

      expect(() => renderTemplate(template, variables)).toThrow('Potentially malicious content');
    });

    it('should detect javascript: URLs', () => {
      const variables = {
        firstName: 'javascript:alert("xss")',
        lastName: 'Doe'
      };

      expect(() => renderTemplate(template, variables)).toThrow('Potentially malicious content');
    });

    it('should detect onload attributes', () => {
      const variables = {
        firstName: '<img onload="alert(1)" src="x">',
        lastName: 'Doe'
      };

      expect(() => renderTemplate(template, variables)).toThrow('Potentially malicious content');
    });

    it('should handle variables with whitespace in template', () => {
      const templateWithSpaces: Template = {
        id: '1',
        campaignId: '1',
        subject: 'Test',
        bodyHtml: 'Hello {{ firstName }} and {{lastName}}!',
        bodyText: 'Hello {{ firstName }} and {{lastName}}!',
        version: 1,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      };

      const variables = {
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = renderTemplate(templateWithSpaces, variables);

      expect(result).toBe('Hello John and Doe!');
    });

    it('should handle empty variables object', () => {
      const result = renderTemplate(template, {});

      expect(result).toBe(template.bodyHtml); // Should return unchanged content
    });

    it('should sanitize the entire rendered content', () => {
      const maliciousTemplate: Template = {
        id: '1',
        campaignId: '1',
        subject: 'Test',
        bodyHtml: 'Hello {{firstName}}! <script>alert("template-xss")</script>',
        bodyText: 'Hello {{firstName}}! <script>alert("template-xss")</script>',
        version: 1,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      };

      const variables = {
        firstName: 'John'
      };

      const result = renderTemplate(maliciousTemplate, variables);

      expect(result).toContain('John');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("template-xss")');
    });

    it('should preserve allowed HTML attributes', () => {
      const template: Template = {
        id: '1',
        campaignId: '1',
        subject: 'Test',
        bodyHtml: 'Visit <a href="https://example.com">our site</a>',
        bodyText: 'Visit our site at https://example.com',
        version: 1,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      };

      const result = renderTemplate(template, {});

      expect(result).toContain('<a href="https://example.com">our site</a>');
    });

    it('should remove dangerous HTML attributes', () => {
      const template: Template = {
        id: '1',
        campaignId: '1',
        subject: 'Test',
        bodyHtml: '<a href="https://example.com" onclick="alert(1)">click</a>',
        bodyText: 'click - https://example.com',
        version: 1,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      };

      const result = renderTemplate(template, {});

      expect(result).toContain('<a href="https://example.com">click</a>');
      expect(result).not.toContain('onclick');
    });
  });
});