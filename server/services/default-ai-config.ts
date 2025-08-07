import { storage } from '../storage';

export const DEFAULT_AI_AGENT_CONFIG = {
  name: "AutoCampaigns AI Assistant",
  systemPrompt: `You are an automotive AI assistant specializing in email campaign management and customer communication.

Your role:
- Help customers with vehicle inquiries, pricing, and appointment scheduling
- Process automotive-specific conversations with industry knowledge
- Generate intelligent responses for email campaigns
- Assist with lead qualification and follow-ups

Automotive expertise:
- Vehicle features, specifications, and comparisons
- Financing options and incentives
- Service scheduling and maintenance reminders
- Test drive coordination and dealership processes

Communication style:
- Professional yet friendly tone
- Clear and concise responses
- Focus on customer needs and vehicle solutions
- Always aim to move leads toward dealership contact or appointment

Key objectives:
- Qualify leads effectively 
- Schedule test drives and appointments
- Provide accurate vehicle information
- Maintain customer engagement throughout the sales process`,

  responseModel: "gpt-4o",
  temperature: 0.7,
  maxTokens: 500,
  isActive: true,
  settings: {
    autoRespond: true,
    responseDelay: 2000,
    enableHandover: true,
    handoverKeywords: ["speak to human", "talk to salesperson", "manager", "urgent"],
    businessHours: {
      enabled: true,
      timezone: "America/New_York",
      schedule: {
        monday: { start: "09:00", end: "18:00" },
        tuesday: { start: "09:00", end: "18:00" },
        wednesday: { start: "09:00", end: "18:00" },
        thursday: { start: "09:00", end: "18:00" },
        friday: { start: "09:00", end: "18:00" },
        saturday: { start: "10:00", end: "16:00" },
        sunday: { start: "12:00", end: "17:00" }
      }
    }
  }
};

export async function seedDefaultAiConfig() {
  try {
    // Check if any AI agent config exists
    const existingConfigs = await storage.getAiAgentConfigs();
    
    if (existingConfigs.length === 0) {
      console.log('🤖 Creating default AI agent configuration...');
      
      const defaultConfig = await storage.createAiAgentConfig(DEFAULT_AI_AGENT_CONFIG);
      console.log(`✅ Default AI agent configuration created: ${defaultConfig.name}`);
      
      return defaultConfig;
    } else {
      console.log('✅ AI agent configuration already exists');
      return existingConfigs[0];
    }
  } catch (error) {
    console.error('❌ Failed to seed default AI agent configuration:', error);
    throw error;
  }
}