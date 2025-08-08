// Comprehensive test to verify personality is actually affecting AI responses
import { processCampaignChat } from './services/ai-chat';

async function testPersonalityResponses() {
  console.log("=== TESTING PERSONALITY IN ACTUAL AI RESPONSES ===\n");

  // Test message from a hesitant customer
  const testMessage = "I'm not sure if I want to do this yet... maybe I should wait?";
  const step = "target_audience";
  const campaignData = { type: "test drive campaign" };

  console.log("Test Message:", testMessage);
  console.log("Expected: GRUMPY personality should show impatience\n");

  try {
    const response = await processCampaignChat(testMessage, step, campaignData);
    
    console.log("AI Response:");
    console.log("=" .repeat(50));
    console.log(response.message);
    console.log("\n");
    
    // Check for grumpy indicators
    const grumpyPhrases = ['Look', 'Listen', 'Fine', 'Come on', 'moving', 'decide'];
    const foundPhrases = grumpyPhrases.filter(phrase => 
      response.message.toLowerCase().includes(phrase.toLowerCase())
    );
    
    console.log("Grumpy Personality Indicators Found:", foundPhrases);
    console.log("Response shows personality?", foundPhrases.length > 0 ? "YES" : "NO");
    
  } catch (error) {
    console.error("Error testing personality:", error);
  }

  console.log("\n=== PERSONALITY RESPONSE TEST COMPLETE ===");
}

testPersonalityResponses();