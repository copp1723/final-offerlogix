/**
 * Jest Test Setup for V2 Services
 * 
 * Global test configuration and setup for MailMind V2 services.
 */

/// <reference types="jest" />

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Mock console methods to reduce noise, but keep errors visible
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // Keep console.error visible for debugging
});

afterEach(() => {
  // Restore console methods after each test
  jest.restoreAllMocks();
});

// Global test environment setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/mailmind_test';
  process.env.MAILGUN_SIGNING_KEY = process.env.MAILGUN_SIGNING_KEY || 'test-mailgun-signing-key-for-v2-testing';
});

// Global cleanup
afterAll(() => {
  // Restore original console
  Object.assign(console, originalConsole);
});
