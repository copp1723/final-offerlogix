/**
 * Integration test setup
 * Includes database setup and teardown for tests
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Increase timeout for integration tests
jest.setTimeout(60000);

// Global test database state
let testDbSetup = false;

beforeAll(async () => {
  // Set up test database if needed
  if (!testDbSetup) {
    console.log('Setting up test database...');
    
    // Ensure we're using test database
    if (!process.env.DATABASE_URL?.includes('test')) {
      throw new Error('Integration tests must use a test database. Set DATABASE_URL to a test database.');
    }
    
    testDbSetup = true;
  }
});

afterAll(async () => {
  // Clean up test database connections
  console.log('Cleaning up test database...');
});

beforeEach(async () => {
  // Clean up data before each test
  // Note: Add specific cleanup logic here when database setup is ready
});

afterEach(async () => {
  // Clean up data after each test
  // Note: Add specific cleanup logic here when database setup is ready
});