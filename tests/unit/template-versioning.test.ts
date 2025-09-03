import { 
  hashToBucket, 
  selectTemplateVersion, 
  validateVersionedTemplate,
  createSimpleABTest,
  getABTestStats,
  migrateLegacyTemplate
} from '../../server/services/template-versioning';

describe('Template Versioning', () => {
  describe('hashToBucket', () => {
    it('should be deterministic', () => {
      const leadId = 'lead-123';
      const bucket1 = hashToBucket(leadId);
      const bucket2 = hashToBucket(leadId);
      expect(bucket1).toBe(bucket2);
    });

    it('should return consistent values for same input', () => {
      expect(hashToBucket('lead-123')).toBe(hashToBucket('lead-123'));
      expect(hashToBucket('lead-456')).toBe(hashToBucket('lead-456'));
    });

    it('should distribute across 0-99 range', () => {
      const buckets = new Set();
      for (let i = 0; i < 1000; i++) {
        const bucket = hashToBucket(`lead-${i}`);
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThan(100);
        buckets.add(bucket);
      }
      // Should have good distribution
      expect(buckets.size).toBeGreaterThan(50);
    });

    it('should handle edge cases', () => {
      expect(hashToBucket('')).toBe(0);
      expect(hashToBucket('a')).toBeGreaterThanOrEqual(0);
      expect(() => hashToBucket(null as any)).not.toThrow();
    });
  });

  describe('selectTemplateVersion', () => {
    it('should respect A/B split configuration', () => {
      const template = {
        versions: {
          A: { subject: 'Subject A', content: 'Content A' },
          B: { subject: 'Subject B', content: 'Content B' }
        },
        ab: { A: 50, B: 50 }
      };

      const leadId = 'test-lead';
      const bucket = hashToBucket(leadId);
      const expected = bucket < 50 ? 'A' : 'B';
      
      const { versionKey, template: chosen } = selectTemplateVersion(template, leadId);
      expect(versionKey).toBe(expected);
      expect(chosen.subject).toBe(`Subject ${expected}`);
    });

    it('should default to latest version when no A/B config', () => {
      const template = {
        versions: {
          v1: { subject: 'Version 1', content: 'Content 1' },
          v2: { subject: 'Version 2', content: 'Content 2' },
          v3: { subject: 'Version 3', content: 'Content 3' }
        }
      };

      const { versionKey, template: chosen } = selectTemplateVersion(template, 'lead-x');
      expect(versionKey).toBe('v3'); // Alphabetically last
      expect(chosen.subject).toBe('Version 3');
    });

    it('should handle legacy template format', () => {
      const template = {
        subject: 'Legacy Subject',
        content: 'Legacy Content'
      };

      const { versionKey, template: chosen } = selectTemplateVersion(template, 'lead-legacy');
      expect(versionKey).toBe('default');
      expect(chosen.subject).toBe('Legacy Subject');
      expect(chosen.content).toBe('Legacy Content');
    });

    it('should handle unequal A/B splits', () => {
      const template = {
        versions: {
          A: { subject: 'A', content: 'a' },
          B: { subject: 'B', content: 'b' }
        },
        ab: { A: 30, B: 70 }
      };

      // Test multiple leads to verify distribution
      const results = [];
      for (let i = 0; i < 100; i++) {
        const { versionKey } = selectTemplateVersion(template, `lead-${i}`);
        results.push(versionKey);
      }

      const aCount = results.filter(v => v === 'A').length;
      const bCount = results.filter(v => v === 'B').length;
      
      // Should approximately match 30/70 split (allow some variance)
      expect(aCount).toBeGreaterThan(15);
      expect(aCount).toBeLessThan(45);
      expect(bCount).toBeGreaterThan(55);
      expect(bCount).toBeLessThan(85);
    });

    it('should handle invalid template gracefully', () => {
      const result = selectTemplateVersion(null as any, 'lead-test');
      expect(result.versionKey).toBe('default');
      expect(result.template.subject).toBe('Default Subject');
    });

    it('should fallback when variant not found in versions', () => {
      const template = {
        versions: {
          A: { subject: 'A', content: 'a' }
        },
        ab: { A: 50, B: 50 } // B doesn't exist in versions
      };

      const { template: chosen } = selectTemplateVersion(template, 'lead-fallback');
      expect(chosen.subject).toBe('A'); // Should fallback to available version
    });
  });

  describe('validateVersionedTemplate', () => {
    it('should validate correct versioned template', () => {
      const template = {
        versions: {
          A: { subject: 'Subject A', content: 'Content A' },
          B: { subject: 'Subject B', content: 'Content B' }
        },
        ab: { A: 50, B: 50 }
      };

      const result = validateVersionedTemplate(template);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate legacy template format', () => {
      const template = {
        subject: 'Legacy Subject',
        content: 'Legacy Content'
      };

      const result = validateVersionedTemplate(template);
      expect(result.isValid).toBe(true);
    });

    it('should detect missing required fields', () => {
      const template = {
        versions: {
          A: { subject: 'Subject A' } as any // Missing content
        }
      };

      const result = validateVersionedTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("must have a content string"))).toBe(true);
    });

    it('should detect invalid A/B percentages', () => {
      const template = {
        versions: {
          A: { subject: 'A', content: 'a' },
          B: { subject: 'B', content: 'b' }
        },
        ab: { A: 30, B: 40 } // Only sums to 70
      };

      const result = validateVersionedTemplate(template);
      expect(result.warnings.some(w => w.includes("sum to 70%, not 100%"))).toBe(true);
    });

    it('should warn about very long subjects', () => {
      const longSubject = 'A'.repeat(250);
      const template = {
        versions: {
          A: { subject: longSubject, content: 'Content' }
        }
      };

      const result = validateVersionedTemplate(template);
      expect(result.warnings.some(w => w.includes("subject is very long"))).toBe(true);
    });
  });

  describe('createSimpleABTest', () => {
    it('should create 50/50 A/B test by default', () => {
      const variantA = { subject: 'A', content: 'a' };
      const variantB = { subject: 'B', content: 'b' };

      const template = createSimpleABTest(variantA, variantB);
      
      expect(template.versions?.A).toEqual(variantA);
      expect(template.versions?.B).toEqual(variantB);
      expect(template.ab?.A).toBe(50);
      expect(template.ab?.B).toBe(50);
    });

    it('should create custom split A/B test', () => {
      const variantA = { subject: 'A', content: 'a' };
      const variantB = { subject: 'B', content: 'b' };

      const template = createSimpleABTest(variantA, variantB, 30);
      
      expect(template.ab?.A).toBe(30);
      expect(template.ab?.B).toBe(70);
    });

    it('should validate split percentage', () => {
      const variantA = { subject: 'A', content: 'a' };
      const variantB = { subject: 'B', content: 'b' };

      expect(() => createSimpleABTest(variantA, variantB, -10)).toThrow();
      expect(() => createSimpleABTest(variantA, variantB, 110)).toThrow();
    });
  });

  describe('getABTestStats', () => {
    it('should calculate statistics correctly', () => {
      const assignments = [
        { leadId: '1', versionKey: 'A' },
        { leadId: '2', versionKey: 'A' },
        { leadId: '3', versionKey: 'B' },
        { leadId: '4', versionKey: 'B' },
        { leadId: '5', versionKey: 'B' }
      ];

      const stats = getABTestStats(assignments);
      
      expect(stats.A.count).toBe(2);
      expect(stats.A.percentage).toBe(40);
      expect(stats.B.count).toBe(3);
      expect(stats.B.percentage).toBe(60);
    });

    it('should handle empty assignments', () => {
      const stats = getABTestStats([]);
      expect(stats).toEqual({});
    });
  });

  describe('migrateLegacyTemplate', () => {
    it('should migrate legacy template to versioned format', () => {
      const legacy = {
        subject: 'Old Subject',
        content: 'Old Content'
      };

      const versioned = migrateLegacyTemplate(legacy);
      
      expect(versioned.versions?.v1.subject).toBe('Old Subject');
      expect(versioned.versions?.v1.content).toBe('Old Content');
    });

    it('should handle empty legacy template', () => {
      const versioned = migrateLegacyTemplate({});
      
      expect(versioned.versions?.v1.subject).toBe('Migrated Template');
      expect(versioned.versions?.v1.content).toBe('Migrated Content');
    });
  });
});