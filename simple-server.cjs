// Simple server startup script for testing
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'MailMind server is running',
    port: port
  });
});

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'operational',
    services: {
      server: 'running',
      database: 'checking...',
      redis: 'checking...'
    }
  });
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to MailMind',
    status: 'running',
    endpoints: ['/health', '/api/status']
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 MailMind server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API status: http://localhost:${port}/api/status`);
});