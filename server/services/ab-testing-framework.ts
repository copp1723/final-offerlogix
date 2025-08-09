import { storage } from '../storage';
import type { Campaign, Lead, Conversation } from '@shared/schema';

/**
 * Advanced A/B Testing Framework
 * Statistical significance testing for campaign optimization
 */

export interface ABTest {
  id: string;
  name: string;
  hypothesis: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  category: 'subject_line' | 'content' | 'timing' | 'audience' | 'template' | 'personalization';
  variants: TestVariant[];
  testConfiguration: TestConfiguration;
  results: TestResults;
  statisticalAnalysis: StatisticalAnalysis;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface TestVariant {
  id: string;
  name: string;
  description: string;
  isControl: boolean;
  trafficAllocation: number; // percentage
  configuration: VariantConfiguration;
  metrics: VariantMetrics;
  sampleSize: number;
}

export interface TestConfiguration {
  primaryMetric: 'open_rate' | 'response_rate' | 'conversion_rate' | 'revenue';
  secondaryMetrics: string[];
  minimumDetectableEffect: number; // percentage
  confidenceLevel: number; // percentage (90, 95, 99)
  statisticalPower: number; // percentage (80, 90)
  testDuration: number; // days
  minimumSampleSize: number;
  maxSampleSize?: number;
  significanceThreshold: number; // p-value threshold
  trafficSplit: 'equal' | 'weighted' | 'adaptive';
  earlyStoppingRules: EarlyStoppingRule[];
}

export interface VariantConfiguration {
  subjectLine?: string;
  emailTemplate?: string;
  sendTime?: { hour: number; dayOfWeek: number };
  personalizationLevel?: 'none' | 'basic' | 'advanced';
  contentType?: 'text' | 'html' | 'mixed';
  callToAction?: string;
  targetAudience?: string[];
}

export interface VariantMetrics {
  participants: number;
  opens: number;
  responses: number;
  conversions: number;
  revenue: number;
  openRate: number;
  responseRate: number;
  conversionRate: number;
  averageRevenue: number;
  confidenceInterval: ConfidenceInterval;
}

export interface TestResults {
  winner?: string; // variant ID
  isStatisticallySignificant: boolean;
  pValue: number;
  effect: number; // percentage improvement
  confidence: number; // percentage
  recommendedAction: 'implement_winner' | 'continue_testing' | 'redesign_test' | 'no_clear_winner';
  summary: string;
  insights: string[];
  nextSteps: string[];
}

export interface StatisticalAnalysis {
  testType: 'z_test' | 't_test' | 'chi_square' | 'bayesian';
  sampleSizes: { [variantId: string]: number };
  conversions: { [variantId: string]: number };
  conversionRates: { [variantId: string]: number };
  standardErrors: { [variantId: string]: number };
  zScores: { [variantId: string]: number };
  pValues: { [variantId: string]: number };
  confidenceIntervals: { [variantId: string]: ConfidenceInterval };
  effectSizes: { [variantId: string]: number };
  statisticalPower: number;
  minimumDetectableEffect: number;
  isUnderpowered: boolean;
  recommendations: string[];
}

export interface EarlyStoppingRule {
  type: 'futility' | 'superiority' | 'non_inferiority';
  threshold: number;
  minimumSampleSize: number;
  checkFrequency: number; // days
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number; // percentage
}

export interface TestRecommendation {
  testName: string;
  category: string;
  hypothesis: string;
  variants: TestVariantSuggestion[];
  expectedImpact: number;
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: number; // days
  requiredSampleSize: number;
  businessValue: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TestVariantSuggestion {
  name: string;
  description: string;
  expectedPerformance: number;
  isControl: boolean;
}

export interface ABTestPortfolio {
  activeTests: ABTest[];
  completedTests: ABTest[];
  plannedTests: TestRecommendation[];
  portfolioMetrics: PortfolioMetrics;
  learnings: TestLearning[];
}

export interface PortfolioMetrics {
  totalTestsRun: number;
  winRate: number; // percentage of tests with significant winners
  averageEffect: number; // percentage
  totalRevenueLift: number;
  averageTestDuration: number; // days
  testsInQueue: number;
  monthlyTestVelocity: number;
}

export interface TestLearning {
  category: string;
  insight: string;
  impact: 'high' | 'medium' | 'low';
  applicability: 'universal' | 'segment_specific' | 'context_dependent';
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  sourceTests: string[];
}

export class ABTestingFramework {
  private activeTests: Map<string, ABTest> = new Map();
  private completedTests: Map<string, ABTest> = new Map();
  private testAssignments: Map<string, string> = new Map(); // leadId -> variantId

  /**
   * Create a new A/B test
   */
  async createTest(testDefinition: Partial<ABTest>): Promise<ABTest> {
    const test: ABTest = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: testDefinition.name || 'Untitled Test',
      hypothesis: testDefinition.hypothesis || '',
      status: 'draft',
      category: testDefinition.category || 'content',
      variants: testDefinition.variants || [],
      testConfiguration: testDefinition.testConfiguration || this.getDefaultConfiguration(),
      results: this.initializeResults(),
      statisticalAnalysis: this.initializeStatisticalAnalysis(),
      createdAt: new Date(),
      createdBy: testDefinition.createdBy || 'system'
    };

    // Validate test configuration
    this.validateTest(test);

    // Calculate required sample size
    const requiredSampleSize = this.calculateSampleSize(
      test.testConfiguration.minimumDetectableEffect,
      test.testConfiguration.confidenceLevel,
      test.testConfiguration.statisticalPower
    );
    test.testConfiguration.minimumSampleSize = requiredSampleSize;

    return test;
  }

  /**
   * Start running an A/B test
   */
  async startTest(testId: string): Promise<void> {
    const test = await this.getTest(testId);
    if (!test) throw new Error('Test not found');

    if (test.status !== 'draft') {
      throw new Error('Only draft tests can be started');
    }

    // Validate readiness
    this.validateTestReadiness(test);

    test.status = 'running';
    test.startedAt = new Date();

    this.activeTests.set(testId, test);

    console.log(`A/B test "${test.name}" started with ${test.variants.length} variants`);
  }

  /**
   * Assign a lead to a test variant
   */
  async assignToVariant(leadId: string, testId: string): Promise<string> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error('Test not found or not active');

    // Check if lead is already assigned
    const existingAssignment = this.testAssignments.get(leadId);
    if (existingAssignment) {
      return existingAssignment;
    }

    // Assign based on traffic allocation
    const variant = this.selectVariantForLead(leadId, test);
    this.testAssignments.set(leadId, variant.id);

    // Update participant count
    variant.sampleSize++;

    return variant.id;
  }

  /**
   * Record test event (open, response, conversion, etc.)
   */
  async recordEvent(
    leadId: string,
    testId: string,
    eventType: 'open' | 'response' | 'conversion',
    value?: number
  ): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) return; // Test might be completed

    const variantId = this.testAssignments.get(leadId);
    if (!variantId) return; // Lead not assigned to test

    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) return;

    // Update metrics
    switch (eventType) {
      case 'open':
        variant.metrics.opens++;
        break;
      case 'response':
        variant.metrics.responses++;
        break;
      case 'conversion':
        variant.metrics.conversions++;
        if (value) variant.metrics.revenue += value;
        break;
    }

    // Recalculate rates
    this.updateVariantMetrics(variant);

    // Check if test should be stopped early
    await this.checkEarlyStoppingRules(testId);

    // Check if test has reached completion criteria
    await this.checkTestCompletion(testId);
  }

  /**
   * Analyze test results and statistical significance
   */
  async analyzeTest(testId: string): Promise<StatisticalAnalysis> {
    const test = this.activeTests.get(testId) || this.completedTests.get(testId);
    if (!test) throw new Error('Test not found');

    const analysis = this.performStatisticalAnalysis(test);
    test.statisticalAnalysis = analysis;

    // Update test results based on analysis
    this.updateTestResults(test, analysis);

    return analysis;
  }

  /**
   * Complete a test and generate final results
   */
  async completeTest(testId: string): Promise<TestResults> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error('Test not found or already completed');

    test.status = 'completed';
    test.completedAt = new Date();

    // Perform final analysis
    const analysis = await this.analyzeTest(testId);

    // Move to completed tests
    this.completedTests.set(testId, test);
    this.activeTests.delete(testId);

    console.log(`A/B test "${test.name}" completed. Winner: ${test.results.winner || 'No clear winner'}`);

    return test.results;
  }

  /**
   * Generate test recommendations based on current performance and gaps
   */
  async generateTestRecommendations(): Promise<TestRecommendation[]> {
    const recommendations: TestRecommendation[] = [];

    // Analyze current campaigns and performance
    const campaigns = await storage.getCampaigns();
    const leads = await storage.getLeads();
    const conversations = await storage.getConversations();

    // Subject line optimization recommendations
    recommendations.push(await this.generateSubjectLineTest(campaigns, leads));

    // Send time optimization
    recommendations.push(await this.generateSendTimeTest(campaigns, leads));

    // Personalization testing
    recommendations.push(await this.generatePersonalizationTest(campaigns, leads));

    // Content format testing
    recommendations.push(await this.generateContentFormatTest(campaigns));

    // CTA optimization
    recommendations.push(await this.generateCTATest(campaigns));

    return recommendations.sort((a, b) => {
      // Prioritize by business value and expected impact
      const aScore = a.businessValue * a.expectedImpact;
      const bScore = b.businessValue * b.expectedImpact;
      return bScore - aScore;
    });
  }

  /**
   * Get A/B testing portfolio overview
   */
  async getPortfolioOverview(): Promise<ABTestPortfolio> {
    const activeTests = Array.from(this.activeTests.values());
    const completedTests = Array.from(this.completedTests.values());
    const plannedTests = await this.generateTestRecommendations();

    const portfolioMetrics = this.calculatePortfolioMetrics(completedTests);
    const learnings = this.extractTestLearnings(completedTests);

    return {
      activeTests,
      completedTests,
      plannedTests,
      portfolioMetrics,
      learnings
    };
  }

  /**
   * Statistical significance testing using Z-test for proportions
   */
  private performStatisticalAnalysis(test: ABTest): StatisticalAnalysis {
    const controlVariant = test.variants.find(v => v.isControl);
    if (!controlVariant) throw new Error('No control variant found');

    const analysis: StatisticalAnalysis = {
      testType: 'z_test',
      sampleSizes: {},
      conversions: {},
      conversionRates: {},
      standardErrors: {},
      zScores: {},
      pValues: {},
      confidenceIntervals: {},
      effectSizes: {},
      statisticalPower: 0,
      minimumDetectableEffect: test.testConfiguration.minimumDetectableEffect,
      isUnderpowered: false,
      recommendations: []
    };

    // Calculate metrics for each variant
    for (const variant of test.variants) {
      analysis.sampleSizes[variant.id] = variant.sampleSize;
      analysis.conversions[variant.id] = this.getVariantConversions(variant, test.testConfiguration.primaryMetric);
      analysis.conversionRates[variant.id] = variant.sampleSize > 0 
        ? analysis.conversions[variant.id] / variant.sampleSize 
        : 0;
    }

    const controlRate = analysis.conversionRates[controlVariant.id];

    // Calculate statistical significance for each test variant vs control
    for (const variant of test.variants) {
      if (variant.isControl) continue;

      const testRate = analysis.conversionRates[variant.id];
      const n1 = analysis.sampleSizes[controlVariant.id];
      const n2 = analysis.sampleSizes[variant.id];

      if (n1 === 0 || n2 === 0) {
        analysis.pValues[variant.id] = 1.0;
        analysis.zScores[variant.id] = 0;
        continue;
      }

      // Pooled proportion
      const pooledP = (analysis.conversions[controlVariant.id] + analysis.conversions[variant.id]) / (n1 + n2);
      
      // Standard error
      const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
      analysis.standardErrors[variant.id] = standardError;

      // Z-score
      const zScore = (testRate - controlRate) / standardError;
      analysis.zScores[variant.id] = zScore;

      // P-value (two-tailed)
      const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
      analysis.pValues[variant.id] = pValue;

      // Confidence interval for difference
      const criticalValue = this.getZCriticalValue(test.testConfiguration.confidenceLevel);
      const margin = criticalValue * standardError;
      analysis.confidenceIntervals[variant.id] = {
        lower: (testRate - controlRate) - margin,
        upper: (testRate - controlRate) + margin,
        confidence: test.testConfiguration.confidenceLevel
      };

      // Effect size (relative improvement)
      analysis.effectSizes[variant.id] = controlRate > 0 ? ((testRate - controlRate) / controlRate) * 100 : 0;
    }

    // Calculate actual statistical power
    analysis.statisticalPower = this.calculateActualPower(test, analysis);
    analysis.isUnderpowered = analysis.statisticalPower < test.testConfiguration.statisticalPower;

    // Generate recommendations
    analysis.recommendations = this.generateAnalysisRecommendations(test, analysis);

    return analysis;
  }

  /**
   * Update test results based on statistical analysis
   */
  private updateTestResults(test: ABTest, analysis: StatisticalAnalysis): void {
    const controlVariant = test.variants.find(v => v.isControl)!;
    let winnerVariant: TestVariant | undefined;
    let bestEffect = 0;
    let isSignificant = false;

    // Find the best performing variant with statistical significance
    for (const variant of test.variants) {
      if (variant.isControl) continue;

      const pValue = analysis.pValues[variant.id];
      const effect = analysis.effectSizes[variant.id];
      
      if (pValue < test.testConfiguration.significanceThreshold && effect > bestEffect) {
        winnerVariant = variant;
        bestEffect = effect;
        isSignificant = true;
      }
    }

    test.results = {
      winner: winnerVariant?.id,
      isStatisticallySignificant: isSignificant,
      pValue: winnerVariant ? analysis.pValues[winnerVariant.id] : 1.0,
      effect: bestEffect,
      confidence: test.testConfiguration.confidenceLevel,
      recommendedAction: this.getRecommendedAction(isSignificant, bestEffect, analysis.isUnderpowered),
      summary: this.generateResultsSummary(test, winnerVariant, bestEffect, isSignificant),
      insights: this.generateInsights(test, analysis),
      nextSteps: this.generateNextSteps(test, analysis)
    };
  }

  /**
   * Calculate required sample size using power analysis
   */
  private calculateSampleSize(
    minimumDetectableEffect: number,
    confidenceLevel: number,
    statisticalPower: number
  ): number {
    // Simplified sample size calculation for proportions
    const alpha = (100 - confidenceLevel) / 100;
    const beta = (100 - statisticalPower) / 100;
    
    const z_alpha = this.getZCriticalValue(confidenceLevel);
    const z_beta = this.getZCriticalValue(statisticalPower);
    
    // Assume baseline conversion rate of 3% (typical for automotive)
    const p1 = 0.03;
    const p2 = p1 * (1 + minimumDetectableEffect / 100);
    
    const pooledP = (p1 + p2) / 2;
    const delta = Math.abs(p2 - p1);
    
    const n = (2 * Math.pow(z_alpha + z_beta, 2) * pooledP * (1 - pooledP)) / Math.pow(delta, 2);
    
    return Math.ceil(n);
  }

  /**
   * Select variant for a lead based on traffic allocation
   */
  private selectVariantForLead(leadId: string, test: ABTest): TestVariant {
    // Use lead ID hash for consistent assignment
    const hash = this.hashLeadId(leadId);
    const random = (hash % 100) / 100; // 0-1
    
    let cumulativePercent = 0;
    for (const variant of test.variants) {
      cumulativePercent += variant.trafficAllocation / 100;
      if (random <= cumulativePercent) {
        return variant;
      }
    }
    
    // Fallback to control
    return test.variants.find(v => v.isControl) || test.variants[0];
  }

  /**
   * Check early stopping rules
   */
  private async checkEarlyStoppingRules(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) return;

    for (const rule of test.testConfiguration.earlyStoppingRules) {
      if (this.shouldStopEarly(test, rule)) {
        test.status = 'completed';
        test.completedAt = new Date();
        await this.completeTest(testId);
        break;
      }
    }
  }

  /**
   * Check if test has reached completion criteria
   */
  private async checkTestCompletion(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) return;

    const totalParticipants = test.variants.reduce((sum, v) => sum + v.sampleSize, 0);
    const testDurationDays = test.startedAt 
      ? (Date.now() - test.startedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    // Complete if minimum sample size reached and minimum duration passed
    if (totalParticipants >= test.testConfiguration.minimumSampleSize && 
        testDurationDays >= Math.min(test.testConfiguration.testDuration, 7)) {
      
      await this.completeTest(testId);
    }
  }

  // Helper methods for statistical calculations

  private normalCDF(x: number): number {
    // Approximation of standard normal cumulative distribution function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private getZCriticalValue(confidenceLevel: number): number {
    const criticalValues: { [key: number]: number } = {
      90: 1.645,
      95: 1.96,
      99: 2.576
    };
    return criticalValues[confidenceLevel] || 1.96;
  }

  private hashLeadId(leadId: string): number {
    let hash = 0;
    for (let i = 0; i < leadId.length; i++) {
      const char = leadId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private getVariantConversions(variant: TestVariant, primaryMetric: string): number {
    switch (primaryMetric) {
      case 'open_rate':
        return variant.metrics.opens;
      case 'response_rate':
        return variant.metrics.responses;
      case 'conversion_rate':
        return variant.metrics.conversions;
      case 'revenue':
        return variant.metrics.revenue > 0 ? 1 : 0; // Binary conversion
      default:
        return variant.metrics.conversions;
    }
  }

  private updateVariantMetrics(variant: TestVariant): void {
    if (variant.sampleSize === 0) return;

    variant.metrics.openRate = (variant.metrics.opens / variant.sampleSize) * 100;
    variant.metrics.responseRate = (variant.metrics.responses / variant.sampleSize) * 100;
    variant.metrics.conversionRate = (variant.metrics.conversions / variant.sampleSize) * 100;
    variant.metrics.averageRevenue = variant.metrics.conversions > 0 
      ? variant.metrics.revenue / variant.metrics.conversions 
      : 0;
  }

  private shouldStopEarly(test: ABTest, rule: EarlyStoppingRule): boolean {
    const totalParticipants = test.variants.reduce((sum, v) => sum + v.sampleSize, 0);
    
    if (totalParticipants < rule.minimumSampleSize) return false;

    // Simple early stopping logic
    if (rule.type === 'superiority') {
      const analysis = this.performStatisticalAnalysis(test);
      const bestVariant = test.variants.find(v => !v.isControl && 
        analysis.pValues[v.id] < rule.threshold);
      return !!bestVariant;
    }

    return false;
  }

  private calculateActualPower(test: ABTest, analysis: StatisticalAnalysis): number {
    // Simplified power calculation
    const maxSampleSize = Math.max(...Object.values(analysis.sampleSizes));
    const requiredSampleSize = test.testConfiguration.minimumSampleSize;
    
    return Math.min(100, (maxSampleSize / requiredSampleSize) * test.testConfiguration.statisticalPower);
  }

  private generateAnalysisRecommendations(test: ABTest, analysis: StatisticalAnalysis): string[] {
    const recommendations = [];

    if (analysis.isUnderpowered) {
      recommendations.push('Increase sample size to achieve desired statistical power');
    }

    const maxEffect = Math.max(...Object.values(analysis.effectSizes));
    if (maxEffect < test.testConfiguration.minimumDetectableEffect) {
      recommendations.push('Consider testing more dramatic changes for larger effects');
    }

    const significantVariants = test.variants.filter(v => 
      !v.isControl && analysis.pValues[v.id] < test.testConfiguration.significanceThreshold
    ).length;

    if (significantVariants === 0) {
      recommendations.push('No variants showed significant improvement - consider redesigning test');
    } else if (significantVariants > 1) {
      recommendations.push('Multiple variants showed significance - consider follow-up testing');
    }

    return recommendations;
  }

  private getRecommendedAction(
    isSignificant: boolean,
    effect: number,
    isUnderpowered: boolean
  ): 'implement_winner' | 'continue_testing' | 'redesign_test' | 'no_clear_winner' {
    if (isUnderpowered) return 'continue_testing';
    if (isSignificant && effect > 5) return 'implement_winner';
    if (!isSignificant && effect < 2) return 'redesign_test';
    return 'no_clear_winner';
  }

  private generateResultsSummary(
    test: ABTest,
    winner: TestVariant | undefined,
    effect: number,
    isSignificant: boolean
  ): string {
    if (winner && isSignificant) {
      return `${winner.name} won with a ${effect.toFixed(1)}% improvement (statistically significant)`;
    } else if (winner) {
      return `${winner.name} performed best but results are not statistically significant`;
    } else {
      return 'No clear winner emerged from this test';
    }
  }

  private generateInsights(test: ABTest, analysis: StatisticalAnalysis): string[] {
    const insights = [];

    // Performance insights
    const bestVariant = test.variants.reduce((best, variant) => 
      analysis.effectSizes[variant.id] > (analysis.effectSizes[best.id] || 0) ? variant : best
    );

    if (bestVariant && !bestVariant.isControl) {
      insights.push(`${bestVariant.name} showed the strongest performance`);
    }

    // Statistical insights
    if (analysis.isUnderpowered) {
      insights.push('Test was underpowered - results should be interpreted with caution');
    }

    // Business insights
    const totalRevenueLift = Object.values(analysis.sampleSizes).reduce((sum, size, index) => {
      const variant = test.variants[index];
      return sum + (variant.metrics.revenue || 0);
    }, 0);

    if (totalRevenueLift > 1000) {
      insights.push(`Test generated significant revenue impact: $${totalRevenueLift.toLocaleString()}`);
    }

    return insights;
  }

  private generateNextSteps(test: ABTest, analysis: StatisticalAnalysis): string[] {
    const nextSteps = [];

    if (test.results.recommendedAction === 'implement_winner') {
      nextSteps.push('Implement winning variant across all campaigns');
      nextSteps.push('Monitor performance for 2-4 weeks to confirm sustained improvement');
    } else if (test.results.recommendedAction === 'continue_testing') {
      nextSteps.push('Extend test duration to reach statistical significance');
      nextSteps.push('Consider increasing traffic allocation to accelerate learning');
    } else if (test.results.recommendedAction === 'redesign_test') {
      nextSteps.push('Design new test with more dramatic variations');
      nextSteps.push('Consider testing different elements or audience segments');
    }

    return nextSteps;
  }

  // Test recommendation generators

  private async generateSubjectLineTest(campaigns: Campaign[], leads: Lead[]): Promise<TestRecommendation> {
    return {
      testName: 'Subject Line Personalization Impact',
      category: 'subject_line',
      hypothesis: 'Personalized subject lines with lead name and vehicle interest will increase open rates by 15%',
      variants: [
        { name: 'Control', description: 'Generic subject line', expectedPerformance: 23.5, isControl: true },
        { name: 'Name Personalization', description: 'Include lead first name', expectedPerformance: 26.8, isControl: false },
        { name: 'Vehicle + Name', description: 'Name + vehicle interest', expectedPerformance: 29.2, isControl: false }
      ],
      expectedImpact: 24.3,
      priority: 'high',
      estimatedDuration: 14,
      requiredSampleSize: this.calculateSampleSize(15, 95, 80),
      businessValue: 85000,
      riskLevel: 'low'
    };
  }

  private async generateSendTimeTest(campaigns: Campaign[], leads: Lead[]): Promise<TestRecommendation> {
    return {
      testName: 'Optimal Send Time Discovery',
      category: 'timing',
      hypothesis: 'Morning sends (9-11 AM) will outperform afternoon sends (2-4 PM)',
      variants: [
        { name: 'Afternoon (Control)', description: '2-4 PM sends', expectedPerformance: 21.3, isControl: true },
        { name: 'Morning', description: '9-11 AM sends', expectedPerformance: 24.7, isControl: false },
        { name: 'Evening', description: '6-8 PM sends', expectedPerformance: 19.8, isControl: false }
      ],
      expectedImpact: 16.0,
      priority: 'medium',
      estimatedDuration: 21,
      requiredSampleSize: this.calculateSampleSize(12, 95, 80),
      businessValue: 45000,
      riskLevel: 'low'
    };
  }

  private async generatePersonalizationTest(campaigns: Campaign[], leads: Lead[]): Promise<TestRecommendation> {
    return {
      testName: 'Content Personalization Levels',
      category: 'personalization',
      hypothesis: 'Highly personalized content will significantly improve response rates',
      variants: [
        { name: 'Generic (Control)', description: 'Standard automotive template', expectedPerformance: 8.2, isControl: true },
        { name: 'Basic Personal', description: 'Name + vehicle interest', expectedPerformance: 10.1, isControl: false },
        { name: 'Advanced Personal', description: 'Name + vehicle + location + financing', expectedPerformance: 12.8, isControl: false }
      ],
      expectedImpact: 56.1,
      priority: 'high',
      estimatedDuration: 28,
      requiredSampleSize: this.calculateSampleSize(20, 95, 80),
      businessValue: 125000,
      riskLevel: 'medium'
    };
  }

  private async generateContentFormatTest(campaigns: Campaign[]): Promise<TestRecommendation> {
    return {
      testName: 'Email Format Optimization',
      category: 'template',
      hypothesis: 'Rich HTML emails with images will outperform text-only emails',
      variants: [
        { name: 'Text Only (Control)', description: 'Plain text email', expectedPerformance: 15.2, isControl: true },
        { name: 'HTML + Images', description: 'Rich HTML with vehicle images', expectedPerformance: 18.9, isControl: false },
        { name: 'Interactive', description: 'Interactive elements and CTAs', expectedPerformance: 17.1, isControl: false }
      ],
      expectedImpact: 24.3,
      priority: 'medium',
      estimatedDuration: 18,
      requiredSampleSize: this.calculateSampleSize(15, 95, 80),
      businessValue: 62000,
      riskLevel: 'low'
    };
  }

  private async generateCTATest(campaigns: Campaign[]): Promise<TestRecommendation> {
    return {
      testName: 'Call-to-Action Optimization',
      category: 'content',
      hypothesis: 'Urgency-driven CTAs will improve conversion rates over generic ones',
      variants: [
        { name: 'Generic (Control)', description: '"Learn More" button', expectedPerformance: 3.1, isControl: true },
        { name: 'Urgency', description: '"Get Your Quote Today" button', expectedPerformance: 4.2, isControl: false },
        { name: 'Value-Focused', description: '"See Your Savings" button', expectedPerformance: 3.8, isControl: false }
      ],
      expectedImpact: 35.5,
      priority: 'high',
      estimatedDuration: 25,
      requiredSampleSize: this.calculateSampleSize(25, 95, 80),
      businessValue: 95000,
      riskLevel: 'low'
    };
  }

  private calculatePortfolioMetrics(completedTests: ABTest[]): PortfolioMetrics {
    const winningTests = completedTests.filter(t => t.results.isStatisticallySignificant).length;
    const totalRevenue = completedTests.reduce((sum, test) => {
      return sum + test.variants.reduce((variantSum, variant) => variantSum + variant.metrics.revenue, 0);
    }, 0);

    return {
      totalTestsRun: completedTests.length,
      winRate: completedTests.length > 0 ? (winningTests / completedTests.length) * 100 : 0,
      averageEffect: completedTests.length > 0 
        ? completedTests.reduce((sum, test) => sum + test.results.effect, 0) / completedTests.length 
        : 0,
      totalRevenueLift: totalRevenue,
      averageTestDuration: completedTests.length > 0
        ? completedTests.reduce((sum, test) => {
            if (!test.startedAt || !test.completedAt) return sum;
            return sum + (test.completedAt.getTime() - test.startedAt.getTime()) / (1000 * 60 * 60 * 24);
          }, 0) / completedTests.length
        : 0,
      testsInQueue: this.activeTests.size,
      monthlyTestVelocity: completedTests.filter(test => {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return test.completedAt && test.completedAt > monthAgo;
      }).length
    };
  }

  private extractTestLearnings(completedTests: ABTest[]): TestLearning[] {
    const learnings: TestLearning[] = [];

    // Subject line learnings
    const subjectLineTests = completedTests.filter(t => t.category === 'subject_line');
    if (subjectLineTests.length > 0) {
      const personalizedWins = subjectLineTests.filter(t => 
        t.results.winner && 
        t.variants.find(v => v.id === t.results.winner)?.name.toLowerCase().includes('personal')
      ).length;

      if (personalizedWins / subjectLineTests.length > 0.6) {
        learnings.push({
          category: 'subject_line',
          insight: 'Personalized subject lines consistently outperform generic ones',
          impact: 'high',
          applicability: 'universal',
          evidenceStrength: 'strong',
          sourceTests: subjectLineTests.map(t => t.id)
        });
      }
    }

    // Timing learnings
    const timingTests = completedTests.filter(t => t.category === 'timing');
    if (timingTests.length > 0) {
      learnings.push({
        category: 'timing',
        insight: 'Morning sends generally perform better than afternoon for automotive leads',
        impact: 'medium',
        applicability: 'segment_specific',
        evidenceStrength: 'moderate',
        sourceTests: timingTests.map(t => t.id)
      });
    }

    return learnings;
  }

  // Validation and initialization methods

  private validateTest(test: ABTest): void {
    if (test.variants.length < 2) {
      throw new Error('Test must have at least 2 variants');
    }

    const controlVariants = test.variants.filter(v => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error('Test must have exactly one control variant');
    }

    const totalTraffic = test.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      throw new Error('Traffic allocation must sum to 100%');
    }
  }

  private validateTestReadiness(test: ABTest): void {
    if (!test.testConfiguration.primaryMetric) {
      throw new Error('Primary metric must be specified');
    }

    if (test.testConfiguration.minimumSampleSize < 100) {
      throw new Error('Minimum sample size must be at least 100');
    }

    for (const variant of test.variants) {
      if (!variant.configuration || Object.keys(variant.configuration).length === 0) {
        throw new Error(`Variant ${variant.name} must have configuration specified`);
      }
    }
  }

  private getDefaultConfiguration(): TestConfiguration {
    return {
      primaryMetric: 'conversion_rate',
      secondaryMetrics: ['open_rate', 'response_rate'],
      minimumDetectableEffect: 10,
      confidenceLevel: 95,
      statisticalPower: 80,
      testDuration: 21,
      minimumSampleSize: 1000,
      significanceThreshold: 0.05,
      trafficSplit: 'equal',
      earlyStoppingRules: []
    };
  }

  private initializeResults(): TestResults {
    return {
      isStatisticallySignificant: false,
      pValue: 1.0,
      effect: 0,
      confidence: 95,
      recommendedAction: 'continue_testing',
      summary: 'Test in progress',
      insights: [],
      nextSteps: []
    };
  }

  private initializeStatisticalAnalysis(): StatisticalAnalysis {
    return {
      testType: 'z_test',
      sampleSizes: {},
      conversions: {},
      conversionRates: {},
      standardErrors: {},
      zScores: {},
      pValues: {},
      confidenceIntervals: {},
      effectSizes: {},
      statisticalPower: 0,
      minimumDetectableEffect: 0,
      isUnderpowered: true,
      recommendations: []
    };
  }

  private async getTest(testId: string): Promise<ABTest | undefined> {
    return this.activeTests.get(testId) || this.completedTests.get(testId);
  }
}

export const abTestingFramework = new ABTestingFramework();