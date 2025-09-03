import express from 'express';
import { registerRoutes } from '../../server/routes';

// Build an Express app instance for tests
export async function makeApp() {
  const app = express();
  app.use(express.json());
  await registerRoutes(app);
  return app;
}