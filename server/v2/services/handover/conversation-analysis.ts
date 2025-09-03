/**
 * Conversation Analysis Utilities for Handover Briefs
 * 
 * Extracts actionable intelligence from conversation history.
 */

/**
 * Extract vehicle information from conversation text
 */
export function extractVehicleInfo(text: string): string | undefined {
  // Look for year + make + model patterns
  const vehiclePatterns = [
    /(\d{4})\s+(toyota|honda|ford|chevrolet|nissan|hyundai|kia|mazda|subaru|volkswagen|bmw|mercedes|audi|lexus|acura|infiniti|cadillac|lincoln|buick|gmc|ram|jeep|dodge|chrysler)\s+(\w+)/i,
    /(toyota|honda|ford|chevrolet|nissan|hyundai|kia|mazda|subaru|volkswagen|bmw|mercedes|audi|lexus|acura|infiniti|cadillac|lincoln|buick|gmc|ram|jeep|dodge|chrysler)\s+(\w+)\s*(\d{4})?/i,
    /(prius|camry|corolla|accord|civic|f-150|silverado|altima|sentra|elantra|sonata|optima|cx-5|outback|forester|jetta|passat|3 series|c-class|a4|es|tlx|q50)/i
  ];
  
  for (const pattern of vehiclePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && match[2] && match[3]) {
        // Year Make Model
        return `${match[1]} ${match[2]} ${match[3]}`.replace(/\s+/g, ' ').trim();
      } else if (match[1] && match[2]) {
        // Make Model or Model only
        return `${match[1]} ${match[2]}`.replace(/\s+/g, ' ').trim();
      } else if (match[1]) {
        // Model only
        return match[1].trim();
      }
    }
  }
  
  return undefined;
}

/**
 * Determine purchase/service window from conversation urgency
 */
export function determinePurchaseWindow(text: string, lastMessage: string): string {
  const urgentIndicators = [
    'asap', 'urgent', 'immediately', 'right away', 'today', 'tomorrow',
    'this week', 'soon', 'quickly', 'fast', 'emergency'
  ];
  
  const nearTermIndicators = [
    'next week', 'this month', 'within', 'by', 'before', 'schedule', 'appointment'
  ];
  
  const recentText = (text + ' ' + lastMessage.toLowerCase());
  
  if (urgentIndicators.some(indicator => recentText.includes(indicator))) {
    return 'Immediate (within days)';
  }
  
  if (nearTermIndicators.some(indicator => recentText.includes(indicator))) {
    return 'Near-term (within weeks)';
  }
  
  // Check for specific timeframes
  if (recentText.match(/\d+\s*(day|week|month)s?/)) {
    return 'Specific timeframe mentioned';
  }
  
  return 'Timeline unclear - ask for urgency';
}

/**
 * Analyze communication style from message patterns
 */
export function analyzeCommunicationStyle(userMessages: string[]): string {
  const totalLength = userMessages.join('').length;
  const avgLength = totalLength / userMessages.length;
  const hasQuestions = userMessages.some(msg => msg.includes('?'));
  const hasExclamations = userMessages.some(msg => msg.includes('!'));
  
  if (avgLength < 50 && hasQuestions) {
    return 'Direct, efficiency-focused - prefers quick answers';
  }
  
  if (avgLength > 150) {
    return 'Detailed communicator - provides context, expects thorough responses';
  }
  
  if (hasExclamations) {
    return 'Enthusiastic - responds well to energy and excitement';
  }
  
  return 'Balanced communicator - adapts to professional tone';
}

/**
 * Extract key intents from conversation
 */
export function extractIntents(text: string): string[] {
  const intentMap = {
    pricing: ['price', 'cost', 'expensive', 'cheap', 'afford', 'budget', 'payment', 'finance', 'lease', 'monthly'],
    scheduling: ['schedule', 'appointment', 'book', 'available', 'when', 'time', 'calendar', 'slot'],
    comparison: ['compare', 'versus', 'vs', 'better', 'difference', 'other', 'competitor', 'alternative'],
    technical: ['battery', 'engine', 'maintenance', 'service', 'repair', 'diagnostic', 'check', 'problem'],
    purchase: ['buy', 'purchase', 'get', 'want', 'need', 'looking for', 'interested', 'ready'],
    information: ['tell me', 'explain', 'how', 'what', 'why', 'details', 'information', 'learn']
  };
  
  const foundIntents: string[] = [];
  
  for (const [intent, keywords] of Object.entries(intentMap)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      foundIntents.push(intent);
    }
  }
  
  return foundIntents.length > 0 ? foundIntents : ['general_inquiry'];
}

/**
 * Determine urgency level from conversation
 */
export function determineUrgencyLevel(text: string, lastMessage: string): 'low' | 'medium' | 'high' {
  const highUrgency = ['urgent', 'asap', 'immediately', 'emergency', 'today', 'right now', 'need help'];
  const mediumUrgency = ['soon', 'this week', 'quickly', 'schedule', 'appointment', 'when can'];
  
  const recentText = (text + ' ' + lastMessage.toLowerCase());
  
  if (highUrgency.some(indicator => recentText.includes(indicator))) {
    return 'high';
  }
  
  if (mediumUrgency.some(indicator => recentText.includes(indicator))) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Generate conversation summary
 */
export function generateConversationSummary(userMessages: string[], intents: string[]): string {
  const primaryIntent = intents[0] || 'general_inquiry';
  const messageCount = userMessages.length;
  
  let summary = '';
  
  if (intents.includes('pricing')) {
    summary += 'Asked specifically about pricing and costs. ';
  }
  
  if (intents.includes('scheduling')) {
    summary += 'Wants to schedule an appointment or service. ';
  }
  
  if (intents.includes('technical')) {
    summary += 'Has technical questions or service needs. ';
  }
  
  if (intents.includes('comparison')) {
    summary += 'Comparing options with competitors. ';
  }
  
  if (messageCount > 3) {
    summary += 'Engaged in detailed conversation - high interest level. ';
  }
  
  return summary.trim() || 'General inquiry about products/services.';
}

/**
 * Extract customer priorities from conversation
 */
export function extractPriorities(text: string, intents: string[]): string[] {
  const priorities: string[] = [];
  
  if (text.includes('price') || text.includes('cost') || text.includes('budget')) {
    priorities.push('Cost-conscious - price transparency important');
  }
  
  if (text.includes('quality') || text.includes('reliable') || text.includes('best')) {
    priorities.push('Quality-focused - values reliability and reputation');
  }
  
  if (text.includes('quick') || text.includes('fast') || text.includes('convenient')) {
    priorities.push('Convenience-driven - values speed and efficiency');
  }
  
  if (intents.includes('comparison')) {
    priorities.push('Research-oriented - comparing multiple options');
  }
  
  return priorities.length > 0 ? priorities : ['Standard service expectations'];
}

/**
 * Extract competitive context
 */
export function extractCompetitiveContext(text: string): string | undefined {
  const competitors = ['other dealer', 'another shop', 'competitor', 'elsewhere', 'different place', 'quote from'];
  
  if (competitors.some(comp => text.includes(comp))) {
    return 'Actively comparing with other providers - competitive situation';
  }
  
  return undefined;
}

/**
 * Generate sales strategy recommendations
 */
export function generateSalesStrategy(intents: string[], urgencyLevel: string, vehicleInfo?: string): string[] {
  const strategies: string[] = [];
  
  if (intents.includes('pricing')) {
    strategies.push('Lead with transparent pricing - provide clear breakdown upfront');
  }
  
  if (intents.includes('scheduling')) {
    strategies.push('Offer immediate appointment availability - show flexibility');
  }
  
  if (intents.includes('technical') && vehicleInfo) {
    strategies.push(`Position as ${vehicleInfo} specialist - highlight relevant expertise`);
  }
  
  if (urgencyLevel === 'high') {
    strategies.push('Emphasize same-day service capability and immediate solutions');
  }
  
  if (intents.includes('comparison')) {
    strategies.push('Differentiate with unique value props - factory training, warranties, follow-up');
  }
  
  return strategies.length > 0 ? strategies : ['Build rapport and understand specific needs'];
}

/**
 * Generate closing strategies
 */
export function generateClosingStrategies(urgencyLevel: string, intents: string[]): string[] {
  const strategies: string[] = [];
  
  if (urgencyLevel === 'high') {
    strategies.push('Speed matters: reach out same day - don\'t leave this on the table');
    strategies.push('Lock in appointment slot first, then expand into package/upsell');
  }
  
  if (intents.includes('pricing')) {
    strategies.push('Be prepared with promotion or incentive to differentiate your offer');
    strategies.push('Provide financing options if price is a concern');
  }
  
  if (intents.includes('scheduling')) {
    strategies.push('Offer multiple time slots and confirm availability immediately');
  }
  
  strategies.push('Follow up with transparent, confident response to seal the deal');
  
  return strategies;
}
