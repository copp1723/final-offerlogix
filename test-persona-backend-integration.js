#!/usr/bin/env node

/**
 * PERSONA SELECTOR BACKEND INTEGRATION TEST SUITE
 * 
 * Comprehensive testing script for verifying backend integration
 * of the persona selector implementation in OfferLogix.
 * 
 * This script validates:
 * 1. API Endpoint Functionality (/api/personas, /api/campaigns)
 * 2. Database Schema & Foreign Key Constraints  
 * 3. Campaign-Persona Association Storage
 * 4. AI Response Differentiation
 * 5. End-to-End Workflow Testing
 * 6. Error Handling & Edge Cases
 */

const axios = require('axios').default;
const { Pool } = require('pg');

// Configuration
const config = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:5000',
  databaseURL: process.env.DATABASE_URL,
  clientId: process.env.TEST_CLIENT_ID || 'default',
  timeout: 10000, // 10 seconds
  retries: 3
};

// Test data
const testPersonas = {
  creditSolutions: {
    name: 'Credit Solutions AI',
    targetAudience: 'automotive dealers',
    industry: 'automotive',
    tonality: 'technical',
    personality: 'Professional and knowledgeable about financing solutions',
    communicationStyle: 'direct',
    model: 'openai/gpt-4o',
    temperature: 50,
    maxTokens: 300,
    systemPrompt: 'You are a Credit Solutions AI assistant specializing in automotive financing.',
    isActive: true,
    metadata: { category: 'dealer_focused' }
  },
  paymentsAI: {
    name: 'Payments AI',
    targetAudience: 'payment vendors',
    industry: 'automotive',
    tonality: 'consultative',
    personality: 'Business-focused and consultative about payment solutions',
    communicationStyle: 'consultative',
    model: 'openai/gpt-4o',
    temperature: 60,
    maxTokens: 350,
    systemPrompt: 'You are a Payments AI assistant specializing in vendor payment solutions.',
    isActive: true,
    metadata: { category: 'vendor_focused' }
  }
};

const testCampaigns = [
  {
    name: 'Credit Solutions Campaign Test',
    context: 'Testing campaign for Credit Solutions persona',
    targetAudience: 'automotive dealers',
    numberOfTemplates: 3,
    daysBetweenMessages: 2
  },
  {
    name: 'Payments Vendor Campaign Test', 
    context: 'Testing campaign for Payments AI persona',
    targetAudience: 'payment vendors',
    numberOfTemplates: 3,
    daysBetweenMessages: 2
  }
];

// Test Results Storage
const testResults = {
  apiTests: {},
  databaseTests: {},
  integrationTests: {},
  aiResponseTests: {},
  errorHandlingTests: {},
  summary: {
    passed: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date(),
    endTime: null
  }
};

// Utility Functions
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`✅ [SUCCESS] ${msg}`),
  error: (msg) => console.log(`❌ [ERROR] ${msg}`),
  warning: (msg) => console.log(`⚠️ [WARNING] ${msg}`),
  test: (msg) => console.log(`🧪 [TEST] ${msg}`)
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  const url = `${config.baseURL}${endpoint}`;
  const requestConfig = {
    method,
    url,
    timeout: config.timeout,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': config.clientId,
      ...headers
    }
  };
  
  if (data) {
    requestConfig.data = data;
  }
  
  for (let attempt = 1; attempt <= config.retries; attempt++) {
    try {
      logger.info(`${method.toUpperCase()} ${endpoint} (attempt ${attempt}/${config.retries})`);
      const response = await axios(requestConfig);
      return response;
    } catch (error) {
      if (attempt === config.retries) {
        throw error;
      }
      logger.warning(`Request failed, retrying in 2s... (${error.message})`);
      await sleep(2000);
    }
  }
};

// Database connection
let dbPool;
const connectDatabase = async () => {
  if (!config.databaseURL) {
    logger.warning('DATABASE_URL not provided, skipping database tests');
    return null;
  }
  
  try {
    dbPool = new Pool({ connectionString: config.databaseURL });
    await dbPool.query('SELECT 1'); // Test connection
    logger.success('Database connection established');
    return dbPool;
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    return null;
  }
};

// Test Functions

/**
 * 1. API ENDPOINT TESTS
 */
const testPersonasEndpoint = async () => {
  logger.test('Testing /api/personas endpoint...');
  
  try {
    // Test GET /api/personas
    const response = await makeRequest('GET', '/api/personas');
    testResults.apiTests.getPersonas = {
      passed: response.status === 200 && Array.isArray(response.data.data),
      status: response.status,
      dataStructure: response.data,
      timestamp: new Date()
    };
    
    if (testResults.apiTests.getPersonas.passed) {
      logger.success(`GET /api/personas - Status: ${response.status}, Count: ${response.data.total}`);
    } else {
      logger.error(`GET /api/personas failed - Status: ${response.status}`);
    }
    
    // Test with query parameters  
    const filteredResponse = await makeRequest('GET', '/api/personas?isActive=true&includeKnowledgeBases=true');
    testResults.apiTests.getPersonasFiltered = {
      passed: filteredResponse.status === 200,
      status: filteredResponse.status,
      hasActiveFilter: filteredResponse.data.data.every(p => p.isActive),
      timestamp: new Date()
    };
    
    if (testResults.apiTests.getPersonasFiltered.passed) {
      logger.success(`GET /api/personas with filters - Status: ${filteredResponse.status}`);
    }
    
  } catch (error) {
    logger.error(`Personas endpoint test failed: ${error.message}`);
    testResults.apiTests.getPersonas = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

const testCreatePersona = async () => {
  logger.test('Testing persona creation...');
  
  try {
    // Create Credit Solutions persona
    const creditResponse = await makeRequest('POST', '/api/personas', testPersonas.creditSolutions);
    testResults.apiTests.createCreditPersona = {
      passed: creditResponse.status === 201,
      status: creditResponse.status,
      personaId: creditResponse.data.data?.id,
      timestamp: new Date()
    };
    
    if (testResults.apiTests.createCreditPersona.passed) {
      logger.success(`Created Credit Solutions persona - ID: ${creditResponse.data.data.id}`);
      testPersonas.creditSolutions.id = creditResponse.data.data.id;
    }
    
    // Create Payments AI persona  
    const paymentsResponse = await makeRequest('POST', '/api/personas', testPersonas.paymentsAI);
    testResults.apiTests.createPaymentsPersona = {
      passed: paymentsResponse.status === 201,
      status: paymentsResponse.status,
      personaId: paymentsResponse.data.data?.id,
      timestamp: new Date()
    };
    
    if (testResults.apiTests.createPaymentsPersona.passed) {
      logger.success(`Created Payments AI persona - ID: ${paymentsResponse.data.data.id}`);
      testPersonas.paymentsAI.id = paymentsResponse.data.data.id;
    }
    
  } catch (error) {
    logger.error(`Create persona test failed: ${error.message}`);
    testResults.apiTests.createPersona = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

const testCampaignCreationWithPersona = async () => {
  logger.test('Testing campaign creation with persona assignment...');
  
  if (!testPersonas.creditSolutions.id || !testPersonas.paymentsAI.id) {
    logger.error('Personas not created, skipping campaign tests');
    testResults.apiTests.createCampaignWithPersona = { passed: false, error: 'Prerequisites not met' };
    return;
  }
  
  try {
    // Create campaign with Credit Solutions persona
    const creditCampaignData = {
      ...testCampaigns[0],
      personaId: testPersonas.creditSolutions.id
    };
    
    const creditCampaignResponse = await makeRequest('POST', '/api/campaigns', creditCampaignData);
    testResults.apiTests.createCreditCampaign = {
      passed: creditCampaignResponse.status === 200,
      status: creditCampaignResponse.status,
      campaignId: creditCampaignResponse.data?.id,
      personaAssigned: creditCampaignResponse.data?.personaId === testPersonas.creditSolutions.id,
      timestamp: new Date()
    };
    
    if (testResults.apiTests.createCreditCampaign.passed) {
      logger.success(`Created campaign with Credit Solutions persona - ID: ${creditCampaignResponse.data.id}`);
      testCampaigns[0].id = creditCampaignResponse.data.id;
    }
    
    // Create campaign with Payments AI persona
    const paymentsCampaignData = {
      ...testCampaigns[1],
      personaId: testPersonas.paymentsAI.id
    };
    
    const paymentsCampaignResponse = await makeRequest('POST', '/api/campaigns', paymentsCampaignData);
    testResults.apiTests.createPaymentsCampaign = {
      passed: paymentsCampaignResponse.status === 200,
      status: paymentsCampaignResponse.status,
      campaignId: paymentsCampaignResponse.data?.id,
      personaAssigned: paymentsCampaignResponse.data?.personaId === testPersonas.paymentsAI.id,
      timestamp: new Date()
    };
    
    if (testResults.apiTests.createPaymentsCampaign.passed) {
      logger.success(`Created campaign with Payments AI persona - ID: ${paymentsCampaignResponse.data.id}`);
      testCampaigns[1].id = paymentsCampaignResponse.data.id;
    }
    
  } catch (error) {
    logger.error(`Campaign creation test failed: ${error.message}`);
    testResults.apiTests.createCampaignWithPersona = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * 2. DATABASE INTEGRATION TESTS
 */
const testDatabaseSchema = async () => {
  logger.test('Testing database schema and constraints...');
  
  if (!dbPool) {
    testResults.databaseTests.schema = { passed: false, error: 'Database not available' };
    return;
  }
  
  try {
    // Check campaigns table has persona_id column
    const campaignSchemaQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'persona_id'
    `;
    const campaignResult = await dbPool.query(campaignSchemaQuery);
    
    testResults.databaseTests.campaignPersonaIdColumn = {
      passed: campaignResult.rows.length > 0,
      columnExists: campaignResult.rows.length > 0,
      columnInfo: campaignResult.rows[0],
      timestamp: new Date()
    };
    
    // Check foreign key constraint
    const fkQuery = `
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'campaigns'
        AND kcu.column_name = 'persona_id'
    `;
    const fkResult = await dbPool.query(fkQuery);
    
    testResults.databaseTests.foreignKeyConstraint = {
      passed: fkResult.rows.length > 0,
      constraintExists: fkResult.rows.length > 0,
      constraintInfo: fkResult.rows[0],
      timestamp: new Date()
    };
    
    if (testResults.databaseTests.campaignPersonaIdColumn.passed) {
      logger.success('campaigns.persona_id column exists');
    }
    
    if (testResults.databaseTests.foreignKeyConstraint.passed) {
      logger.success('Foreign key constraint to ai_personas table exists');
    }
    
  } catch (error) {
    logger.error(`Database schema test failed: ${error.message}`);
    testResults.databaseTests.schema = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

const testCampaignPersonaAssociation = async () => {
  logger.test('Testing campaign-persona associations in database...');
  
  if (!dbPool || !testCampaigns[0].id || !testCampaigns[1].id) {
    testResults.databaseTests.campaignPersonaAssociation = { passed: false, error: 'Prerequisites not met' };
    return;
  }
  
  try {
    // Query campaigns with persona information
    const query = `
      SELECT 
        c.id as campaign_id,
        c.name as campaign_name,
        c.persona_id,
        p.name as persona_name,
        p.target_audience,
        p.tonality
      FROM campaigns c
      LEFT JOIN ai_personas p ON c.persona_id = p.id
      WHERE c.id IN ($1, $2)
      ORDER BY c.created_at DESC
    `;
    
    const result = await dbPool.query(query, [testCampaigns[0].id, testCampaigns[1].id]);
    
    testResults.databaseTests.campaignPersonaAssociation = {
      passed: result.rows.length === 2 && result.rows.every(row => row.persona_id && row.persona_name),
      campaignCount: result.rows.length,
      associatedCampaigns: result.rows.filter(row => row.persona_id).length,
      campaignData: result.rows,
      timestamp: new Date()
    };
    
    if (testResults.databaseTests.campaignPersonaAssociation.passed) {
      logger.success(`Campaign-persona associations verified: ${result.rows.length} campaigns with personas`);
      result.rows.forEach(row => {
        logger.info(`Campaign "${row.campaign_name}" → Persona "${row.persona_name}" (${row.tonality})`);
      });
    }
    
  } catch (error) {
    logger.error(`Campaign-persona association test failed: ${error.message}`);
    testResults.databaseTests.campaignPersonaAssociation = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * 3. AI RESPONSE DIFFERENTIATION TESTS  
 */
const testPersonaSystemPrompts = async () => {
  logger.test('Testing persona system prompt generation...');
  
  if (!testPersonas.creditSolutions.id || !testPersonas.paymentsAI.id) {
    testResults.aiResponseTests.systemPrompts = { passed: false, error: 'Prerequisites not met' };
    return;
  }
  
  try {
    // Get Credit Solutions system prompt
    const creditPromptResponse = await makeRequest('GET', 
      `/api/personas/${testPersonas.creditSolutions.id}/system-prompt?targetAudience=dealers&campaignContext=financing`
    );
    
    // Get Payments AI system prompt
    const paymentsPromptResponse = await makeRequest('GET',
      `/api/personas/${testPersonas.paymentsAI.id}/system-prompt?targetAudience=vendors&campaignContext=payments`
    );
    
    testResults.aiResponseTests.systemPrompts = {
      passed: creditPromptResponse.status === 200 && paymentsPromptResponse.status === 200,
      creditPrompt: creditPromptResponse.data?.data?.systemPrompt,
      paymentsPrompt: paymentsPromptResponse.data?.data?.systemPrompt,
      promptsDifferent: creditPromptResponse.data?.data?.systemPrompt !== paymentsPromptResponse.data?.data?.systemPrompt,
      timestamp: new Date()
    };
    
    if (testResults.aiResponseTests.systemPrompts.passed) {
      logger.success('System prompts generated successfully for both personas');
      logger.info(`Credit Solutions prompt length: ${testResults.aiResponseTests.systemPrompts.creditPrompt?.length || 0}`);
      logger.info(`Payments AI prompt length: ${testResults.aiResponseTests.systemPrompts.paymentsPrompt?.length || 0}`);
      logger.info(`Prompts are different: ${testResults.aiResponseTests.systemPrompts.promptsDifferent}`);
    }
    
  } catch (error) {
    logger.error(`System prompt test failed: ${error.message}`);
    testResults.aiResponseTests.systemPrompts = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * 4. ERROR HANDLING TESTS
 */
const testErrorHandling = async () => {
  logger.test('Testing error handling scenarios...');
  
  try {
    // Test invalid persona ID in campaign creation
    const invalidPersonaCampaign = {
      ...testCampaigns[0],
      personaId: 'invalid-uuid'
    };
    
    try {
      await makeRequest('POST', '/api/campaigns', invalidPersonaCampaign);
      testResults.errorHandlingTests.invalidPersonaId = {
        passed: false,
        error: 'Expected validation error but request succeeded',
        timestamp: new Date()
      };
    } catch (error) {
      testResults.errorHandlingTests.invalidPersonaId = {
        passed: error.response?.status >= 400 && error.response?.status < 500,
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        timestamp: new Date()
      };
    }
    
    // Test non-existent persona ID
    const nonExistentPersonaId = '550e8400-e29b-41d4-a716-446655440000';
    try {
      await makeRequest('GET', `/api/personas/${nonExistentPersonaId}`);
      testResults.errorHandlingTests.nonExistentPersona = {
        passed: false,
        error: 'Expected 404 error but request succeeded',
        timestamp: new Date()
      };
    } catch (error) {
      testResults.errorHandlingTests.nonExistentPersona = {
        passed: error.response?.status === 404,
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        timestamp: new Date()
      };
    }
    
    if (testResults.errorHandlingTests.invalidPersonaId.passed) {
      logger.success('Invalid persona ID properly rejected');
    }
    
    if (testResults.errorHandlingTests.nonExistentPersona.passed) {
      logger.success('Non-existent persona properly returns 404');
    }
    
  } catch (error) {
    logger.error(`Error handling test failed: ${error.message}`);
    testResults.errorHandlingTests.general = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * 5. END-TO-END WORKFLOW TESTS
 */
const testEndToEndWorkflow = async () => {
  logger.test('Testing complete end-to-end workflow...');
  
  try {
    // 1. Get active personas
    const personasResponse = await makeRequest('GET', '/api/personas?isActive=true');
    
    // 2. Create campaign with persona
    if (personasResponse.data.data.length > 0) {
      const firstPersona = personasResponse.data.data[0];
      const e2eCampaign = {
        name: 'E2E Test Campaign',
        context: 'End-to-end integration test campaign',
        targetAudience: firstPersona.targetAudience,
        personaId: firstPersona.id,
        numberOfTemplates: 2,
        daysBetweenMessages: 1
      };
      
      const campaignResponse = await makeRequest('POST', '/api/campaigns', e2eCampaign);
      
      // 3. Verify campaign was created with persona
      const campaignId = campaignResponse.data.id;
      const campaignDetailsResponse = await makeRequest('GET', `/api/campaigns/${campaignId}`);
      
      testResults.integrationTests.endToEndWorkflow = {
        passed: campaignDetailsResponse.data.personaId === firstPersona.id,
        steps: {
          getPersonas: personasResponse.status === 200,
          createCampaign: campaignResponse.status === 200,
          verifyCampaign: campaignDetailsResponse.status === 200,
          personaAssigned: campaignDetailsResponse.data.personaId === firstPersona.id
        },
        campaignId,
        timestamp: new Date()
      };
      
      if (testResults.integrationTests.endToEndWorkflow.passed) {
        logger.success(`E2E workflow completed - Campaign ${campaignId} created with persona ${firstPersona.name}`);
      }
    } else {
      testResults.integrationTests.endToEndWorkflow = {
        passed: false,
        error: 'No active personas found for testing',
        timestamp: new Date()
      };
    }
    
  } catch (error) {
    logger.error(`End-to-end workflow test failed: ${error.message}`);
    testResults.integrationTests.endToEndWorkflow = {
      passed: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * CLEANUP FUNCTIONS
 */
const cleanupTestData = async () => {
  logger.info('Cleaning up test data...');
  
  // Delete test campaigns
  for (const campaign of testCampaigns) {
    if (campaign.id) {
      try {
        await makeRequest('DELETE', `/api/campaigns/${campaign.id}`);
        logger.info(`Deleted campaign ${campaign.id}`);
      } catch (error) {
        logger.warning(`Failed to delete campaign ${campaign.id}: ${error.message}`);
      }
    }
  }
  
  // Delete test personas
  for (const persona of Object.values(testPersonas)) {
    if (persona.id) {
      try {
        await makeRequest('DELETE', `/api/personas/${persona.id}`);
        logger.info(`Deleted persona ${persona.id}`);
      } catch (error) {
        logger.warning(`Failed to delete persona ${persona.id}: ${error.message}`);
      }
    }
  }
  
  if (dbPool) {
    await dbPool.end();
    logger.info('Database connection closed');
  }
};

/**
 * REPORT GENERATION
 */
const generateTestReport = () => {
  testResults.summary.endTime = new Date();
  const duration = testResults.summary.endTime - testResults.summary.startTime;
  
  console.log('\n' + '='.repeat(80));
  console.log('🧪 PERSONA SELECTOR BACKEND INTEGRATION TEST REPORT');
  console.log('='.repeat(80));
  console.log(`Test Duration: ${Math.round(duration / 1000)}s`);
  console.log(`Started: ${testResults.summary.startTime.toISOString()}`);
  console.log(`Completed: ${testResults.summary.endTime.toISOString()}`);
  console.log('');
  
  // Count results
  const allTests = [
    ...Object.values(testResults.apiTests),
    ...Object.values(testResults.databaseTests),
    ...Object.values(testResults.integrationTests),
    ...Object.values(testResults.aiResponseTests),
    ...Object.values(testResults.errorHandlingTests)
  ];
  
  const passed = allTests.filter(test => test.passed === true).length;
  const failed = allTests.filter(test => test.passed === false).length;
  const total = allTests.length;
  
  console.log(`📊 SUMMARY: ${passed}/${total} tests passed (${Math.round(passed/total*100)}% success rate)`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
  }
  console.log('');
  
  // API Tests Section
  console.log('🔌 API ENDPOINT TESTS:');
  console.log('-'.repeat(40));
  Object.entries(testResults.apiTests).forEach(([testName, result]) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  console.log('');
  
  // Database Tests Section  
  console.log('🗄️ DATABASE INTEGRATION TESTS:');
  console.log('-'.repeat(40));
  Object.entries(testResults.databaseTests).forEach(([testName, result]) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  console.log('');
  
  // AI Response Tests Section
  console.log('🤖 AI RESPONSE TESTS:');
  console.log('-'.repeat(40));
  Object.entries(testResults.aiResponseTests).forEach(([testName, result]) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (result.promptsDifferent !== undefined) {
      console.log(`   Personas have different prompts: ${result.promptsDifferent ? 'Yes' : 'No'}`);
    }
  });
  console.log('');
  
  // Integration Tests Section
  console.log('🔄 END-TO-END INTEGRATION TESTS:');
  console.log('-'.repeat(40));
  Object.entries(testResults.integrationTests).forEach(([testName, result]) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (result.steps) {
      Object.entries(result.steps).forEach(([step, stepPassed]) => {
        console.log(`   ${stepPassed ? '✓' : '✗'} ${step}`);
      });
    }
  });
  console.log('');
  
  // Error Handling Tests
  console.log('⚠️ ERROR HANDLING TESTS:');
  console.log('-'.repeat(40));
  Object.entries(testResults.errorHandlingTests).forEach(([testName, result]) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (result.status) {
      console.log(`   HTTP Status: ${result.status}`);
    }
  });
  console.log('');
  
  // Production Readiness Assessment
  console.log('🚀 PRODUCTION READINESS ASSESSMENT:');
  console.log('-'.repeat(40));
  
  const criticalTests = [
    testResults.apiTests.getPersonas?.passed,
    testResults.apiTests.createCreditPersona?.passed || testResults.apiTests.createPaymentsPersona?.passed,
    testResults.apiTests.createCreditCampaign?.passed || testResults.apiTests.createPaymentsCampaign?.passed,
    testResults.databaseTests.campaignPersonaIdColumn?.passed,
    testResults.databaseTests.foreignKeyConstraint?.passed
  ];
  
  const productionReady = criticalTests.every(test => test === true);
  
  console.log(`Production Ready: ${productionReady ? '✅ YES' : '❌ NO'}`);
  console.log('Critical Requirements:');
  console.log(`  ✓ Personas API functional: ${testResults.apiTests.getPersonas?.passed ? 'YES' : 'NO'}`);
  console.log(`  ✓ Campaign creation with persona: ${(testResults.apiTests.createCreditCampaign?.passed || testResults.apiTests.createPaymentsCampaign?.passed) ? 'YES' : 'NO'}`);
  console.log(`  ✓ Database schema correct: ${testResults.databaseTests.campaignPersonaIdColumn?.passed ? 'YES' : 'NO'}`);
  console.log(`  ✓ Foreign key constraints: ${testResults.databaseTests.foreignKeyConstraint?.passed ? 'YES' : 'NO'}`);
  console.log(`  ✓ Persona differentiation: ${testResults.aiResponseTests.systemPrompts?.promptsDifferent ? 'YES' : 'NO'}`);
  
  console.log('\n' + '='.repeat(80));
  
  // Return production readiness
  return productionReady;
};

/**
 * MAIN TEST EXECUTION
 */
const runAllTests = async () => {
  logger.info('🧪 Starting Persona Selector Backend Integration Tests...');
  logger.info(`Base URL: ${config.baseURL}`);
  logger.info(`Client ID: ${config.clientId}`);
  logger.info(`Database: ${config.databaseURL ? 'Available' : 'Not configured'}`);
  console.log('');
  
  try {
    // Initialize database connection
    await connectDatabase();
    
    // Run all test suites
    await testPersonasEndpoint();
    await testCreatePersona();
    await testCampaignCreationWithPersona();
    
    if (dbPool) {
      await testDatabaseSchema();
      await testCampaignPersonaAssociation();
    }
    
    await testPersonaSystemPrompts();
    await testErrorHandling();
    await testEndToEndWorkflow();
    
    // Generate report
    const productionReady = generateTestReport();
    
    // Cleanup
    await cleanupTestData();
    
    // Exit with appropriate code
    process.exit(productionReady ? 0 : 1);
    
  } catch (error) {
    logger.error(`Test execution failed: ${error.message}`);
    console.error(error);
    
    await cleanupTestData();
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGINT', async () => {
  logger.warning('Test execution interrupted');
  await cleanupTestData();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  await cleanupTestData();
  process.exit(1);
});

// Execute tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testResults,
  config
};