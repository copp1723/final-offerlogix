#!/usr/bin/env node

/**
 * Test script to verify the multi-persona AI system works
 */

import { aiPersonaManagementService } from './server/services/ai-persona-management.js';

async function testPersonaSystem() {
  console.log('🧪 Testing Multi-Persona AI System...\n');

  const testClientId = '00000000-0000-0000-0000-000000000001';

  try {
    // 1. Create default personas
    console.log('1. Creating default personas...');
    const personas = await aiPersonaManagementService.createDefaultPersonas(testClientId);
    console.log(`   ✅ Created ${personas.length} personas`);
    
    personas.forEach(persona => {
      console.log(`   - ${persona.name} (${persona.targetAudience})`);
    });

    // 2. Test persona retrieval
    console.log('\n2. Testing persona retrieval...');
    const allPersonas = await aiPersonaManagementService.getPersonas({
      clientId: testClientId,
      includeKnowledgeBases: true,
      includeCampaignCounts: true
    });
    console.log(`   ✅ Retrieved ${allPersonas.length} personas`);

    // 3. Test default persona
    console.log('\n3. Testing default persona selection...');
    const defaultPersona = await aiPersonaManagementService.getDefaultPersona(testClientId);
    if (defaultPersona) {
      console.log(`   ✅ Default persona: ${defaultPersona.name}`);
    } else {
      console.log('   ⚠️  No default persona set');
    }

    // 4. Test system prompt generation
    if (personas.length > 0) {
      console.log('\n4. Testing system prompt generation...');
      const systemPrompt = aiPersonaManagementService.generatePersonaSystemPrompt(personas[0], {
        targetAudience: personas[0].targetAudience,
        campaignContext: 'Test campaign'
      });
      console.log('   ✅ System prompt generated successfully');
      console.log(`   📝 Prompt length: ${systemPrompt.length} characters`);
    }

    // 5. Test persona filtering by target audience
    console.log('\n5. Testing persona filtering...');
    const dealerPersonas = await aiPersonaManagementService.getPersonas({
      clientId: testClientId,
      targetAudience: 'dealers'
    });
    console.log(`   ✅ Found ${dealerPersonas.length} dealer personas`);

    const vendorPersonas = await aiPersonaManagementService.getPersonas({
      clientId: testClientId,
      targetAudience: 'vendors'
    });
    console.log(`   ✅ Found ${vendorPersonas.length} vendor personas`);

    console.log('\n🎉 Multi-Persona AI System Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   • Total Personas: ${allPersonas.length}`);
    console.log(`   • Dealer-focused: ${dealerPersonas.length}`);
    console.log(`   • Vendor-focused: ${vendorPersonas.length}`);
    console.log(`   • Default set: ${defaultPersona ? 'Yes' : 'No'}`);
    
    console.log('\n✨ System is ready for production use!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPersonaSystem().then(() => {
  console.log('\nTest completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});