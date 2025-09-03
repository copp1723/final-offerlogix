/**
 * Handover Decision Logic
 *
 * Deterministic handover control that gives campaign creators full control
 * over when conversations should be handed over to humans.
 */

import {
  extractVehicleInfo,
  determinePurchaseWindow,
  analyzeCommunicationStyle,
  extractIntents,
  determineUrgencyLevel,
  generateConversationSummary,
  extractPriorities,
  extractCompetitiveContext,
  generateSalesStrategy,
  generateClosingStrategies
} from './conversation-analysis.js';

export interface HandoverTriggers {
  pricingQuestions: boolean;
  testDriveDemo: boolean;
  tradeInValue: boolean;
  financing: boolean;
  vehicleAvailability: boolean;
  urgency: boolean;
  customTriggers: string[];
}

export interface HandoverConfig {
  triggers: HandoverTriggers;
  recipient?: string | null;
  recipientName?: string | null;
}

export interface HandoverDecisionInput {
  config: HandoverConfig;
  lastUserMessage: string;
  modelHandoverFlag?: boolean;
  modelHandoverReason?: string;
}

export interface HandoverDecisionResult {
  shouldHandover: boolean;
  reason: string;
  triggeredBy: 'always' | 'never' | 'keyword' | 'model' | 'rule_fallback';
}

export interface HandoverBrief {
  // 1. Lead Identification
  leadName?: string;
  leadEmail: string;
  vehicleInfo?: string;
  campaignSource: string;
  purchaseWindow?: string;

  // 2. Conversation Summary
  conversationSummary: string;
  keyIntents: string[];

  // 3. Relationship-Building Intel
  communicationStyle: string;
  priorities: string[];
  competitiveContext?: string;

  // 4. Sales Strategy
  salesStrategy: string[];

  // 5. Closing Strategies
  closingStrategies: string[];
  urgencyLevel: 'low' | 'medium' | 'high';

  // Meta
  handoverReason: string;
  triggeredBy: string;
  generatedAt: Date;
}

/**
 * Decide whether to handover a conversation based on campaign configuration
 * 
 * Priority order:
 * 1. 'always' -> always handover
 * 2. 'never' -> never handover  
 * 3. 'rule' -> check keywords first, then model as tie-breaker
 * 4. 'model' -> use model decision only
 */
export function decideHandover(input: HandoverDecisionInput): HandoverDecisionResult {
  const { config, lastUserMessage, modelHandoverFlag, modelHandoverReason } = input;
  const userText = (lastUserMessage || '').toLowerCase();
  const triggers = config.triggers;

  // Define business trigger patterns
  const businessTriggers = [
    { key: 'pricingQuestions', enabled: triggers.pricingQuestions, keywords: ['price', 'cost', 'payment', 'monthly', 'finance', 'lease', 'buy', 'purchase', 'afford', 'budget', 'down payment', 'apr', 'interest'] },
    { key: 'testDriveDemo', enabled: triggers.testDriveDemo, keywords: ['test drive', 'demo', 'try', 'drive', 'test', 'schedule', 'appointment', 'visit', 'see the car', 'look at'] },
    { key: 'tradeInValue', enabled: triggers.tradeInValue, keywords: ['trade', 'trade-in', 'trade in', 'current car', 'my car', 'old car', 'worth', 'value', 'appraise'] },
    { key: 'financing', enabled: triggers.financing, keywords: ['financing', 'loan', 'credit', 'approve', 'qualify', 'bank', 'lender', 'terms', 'rate'] },
    { key: 'vehicleAvailability', enabled: triggers.vehicleAvailability, keywords: ['available', 'in stock', 'inventory', 'when', 'delivery', 'pickup', 'ready', 'lot'] },
    { key: 'urgency', enabled: triggers.urgency, keywords: ['asap', 'urgent', 'soon', 'today', 'this week', 'need now', 'quickly', 'rush', 'immediate'] }
  ];

  // Check for business trigger matches
  for (const trigger of businessTriggers) {
    if (trigger.enabled && trigger.keywords.some(keyword => userText.includes(keyword))) {
      const matchedKeyword = trigger.keywords.find(keyword => userText.includes(keyword));
      return {
        shouldHandover: true,
        reason: `Business trigger: ${trigger.key} (detected "${matchedKeyword}")`,
        triggeredBy: 'keyword'
      };
    }
  }

  // Check custom triggers
  if (triggers.customTriggers && triggers.customTriggers.length > 0) {
    const customMatch = triggers.customTriggers.find(customTrigger =>
      userText.includes(customTrigger.toLowerCase())
    );
    if (customMatch) {
      return {
        shouldHandover: true,
        reason: `Custom trigger: "${customMatch}"`,
        triggeredBy: 'keyword'
      };
    }
  }

  // If any triggers are enabled but none matched, use AI as fallback
  const hasAnyTriggers = businessTriggers.some(t => t.enabled) || (triggers.customTriggers && triggers.customTriggers.length > 0);

  if (hasAnyTriggers && modelHandoverFlag) {
    return {
      shouldHandover: true,
      reason: `AI fallback: ${modelHandoverReason || 'AI model recommended handover'}`,
      triggeredBy: 'rule_fallback'
    };
  }

  // No triggers configured or matched, use pure AI decision
  return {
    shouldHandover: !!modelHandoverFlag,
    reason: modelHandoverReason || (modelHandoverFlag ? 'AI model recommended handover' : 'AI model did not recommend handover'),
    triggeredBy: 'model'
  };
}

/**
 * Extract handover configuration from campaign data
 */
export function extractHandoverConfig(campaign: any): HandoverConfig {
  const triggers = campaign?.handoverTriggers || campaign?.handover_triggers || {
    pricingQuestions: false,
    testDriveDemo: false,
    tradeInValue: false,
    financing: false,
    vehicleAvailability: false,
    urgency: false,
    customTriggers: []
  };

  return {
    triggers,
    recipient: campaign?.handoverRecipient || campaign?.handover_recipient || null,
    recipientName: campaign?.handoverRecipientName || campaign?.handover_recipient_name || null,
  };
}

/**
 * Generate handover brief from conversation data
 */
export function generateHandoverBrief(input: {
  conversationHistory: Array<{ role: string; content: string; timestamp?: Date }>;
  leadEmail: string;
  campaignName?: string;
  handoverReason: string;
  triggeredBy: string;
  lastUserMessage: string;
}): HandoverBrief {
  const { conversationHistory, leadEmail, campaignName, handoverReason, triggeredBy, lastUserMessage } = input;

  // Extract lead name from email or conversation
  const leadName = extractLeadName(conversationHistory, leadEmail);

  // Analyze conversation for key insights
  const analysis = analyzeConversation(conversationHistory, lastUserMessage);

  return {
    // 1. Lead Identification
    leadName,
    leadEmail,
    vehicleInfo: analysis.vehicleInfo,
    campaignSource: campaignName || 'Unknown Campaign',
    purchaseWindow: analysis.purchaseWindow,

    // 2. Conversation Summary
    conversationSummary: analysis.summary,
    keyIntents: analysis.intents,

    // 3. Relationship-Building Intel
    communicationStyle: analysis.communicationStyle,
    priorities: analysis.priorities,
    competitiveContext: analysis.competitiveContext,

    // 4. Sales Strategy
    salesStrategy: analysis.salesStrategy,

    // 5. Closing Strategies
    closingStrategies: analysis.closingStrategies,
    urgencyLevel: analysis.urgencyLevel,

    // Meta
    handoverReason,
    triggeredBy,
    generatedAt: new Date(),
  };
}

/**
 * Extract lead name from conversation or email
 */
function extractLeadName(conversationHistory: Array<{ role: string; content: string }>, leadEmail: string): string | undefined {
  // Try to find name in conversation (look for "I'm [Name]" or similar patterns)
  for (const message of conversationHistory) {
    if (message.role === 'user') {
      const nameMatch = message.content.match(/(?:i'm|i am|my name is|this is)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
      if (nameMatch) {
        return nameMatch[1].trim();
      }
    }
  }

  // Fallback: extract from email (before @)
  const emailName = leadEmail.split('@')[0];
  if (emailName && emailName.length > 2) {
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }

  return undefined;
}

/**
 * Analyze conversation for handover brief insights
 */
function analyzeConversation(conversationHistory: Array<{ role: string; content: string }>, lastUserMessage: string) {
  const userMessages = conversationHistory.filter(m => m.role === 'user').map(m => m.content);
  const allText = userMessages.join(' ').toLowerCase();

  // Extract vehicle information
  const vehicleInfo = extractVehicleInfo(allText);

  // Determine purchase window based on urgency indicators
  const purchaseWindow = determinePurchaseWindow(allText, lastUserMessage);

  // Analyze communication style
  const communicationStyle = analyzeCommunicationStyle(userMessages);

  // Extract key intents
  const intents = extractIntents(allText);

  // Determine urgency level
  const urgencyLevel = determineUrgencyLevel(allText, lastUserMessage);

  // Generate conversation summary
  const summary = generateConversationSummary(userMessages, intents);

  // Extract priorities
  const priorities = extractPriorities(allText, intents);

  // Check for competitive context
  const competitiveContext = extractCompetitiveContext(allText);

  // Generate sales strategy
  const salesStrategy = generateSalesStrategy(intents, urgencyLevel, vehicleInfo);

  // Generate closing strategies
  const closingStrategies = generateClosingStrategies(urgencyLevel, intents);

  return {
    vehicleInfo,
    purchaseWindow,
    summary,
    intents,
    communicationStyle,
    priorities,
    competitiveContext,
    salesStrategy,
    closingStrategies,
    urgencyLevel,
  };
}
