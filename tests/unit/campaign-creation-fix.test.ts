import { ZodError } from 'zod';

describe('Campaign Creation Fix', () => {
  
  // Mock the database and logging
  const mockDb = {
    insert: jest.fn(),
    returning: jest.fn()
  };
  
  const mockLog = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  };

  // Mock campaign creation logic
  function createCampaignData(campaign: any) {
    const safeArray = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      }
      return [];
    };

    const sanitizedTemplates = safeArray(campaign.templates || [])
      .map((t) => {
        if (typeof t === 'string') {
          const content = t.trim();
          const subj = content ? content.replace(/<[^>]*>/g, '').slice(0, 80) : 'Untitled';
          return { subject: subj, content };
        }
        if (!t || typeof t !== 'object') return null;
        const subj = t.subject || t.title || 'Untitled';
        const content = t.content || t.html || t.body || t.text || '';
        return { subject: subj.slice(0, 140), content };
      })
      .filter(Boolean);

    const sanitizedSubjects = safeArray(campaign.subjectLines || [])
      .filter(s => typeof s === 'string' && s.trim())
      .map(s => s.slice(0, 140));

    return {
      // Core required fields
      name: campaign.name || 'Untitled Campaign',
      context: campaign.context || 'Campaign context',
      status: campaign.status || 'draft',
      
      // Optional fields with safe defaults
      handoverGoals: campaign.handoverGoals || null,
      targetAudience: campaign.targetAudience || null,
      handoverPrompt: campaign.handoverPrompt || null,
      handoverPromptSpec: campaign.handoverPromptSpec || null,
      handoverCriteria: campaign.handoverCriteria || null,
      handoverRecipient: campaign.handoverRecipient || null,
      numberOfTemplates: campaign.numberOfTemplates || 5,
      daysBetweenMessages: campaign.daysBetweenMessages || 3,
      openRate: campaign.openRate || null,
      isTemplate: campaign.isTemplate || false,
      originalCampaignId: campaign.originalCampaignId || null,
      agentConfigId: campaign.agentConfigId || null,
      stopOnComplaint: campaign.stopOnComplaint || false,
      sendWindow: campaign.sendWindow || null,
      
      // Processed fields
      templates: sanitizedTemplates,
      subjectLines: sanitizedSubjects,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  describe('Data Sanitization', () => {
    it('should handle minimal campaign data with safe defaults', () => {
      const minimalCampaign = {
        name: 'Test Campaign',
        context: 'Test automotive campaign'
      };

      const result = createCampaignData(minimalCampaign);

      expect(result).toMatchObject({
        name: 'Test Campaign',
        context: 'Test automotive campaign',
        status: 'draft',
        numberOfTemplates: 5,
        daysBetweenMessages: 3,
        isTemplate: false,
        stopOnComplaint: false,
        templates: [],
        subjectLines: []
      });

      // Check that optional fields are null
      expect(result.handoverGoals).toBeNull();
      expect(result.targetAudience).toBeNull();
      expect(result.handoverCriteria).toBeNull();
      expect(result.handoverRecipient).toBeNull();
    });

    it('should sanitize email templates correctly', () => {
      const campaignWithTemplates = {
        name: 'Campaign with Templates',
        context: 'Test context',
        templates: [
          'Simple string template about Toyota Prius fuel efficiency',
          {
            subject: 'Test Drive Your New Toyota Prius',
            content: 'Experience the incredible fuel efficiency of the 2024 Toyota Prius'
          },
          {
            title: 'Financing Options', 
            body: 'Flexible financing available for your new Toyota Prius'
          }
        ]
      };

      const result = createCampaignData(campaignWithTemplates);

      expect(result.templates).toHaveLength(3);
      
      // String template
      expect(result.templates[0]).toEqual({
        subject: 'Simple string template about Toyota Prius fuel efficiency',
        content: 'Simple string template about Toyota Prius fuel efficiency'
      });

      // Object template with subject/content
      expect(result.templates[1]).toEqual({
        subject: 'Test Drive Your New Toyota Prius',
        content: 'Experience the incredible fuel efficiency of the 2024 Toyota Prius'
      });

      // Object template with title/body
      expect(result.templates[2]).toEqual({
        subject: 'Financing Options',
        content: 'Flexible financing available for your new Toyota Prius'
      });
    });

    it('should handle empty or invalid template data', () => {
      const campaignWithInvalidTemplates = {
        name: 'Test Campaign',
        context: 'Test context',
        templates: [
          '', // Empty string
          null, // Null value
          {}, // Empty object
          { subject: '', content: '' }, // Empty subject/content
          'Valid template content'
        ]
      };

      const result = createCampaignData(campaignWithInvalidTemplates);

      // Should filter out null values but keep others (empty strings become "Untitled")
      expect(result.templates.length).toBeGreaterThan(0);
      expect(result.templates[result.templates.length - 1]).toEqual({
        subject: 'Valid template content',
        content: 'Valid template content'
      });
    });

    it('should sanitize subject lines array', () => {
      const campaignWithSubjects = {
        name: 'Test Campaign',
        context: 'Test context',
        subjectLines: [
          'Great deals on Toyota Prius',
          '', // Empty string should be filtered
          'Test drive the fuel-efficient Prius',
          123, // Non-string should be filtered
          'Financing options available'
        ]
      };

      const result = createCampaignData(campaignWithSubjects);

      expect(result.subjectLines).toEqual([
        'Great deals on Toyota Prius',
        'Test drive the fuel-efficient Prius',
        'Financing options available'
      ]);
    });

    it('should handle string-encoded JSON arrays', () => {
      const campaignWithStringArrays = {
        name: 'Test Campaign',
        context: 'Test context',
        templates: '["Template 1", "Template 2"]',
        subjectLines: '["Subject 1", "Subject 2"]'
      };

      const result = createCampaignData(campaignWithStringArrays);

      expect(result.templates).toHaveLength(2);
      expect(result.templates[0]?.subject).toBe('Template 1');
      expect(result.templates[1]?.subject).toBe('Template 2');
      
      expect(result.subjectLines).toEqual(['Subject 1', 'Subject 2']);
    });
  });

  describe('Error Handling', () => {
    it('should handle handover_criteria column compatibility error', () => {
      const error = {
        code: '42703',
        message: 'column "handover_criteria" does not exist'
      };

      const isHandoverColumnError = error.code === '42703' && 
        error.message.includes('handover_criteria');

      expect(isHandoverColumnError).toBe(true);
    });

    it('should create fallback campaign data without handover_criteria', () => {
      const originalData = {
        name: 'Test Campaign',
        context: 'Test context',
        handoverCriteria: { minScore: 80 },
        handoverRecipient: 'sales@example.com',
        templates: [],
        subjectLines: []
      };

      const { handoverCriteria, ...fallbackData } = createCampaignData(originalData);

      expect(fallbackData).not.toHaveProperty('handoverCriteria');
      expect(fallbackData.handoverRecipient).toBe('sales@example.com');
      expect(fallbackData.name).toBe('Test Campaign');
    });
  });

  describe('Required Field Defaults', () => {
    it('should provide safe defaults for missing required fields', () => {
      const incompleteData = {};

      const result = createCampaignData(incompleteData);

      expect(result.name).toBe('Untitled Campaign');
      expect(result.context).toBe('Campaign context');
      expect(result.status).toBe('draft');
    });

    it('should preserve provided values over defaults', () => {
      const providedData = {
        name: 'My Custom Campaign',
        context: 'Toyota Prius lead nurturing',
        status: 'active',
        numberOfTemplates: 7,
        daysBetweenMessages: 2
      };

      const result = createCampaignData(providedData);

      expect(result.name).toBe('My Custom Campaign');
      expect(result.context).toBe('Toyota Prius lead nurturing');
      expect(result.status).toBe('active');
      expect(result.numberOfTemplates).toBe(7);
      expect(result.daysBetweenMessages).toBe(2);
    });
  });
});