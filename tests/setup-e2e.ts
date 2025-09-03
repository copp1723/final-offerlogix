/**
 * End-to-end test setup
 * Includes browser automation and full system setup
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Increase timeout for E2E tests
jest.setTimeout(120000);

// Global E2E test state
let e2eSetup = false;

beforeAll(async () => {
  if (!e2eSetup) {
    console.log('Setting up E2E test environment...');
    
    // Ensure we're using test environment
    if (process.env.NODE_ENV !== 'test') {
      process.env.NODE_ENV = 'test';
    }
    
    e2eSetup = true;
  }
});

afterAll(async () => {
  console.log('Cleaning up E2E test environment...');
});

beforeEach(async () => {
  // Reset test data before each E2E test
});

afterEach(async () => {
  // Clean up after each E2E test
});