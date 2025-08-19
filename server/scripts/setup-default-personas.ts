#!/usr/bin/env ts-node

/**
 * Setup Default Personas Script
 * 
 * Creates default AI personas for OfferLogix:
 * 1. Credit Solutions AI - for dealer outreach
 * 2. Payments AI - for vendor outreach
 * 
 * This script can be run as part of the deployment process or
 * manually to set up personas for new clients.
 */

import { aiPersonaManagementService } from '../services/ai-persona-management';
import { storage } from '../storage';

async function setupDefaultPersonas() {
  console.log('🚀 Setting up default AI personas for OfferLogix...\n');

  try {
    // Get all clients or use default client
    const clients = await storage.getClients?.() || [];
    
    // If no clients exist, create personas for default client
    const clientsToSetup = clients.length > 0 ? clients : [{ id: 'default', name: 'Default Client' }];

    let totalPersonasCreated = 0;

    for (const client of clientsToSetup) {
      console.log(`\n📋 Setting up personas for client: ${client.name} (${client.id})`);

      try {
        // Check if personas already exist
        const existingPersonas = await aiPersonaManagementService.getPersonas({
          clientId: client.id,
          isActive: true
        });

        if (existingPersonas.length > 0) {
          console.log(`  ⚠️  Found ${existingPersonas.length} existing personas, skipping...`);
          continue;
        }

        // Create default personas
        const personas = await aiPersonaManagementService.createDefaultPersonas(client.id);
        totalPersonasCreated += personas.length;

        console.log(`  ✅ Created ${personas.length} default personas:`);
        personas.forEach(persona => {
          console.log(`    - ${persona.name} (${persona.targetAudience})`);
        });

      } catch (error) {
        console.error(`  ❌ Failed to create personas for client ${client.name}:`, error);
      }
    }

    if (totalPersonasCreated > 0) {
      console.log(`\n🎉 Successfully created ${totalPersonasCreated} personas across ${clientsToSetup.length} clients!`);
      
      console.log('\n📝 Default Personas Created:');
      console.log('  1. Credit Solutions AI');
      console.log('     - Target: Dealers (300 contacts)');
      console.log('     - Focus: Credit decision technology, instant approvals');
      console.log('     - Tone: Professional, technical, ROI-focused');
      console.log('');
      console.log('  2. Payments AI');
      console.log('     - Target: Vendors (200 contacts)');
      console.log('     - Focus: Payment calculation tools, implementation');
      console.log('     - Tone: Business-focused, consultative');

      console.log('\n🔧 Next Steps:');
      console.log('  1. Associate personas with relevant knowledge bases');
      console.log('  2. Assign personas to campaigns');
      console.log('  3. Test persona-specific conversations');
      console.log('  4. Monitor persona performance and adjust as needed');
    } else {
      console.log('\n✨ No new personas created (existing personas found)');
    }

  } catch (error) {
    console.error('\n❌ Failed to setup default personas:', error);
    process.exit(1);
  }
}

async function displayPersonaSummary() {
  try {
    const clients = await storage.getClients?.() || [];
    const clientsToCheck = clients.length > 0 ? clients : [{ id: 'default', name: 'Default Client' }];

    console.log('\n📊 Current Persona Summary:');
    console.log('==========================');

    for (const client of clientsToCheck) {
      const personas = await aiPersonaManagementService.getPersonas({
        clientId: client.id,
        includeKnowledgeBases: true,
        includeCampaignCounts: true
      });

      console.log(`\n👥 ${client.name} (${personas.length} personas):`);
      
      if (personas.length === 0) {
        console.log('  No personas configured');
        continue;
      }

      personas.forEach(persona => {
        const status = persona.isActive ? '🟢' : '🔴';
        const isDefault = persona.isDefault ? ' [DEFAULT]' : '';
        console.log(`  ${status} ${persona.name}${isDefault}`);
        console.log(`     Target: ${persona.targetAudience}`);
        console.log(`     Style: ${persona.communicationStyle} | Tone: ${persona.tonality}`);
        console.log(`     KB Access: ${persona.knowledgeBaseAccessLevel}`);
        console.log(`     KBs Linked: ${persona.knowledgeBases?.length || 0}`);
        console.log(`     Campaigns: ${persona.campaignCount || 0}`);
        console.log(`     Priority: ${persona.priority}`);
      });
    }

  } catch (error) {
    console.error('Failed to display persona summary:', error);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'setup':
      await setupDefaultPersonas();
      await displayPersonaSummary();
      break;
      
    case 'summary':
      await displayPersonaSummary();
      break;
      
    case 'reset':
      console.log('⚠️  Reset functionality not implemented for safety');
      console.log('   Please manually deactivate personas if needed');
      break;
      
    default:
      console.log('OfferLogix Default Personas Setup');
      console.log('==================================');
      console.log('');
      console.log('Usage:');
      console.log('  npm run setup-personas setup     - Create default personas');
      console.log('  npm run setup-personas summary   - Show current personas');
      console.log('  npm run setup-personas reset     - Reset personas (manual)');
      console.log('');
      console.log('Default Personas:');
      console.log('  • Credit Solutions AI - Dealer outreach specialist');
      console.log('  • Payments AI - Vendor outreach consultant');
  }

  process.exit(0);
}

// Handle script execution
const isMainModule = process.argv[1]?.includes('setup-default-personas.ts');
if (isMainModule) {
  main().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { setupDefaultPersonas, displayPersonaSummary };