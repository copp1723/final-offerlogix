import express from 'express';
import request from 'supertest';
import { securityLogging, securityLogger, SecurityEventType } from '../../server/middleware/security-logging';

describe('Security logging middleware', () => {
  beforeEach(() => {
    // Clear logs before each test
    (securityLogger as any).logs = [];
  });

  it('logs server errors with SERVER_ERROR event type and medium severity', async () => {
    const app = express();
    app.use(securityLogging);
    app.get('/error', (_req, res) => res.status(500).json({ error: 'Internal server error' }));

    await request(app).get('/error');

    const logs = securityLogger.getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(SecurityEventType.SERVER_ERROR);
    expect(logs[0].severity).toBe('medium');
    expect(logs[0].statusCode).toBe(500);
    expect(logs[0].details.hasError).toBe(true);
  });

  it('logs client errors with API_KEY_USAGE event type and low severity', async () => {
    const app = express();
    app.use(securityLogging);
    app.get('/bad-request', (_req, res) => res.status(400).json({ error: 'Bad request' }));

    await request(app).get('/bad-request');

    const logs = securityLogger.getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(SecurityEventType.API_KEY_USAGE);
    expect(logs[0].severity).toBe('low');
    expect(logs[0].statusCode).toBe(400);
  });

  it('logs different 5xx status codes as SERVER_ERROR', async () => {
    const app = express();
    app.use(securityLogging);
    app.get('/502', (_req, res) => res.status(502).json({ error: 'Bad gateway' }));
    app.get('/503', (_req, res) => res.status(503).json({ error: 'Service unavailable' }));

    await request(app).get('/502');
    await request(app).get('/503');

    const logs = securityLogger.getRecentLogs();
    expect(logs).toHaveLength(2);
    
    expect(logs[0].eventType).toBe(SecurityEventType.SERVER_ERROR);
    expect(logs[0].severity).toBe('medium');
    expect(logs[0].statusCode).toBe(502);
    
    expect(logs[1].eventType).toBe(SecurityEventType.SERVER_ERROR);
    expect(logs[1].severity).toBe('medium');
    expect(logs[1].statusCode).toBe(503);
  });

  it('does not log successful responses on non-sensitive endpoints', async () => {
    const app = express();
    app.use(securityLogging);
    app.get('/success', (_req, res) => res.status(200).json({ message: 'Success' }));

    await request(app).get('/success');

    const logs = securityLogger.getRecentLogs();
    // Should not log successful requests on non-sensitive endpoints
    expect(logs).toHaveLength(0);
  });

  it('captures response time and error details', async () => {
    const app = express();
    app.use(securityLogging);
    app.get('/timeout-error', (_req, res) => {
      setTimeout(() => {
        res.status(500).json({ error: 'Request timeout', code: 'TIMEOUT' });
      }, 10);
    });

    await request(app).get('/timeout-error');

    const logs = securityLogger.getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].details.responseTime).toBeGreaterThan(0);
    expect(logs[0].details.errorMessage).toBe('Request timeout');
    expect(logs[0].details.hasError).toBe(true);
  });
});