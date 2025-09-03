import request from 'supertest';
import { Express } from 'express';
import { createServer } from '../../server/index';

jest.mock('../../server/services/mailgun', () => ({
  sendCampaignEmail: jest.fn().mockResolvedValue({ success: true }),
  validateEmailAddresses: jest.fn().mockResolvedValue({ valid: [], invalid: [] }),
}));

jest.mock('../../server/middleware/html-sanitizer', () => ({
  validateTemplateHtml: jest.fn().mockReturnValue(true),
}));

describe('Email API Validation', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    process.env.SKIP_AUTH = 'true';
    process.env.NODE_ENV = 'test';
    server = await createServer();
    app = server.app;
  });

  afterAll(async () => {
    if (server?.close) {
      await server.close();
    }
    delete process.env.SKIP_AUTH;
    delete process.env.NODE_ENV;
  });

  describe('POST /api/email/send', () => {
    it('rejects invalid recipient email', async () => {
      const res = await request(app)
        .post('/api/email/send')
        .send({ 
          to: 'invalid-email', 
          subject: 'Test', 
          htmlContent: '<p>hi</p>' 
        })
        .expect(400);

      expect(res.body.message).toBe('Invalid email data');
      expect(res.body.errors).toBeDefined();
    });

    it('rejects invalid sender email', async () => {
      const res = await request(app)
        .post('/api/email/send')
        .send({ 
          to: 'user@example.com', 
          subject: 'Test', 
          htmlContent: '<p>hi</p>', 
          fromEmail: 'bad-email' 
        })
        .expect(400);

      expect(res.body.message).toBe('Invalid email data');
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/email/send')
        .send({ 
          to: 'user@example.com',
          subject: '',
          htmlContent: '<p>hi</p>'
        })
        .expect(400);

      expect(res.body.message).toBe('Invalid email data');
    });

    it('accepts valid email data', async () => {
      const res = await request(app)
        .post('/api/email/send')
        .send({ 
          to: 'user@example.com', 
          subject: 'Test Subject', 
          htmlContent: '<p>Hello World</p>' 
        })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('accepts valid email with optional fields', async () => {
      const res = await request(app)
        .post('/api/email/send')
        .send({ 
          to: 'user@example.com', 
          subject: 'Test Subject', 
          htmlContent: '<p>Hello World</p>',
          fromName: 'John Doe',
          fromEmail: 'john@example.com'
        })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/email/validate', () => {
    it('rejects invalid email addresses', async () => {
      const res = await request(app)
        .post('/api/email/validate')
        .send({ 
          emails: ['valid@example.com', 'bad-email']
        })
        .expect(400);

      expect(res.body.message).toBe('Invalid email addresses');
    });

    it('rejects empty email array', async () => {
      const res = await request(app)
        .post('/api/email/validate')
        .send({ 
          emails: []
        })
        .expect(400);

      expect(res.body.message).toBe('Invalid email addresses');
    });

    it('accepts valid email addresses', async () => {
      const res = await request(app)
        .post('/api/email/validate')
        .send({ 
          emails: ['user1@example.com', 'user2@example.com']
        })
        .expect(200);

      expect(res.body).toHaveProperty('valid');
      expect(res.body).toHaveProperty('invalid');
    });
  });

  describe('POST /api/email/validate-content', () => {
    it('rejects invalid email in content validation', async () => {
      const res = await request(app)
        .post('/api/email/validate-content')
        .send({ 
          to: 'not-an-email',
          subject: 'Test',
          htmlContent: '<p>Hello</p>'
        })
        .expect(400);

      expect(res.body.message).toBe('Invalid email data');
    });

    it('accepts valid content data', async () => {
      // Mock the EnhancedEmailValidator
      jest.doMock('../../server/services/enhanced-email-validator', () => ({
        EnhancedEmailValidator: {
          validateEmailContent: jest.fn().mockReturnValue({ valid: true, issues: [] })
        }
      }));

      const res = await request(app)
        .post('/api/email/validate-content')
        .send({ 
          to: 'user@example.com',
          subject: 'Test Subject',
          htmlContent: '<p>Hello World</p>'
        })
        .expect(200);

      expect(res.body).toHaveProperty('valid');
    });
  });
});