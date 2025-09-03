export interface LeadScoreWeights {
  urgency: number;
  questions: number;
  engagement: number;
  timeline: number;
}

const DEFAULT_WEIGHTS: LeadScoreWeights = {
  urgency: 0.4,
  questions: 0.2,
  engagement: 0.2,
  timeline: 0.2,
};

const URGENCY_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'soon', 'fast', 'quick',
  'rush', 'emergency', 'priority', 'deadline'
];

const TIMELINE_INDICATORS = [
  'today', 'tomorrow', 'this week', 'next week', 'this month', 'next month',
  'weekend', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'
];

const ENGAGEMENT_KEYWORDS = [
  'interested', 'want', 'need', 'looking for', 'shopping',
  'buying', 'purchase', 'ready', 'serious'
];

/**
 * Calculate a lead qualification score based on recent messages.
 * Score is normalized 0-100.
 * 
 * @param messages Array of message content strings
 * @param weights Optional custom weights for scoring factors
 * @returns Score between 0-100
 */
export function calculateLeadScore(
  messages: string[],
  weights: Partial<LeadScoreWeights> = {},
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  if (!messages.length) return 0;

  const text = messages.join(' ').toLowerCase();

  // Urgency scoring - looks for urgent keywords
  const urgencyHits = URGENCY_KEYWORDS.reduce(
    (acc, keyword) => (text.includes(keyword) ? acc + 1 : acc),
    0,
  );
  const urgencyScore = Math.min(1, urgencyHits / 2); // cap at 2 hits for max score

  // Question complexity - more questions indicate higher engagement
  const questionCount = (text.match(/\?/g) || []).length;
  const questionScore = Math.min(1, questionCount / 3); // cap at 3 questions

  // Engagement indicators
  const engagementHits = ENGAGEMENT_KEYWORDS.reduce(
    (acc, keyword) => (text.includes(keyword) ? acc + 1 : acc),
    0,
  );
  // Combine message count and engagement keywords
  const messageEngagement = Math.min(1, messages.length / 5); // cap at 5 messages
  const keywordEngagement = Math.min(1, engagementHits / 3); // cap at 3 keywords
  const engagementScore = Math.max(messageEngagement, keywordEngagement);

  // Timeline indicators - shows readiness to move forward
  const timelineHits = TIMELINE_INDICATORS.reduce(
    (acc, keyword) => (text.includes(keyword) ? acc + 1 : acc),
    0,
  );
  const timelineScore = Math.min(1, timelineHits / 2); // cap at 2 timeline mentions

  // Calculate weighted total
  const total =
    urgencyScore * w.urgency +
    questionScore * w.questions +
    engagementScore * w.engagement +
    timelineScore * w.timeline;

  return Math.round(total * 100);
}

/**
 * Get default score thresholds for handover decisions
 */
export const DEFAULT_SCORE_THRESHOLDS = {
  immediate: 75, // Immediate handover threshold
  scheduled: 50, // Scheduled handover threshold
};

/**
 * Interpret lead score into actionable categories
 */
export function interpretLeadScore(score: number): {
  category: 'hot' | 'warm' | 'cold';
  action: 'immediate' | 'scheduled' | 'nurture';
  description: string;
} {
  if (score >= 75) {
    return {
      category: 'hot',
      action: 'immediate',
      description: 'High-intent lead ready for immediate handover',
    };
  } else if (score >= 50) {
    return {
      category: 'warm',
      action: 'scheduled',
      description: 'Engaged lead suitable for scheduled follow-up',
    };
  } else {
    return {
      category: 'cold',
      action: 'nurture',
      description: 'Early-stage lead requiring nurturing',
    };
  }
}

/**
 * Validate scoring weights configuration
 */
export function validateScoreWeights(weights: Partial<LeadScoreWeights>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check all weights are between 0 and 1
  for (const [key, value] of Object.entries(weights)) {
    if (typeof value !== 'number' || value < 0 || value > 1) {
      errors.push(`Weight '${key}' must be a number between 0 and 1`);
    }
  }
  
  // Check weights sum to approximately 1.0 (allow small floating point variance)
  const totalWeight = Object.values({ ...DEFAULT_WEIGHTS, ...weights })
    .reduce((sum, weight) => sum + weight, 0);
  
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    errors.push(`Total weights must sum to 1.0, got ${totalWeight.toFixed(3)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}