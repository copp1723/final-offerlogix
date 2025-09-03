import { 
  calculateLeadScore, 
  interpretLeadScore, 
  validateScoreWeights, 
  DEFAULT_SCORE_THRESHOLDS 
} from '../../server/services/lead-score';

describe('calculateLeadScore', () => {
  it('returns 0 for empty messages', () => {
    const score = calculateLeadScore([]);
    expect(score).toBe(0);
  });

  it('scores urgency keywords highly', () => {
    const messages = ['I need a car ASAP!'];
    const score = calculateLeadScore(messages);
    expect(score).toBeGreaterThan(20); // Urgency weight is 0.4, gets partial points
  });

  it('scores questions appropriately', () => {
    const messages = ['What is the price? Can I finance? When can I test drive?'];
    const score = calculateLeadScore(messages);
    expect(score).toBeGreaterThan(15); // Question weight is 0.2, so should get points
  });

  it('scores engagement based on message count', () => {
    const manyMessages = ['Hi', 'Interested', 'Tell me more', 'Perfect', 'Let\'s proceed'];
    const fewMessages = ['Hi'];
    
    const highScore = calculateLeadScore(manyMessages);
    const lowScore = calculateLeadScore(fewMessages);
    
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('scores timeline indicators', () => {
    const messages = ['I need this today', 'Can we close this week?'];
    const score = calculateLeadScore(messages);
    expect(score).toBeGreaterThan(15); // Timeline weight is 0.2
  });

  it('respects custom weights', () => {
    const messages = ['What is the price?'];
    const defaultScore = calculateLeadScore(messages);
    const customScore = calculateLeadScore(messages, { questions: 0.8, urgency: 0.1, engagement: 0.05, timeline: 0.05 });
    
    expect(customScore).toBeGreaterThan(defaultScore);
  });

  it('returns score between 0-100', () => {
    const highEngagementMessages = [
      'I need a car ASAP!',
      'What financing options do you have?',
      'Can I test drive today?',
      'This looks perfect for me',
      'Let\'s close this deal'
    ];
    
    const score = calculateLeadScore(highEngagementMessages);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles mixed engagement levels', () => {
    const urgentMessages = ['Need car urgent', 'ASAP please'];
    const casualMessages = ['Hi there', 'Just looking'];
    
    const urgentScore = calculateLeadScore(urgentMessages);
    const casualScore = calculateLeadScore(casualMessages);
    
    expect(urgentScore).toBeGreaterThan(casualScore);
  });
});

describe('interpretLeadScore', () => {
  it('categorizes hot leads correctly', () => {
    const interpretation = interpretLeadScore(85);
    expect(interpretation.category).toBe('hot');
    expect(interpretation.action).toBe('immediate');
  });

  it('categorizes warm leads correctly', () => {
    const interpretation = interpretLeadScore(60);
    expect(interpretation.category).toBe('warm');
    expect(interpretation.action).toBe('scheduled');
  });

  it('categorizes cold leads correctly', () => {
    const interpretation = interpretLeadScore(30);
    expect(interpretation.category).toBe('cold');
    expect(interpretation.action).toBe('nurture');
  });

  it('handles boundary conditions', () => {
    expect(interpretLeadScore(75).category).toBe('hot');
    expect(interpretLeadScore(74).category).toBe('warm');
    expect(interpretLeadScore(50).category).toBe('warm');
    expect(interpretLeadScore(49).category).toBe('cold');
  });
});

describe('validateScoreWeights', () => {
  it('validates correct weights', () => {
    const result = validateScoreWeights({ urgency: 0.4, questions: 0.2, engagement: 0.2, timeline: 0.2 });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects weights outside 0-1 range', () => {
    const result = validateScoreWeights({ urgency: 1.5 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('must be a number between 0 and 1'))).toBe(true);
  });

  it('rejects weights that don\'t sum to 1', () => {
    const result = validateScoreWeights({ urgency: 0.8 }); // Total would be 1.4 with defaults
    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('must sum to 1.0'))).toBe(true);
  });

  it('allows small floating point variance', () => {
    const result = validateScoreWeights({ urgency: 0.401, questions: 0.199 }); // Sum: 1.0005
    expect(result.isValid).toBe(true);
  });
});

describe('DEFAULT_SCORE_THRESHOLDS', () => {
  it('has reasonable default values', () => {
    expect(DEFAULT_SCORE_THRESHOLDS.immediate).toBe(75);
    expect(DEFAULT_SCORE_THRESHOLDS.scheduled).toBe(50);
    expect(DEFAULT_SCORE_THRESHOLDS.immediate).toBeGreaterThan(DEFAULT_SCORE_THRESHOLDS.scheduled);
  });
});