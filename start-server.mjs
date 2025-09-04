#!/usr/bin/env node

// OfferLogix Development Server Starter
// This script ensures environment variables are loaded before starting the server

import dotenv from 'dotenv';
import { spawn } from 'child_process';

// Load .env file exactly like the working test-env.ts
console.log('🔍 Loading environment variables...');
const result = dotenv.config();

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
  process.exit(1);
} else {
  console.log('✅ .env file loaded successfully');
}

// Verify critical variables are loaded
const requiredVars = [
  'DATABASE_URL', 'APP_URL', 'CLIENT_URL', 'MAILGUN_API_KEY', 
  'OPENROUTER_API_KEY', 'SESSION_SECRET'
];

let allLoaded = true;
for (const varName of requiredVars) {
  const isLoaded = !!process.env[varName];
  console.log(`${varName}: ${isLoaded ? '✅ Set' : '❌ Missing'}`);
  if (!isLoaded) allLoaded = false;
}

if (!allLoaded) {
  console.error('\n❌ Some required environment variables are missing');
  process.exit(1);
}

console.log('\n🚀 Starting OfferLogix server...');

// Start the server process with the loaded environment
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd()
});

serverProcess.on('close', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});