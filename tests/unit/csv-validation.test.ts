/**
 * Unit tests for CSV validation service
 */

import { CSVValidationService, ValidationResult, CSVValidationOptions } from '../../server/services/csv/csv-validation';

describe('CSVValidationService', () => {
  describe('validateCSV', () => {
    it('should validate a properly formatted CSV file', async () => {
      const csvContent = `firstName,lastName,email,phone
John,Doe,john.doe@example.com,555-0123
Jane,Smith,jane.smith@example.com,555-0124`;
      
      const buffer = Buffer.from(csvContent, 'utf8');
      const result = await CSVValidationService.validateCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0]).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123'
      });
      expect(result.stats).toMatchObject({
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateEmails: 0
      });
    });

    it('should reject CSV files that exceed size limit', async () => {
      const largeContent = 'a'.repeat(11 * 1024 * 1024); // 11MB
      const buffer = Buffer.from(largeContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer, { maxFileSize: 10 * 1024 * 1024 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('File size')
      );
    });

    it('should reject CSV files with too many rows', async () => {
      const csvContent = `email\n` + Array.from({ length: 101 }, (_, i) => `user${i}@example.com`).join('\n');
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer, { maxRows: 100 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('exceeding maximum allowed')
      );
    });

    it('should handle empty CSV files', async () => {
      const csvContent = '';
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('empty or contains no valid data')
      );
    });

    it('should validate required columns', async () => {
      const csvContent = `firstName,lastName,phone\nJohn,Doe,555-0123`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer, {
        requireColumns: ['email']
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Missing required columns: email')
      );
    });

    it('should detect duplicate email addresses', async () => {
      const csvContent = `email\ntest@example.com\ntest@example.com\ndifferent@example.com`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.data).toHaveLength(2); // Only unique emails should be kept
      expect(result.warnings).toContain(
        expect.stringContaining('Duplicate email address')
      );
      expect(result.stats!.duplicateEmails).toBe(1);
    });

    it('should validate email format', async () => {
      const csvContent = `email\ninvalid-email\nvalid@example.com`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Invalid email format')
      );
      expect(result.stats!.validRows).toBe(1);
      expect(result.stats!.invalidRows).toBe(1);
    });

    it('should sanitize potentially dangerous content', async () => {
      const csvContent = `email,notes\ntest@example.com,"<script>alert('xss')</script>Notes here"`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer, { sanitizeData: true });

      expect(result.valid).toBe(true);
      expect(result.data![0].notes).not.toContain('<script>');
      expect(result.data![0].notes).toContain('Notes here');
    });

    it('should detect suspicious content patterns', async () => {
      const csvContent = `email\n<script>alert('malicious')</script>@example.com`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('potentially malicious content')
      );
    });

    it('should handle optional fields properly', async () => {
      const csvContent = `email,firstName,vehicleInterest\ntest@example.com,John,SUV`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.data![0]).toMatchObject({
        email: 'test@example.com',
        firstName: 'John',
        vehicleInterest: 'SUV'
      });
    });

    it('should handle malformed CSV gracefully', async () => {
      const csvContent = `email,name\ntest@example.com,"Unclosed quote\ntest2@example.com,Valid Name`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const result = await CSVValidationService.validateCSV(buffer);

      // Should handle parsing errors gracefully
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('CSV parsing failed')
      );
    });

    it('should respect custom validation options', async () => {
      const csvContent = `customField,email\nvalue,test@example.com`;
      const buffer = Buffer.from(csvContent, 'utf8');

      const options: CSVValidationOptions = {
        allowedColumns: ['customField', 'email'],
        requireColumns: ['customField', 'email'],
        sanitizeData: false
      };

      const result = await CSVValidationService.validateCSV(buffer, options);

      expect(result.valid).toBe(true);
    });

    it('should handle case-insensitive column validation for required columns', async () => {
      // Test with capital E in Email
      const csvContentCapitalE = `firstName,lastName,Email,phone
John,Doe,john.doe@example.com,555-0123
Jane,Smith,jane.smith@example.com,555-0124`;

      const bufferCapitalE = Buffer.from(csvContentCapitalE, 'utf8');
      const resultCapitalE = await CSVValidationService.validateCSV(bufferCapitalE);

      expect(resultCapitalE.valid).toBe(true);
      expect(resultCapitalE.data).toHaveLength(2);
      expect(resultCapitalE.data![0]).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123'
      });

      // Test with all caps EMAIL
      const csvContentAllCaps = `firstName,lastName,EMAIL,phone
John,Doe,john.doe@example.com,555-0123`;

      const bufferAllCaps = Buffer.from(csvContentAllCaps, 'utf8');
      const resultAllCaps = await CSVValidationService.validateCSV(bufferAllCaps);

      expect(resultAllCaps.valid).toBe(true);
      expect(resultAllCaps.data).toHaveLength(1);
      expect(resultAllCaps.data![0].email).toBe('john.doe@example.com');

      // Test with mixed case variations - E-Mail should now work since we added it to mappings
      const csvContentMixed = `firstName,lastName,E-Mail,phone
John,Doe,john.doe@example.com,555-0123`;

      const bufferMixed = Buffer.from(csvContentMixed, 'utf8');
      const resultMixed = await CSVValidationService.validateCSV(bufferMixed);

      // This should now pass because E-Mail is in our field mappings
      expect(resultMixed.valid).toBe(true);
      expect(resultMixed.data).toHaveLength(1);
      expect(resultMixed.data![0].email).toBe('john.doe@example.com');
    });

    it('should reject invalid column names when allowedColumns is specified', async () => {
      const csvContent = `invalidColumn,email\nvalue,test@example.com`;
      const buffer = Buffer.from(csvContent, 'utf8');
      
      const options: CSVValidationOptions = {
        allowedColumns: ['email', 'firstName', 'lastName']
      };
      
      const result = await CSVValidationService.validateCSV(buffer, options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Invalid columns found: invalidColumn')
      );
    });
  });

  describe('generateValidationReport', () => {
    it('should generate a comprehensive validation report', () => {
      const result: ValidationResult = {
        valid: false,
        errors: ['Row 2: Invalid email format', 'Row 3: Missing required field'],
        warnings: ['Row 4: Duplicate email address'],
        stats: {
          totalRows: 5,
          validRows: 3,
          invalidRows: 2,
          duplicateEmails: 1
        }
      };

      const report = CSVValidationService.generateValidationReport(result);

      expect(report).toContain('Status: FAILED');
      expect(report).toContain('Total rows processed: 5');
      expect(report).toContain('Valid rows: 3');
      expect(report).toContain('Invalid rows: 2');
      expect(report).toContain('Duplicate emails: 1');
      expect(report).toContain('❌ Row 2: Invalid email format');
      expect(report).toContain('⚠️ Row 4: Duplicate email address');
    });

    it('should generate a success report for valid data', () => {
      const result: ValidationResult = {
        valid: true,
        stats: {
          totalRows: 3,
          validRows: 3,
          invalidRows: 0,
          duplicateEmails: 0
        }
      };

      const report = CSVValidationService.generateValidationReport(result);

      expect(report).toContain('Status: PASSED');
      expect(report).toContain('Total rows processed: 3');
      expect(report).toContain('Valid rows: 3');
      expect(report).toContain('Invalid rows: 0');
    });
  });
});