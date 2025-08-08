// Test script to validate personality integration
import { AutomotivePromptService } from './services/automotive-prompts';

const testConfig = {
  dealershipName: "AutoMax Dealership",
  dealershipAddress: "123 Main St, City, State 12345",
  dealershipWebsite: "www.automax.com",
  dealershipPhone: "(555) 123-4567",
  personality: "GRUMPY",
  tradeInUrl: "https://automax.com/trade-in",
  financingUrl: "https://automax.com/financing"
};

const testContext = {
  leadName: "John Smith",
  vehicleInterest: "2024 Toyota Camry",
  customerMood: 'hesitant' as const,
  detectedIntents: ['financing_discussion']
};

console.log("=== TESTING PERSONALITY INTEGRATION ===\n");

// Test 1: GRUMPY personality
console.log("1. GRUMPY Personality Prompt:");
console.log("=" .repeat(50));
const grumpyPrompt = AutomotivePromptService.generateSystemPrompt(testConfig, testContext);
console.log(grumpyPrompt);
console.log("\n");

// Test 2: ENTHUSIASTIC personality
console.log("2. ENTHUSIASTIC Personality Prompt:");
console.log("=" .repeat(50));
const enthusiasticConfig = { ...testConfig, personality: "ENTHUSIASTIC" };
const enthusiasticPrompt = AutomotivePromptService.generateSystemPrompt(enthusiasticConfig, testContext);
console.log(enthusiasticPrompt);
console.log("\n");

// Test 3: No personality (should fall back to professional)
console.log("3. No Personality (Professional Default):");
console.log("=" .repeat(50));
const noneConfig = { ...testConfig, personality: undefined };
const nonePrompt = AutomotivePromptService.generateSystemPrompt(noneConfig, testContext);
console.log(nonePrompt);

console.log("\n=== PERSONALITY TEST COMPLETE ===");