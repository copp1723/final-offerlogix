import express from 'express';
import { inboundRouter } from './inbound.js';
import { outboundRouter } from './outbound.js';
import conversationsRouter from './conversations.js';
import campaignsRouter from './campaigns.js';
import handoversRouter from './handovers.js';
import agentsRouter from './agents.js';
import healthRouter from './health.js';

export function buildV2Router() {
  const router = express.Router();
  router.use('/inbound', inboundRouter);
  router.use('/outbound', outboundRouter);
  router.use('/conversations', conversationsRouter);
  router.use('/campaigns', campaignsRouter);
  router.use('/handovers', handoversRouter);
  router.use('/agents', agentsRouter);
  router.use('/health', healthRouter);
  return router;
}
