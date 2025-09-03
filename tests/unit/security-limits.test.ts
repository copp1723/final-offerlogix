import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

describe('Security limits', () => {
  it('should return 413 when payload exceeds limit', async () => {
    const app = express();
    app.use(express.json({ limit: '100b' }));
    app.post('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app)
      .post('/test')
      .send({ data: 'a'.repeat(200) });

    expect(res.status).toBe(413);
  });

  it('should return 429 when rate limit exceeded', async () => {
    const app = express();
    const limiter = rateLimit({ windowMs: 1000, max: 1 });
    app.post('/test', limiter, (req, res) => res.json({ ok: true }));

    await request(app).post('/test').send({});
    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(429);
  });
});