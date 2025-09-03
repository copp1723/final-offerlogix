/**
 * Unit tests for Lead Import service
 */

import { LeadImportService, fieldMappingSuggestions } from '../../server/services/lead-import';
import { Request, Response } from 'express';

// Mock the storage module
jest.mock('../../server/storage', () => ({
  storage: {
    getLeadByEmail: jest.fn(),
    createLead: jest.fn(),
    getLeads: jest.fn(),
  }
}));

import { storage } from '../../server/storage';

// Create mock Request and Response objects
const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  file: undefined,
  body: {},
  query: {},
  ...overrides,
});

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('LeadImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fieldMappingSuggestions', () => {
    it('should provide correct mapping suggestions for common headers', () => {
      expect(fieldMappingSuggestions['first name']).toBe('firstName');
      expect(fieldMappingSuggestions['email']).toBe('email');
      expect(fieldMappingSuggestions['phone number']).toBe('phone');
      expect(fieldMappingSuggestions['vehicle interest']).toBe('vehicleInterest');
      expect(fieldMappingSuggestions['company']).toBe('employer');
    });

    it('should handle variations of common field names', () => {
      expect(fieldMappingSuggestions['firstname']).toBe('firstName');
      expect(fieldMappingSuggestions['first_name']).toBe('firstName');
      expect(fieldMappingSuggestions['fname']).toBe('firstName');
      
      expect(fieldMappingSuggestions['email address']).toBe('email');
      expect(fieldMappingSuggestions['email_address']).toBe('email');
      
      expect(fieldMappingSuggestions['phone']).toBe('phone');
      expect(fieldMappingSuggestions['mobile']).toBe('phone');
    });
  });

  describe('analyzeCsv', () => {
    it('should analyze CSV file and return headers with suggestions', async () => {
      const csvContent = `First Name,Last Name,Email Address,Phone\nJohn,Doe,john@example.com,555-0123\nJane,Smith,jane@example.com,555-0124`;
      const mockFile = {
        buffer: Buffer.from(csvContent, 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const req = createMockRequest({ file: mockFile as any });
      const res = createMockResponse();

      await LeadImportService.analyzeCsv(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: ['First Name', 'Last Name', 'Email Address', 'Phone'],
          previewRows: expect.arrayContaining([
            expect.objectContaining({
              'First Name': 'John',
              'Last Name': 'Doe',
              'Email Address': 'john@example.com',
              'Phone': '555-0123'
            })
          ]),
          suggestedMappings: expect.arrayContaining([
            { csvColumn: 'First Name', leadField: 'firstName' },
            { csvColumn: 'Last Name', leadField: 'lastName' },
            { csvColumn: 'Email Address', leadField: 'email' },
            { csvColumn: 'Phone', leadField: 'phone' }
          ]),
          totalRows: 2
        })
      );
    });

    it('should return error when no file is uploaded', async () => {
      const req = createMockRequest({ file: undefined });
      const res = createMockResponse();

      await LeadImportService.analyzeCsv(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' }
      });
    });

    it('should handle CSV parsing errors gracefully', async () => {
      const invalidCsvContent = `"Unclosed quote\nInvalid,CSV,Format`;
      const mockFile = {
        buffer: Buffer.from(invalidCsvContent, 'utf8'),
        originalname: 'invalid.csv',
        mimetype: 'text/csv',
      };

      const req = createMockRequest({ file: mockFile as any });
      const res = createMockResponse();

      await LeadImportService.analyzeCsv(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'PARSE_ERROR',
            message: 'Failed to parse CSV file'
          })
        })
      );
    });

    it('should limit preview rows to 5', async () => {
      const csvContent = `email\n` + Array.from({ length: 10 }, (_, i) => `user${i}@example.com`).join('\n');
      const mockFile = {
        buffer: Buffer.from(csvContent, 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const req = createMockRequest({ file: mockFile as any });
      const res = createMockResponse();

      await LeadImportService.analyzeCsv(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          previewRows: expect.arrayContaining([]),
          totalRows: 10
        })
      );
      
      const call = (res.json as jest.Mock).mock.calls[0][0];
      expect(call.previewRows.length).toBeLessThanOrEqual(5);
    });
  });

  describe('importLeads', () => {
    it('should successfully import leads with proper mappings', async () => {
      const csvContent = `fname,lname,email_address\nJohn,Doe,john@example.com\nJane,Smith,jane@example.com`;
      const mockFile = {
        buffer: Buffer.from(csvContent, 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const mappings = [
        { csvColumn: 'fname', leadField: 'firstName' },
        { csvColumn: 'lname', leadField: 'lastName' },
        { csvColumn: 'email_address', leadField: 'email' }
      ];

      const req = createMockRequest({
        file: mockFile as any,
        body: {
          mappings: JSON.stringify(mappings),
          campaignId: 'test-campaign-123'
        }
      });
      const res = createMockResponse();

      // Mock storage calls
      (storage.getLeadByEmail as jest.Mock).mockResolvedValue(null);
      (storage.createLead as jest.Mock).mockImplementation((leadData) => 
        Promise.resolve({ id: 'lead-123', ...leadData })
      );

      await LeadImportService.importLeads(req as Request, res as Response);

      expect(storage.createLead).toHaveBeenCalledTimes(2);
      expect(storage.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          name: 'John Doe',
          source: 'csv_import',
          status: 'new',
          campaignId: 'test-campaign-123'
        })
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total: 2,
          successful: 2,
          failed: 0
        })
      );
    });

    it('should return error when no file is uploaded', async () => {
      const req = createMockRequest({ file: undefined });
      const res = createMockResponse();

      await LeadImportService.importLeads(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' }
      });
    });

    it('should return error when no mappings are provided', async () => {
      const mockFile = {
        buffer: Buffer.from('email\ntest@example.com', 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const req = createMockRequest({
        file: mockFile as any,
        body: { mappings: '[]' }
      });
      const res = createMockResponse();

      await LeadImportService.importLeads(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'NO_MAPPINGS', message: 'Field mappings are required' }
      });
    });

    it('should skip rows without required email field', async () => {
      const csvContent = `name,email\nJohn Doe,\nJane Smith,jane@example.com`;
      const mockFile = {
        buffer: Buffer.from(csvContent, 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const mappings = [
        { csvColumn: 'name', leadField: 'firstName' },
        { csvColumn: 'email', leadField: 'email' }
      ];

      const req = createMockRequest({
        file: mockFile as any,
        body: { mappings: JSON.stringify(mappings) }
      });
      const res = createMockResponse();

      (storage.getLeadByEmail as jest.Mock).mockResolvedValue(null);
      (storage.createLead as jest.Mock).mockImplementation((leadData) => 
        Promise.resolve({ id: 'lead-123', ...leadData })
      );

      await LeadImportService.importLeads(req as Request, res as Response);

      expect(storage.createLead).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total: 2,
          successful: 1,
          failed: 1,
          errors: expect.arrayContaining([
            expect.objectContaining({
              row: 2,
              error: 'Email is required'
            })
          ])
        })
      );
    });

    it('should skip duplicate email addresses', async () => {
      const csvContent = `email\nexisting@example.com\nnew@example.com`;
      const mockFile = {
        buffer: Buffer.from(csvContent, 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const mappings = [{ csvColumn: 'email', leadField: 'email' }];

      const req = createMockRequest({
        file: mockFile as any,
        body: { mappings: JSON.stringify(mappings) }
      });
      const res = createMockResponse();

      // Mock existing lead for first email
      (storage.getLeadByEmail as jest.Mock)
        .mockResolvedValueOnce({ id: 'existing-lead' }) // First call returns existing lead
        .mockResolvedValueOnce(null); // Second call returns null

      (storage.createLead as jest.Mock).mockImplementation((leadData) => 
        Promise.resolve({ id: 'new-lead', ...leadData })
      );

      await LeadImportService.importLeads(req as Request, res as Response);

      expect(storage.createLead).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total: 2,
          successful: 1,
          failed: 1,
          errors: expect.arrayContaining([
            expect.objectContaining({
              row: 2,
              error: 'Duplicate email: existing@example.com'
            })
          ])
        })
      );
    });

    it('should handle numeric fields properly', async () => {
      const csvContent = `email,income,credit_score\ntest@example.com,75000,720`;
      const mockFile = {
        buffer: Buffer.from(csvContent, 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const mappings = [
        { csvColumn: 'email', leadField: 'email' },
        { csvColumn: 'income', leadField: 'income' },
        { csvColumn: 'credit_score', leadField: 'creditScore' }
      ];

      const req = createMockRequest({
        file: mockFile as any,
        body: { mappings: JSON.stringify(mappings) }
      });
      const res = createMockResponse();

      (storage.getLeadByEmail as jest.Mock).mockResolvedValue(null);
      (storage.createLead as jest.Mock).mockImplementation((leadData) => 
        Promise.resolve({ id: 'lead-123', ...leadData })
      );

      await LeadImportService.importLeads(req as Request, res as Response);

      expect(storage.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          income: 75000,
          creditScore: 720
        })
      );
    });

    it('should ignore fields mapped to "ignore"', async () => {
      const csvContent = `email,ignore_field,name\ntest@example.com,ignored_value,John Doe`;
      const mockFile = {
        buffer: Buffer.from(csvContent, 'utf8'),
        originalname: 'test.csv',
        mimetype: 'text/csv',
      };

      const mappings = [
        { csvColumn: 'email', leadField: 'email' },
        { csvColumn: 'ignore_field', leadField: 'ignore' },
        { csvColumn: 'name', leadField: 'firstName' }
      ];

      const req = createMockRequest({
        file: mockFile as any,
        body: { mappings: JSON.stringify(mappings) }
      });
      const res = createMockResponse();

      (storage.getLeadByEmail as jest.Mock).mockResolvedValue(null);
      (storage.createLead as jest.Mock).mockImplementation((leadData) => 
        Promise.resolve({ id: 'lead-123', ...leadData })
      );

      await LeadImportService.importLeads(req as Request, res as Response);

      expect(storage.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John Doe'
        })
      );

      // Should not include ignored field
      const createdLead = (storage.createLead as jest.Mock).mock.calls[0][0];
      expect(createdLead).not.toHaveProperty('ignore_field');
    });
  });

  describe('exportLeads', () => {
    it('should export leads to CSV format', async () => {
      const mockLeads = [
        {
          id: 'lead-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '555-0123',
          status: 'new',
          leadSource: 'website',
          vehicleInterest: 'SUV',
          campaignId: 'campaign-1',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02')
        },
        {
          id: 'lead-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '555-0124',
          status: 'contacted',
          leadSource: 'referral',
          vehicleInterest: 'Sedan',
          campaignId: 'campaign-2',
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-04')
        }
      ];

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      (storage.getLeads as jest.Mock).mockResolvedValue(mockLeads);

      await LeadImportService.exportLeads(req as Request, res as Response);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        expect.stringMatching(/attachment; filename="leads-export-\d{4}-\d{2}-\d{2}\.csv"/)
      );

      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('"john@example.com"')
      );
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('"jane@example.com"')
      );
    });

    it('should filter leads by campaign ID', async () => {
      const mockLeads = [
        { id: 'lead-1', campaignId: 'campaign-1', email: 'test1@example.com' },
        { id: 'lead-2', campaignId: 'campaign-2', email: 'test2@example.com' }
      ];

      const req = createMockRequest({ query: { campaignId: 'campaign-1' } });
      const res = createMockResponse();

      (storage.getLeads as jest.Mock).mockResolvedValue(mockLeads);

      await LeadImportService.exportLeads(req as Request, res as Response);

      // Verify the export only includes filtered results
      const csvContent = (res.send as jest.Mock).mock.calls[0][0];
      expect(csvContent).toContain('test1@example.com');
      expect(csvContent).not.toContain('test2@example.com');
    });

    it('should handle export errors gracefully', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      (storage.getLeads as jest.Mock).mockRejectedValue(new Error('Database error'));

      await LeadImportService.exportLeads(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to export leads'
      });
    });
  });
});