import multer from 'multer';
import * as csv from 'csv-parse';
import { storage } from '../storage';
import { Request, Response } from 'express';

// Configure multer for file uploads
export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Field mapping suggestions based on common CSV headers
export const fieldMappingSuggestions: Record<string, string> = {
  'first name': 'firstName',
  'firstname': 'firstName',
  'first_name': 'firstName',
  'fname': 'firstName',
  'last name': 'lastName',
  'lastname': 'lastName', 
  'last_name': 'lastName',
  'lname': 'lastName',
  'email': 'email',
  'email address': 'email',
  'email_address': 'email',
  'phone': 'phone',
  'phone number': 'phone',
  'phone_number': 'phone',
  'mobile': 'phone',
  'source': 'source',
  'lead source': 'source',
  'lead_source': 'source',
  'company': 'employer',
  'employer': 'employer',
  'job title': 'jobTitle',
  'job_title': 'jobTitle',
  'position': 'jobTitle',
  'income': 'income',
  'annual income': 'income',
  'annual_income': 'income',
  'credit score': 'creditScore',
  'credit_score': 'creditScore',
  'notes': 'notes',
  'comments': 'notes',
  'vehicle interest': 'vehicleInterest',
  'vehicle_interest': 'vehicleInterest',
  'make model': 'vehicleInterest',
  'car interest': 'vehicleInterest'
};

export class LeadImportService {
  /**
   * Analyze CSV file and suggest field mappings
   */
  static async analyzeCsv(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' }
        });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const rows: any[] = [];
      let headers: string[] = [];

      return new Promise((resolve, reject) => {
        const parser = csv.parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          cast: false,
          max_record_size: 50000,
        });

        parser.on('readable', function () {
          let record;
          while ((record = parser.read()) !== null) {
            if (rows.length === 0 && Object.keys(record).length > 0) {
              headers = Object.keys(record);
            }
            if (rows.length < 5) {
              rows.push(record);
            }
          }
        });

        parser.on('error', function (err) {
          console.error('CSV parsing error:', err);
          res.status(400).json({
            success: false,
            error: {
              code: 'PARSE_ERROR',
              message: 'Failed to parse CSV file',
              details: err.message,
            },
          });
          reject(err);
        });

        parser.on('end', function () {
          const allRows = fileContent.split('\n').filter(line => line.trim()).length - 1;

          // Generate field mapping suggestions
          const suggestedMappings = headers.map(header => {
            const normalizedHeader = header.toLowerCase().trim();
            const leadField = fieldMappingSuggestions[normalizedHeader] || '';
            return {
              csvColumn: header,
              leadField: leadField,
            };
          });

          res.json({
            headers,
            previewRows: rows,
            suggestedMappings,
            totalRows: allRows,
          });
          resolve(true);
        });

        parser.write(fileContent);
        parser.end();
      });
    } catch (error) {
      console.error('Error analyzing CSV:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYSIS_ERROR',
          message: 'Failed to analyze CSV file',
        },
      });
    }
  }

  /**
   * Import leads from CSV with field mappings
   */
  static async importLeads(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' }
        });
      }

      const mappings = JSON.parse(req.body.mappings || '[]');
      const campaignId = req.body.campaignId;

      if (!Array.isArray(mappings) || mappings.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_MAPPINGS', message: 'Field mappings are required' }
        });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const importedLeads: any[] = [];
      const errors: Array<{ row?: number; error: string }> = [];
      let rowNumber = 0;

      // Create field mapping lookup
      const fieldMap: Record<string, string> = {};
      mappings.forEach((mapping: any) => {
        if (mapping.leadField && mapping.leadField !== 'ignore') {
          fieldMap[mapping.csvColumn] = mapping.leadField;
        }
      });

      return new Promise((resolve, reject) => {
        const parser = csv.parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          cast: false,
          max_record_size: 50000,
        });

        parser.on('readable', async function () {
          let record;
          while ((record = parser.read()) !== null) {
            rowNumber++;

            try {
              // Map CSV fields to lead fields
              const leadData: any = {
                source: 'csv_import',
                status: 'new',
                name: '',
              };

              // Apply field mappings
              Object.entries(record).forEach(([csvField, value]) => {
                const leadField = fieldMap[csvField];
                if (leadField && value) {
                  if (['income', 'creditScore', 'qualificationScore'].includes(leadField)) {
                    const numValue = parseInt(value as string, 10);
                    if (!isNaN(numValue)) {
                      leadData[leadField] = numValue;
                    }
                  } else {
                    leadData[leadField] = value;
                  }
                }
              });

              // Create full name from firstName/lastName
              if (leadData.firstName || leadData.lastName) {
                leadData.name = `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim();
              }

              // Add campaign ID if provided
              if (campaignId) {
                leadData.campaignId = campaignId;
              }

              // Validate required fields
              if (!leadData.email) {
                errors.push({ row: rowNumber, error: 'Email is required' });
                continue;
              }

              // Check for duplicate email
              const existingLead = await storage.getLeadByEmail(leadData.email);
              if (existingLead) {
                errors.push({
                  row: rowNumber,
                  error: `Duplicate email: ${leadData.email}`
                });
                continue;
              }

              // Create the lead
              const newLead = await storage.createLead(leadData);
              importedLeads.push(newLead);

            } catch (error) {
              console.error('Error importing lead row:', error);
              errors.push({
                row: rowNumber,
                error: error instanceof Error ? error.message : 'Import failed'
              });
            }
          }
        });

        parser.on('error', function (err) {
          console.error('CSV import parsing error:', err);
          res.status(400).json({
            success: false,
            error: {
              code: 'PARSE_ERROR',
              message: 'Failed to parse CSV file during import',
              details: err.message,
            },
          });
          reject(err);
        });

        parser.on('end', function () {
          res.json({
            success: true,
            total: rowNumber,
            successful: importedLeads.length,
            failed: errors.length,
            errors: errors.slice(0, 100), // Limit errors returned
            leads: importedLeads.slice(0, 10) // Return first 10 imported leads
          });
          resolve(true);
        });

        parser.write(fileContent);
        parser.end();
      });
    } catch (error) {
      console.error('Error importing leads:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'Failed to import leads',
        },
      });
    }
  }

  /**
   * Export leads to CSV
   */
  static async exportLeads(req: Request, res: Response) {
    try {
      const { campaignId, status, source } = req.query;
      
      // Get leads based on filters
      let leads = await storage.getLeads();
      
      if (campaignId) {
        leads = leads.filter(lead => lead.campaignId === campaignId);
      }
      if (status) {
        leads = leads.filter(lead => lead.status === status);
      }
      if (source) {
        leads = leads.filter(lead => lead.source === source);
      }

      // Create CSV headers
      const headers = [
        'ID',
        'First Name', 
        'Last Name',
        'Full Name',
        'Email',
        'Phone',
        'Status',
        'Source',
        'Score',
        'Vehicle Interest',
        'Campaign ID',
        'Created Date',
        'Updated Date'
      ];

      // Generate CSV rows
      const csvRows = leads.map(lead => [
        lead.id,
        lead.firstName || '',
        lead.lastName || '',
        lead.name || '',
        lead.email,
        lead.phone || '',
        lead.status,
        lead.source,
        lead.qualificationScore || '',
        lead.vehicleInterest || '',
        lead.campaignId || '',
        new Date(lead.createdAt).toISOString(),
        new Date(lead.updatedAt).toISOString()
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      // Set response headers
      const filename = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting leads:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export leads'
      });
    }
  }
}