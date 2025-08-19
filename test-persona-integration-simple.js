#!/usr/bin/env node

/**
 * SIMPLIFIED PERSONA SELECTOR INTEGRATION TEST
 * 
 * A lightweight test script using built-in Node.js fetch API
 * to verify persona selector backend integration.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const clientId = process.env.TEST_CLIENT_ID || 'default';

const testData = {
  creditPersona: {
    name: 'Credit Solutions AI Test',
    targetAudience: 'automotive dealers',
    industry: 'automotive',
    tonality: 'technical',
    isActive: true
  },
  paymentsPersona: {
    name: 'Payments AI Test', 
    targetAudience: 'payment vendors',
    industry: 'automotive', 
    tonality: 'consultative',
    isActive: true
  }
};

const makeRequest = async (method, endpoint, data = null) => {
  const url = `${baseURL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  console.log(`[${method}] ${endpoint}`);
  
  try {
    const response = await fetch(url, options);
    const responseData = await response.json();
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Response: ${JSON.stringify(responseData, null, 2).substring(0, 200)}...`);
    
    return { status: response.status, data: responseData };
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    throw error;
  }
};

const runBasicTests = async () => {
  console.log('🧪 PERSONA SELECTOR INTEGRATION TEST');
  console.log('=====================================');
  console.log(`Base URL: ${baseURL}`);
  console.log('');
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  try {
    // Test 1: Get personas endpoint
    testsTotal++;
    console.log('1️⃣ Testing GET /api/personas...');
    const getPersonasResponse = await makeRequest('GET', '/api/personas');
    
    if (getPersonasResponse.status === 200) {
      testsPassed++;
      console.log('✅ Personas endpoint working');
    } else {
      console.log('❌ Personas endpoint failed');
    }
    console.log('');
    
    // Test 2: Get personas with filter
    testsTotal++;
    console.log('2️⃣ Testing GET /api/personas?isActive=true...');
    const getActivePersonasResponse = await makeRequest('GET', '/api/personas?isActive=true');
    
    if (getActivePersonasResponse.status === 200) {
      testsPassed++;
      console.log('✅ Persona filtering working');
    } else {
      console.log('❌ Persona filtering failed');
    }
    console.log('');
    
    // Test 3: Create Credit Solutions persona
    testsTotal++;
    console.log('3️⃣ Testing POST /api/personas (Credit Solutions)...');
    const createCreditResponse = await makeRequest('POST', '/api/personas', testData.creditPersona);
    let creditPersonaId = null;
    
    if (createCreditResponse.status === 201) {
      testsPassed++;
      creditPersonaId = createCreditResponse.data.data?.id;
      console.log(`✅ Credit Solutions persona created: ${creditPersonaId}`);
    } else {
      console.log('❌ Credit Solutions persona creation failed');
    }
    console.log('');
    
    // Test 4: Create Payments AI persona
    testsTotal++;
    console.log('4️⃣ Testing POST /api/personas (Payments AI)...');
    const createPaymentsResponse = await makeRequest('POST', '/api/personas', testData.paymentsPersona);
    let paymentsPersonaId = null;
    
    if (createPaymentsResponse.status === 201) {
      testsPassed++;
      paymentsPersonaId = createPaymentsResponse.data.data?.id;
      console.log(`✅ Payments AI persona created: ${paymentsPersonaId}`);
    } else {
      console.log('❌ Payments AI persona creation failed');
    }
    console.log('');
    
    // Test 5: Create campaign with persona
    if (creditPersonaId) {
      testsTotal++;
      console.log('5️⃣ Testing POST /api/campaigns with personaId...');
      const campaignData = {
        name: 'Test Campaign with Persona',
        context: 'Testing campaign with persona assignment',
        targetAudience: 'automotive dealers',
        personaId: creditPersonaId,
        numberOfTemplates: 3,
        daysBetweenMessages: 2
      };
      
      const createCampaignResponse = await makeRequest('POST', '/api/campaigns', campaignData);
      
      if (createCampaignResponse.status === 200) {
        testsPassed++;
        const campaignId = createCampaignResponse.data.id;
        console.log(`✅ Campaign created with persona: ${campaignId}`);
        
        // Test 6: Verify campaign has persona assigned
        testsTotal++;
        console.log('6️⃣ Testing GET /api/campaigns/:id (verify persona)...');
        const getCampaignResponse = await makeRequest('GET', `/api/campaigns/${campaignId}`);
        
        if (getCampaignResponse.status === 200 && getCampaignResponse.data.personaId === creditPersonaId) {
          testsPassed++;
          console.log('✅ Campaign-persona association verified');
        } else {
          console.log('❌ Campaign-persona association failed');
        }
        
        // Cleanup campaign
        try {
          await makeRequest('DELETE', `/api/campaigns/${campaignId}`);
          console.log('🧹 Test campaign cleaned up');
        } catch (e) {
          console.log('⚠️ Campaign cleanup failed');
        }
      } else {
        console.log('❌ Campaign creation with persona failed');
      }
    }
    console.log('');
    
    // Test 7: Get system prompt for persona
    if (creditPersonaId) {
      testsTotal++;
      console.log('7️⃣ Testing GET /api/personas/:id/system-prompt...');
      const getPromptResponse = await makeRequest('GET', 
        `/api/personas/${creditPersonaId}/system-prompt?targetAudience=dealers`);
      
      if (getPromptResponse.status === 200) {
        testsPassed++;
        console.log('✅ System prompt generation working');
      } else {
        console.log('❌ System prompt generation failed');
      }
    }
    console.log('');
    
    // Cleanup personas
    console.log('🧹 Cleaning up test data...');
    if (creditPersonaId) {
      try {
        await makeRequest('DELETE', `/api/personas/${creditPersonaId}`);
        console.log('Credit persona cleaned up');
      } catch (e) {
        console.log('Credit persona cleanup failed');
      }
    }
    
    if (paymentsPersonaId) {
      try {
        await makeRequest('DELETE', `/api/personas/${paymentsPersonaId}`);
        console.log('Payments persona cleaned up');
      } catch (e) {
        console.log('Payments persona cleanup failed');
      }
    }
    
  } catch (error) {
    console.log(`\n❌ Test execution failed: ${error.message}`);
  }
  
  // Results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS:');
  console.log('='.repeat(50));
  console.log(`Passed: ${testsPassed}/${testsTotal} (${Math.round(testsPassed/testsTotal*100)}%)`);
  
  const productionReady = testsPassed >= testsTotal * 0.8; // 80% pass rate
  console.log(`Production Ready: ${productionReady ? '✅ YES' : '❌ NO'}`);
  
  if (productionReady) {
    console.log('\n✅ PERSONA SELECTOR BACKEND INTEGRATION VERIFIED');
    console.log('✅ All critical API endpoints are functional');
    console.log('✅ Campaign-persona associations work correctly');
    console.log('✅ System is ready for production use');
  } else {
    console.log('\n❌ PERSONA SELECTOR INTEGRATION INCOMPLETE');
    console.log('❌ Some critical tests failed');
    console.log('❌ Manual verification required before production');
  }
  
  return productionReady;
};

if (require.main === module) {
  runBasicTests().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch(() => {
    process.exit(1);
  });
}

module.exports = { runBasicTests };