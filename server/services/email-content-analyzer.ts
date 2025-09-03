export interface ContentAnalysisResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  recommendations: string[];
  flags: {
    spamKeywords: string[];
    suspiciousPatterns: string[];
    excessivePunctuation: boolean;
    allCapsText: string[];
    promotionalContent: boolean;
  };
}

/**
 * Content Analysis Service for email spam prevention
 * Analyzes email content to reduce spam complaints and improve deliverability
 */
export class EmailContentAnalyzer {
  private static spamKeywords = [
    // High-risk promotional terms
    'free', 'guaranteed', 'urgent', 'act now', 'limited time',
    'click here', 'buy now', 'special offer', 'no obligation',
    'risk free', 'money back', 'instant', 'immediately',
    'cash', 'prize', 'winner', 'congratulations',
    
    // Financial/scam indicators
    'make money', 'earn money', 'financial freedom',
    'work from home', 'no experience', 'easy money',
    'investment', 'loan', 'credit', 'debt',
    
    // Aggressive sales terms
    'don\'t hesitate', 'call now', 'order now', 'buy direct',
    'while supplies last', 'expires soon', 'final notice'
  ];

  private static suspiciousPatterns = [
    // Credit card patterns
    { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, description: 'Credit card number pattern' },
    
    // SSN patterns
    { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, description: 'Social security number pattern' },
    
    // Phone patterns with aggressive context
    { pattern: /call\s+now.{0,20}\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/gi, description: 'Aggressive phone solicitation' },
    
    // Excessive money symbols
    { pattern: /\$\$\$+/g, description: 'Multiple dollar signs' },
    
    // Excessive exclamation marks
    { pattern: /!!!+/g, description: 'Multiple exclamation marks' },
    
    // Urgent action phrases
    { pattern: /(urgent|immediate|act now|limited time).{0,50}(click|buy|purchase|call)/gi, description: 'Urgent action solicitation' },
    
    // All caps words (5+ characters)
    { pattern: /\b[A-Z]{5,}\b/g, description: 'Excessive capitalization' },
    
    // Suspicious links
    { pattern: /(bit\.ly|tinyurl|t\.co|goo\.gl|short\.link)/gi, description: 'Shortened URL links' }
  ];

  /**
   * Analyze email content for spam indicators
   */
  static analyzeContent(subject: string, body: string): ContentAnalysisResult {
    const content = `${subject} ${body}`;
    const contentLower = content.toLowerCase();
    
    let riskScore = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];
    const flags = {
      spamKeywords: [] as string[],
      suspiciousPatterns: [] as string[],
      excessivePunctuation: false,
      allCapsText: [] as string[],
      promotionalContent: false
    };

    // Check for spam keywords
    for (const keyword of this.spamKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        flags.spamKeywords.push(keyword);
        riskScore += this.getKeywordRisk(keyword);
        issues.push(`Contains spam keyword: "${keyword}"`);
      }
    }

    // Check suspicious patterns
    for (const { pattern, description } of this.suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        flags.suspiciousPatterns.push(description);
        riskScore += matches.length * 10;
        issues.push(`${description}: ${matches.length} occurrence(s)`);
        
        // Special handling for all caps
        if (description === 'Excessive capitalization') {
          flags.allCapsText.push(...matches);
        }
      }
    }

    // Check excessive punctuation
    const exclamationCount = (content.match(/!/g) || []).length;
    const questionCount = (content.match(/\?/g) || []).length;
    
    if (exclamationCount > 3 || questionCount > 3) {
      flags.excessivePunctuation = true;
      riskScore += 5;
      issues.push('Excessive punctuation marks');
    }

    // Check promotional content density
    const promotionalWords = ['sale', 'discount', 'offer', 'deal', 'promotion', 'savings'];
    let promotionalCount = 0;
    
    for (const word of promotionalWords) {
      promotionalCount += (contentLower.match(new RegExp(word, 'g')) || []).length;
    }
    
    if (promotionalCount > 3) {
      flags.promotionalContent = true;
      riskScore += 8;
      issues.push('High promotional content density');
    }

    // Subject line specific checks
    if (subject) {
      if (subject.length > 50) {
        riskScore += 3;
        issues.push('Subject line is too long');
      }
      
      if (subject === subject.toUpperCase() && subject.length > 10) {
        riskScore += 10;
        issues.push('Subject line is all caps');
      }
      
      if ((subject.match(/!/g) || []).length > 1) {
        riskScore += 5;
        issues.push('Multiple exclamation marks in subject');
      }
    }

    // Content length and quality checks
    if (body.length < 50) {
      riskScore += 15;
      issues.push('Email content is too short');
    }

    const wordCount = body.split(/\s+/).length;
    const linkCount = (body.match(/https?:\/\/[^\s]+/g) || []).length;
    
    if (linkCount > 0 && wordCount / linkCount < 20) {
      riskScore += 10;
      issues.push('High link-to-text ratio');
    }

    // Generate recommendations
    this.generateRecommendations(riskScore, flags, recommendations);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 50) {
      riskLevel = 'high';
    } else if (riskScore >= 20) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      riskScore: Math.min(riskScore, 100),
      riskLevel,
      issues,
      recommendations,
      flags
    };
  }

  /**
   * Get risk score for specific keywords
   */
  private static getKeywordRisk(keyword: string): number {
    const highRiskKeywords = ['free', 'guaranteed', 'urgent', 'act now', 'make money'];
    const mediumRiskKeywords = ['limited time', 'special offer', 'buy now', 'cash'];
    
    if (highRiskKeywords.includes(keyword.toLowerCase())) {
      return 15;
    } else if (mediumRiskKeywords.includes(keyword.toLowerCase())) {
      return 10;
    }
    return 5;
  }

  /**
   * Generate recommendations based on analysis
   */
  private static generateRecommendations(
    riskScore: number, 
    flags: ContentAnalysisResult['flags'], 
    recommendations: string[]
  ): void {
    if (flags.spamKeywords.length > 0) {
      recommendations.push('Reduce use of promotional language and spam trigger words');
    }

    if (flags.allCapsText.length > 0) {
      recommendations.push('Avoid excessive capitalization - use normal sentence case');
    }

    if (flags.excessivePunctuation) {
      recommendations.push('Remove excessive punctuation marks');
    }

    if (flags.promotionalContent) {
      recommendations.push('Balance promotional content with valuable information');
    }

    if (flags.suspiciousPatterns.length > 0) {
      recommendations.push('Review content for patterns that may trigger spam filters');
    }

    if (riskScore > 30) {
      recommendations.push('Consider rewriting the email with more natural, conversational tone');
    }

    if (recommendations.length === 0) {
      recommendations.push('Content looks good for delivery');
    }
  }

  /**
   * Quick spam score check for integration
   */
  static getSpamScore(subject: string, body: string): number {
    return this.analyzeContent(subject, body).riskScore;
  }

  /**
   * Check if content should be blocked based on risk threshold
   */
  static shouldBlock(subject: string, body: string, threshold: number = 50): boolean {
    return this.getSpamScore(subject, body) >= threshold;
  }
}
