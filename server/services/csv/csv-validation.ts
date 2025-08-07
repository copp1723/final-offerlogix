import { parse } from "csv-parse/sync";
import { z } from "zod";

// Validation schema for lead data
const leadValidationSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  vehicleInterest: z.string().optional(),
  budget: z.string().optional(),
  timeframe: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export interface ValidationResult {
  valid: boolean;
  data?: any[];
  errors?: string[];
  warnings?: string[];
  stats?: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateEmails: number;
  };
}

export interface CSVValidationOptions {
  maxFileSize?: number; // in bytes
  maxRows?: number;
  allowedColumns?: string[];
  requireColumns?: string[];
  sanitizeData?: boolean;
}

export class CSVValidationService {
  private static readonly DEFAULT_OPTIONS: CSVValidationOptions = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxRows: 10000,
    requireColumns: ['firstName', 'lastName', 'email'],
    sanitizeData: true,
  };

  /**
   * Validate and parse CSV file with comprehensive security checks
   */
  static async validateCSV(
    fileBuffer: Buffer,
    options: CSVValidationOptions = {}
  ): Promise<ValidationResult> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Security check: File size validation
      if (fileBuffer.length > config.maxFileSize!) {
        return {
          valid: false,
          errors: [`File size ${fileBuffer.length} bytes exceeds maximum allowed ${config.maxFileSize} bytes`]
        };
      }

      // Security check: Content validation (basic CSV format check)
      const content = fileBuffer.toString('utf8');
      
      // Check for suspicious content
      if (this.containsSuspiciousContent(content)) {
        return {
          valid: false,
          errors: ['File contains potentially malicious content']
        };
      }

      // Parse CSV with strict options
      let records: any[];
      try {
        records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          max_record_size: 10000, // Limit record size
          relax_column_count: true,
        });
      } catch (parseError) {
        return {
          valid: false,
          errors: [`CSV parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`]
        };
      }

      // Check row count limit
      if (records.length > config.maxRows!) {
        return {
          valid: false,
          errors: [`CSV contains ${records.length} rows, exceeding maximum allowed ${config.maxRows} rows`]
        };
      }

      if (records.length === 0) {
        return {
          valid: false,
          errors: ['CSV file is empty or contains no valid data rows']
        };
      }

      // Validate column headers
      const headers = Object.keys(records[0] || {});
      const columnValidation = this.validateColumns(headers, config);
      if (!columnValidation.valid) {
        return {
          valid: false,
          errors: columnValidation.errors
        };
      }

      // Validate and sanitize data
      const validatedRecords: any[] = [];
      const emailSet = new Set<string>();
      let duplicateCount = 0;

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; // +2 because CSV is 1-indexed and has header

        try {
          // Sanitize data if enabled
          const sanitizedRecord = config.sanitizeData 
            ? this.sanitizeRecord(record) 
            : record;

          // Validate against schema
          const validatedRecord = leadValidationSchema.parse(sanitizedRecord);

          // Check for duplicate emails
          if (emailSet.has(validatedRecord.email.toLowerCase())) {
            duplicateCount++;
            warnings.push(`Row ${rowNumber}: Duplicate email address ${validatedRecord.email}`);
            continue; // Skip duplicate
          }

          emailSet.add(validatedRecord.email.toLowerCase());
          validatedRecords.push(validatedRecord);

        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            const fieldErrors = validationError.errors
              .map(err => `${err.path.join('.')}: ${err.message}`)
              .join(', ');
            errors.push(`Row ${rowNumber}: ${fieldErrors}`);
          } else {
            errors.push(`Row ${rowNumber}: Validation failed - ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
          }
        }
      }

      // Determine if validation passed
      const hasValidData = validatedRecords.length > 0;
      const hasErrors = errors.length > 0;

      return {
        valid: hasValidData && !hasErrors,
        data: validatedRecords,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        stats: {
          totalRows: records.length,
          validRows: validatedRecords.length,
          invalidRows: records.length - validatedRecords.length,
          duplicateEmails: duplicateCount,
        }
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`CSV validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate CSV column headers
   */
  private static validateColumns(
    headers: string[], 
    config: CSVValidationOptions
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check required columns
    if (config.requireColumns) {
      const missingColumns = config.requireColumns.filter(
        col => !headers.includes(col)
      );
      if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
      }
    }

    // Check for allowed columns (if specified)
    if (config.allowedColumns) {
      const invalidColumns = headers.filter(
        header => !config.allowedColumns!.includes(header)
      );
      if (invalidColumns.length > 0) {
        errors.push(`Invalid columns found: ${invalidColumns.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Sanitize record data to prevent injection attacks
   */
  private static sanitizeRecord(record: any): any {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters and limit length
        sanitized[key] = value
          .replace(/[<>\"'&]/g, '') // Remove HTML/script characters
          .replace(/\r?\n|\r/g, ' ') // Replace newlines with spaces
          .trim()
          .substring(0, 1000); // Limit length
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check for suspicious content that might indicate malicious files
   */
  private static containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /\.exe\b/gi,
      /\.bat\b/gi,
      /\.cmd\b/gi,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Generate detailed validation report
   */
  static generateValidationReport(result: ValidationResult): string {
    const report: string[] = [];
    
    report.push(`CSV Validation Report`);
    report.push(`Status: ${result.valid ? 'PASSED' : 'FAILED'}`);
    
    if (result.stats) {
      report.push(`\nStatistics:`);
      report.push(`  Total rows processed: ${result.stats.totalRows}`);
      report.push(`  Valid rows: ${result.stats.validRows}`);
      report.push(`  Invalid rows: ${result.stats.invalidRows}`);
      report.push(`  Duplicate emails: ${result.stats.duplicateEmails}`);
    }

    if (result.errors && result.errors.length > 0) {
      report.push(`\nErrors:`);
      result.errors.forEach(error => report.push(`  ❌ ${error}`));
    }

    if (result.warnings && result.warnings.length > 0) {
      report.push(`\nWarnings:`);
      result.warnings.forEach(warning => report.push(`  ⚠️ ${warning}`));
    }

    return report.join('\n');
  }
}

// Export for backward compatibility
export const validateCSV = CSVValidationService.validateCSV.bind(CSVValidationService);
export const generateValidationReport = CSVValidationService.generateValidationReport.bind(CSVValidationService);