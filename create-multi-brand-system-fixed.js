#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

async function createMultiBrandSystem(dryRun = true) {
  try {
    const { db } = await import('./server/db.js');
    const { aiAgentConfig, campaigns } = await import('./shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    console.log('🏗️  MULTI-BRAND SYSTEM CREATION');
    console.log('===============================');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Preview Only)' : '🚀 LIVE EXECUTION'}\n`);
    
    // **CRITICAL FIX: Wrap all operations in a transaction**
    return await db.transaction(async (tx) => {
      // **FIX: Validate base campaigns exist before proceeding**
      const kunesOriginalId = '211b819b-17e1-48c7-8c9a-452c2fa05c6d';
      const kunesSuvsId = '21f67b72-1922-4d12-a085-e122f61161ea';
      
      console.log('🔍 VALIDATING BASE CAMPAIGNS...');
      const [kunesTrucks] = await tx.select().from(campaigns).where(eq(campaigns.id, kunesOriginalId));
      const [kunesSuvs] = await tx.select().from(campaigns).where(eq(campaigns.id, kunesSuvsId));
      
      if (!kunesTrucks || !kunesSuvs) {
        throw new Error(`❌ Base campaigns not found - cannot proceed. Missing: ${!kunesTrucks ? 'KUNES TRUCKS' : ''} ${!kunesSuvs ? 'KUNES SUVs' : ''}`);
      }
      
      console.log('✅ Base campaigns validated');
      
      // Define brand configurations with proper validation
      const brandConfigs = [
        {
          name: 'Toyota',
          location: 'Galesburg',
          agentId: 'b85a27b4-e379-4a9d-9a3f-5637ba77b6b4',
          domain: 'kunestoyota-galesburg.kunesauto.vip',
          dealership: 'Kunes Toyota of Galesburg',
          senderName: 'Riley Donovan',
          trucks: ['Tacoma', 'Tundra'],
          suvs: ['RAV4', 'Highlander', '4Runner', 'Sequoia'],
          truckTerm: 'truck', // Use generic for multiple options
          suvTerm: 'SUV'
        },
        {
          name: 'Nissan',
          location: 'Davenport',
          agentId: '0ee87a24-9b16-4e6e-be44-ff962bb86b9f',
          domain: 'kunesnissan-davenport.kunesauto.vip',
          dealership: 'Kunes Nissan of Davenport',
          senderName: 'Riley Donovan',
          trucks: ['Frontier', 'Titan'],
          suvs: ['Rogue', 'Pathfinder', 'Armada', 'Murano'],
          truckTerm: 'truck',
          suvTerm: 'SUV'
        },
        {
          name: 'Ford',
          location: 'East Moline',
          agentId: '0176e702-d550-43a2-bd0f-45ed1f5d40fe',
          domain: 'kunesford-eastmoline.kunesauto.vip',
          dealership: 'Kunes Ford of East Moline',
          senderName: 'Riley Donovan',
          trucks: ['F-150', 'Ranger', 'Super Duty'],
          suvs: ['Explorer', 'Escape', 'Expedition', 'Bronco'],
          truckTerm: 'truck',
          suvTerm: 'SUV'
        },
        {
          name: 'Hyundai',
          location: 'Quincy',
          agentId: '65e66662-6cf0-46b7-a3db-910571ac0414',
          domain: 'kuneshyundai-quincy.kunesauto.vip',
          dealership: 'Kunes Hyundai of Quincy',
          senderName: 'Riley Donovan',
          trucks: ['Santa Cruz'],
          suvs: ['Tucson', 'Santa Fe', 'Palisade', 'Kona'],
          truckTerm: 'Santa Cruz', // Use specific name for single vehicle
          suvTerm: 'SUV'
        },
        {
          name: 'Honda',
          location: 'Quincy',
          agentId: '4f75b6fa-7dad-4d82-8dc1-c6421d801496',
          domain: 'kuneshonda-quincy.kunesauto.vip',
          dealership: 'Kunes Honda of Quincy',
          senderName: 'Riley Donovan',
          trucks: ['Ridgeline'],
          suvs: ['CR-V', 'Pilot', 'Passport', 'HR-V'],
          truckTerm: 'Ridgeline', // Use specific name for single vehicle
          suvTerm: 'SUV'
        }
      ];
      
      // **FIX: Add input validation**
      const validationErrors = [];
      for (const brand of brandConfigs) {
        if (!brand.agentId || !brand.domain || !brand.dealership) {
          validationErrors.push(`${brand.name}: Missing required fields`);
        }
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brand.agentId)) {
          validationErrors.push(`${brand.name}: Invalid agent ID format`);
        }
      }
      
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors:\n${validationErrors.join('\n')}`);
      }
      
      const results = {
        agentsCreated: 0,
        campaignsCreated: 0,
        errors: [],
        operationLog: []
      };
      
      // **FIX: Smart template replacement function**
      function smartReplace(content, oldTerm, newTerm, dealership) {
        // Use word boundaries to prevent partial replacements
        const wordBoundaryRegex = new RegExp(`\\b${oldTerm}\\b`, 'gi');
        let updatedContent = content.replace(wordBoundaryRegex, newTerm);
        
        // Replace dealership name
        updatedContent = updatedContent.replace(/Kunes Auto Group of Macomb/g, dealership);
        
        return updatedContent;
      }
      
      // STEP 1: Create AI Agents
      console.log('STEP 1: 🤖 CREATING AI AGENTS');
      console.log('-----------------------------');
      
      for (const brand of brandConfigs) {
        try {
          console.log(`Processing ${brand.name} (${brand.location})...`);
          
          // Check if agent already exists
          const [existingAgent] = await tx.select()
            .from(aiAgentConfig)
            .where(eq(aiAgentConfig.id, brand.agentId));
          
          if (existingAgent) {
            console.log(`   ⚠️  Agent already exists: ${existingAgent.name}`);
            results.operationLog.push(`Agent ${brand.name}: Already exists`);
          } else {
            // **CRITICAL FIX: Use proper schema-compliant agent data**
            const agentData = {
              id: brand.agentId,
              name: `${brand.dealership} AI Assistant`,
              tonality: "professional",
              personality: `Helpful automotive sales assistant specializing in ${brand.name} vehicles at ${brand.dealership}`,
              dosList: [
                "Be responsive and helpful",
                "Provide accurate vehicle information", 
                "Schedule test drives and appointments",
                "Ask qualifying questions about vehicle needs",
                "Share dealership contact information when appropriate"
              ],
              dontsList: [
                "Make promises about specific pricing without qualification",
                "Discuss financing terms without proper verification", 
                "Share competitor information negatively",
                "Promise inventory availability without checking",
                "Use high-pressure sales tactics"
              ],
              industry: "automotive",
              responseStyle: "helpful",
              model: "openai/gpt-5-chat",
              systemPrompt: `You are a professional sales assistant for ${brand.dealership}, specializing in ${brand.name} vehicles. You help customers with inquiries about ${brand.trucks.join(', ')} trucks and ${brand.suvs.join(', ')} SUVs. Always be helpful, professional, and focus on understanding customer needs.`,
              fromName: brand.senderName,
              agentEmailDomain: brand.domain,
              isActive: true,
              clientId: kunesTrucks.clientId // Use same client as base campaigns
            };
            
            if (!dryRun) {
              await tx.insert(aiAgentConfig).values(agentData);
              console.log(`   ✅ Agent created: ${agentData.name}`);
              results.agentsCreated++;
              results.operationLog.push(`Agent ${brand.name}: Created successfully`);
            } else {
              console.log(`   📋 Would create: ${agentData.name}`);
              console.log(`      Domain: ${agentData.agentEmailDomain}`);
              console.log(`      From Name: ${agentData.fromName}`);
            }
          }
        } catch (error) {
          const errorMsg = `Agent ${brand.name}: ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          results.errors.push(errorMsg);
          results.operationLog.push(`Agent ${brand.name}: ERROR - ${error.message}`);
          
          if (!dryRun) {
            throw error; // Fail fast in live mode
          }
        }
      }
      
      // STEP 2: Create Campaigns
      console.log('\nSTEP 2: 📧 CREATING CAMPAIGNS');
      console.log('------------------------------');
      
      for (const brand of brandConfigs) {
        try {
          // **FIX: Improved template customization**
          const trucksTemplates = kunesTrucks.templates.map(template => ({
            content: smartReplace(template.content, 'truck', brand.truckTerm, brand.dealership),
            subject: smartReplace(template.subject, 'truck', brand.truckTerm, brand.dealership)
          }));
          
          const suvsTemplates = kunesSuvs.templates.map(template => ({
            content: smartReplace(template.content, 'SUV', brand.suvTerm, brand.dealership),
            subject: smartReplace(template.subject, 'SUV', brand.suvTerm, brand.dealership)
          }));
          
          // Create TRUCKS campaign
          const trucksCampaign = {
            name: `${brand.name} Trucks`,
            context: `Announce upcoming dealership events and test drive opportunities for ${brand.trucks.join(', ')} vehicles at ${brand.dealership}`,
            handoverGoals: smartReplace(kunesTrucks.handoverGoals, 'truck', brand.truckTerm, brand.dealership),
            targetAudience: kunesTrucks.targetAudience,
            handoverPrompt: kunesTrucks.handoverPrompt,
            handoverPromptSpec: kunesTrucks.handoverPromptSpec,
            handoverCriteria: kunesTrucks.handoverCriteria,
            handoverRecipient: kunesTrucks.handoverRecipient,
            leadScoreWeights: kunesTrucks.leadScoreWeights,
            handoverScoreThresholds: kunesTrucks.handoverScoreThresholds,
            status: 'draft',
            templates: trucksTemplates,
            subjectLines: kunesTrucks.subjectLines,
            numberOfTemplates: kunesTrucks.numberOfTemplates,
            daysBetweenMessages: kunesTrucks.daysBetweenMessages,
            openRate: null,
            isTemplate: kunesTrucks.isTemplate,
            originalCampaignId: kunesTrucks.id,
            communicationType: kunesTrucks.communicationType,
            smsOptInRequired: kunesTrucks.smsOptInRequired,
            smsOptInMessage: kunesTrucks.smsOptInMessage,
            scheduleType: kunesTrucks.scheduleType,
            scheduledStart: kunesTrucks.scheduledStart,
            recurringPattern: kunesTrucks.recurringPattern,
            recurringDays: kunesTrucks.recurringDays,
            recurringTime: kunesTrucks.recurringTime,
            stopOnComplaint: kunesTrucks.stopOnComplaint,
            isActive: kunesTrucks.isActive,
            nextExecution: null,
            sendWindow: kunesTrucks.sendWindow,
            agentConfigId: brand.agentId,
            clientId: kunesTrucks.clientId
          };
          
          // Create SUVs campaign
          const suvsCampaign = {
            name: `${brand.name} SUVs`,
            context: `Announce upcoming dealership events and test drive opportunities for ${brand.suvs.join(', ')} vehicles at ${brand.dealership}`,
            handoverGoals: smartReplace(kunesSuvs.handoverGoals, 'SUV', brand.suvTerm, brand.dealership),
            targetAudience: kunesSuvs.targetAudience,
            handoverPrompt: kunesSuvs.handoverPrompt,
            handoverPromptSpec: kunesSuvs.handoverPromptSpec,
            handoverCriteria: kunesSuvs.handoverCriteria,
            handoverRecipient: kunesSuvs.handoverRecipient,
            leadScoreWeights: kunesSuvs.leadScoreWeights,
            handoverScoreThresholds: kunesSuvs.handoverScoreThresholds,
            status: 'draft',
            templates: suvsTemplates,
            subjectLines: kunesSuvs.subjectLines,
            numberOfTemplates: kunesSuvs.numberOfTemplates,
            daysBetweenMessages: kunesSuvs.daysBetweenMessages,
            openRate: null,
            isTemplate: kunesSuvs.isTemplate,
            originalCampaignId: kunesSuvs.id,
            communicationType: kunesSuvs.communicationType,
            smsOptInRequired: kunesSuvs.smsOptInRequired,
            smsOptInMessage: kunesSuvs.smsOptInMessage,
            scheduleType: kunesSuvs.scheduleType,
            scheduledStart: kunesSuvs.scheduledStart,
            recurringPattern: kunesSuvs.recurringPattern,
            recurringDays: kunesSuvs.recurringDays,
            recurringTime: kunesSuvs.recurringTime,
            stopOnComplaint: kunesSuvs.stopOnComplaint,
            isActive: kunesSuvs.isActive,
            nextExecution: null,
            sendWindow: kunesSuvs.sendWindow,
            agentConfigId: brand.agentId,
            clientId: kunesSuvs.clientId
          };
          
          console.log(`Creating campaigns for ${brand.name}...`);
          
          if (!dryRun) {
            const [createdTrucks] = await tx.insert(campaigns).values(trucksCampaign).returning();
            const [createdSuvs] = await tx.insert(campaigns).values(suvsCampaign).returning();
            
            console.log(`   ✅ ${createdTrucks.name} (${createdTrucks.id})`);
            console.log(`   ✅ ${createdSuvs.name} (${createdSuvs.id})`);
            results.campaignsCreated += 2;
            results.operationLog.push(`Campaigns ${brand.name}: Trucks & SUVs created successfully`);
          } else {
            console.log(`   📋 Would create: ${trucksCampaign.name}`);
            console.log(`      Templates: ${trucksCampaign.templates.length} (Trucks: ${brand.truckTerm})`);
            console.log(`   📋 Would create: ${suvsCampaign.name}`);
            console.log(`      Templates: ${suvsCampaign.templates.length} (SUVs: ${brand.suvTerm})`);
            console.log(`      Agent: ${brand.agentId}`);
            console.log(`      Domain: ${brand.domain}`);
          }
          
        } catch (error) {
          const errorMsg = `Campaigns ${brand.name}: ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          results.errors.push(errorMsg);
          results.operationLog.push(`Campaigns ${brand.name}: ERROR - ${error.message}`);
          
          if (!dryRun) {
            throw error; // Fail fast in live mode
          }
        }
      }
      
      // SUMMARY
      console.log('\n' + '='.repeat(50));
      console.log('📊 EXECUTION SUMMARY');
      console.log('===================');
      
      if (dryRun) {
        console.log('🔍 DRY RUN COMPLETE - No actual changes made');
        console.log('');
        console.log('Would create:');
        console.log(`   • ${brandConfigs.length} AI Agents`);
        console.log(`   • ${brandConfigs.length * 2} Campaigns (${brandConfigs.length} Trucks + ${brandConfigs.length} SUVs)`);
        console.log('');
        console.log('🎯 Vehicle Type Mapping:');
        brandConfigs.forEach(brand => {
          console.log(`   ${brand.name}: ${brand.truckTerm} → ${brand.suvTerm}`);
        });
        console.log('');
        console.log('⚡ To execute for real, run: tsx create-multi-brand-system-fixed.js --live');
      } else {
        console.log('🚀 LIVE EXECUTION COMPLETE');
        console.log('');
        console.log(`✅ Agents created: ${results.agentsCreated}`);
        console.log(`✅ Campaigns created: ${results.campaignsCreated}`);
        if (results.errors.length > 0) {
          console.log(`❌ Errors encountered: ${results.errors.length}`);
          results.errors.forEach(error => console.log(`   - ${error}`));
        }
        
        console.log('\n📝 OPERATION LOG:');
        results.operationLog.forEach(log => console.log(`   ${log}`));
      }
      
      console.log('');
      console.log('🎯 NEXT STEPS:');
      console.log('1. Verify all agents and campaigns created successfully');
      console.log('2. Test email sending from each domain');
      console.log('3. Import leads via CSV for each brand');
      console.log('4. Review and activate campaigns when ready');
      
      return results;
    });
    
  } catch (error) {
    console.error('❌ Multi-brand system creation failed:', error.message);
    
    if (error.message.includes('transaction')) {
      console.error('🔄 Transaction was rolled back - no partial changes made');
    }
    
    throw error;
  }
}

// Check command line arguments
const isLiveRun = process.argv.includes('--live');
const isDryRun = !isLiveRun;

if (import.meta.url === `file://${process.argv[1]}`) {
  createMultiBrandSystem(isDryRun).catch(console.error);
}