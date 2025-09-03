import { requireApiKey } from '../../server/middleware/api-key-auth';
import { Request, Response, NextFunction } from 'express';

// Mock the database and logging
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../../server/middleware/security-logging', () => ({
  logApiKeyUsage: jest.fn(),
  logAuthEvent: jest.fn(),
  SecurityEventType: {
    API_KEY_INVALID: 'API_KEY_INVALID',
    API_KEY_MISSING: 'API_KEY_MISSING'
  }
}));

describe('API key auth middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1',
      path: '/api/test'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  it('responds with 401 when no API key provided', async () => {
    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'API key required',
      code: 'API_KEY_MISSING'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds with 401 when invalid API key provided', async () => {
    req.headers = { authorization: 'Bearer invalid-key' };
    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds with 401 when API key header is malformed', async () => {
    req.headers = { authorization: 'InvalidFormat' };
    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});