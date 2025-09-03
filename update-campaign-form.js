#!/usr/bin/env node

/**
 * Script to update CampaignForm.tsx for intent-based handover support
 * Run with: node update-campaign-form.js
 */

const fs = require('fs');
const path = require('path');

const CAMPAIGN_FORM_PATH = 'client/src/components/campaign/CampaignForm.tsx';

// Intent options to add
const INTENT_OPTIONS = `
const intentOptions: { value: HandoverIntent; label: string; description: string }[] = [
  { value: 'pricing', label: 'Pricing Questions', description: 'Lead asks about monthly payments, total cost, discounts' },
  { value: 'test_drive', label: 'Test Drive Interest', description: 'Lead wants to schedule a test drive or demo' },
  { value: 'trade_in', label: 'Trade-In Inquiry', description: 'Lead asks about trading in their current vehicle' },
  { value: 'vehicle_info', label: 'Vehicle Details', description: 'Lead needs specific information about features, specs' },
  { value: 'complaint', label: 'Complaint/Issue', description: 'Lead expresses dissatisfaction or reports problems' },
  { value: 'appointment', label: 'Appointment Request', description: 'Lead wants to schedule a meeting or visit' },
  { value: 'other', label: 'Other Intent', description: 'Catch-all for other handover scenarios' }
];`;

// Schema updates
const SCHEMA_UPDATE = `
// Add to formSchema.extend()
handoverCriteria: z.array(z.object({
  intent: z.enum(['pricing', 'test_drive', 'trade_in', 'vehicle_info', 'complaint', 'appointment', 'other']),
  action: z.literal('handover')
})).optional().default([]),
handoverRecipient: z.string().email().optional().default(""),`;

// Import update
const IMPORT_UPDATE = `import type { HandoverIntent, HandoverCriteriaItem } from '@shared/schema';`;

function updateCampaignForm() {
  try {
    if (!fs.existsSync(CAMPAIGN_FORM_PATH)) {
      console.error(`❌ Campaign form not found at: ${CAMPAIGN_FORM_PATH}`);
      console.log('ℹ️  Please run this script from the project root directory');
      return;
    }

    let content = fs.readFileSync(CAMPAIGN_FORM_PATH, 'utf8');
    
    // Check if already updated
    if (content.includes('HandoverIntent')) {
      console.log('✅ Campaign form already updated for intent-based handovers');
      return;
    }

    // Add import
    const importRegex = /import type \{ Campaign as SharedCampaign \} from "@shared\/schema";/;
    if (importRegex.test(content)) {
      content = content.replace(importRegex, `import type { Campaign as SharedCampaign, HandoverIntent, HandoverCriteriaItem } from "@shared/schema";`);
    } else {
      console.log('⚠️  Could not find SharedCampaign import to update');
    }

    // Add intent options after imports
    const afterImports = content.indexOf('// Type representing generated templates');
    if (afterImports !== -1) {
      content = content.slice(0, afterImports) + INTENT_OPTIONS + '\n\n' + content.slice(afterImports);
    }

    // Update schema - look for the extend call
    const schemaExtendRegex = /const formSchema = insertCampaignSchema\.extend\(\{([^}]+)\}\);/s;
    if (schemaExtendRegex.test(content)) {
      content = content.replace(schemaExtendRegex, (match, fields) => {
        if (!fields.includes('handoverCriteria')) {
          return `const formSchema = insertCampaignSchema.extend({${fields.trim()},${SCHEMA_UPDATE}
});`;
        }
        return match;
      });
    }

    // Add default values - look for defaultValues
    const defaultValuesRegex = /(defaultValues: \{[^}]+)(\})/s;
    if (defaultValuesRegex.test(content)) {
      content = content.replace(defaultValuesRegex, (match, start, end) => {
        if (!start.includes('handoverCriteria')) {
          return start + ',\n      handoverCriteria: [],\n      handoverRecipient: "",' + end;
        }
        return match;
      });
    }

    // Write updated content
    fs.writeFileSync(CAMPAIGN_FORM_PATH, content);
    
    console.log('✅ Campaign form updated successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Add UI components for intent selection');
    console.log('   2. Add handover recipient email field');
    console.log('   3. Update form submission to include new fields');
    
  } catch (error) {
    console.error('❌ Failed to update campaign form:', error.message);
  }
}

function main() {
  console.log('🚀 Updating Campaign Form for Intent-Based Handovers...\n');
  
  updateCampaignForm();
  
  console.log('\n📋 Manual UI Updates Still Needed:');
  console.log('   • Add intent selection checkboxes to replace current handover goals');
  console.log('   • Add handover recipient email input field');
  console.log('   • Update form validation and submission logic');
  console.log('   • Test form integration with new schema fields');
  
  console.log('\n🔗 See RENDER_DEPLOYMENT_GUIDE.md for complete UI update instructions');
}

if (require.main === module) {
  main();
}

module.exports = { updateCampaignForm };