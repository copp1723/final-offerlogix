import { emailSendSchema, emailValidationSchema, emailContentSchema } from '../../server/routes/email-schemas';

describe('email validation schemas', () => {
  describe('emailSendSchema', () => {
    it('accepts valid email data', () => {
      const validData = {
        to: 'user@example.com',
        subject: 'Test Subject',
        htmlContent: '<p>Hello World</p>'
      };
      
      expect(() => emailSendSchema.parse(validData)).not.toThrow();
    });

    it('accepts optional fields', () => {
      const validData = {
        to: 'user@example.com',
        subject: 'Test Subject',
        htmlContent: '<p>Hello World</p>',
        textContent: 'Hello World',
        fromName: 'John Doe',
        fromEmail: 'john@example.com'
      };
      
      expect(() => emailSendSchema.parse(validData)).not.toThrow();
    });

    it('rejects invalid recipient email', () => {
      const invalidData = {
        to: 'not-an-email',
        subject: 'Hello',
        htmlContent: '<p>Hi</p>'
      };
      
      expect(() => emailSendSchema.parse(invalidData)).toThrow();
    });

    it('rejects invalid sender email', () => {
      const invalidData = {
        to: 'user@example.com',
        subject: 'Hello',
        htmlContent: '<p>Hi</p>',
        fromEmail: 'bad-email'
      };
      
      expect(() => emailSendSchema.parse(invalidData)).toThrow();
    });

    it('rejects missing required fields', () => {
      const invalidData = {
        to: 'user@example.com',
        subject: ''
      };
      
      expect(() => emailSendSchema.parse(invalidData)).toThrow();
    });
  });

  describe('emailValidationSchema', () => {
    it('accepts valid email array', () => {
      const validData = {
        emails: ['user1@example.com', 'user2@example.com']
      };
      
      expect(() => emailValidationSchema.parse(validData)).not.toThrow();
    });

    it('rejects invalid email in list', () => {
      const invalidData = {
        emails: ['valid@example.com', 'bad-email']
      };
      
      expect(() => emailValidationSchema.parse(invalidData)).toThrow();
    });

    it('rejects empty email array', () => {
      const invalidData = {
        emails: []
      };
      
      expect(() => emailValidationSchema.parse(invalidData)).toThrow();
    });
  });

  describe('emailContentSchema', () => {
    it('accepts valid content data', () => {
      const validData = {
        to: 'user@example.com',
        subject: 'Test Subject',
        htmlContent: '<p>Hello World</p>'
      };
      
      expect(() => emailContentSchema.parse(validData)).not.toThrow();
    });

    it('rejects invalid email in content validation', () => {
      const invalidData = {
        to: 'not-an-email',
        subject: 'Test Subject',
        htmlContent: '<p>Hello World</p>'
      };
      
      expect(() => emailContentSchema.parse(invalidData)).toThrow();
    });
  });
});