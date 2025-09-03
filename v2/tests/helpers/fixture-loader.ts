/**
 * Fixture Loader and Processor
 * 
 * Utilities for loading, processing, and signing test fixtures
 * with deterministic results for stable CI testing.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { signFixturePayload, TEST_SIGNING_KEY } from './mailgun-signer';

// ============================================================================
// TYPES
// ============================================================================

export interface LoadedFixture {
  name: string;
  data: any;
  signed: any;
  scenario: string;
}

export interface FixtureCollection {
  [key: string]: LoadedFixture;
}

// ============================================================================
// FIXTURE LOADING
// ============================================================================

/**
 * Load a single fixture file and sign it
 */
export function loadFixture(
  fixturePath: string,
  signingKey: string = TEST_SIGNING_KEY
): LoadedFixture {
  try {
    const fullPath = join(__dirname, '../fixtures/mailgun', fixturePath);
    const rawData = readFileSync(fullPath, 'utf8');
    const data = JSON.parse(rawData);
    
    // Sign the fixture for webhook testing
    const signed = signFixturePayload(data, signingKey);
    
    return {
      name: fixturePath.replace('.json', ''),
      data,
      signed,
      scenario: data.scenario || 'unknown',
    };
  } catch (error) {
    throw new Error(`Failed to load fixture ${fixturePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load all fixtures from the mailgun directory
 */
export function loadAllFixtures(
  signingKey: string = TEST_SIGNING_KEY
): FixtureCollection {
  const fixtures: FixtureCollection = {};
  
  const fixtureFiles = [
    'lead-reply.json',
    'thread-hop-3.json',
    'edge-cases.json',
  ];
  
  for (const file of fixtureFiles) {
    try {
      const fixture = loadFixture(file, signingKey);
      fixtures[fixture.name] = fixture;
    } catch (error) {
      console.warn(`Warning: Could not load fixture ${file}:`, error);
    }
  }
  
  return fixtures;
}

/**
 * Load specific fixture by scenario name
 */
export function loadFixtureByScenario(
  scenario: string,
  signingKey: string = TEST_SIGNING_KEY
): LoadedFixture | null {
  const fixtures = loadAllFixtures(signingKey);
  
  for (const fixture of Object.values(fixtures)) {
    if (fixture.scenario === scenario) {
      return fixture;
    }
  }
  
  return null;
}

// ============================================================================
// FIXTURE VALIDATION
// ============================================================================

/**
 * Validate that a fixture has all required fields
 */
export function validateFixture(fixture: any): boolean {
  const required = [
    'description',
    'scenario',
    'mailgun_payload',
    'expected_normalized',
  ];
  
  for (const field of required) {
    if (!fixture[field]) {
      console.error(`Fixture missing required field: ${field}`);
      return false;
    }
  }
  
  // Validate mailgun_payload has required headers
  const payload = fixture.mailgun_payload;
  const requiredHeaders = ['message-id', 'from', 'to', 'subject'];
  
  for (const header of requiredHeaders) {
    if (!payload[header] && !payload['message-headers']?.find((h: any) => 
      h[0]?.toLowerCase() === header || h.name?.toLowerCase() === header
    )) {
      console.error(`Fixture payload missing required header: ${header}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Validate all loaded fixtures
 */
export function validateAllFixtures(): boolean {
  const fixtures = loadAllFixtures();
  let allValid = true;
  
  for (const [name, fixture] of Object.entries(fixtures)) {
    if (!validateFixture(fixture.data)) {
      console.error(`Invalid fixture: ${name}`);
      allValid = false;
    }
  }
  
  return allValid;
}

// ============================================================================
// FIXTURE UTILITIES
// ============================================================================

/**
 * Get fixture data for a specific test case
 */
export function getTestCase(
  fixtureName: string,
  caseName?: string,
  signingKey: string = TEST_SIGNING_KEY
): any {
  const fixture = loadFixture(`${fixtureName}.json`, signingKey);
  
  if (!caseName) {
    return fixture.signed;
  }
  
  // Handle edge-cases fixture with multiple test cases
  if (fixture.data.cases) {
    const testCase = fixture.data.cases.find((c: any) => c.name === caseName);
    if (!testCase) {
      throw new Error(`Test case ${caseName} not found in fixture ${fixtureName}`);
    }
    return testCase;
  }
  
  return fixture.signed;
}

/**
 * Create a test payload for webhook endpoint testing
 */
export function createTestWebhookPayload(
  scenario: string,
  signingKey: string = TEST_SIGNING_KEY
): any {
  const fixture = loadFixtureByScenario(scenario, signingKey);
  
  if (!fixture) {
    throw new Error(`No fixture found for scenario: ${scenario}`);
  }
  
  return fixture.signed.signed_payload;
}

/**
 * Get expected normalization result for a fixture
 */
export function getExpectedNormalized(
  fixtureName: string,
  caseName?: string
): any {
  const fixture = loadFixture(`${fixtureName}.json`);
  
  if (!caseName) {
    return fixture.data.expected_normalized;
  }
  
  // Handle edge-cases fixture
  if (fixture.data.cases) {
    const testCase = fixture.data.cases.find((c: any) => c.name === caseName);
    return testCase?.expected_normalized;
  }
  
  return fixture.data.expected_normalized;
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export const FIXTURE_SCENARIOS = {
  NEW_THREAD: 'new-thread',
  DEEP_THREAD: 'deep-thread',
  EDGE_CASES: 'edge-cases',
} as const;

export const EDGE_CASE_NAMES = {
  MISSING_IN_REPLY_TO: 'missing-in-reply-to',
  MIXED_CASE_HEADERS: 'mixed-case-headers',
  LONG_REFERENCES_CHAIN: 'long-references-chain',
  COMMA_SEPARATED_REFERENCES: 'comma-separated-references',
  PLAIN_EMAIL_ADDRESSES: 'plain-email-addresses',
} as const;
