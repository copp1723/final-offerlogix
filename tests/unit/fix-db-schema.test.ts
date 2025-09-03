import fs from 'fs';
import path from 'path';

describe('Database schema fixes', () => {
  const sqlPath = path.join(__dirname, '../../scripts/fix-db.sql');
  const migrationPath = path.join(__dirname, '../../drizzle/0018_add_handover_criteria.sql');

  describe('fix-db.sql schema', () => {
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    it('adds handover_criteria as JSONB', () => {
      expect(sql).toMatch(/ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_criteria JSONB;/i);
    });

    it('adds handover_recipient as TEXT', () => {
      expect(sql).toMatch(/ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_recipient TEXT;/i);
    });

    it('includes performance indexes', () => {
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_campaigns_handover_recipient/i);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_campaigns_handover_criteria/i);
    });

    it('includes data integrity constraints', () => {
      expect(sql).toMatch(/chk_handover_recipient_not_empty/i);
      expect(sql).toMatch(/chk_handover_criteria_valid/i);
    });
  });

  describe('0018 migration', () => {
    const migration = fs.readFileSync(migrationPath, 'utf-8');

    it('creates proper JSONB column', () => {
      expect(migration).toMatch(/handover_criteria JSONB/i);
    });

    it('creates TEXT column for recipient', () => {
      expect(migration).toMatch(/handover_recipient TEXT/i);
    });

    it('includes GIN index for JSONB queries', () => {
      expect(migration).toMatch(/USING gin\(handover_criteria\)/i);
    });

    it('validates JSONB structure', () => {
      expect(migration).toMatch(/jsonb_typeof\(handover_criteria\) = 'object'/i);
    });
  });
});