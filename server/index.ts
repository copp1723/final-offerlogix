// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log as viteLog } from "./vite";

// Import comprehensive security middleware
import { 
  applyComprehensiveSecurity, 
  setupSecurityEndpoints, 
  setupSecurityTestEndpoints,
  startSecurityCleanupTasks,
  securityErrorHandler
} from "./middleware";

// Import structured logging
import {
  log,
  correlationMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  securityLoggingMiddleware
} from "./logging";

// Import Supermemory integration
import { isRAGEnabled } from "./integrations/supermemory";

export async function createExpressApp() {
  const app = express();

  app.use(correlationMiddleware);
  app.use(securityLoggingMiddleware);
  applyComprehensiveSecurity(app);
  app.use(requestLoggingMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  await registerRoutes(app);
  return app;
}

const app = express();

// Behind proxies/load balancers (Render/Cloudflare), enable trust proxy so
// express-rate-limit can correctly use X-Forwarded-For without errors
// and for accurate IP detection/logging.
app.set('trust proxy', 1);

// Initialize structured logging with correlation ID tracking
app.use(correlationMiddleware);
app.use(securityLoggingMiddleware);

// Apply comprehensive security middleware FIRST
applyComprehensiveSecurity(app);

// Enhanced request logging middleware
app.use(requestLoggingMiddleware);

// Body parsing middleware (after security middleware)
const apiBodyLimit = process.env.API_BODY_LIMIT || '1mb';
const webhookBodyLimit = process.env.WEBHOOK_BODY_LIMIT || '256kb';
app.use('/api/webhooks', express.json({ limit: webhookBodyLimit }));
app.use(express.json({ limit: apiBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: apiBodyLimit }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      // Use structured logging instead of basic log
      const requestLogger = log.fromRequest(req);
      requestLogger.api('API request completed (legacy)', {
        endpoint: path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: duration,
        response: capturedJsonResponse ? JSON.stringify(capturedJsonResponse).slice(0, 200) : undefined
      });
      
      // Keep viteLog for backward compatibility in development
      if (process.env.NODE_ENV === 'development') {
        viteLog(logLine);
      }
    }
  });

  next();
});

console.log('JEST_WORKER_ID check:', process.env.JEST_WORKER_ID);
if (!process.env.JEST_WORKER_ID) {
  console.log('Starting server initialization...');
  (async () => {
  try {
    console.log('Calling registerRoutes...');
    const server = await registerRoutes(app);

  // Setup security endpoints and monitoring
  setupSecurityEndpoints(app);
  setupSecurityTestEndpoints(app);

  // Security error handler (must be after routes)
  app.use(securityErrorHandler);
  
  // Add structured error logging middleware
  app.use(errorLoggingMiddleware);

  // General error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log security-relevant errors with structured logging
    const requestLogger = log.fromRequest(_req);
    if (status === 401 || status === 403 || status === 429) {
      requestLogger.security(`Security error ${status}`, {
        eventType: status === 401 ? 'auth_failure' : status === 403 ? 'access_denied' : 'rate_limit_exceeded',
        severity: 'medium',
        sourceIp: _req.ip || 'unknown',
        statusCode: status,
        message,
        path: _req.path,
        method: _req.method
      });
    } else {
      // Log other errors
      requestLogger.error('Application error', {
        error: err,
        statusCode: status,
        path: _req.path,
        method: _req.method,
        severity: status >= 500 ? 'high' : 'medium'
      });
    }

    res.status(status).json({ message });
    
    // Don't throw in production
    if (process.env.NODE_ENV !== 'production') {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5050', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    // Use structured logging for server startup
    log.info('🚀 Server started successfully', {
      component: 'server',
      operation: 'startup',
      port,
      host: '0.0.0.0',
      environment: process.env.NODE_ENV,
      reusePort: true
    });
    
    log.info('🔒 Security middleware activated', {
      component: 'security',
      operation: 'middleware_init',
      mode: process.env.NODE_ENV
    });
    
    // Start security cleanup tasks
    startSecurityCleanupTasks();

    // Validate Supermemory configuration
    if (isRAGEnabled()) {
      log.info('✅ Supermemory integration enabled', {
        component: 'supermemory',
        operation: 'validation',
        status: 'enabled'
      });
    } else {
      log.warn('⚠️  Supermemory integration disabled - no API key configured', {
        component: 'supermemory',
        operation: 'validation',
        status: 'disabled',
        note: 'Run `node scripts/setup-supermemory.js` to configure'
      });
    }

    // Initialize system services
    try {
      const { initializeSystem } = await import('./services/system-initializer.js');
      await initializeSystem(server);
      log.info('✅ System services initialized successfully', {
        component: 'system',
        operation: 'service_init'
      });
    } catch (error) {
      log.error('❌ Failed to initialize system services', {
        component: 'system',
        operation: 'service_init_failed',
        error: error as Error,
        severity: 'critical'
      });
    }

    // Initialize V2 Campaign Scheduler
    try {
      const { v2CampaignScheduler } = await import('./services/v2-campaign-scheduler.js');
      v2CampaignScheduler.start();
      log.info('✅ V2 Campaign scheduler initialized', {
        component: 'v2-campaigns',
        operation: 'scheduler_init',
        status: v2CampaignScheduler.getStatus()
      });
    } catch (error) {
      log.error('❌ Failed to initialize V2 campaign scheduler', {
        component: 'v2-campaigns',
        operation: 'scheduler_init_failed',
        error: error as Error
      });
    }

    log.info('✅ Server ready for requests', {
      component: 'system',
      operation: 'ready'
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info(`🛑 Received ${signal}, shutting down gracefully`, {
      component: 'server',
      operation: 'shutdown',
      signal
    });
    
    server.close(() => {
      log.info('✅ Server closed successfully', {
        component: 'server',
        operation: 'shutdown_complete'
      });
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Fatal server initialization error:', error);
    process.exit(1);
  }
  })();
} else {
  console.log('Skipping server start due to JEST_WORKER_ID being set');
}
