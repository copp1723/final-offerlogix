import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { registerRoutes } from "./server/routes";
import { setupVite, serveStatic } from "./server/vite";

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Register API routes
registerRoutes(app);

// Setup Vite for development
const server = app.listen(4000, '0.0.0.0', async () => {
  console.log('🚀 Development server started on http://localhost:4000');
  
  // Setup Vite in development
  if (process.env.NODE_ENV === 'development') {
    try {
      await setupVite(app, server);
      console.log('✅ Vite development server configured');
    } catch (error) {
      console.error('❌ Vite setup failed:', error);
    }
  } else {
    serveStatic(app);
  }
  
  console.log('✅ Server ready for requests');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
