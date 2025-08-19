# Conversation Intelligence Usage Examples

This document provides practical examples of how to use OfferLogix's Conversation Intelligence System in real automotive dealership scenarios.

## Table of Contents
- [Basic Message Processing](#basic-message-processing)
- [Real-time Coaching Implementation](#real-time-coaching-implementation)
- [A/B Testing for Response Optimization](#ab-testing-for-response-optimization)
- [Advanced Analytics Integration](#advanced-analytics-integration)
- [Dashboard and Monitoring](#dashboard-and-monitoring)
- [Frontend Integration Examples](#frontend-integration-examples)

## Basic Message Processing

### Scenario: Customer Inquiry About Vehicle Availability

```typescript
// Customer sends: "Do you have any 2024 Honda CR-V available?"

const result = await conversationIntelligenceHub.processConversation(
  'conv-12345',
  'Do you have any 2024 Honda CR-V available?',
  'customer-789'
);

// System Response
console.log(result.response.content);
/* Output:
"Hi there! Yes, we do have 2024 Honda CR-V models available. We currently have several trim levels in stock including the LX, EX, and EX-L. Would you like to know about specific features, colors, or schedule a test drive to experience the CR-V firsthand?"
*/

// Analysis Results
console.log(result.analysis.intent.primaryIntent);
/* Output:
{
  intent: "information_seeking",
  confidence: 85,
  reasoning: "Customer asking about specific vehicle availability"
}
*/

console.log(result.analysis.buyingSignals.buyingReadiness);
/* Output:
{
  score: 45,
  level: "researching",
  confidence: 78,
  keyIndicators: ["specific model inquiry"],
  missingSignals: ["timeline discussion", "financing interest"]
}
*/
```

### Scenario: High-Intent Customer Ready to Buy

```typescript
// Customer sends: "I need to buy a truck this week for my business. I'm pre-approved for financing up to $40k."

const result = await conversationIntelligenceHub.processConversation(
  'conv-67890',
  'I need to buy a truck this week for my business. I\'m pre-approved for financing up to $40k.',
  'customer-456'
);

// System generates urgent response
console.log(result.response.content);
/* Output:
"Excellent! I can help you find the perfect business truck within your budget and timeline. With your pre-approval, we can move quickly. Our commercial truck specialist is available today - would you like me to schedule an immediate appointment? We have several trucks under $40k that would be perfect for business use."
*/

// Routing Decision
console.log(result.routing.decision);
/* Output:
{
  routingType: "human_escalation",
  confidence: 95,
  reasoning: "High-value buying signals detected - pre-approved financing and urgent timeline",
  priority: "immediate"
}
*/

// Coaching Alerts
console.log(result.coaching.immediateAlerts);
/* Output:
[
  {
    type: "opportunity_highlight",
    priority: "critical", 
    title: "Hot Lead - Ready to Purchase",
    description: "Customer has financing pre-approval and urgent timeline",
    suggestedAction: "Escalate to sales manager immediately and schedule same-day appointment",
    timing: "immediate"
  }
]
*/
```

## Real-time Coaching Implementation

### Frontend Integration for Agent Dashboard

```typescript
// Real-time coaching component
class ConversationCoaching {
  private conversationId: string;
  
  constructor(conversationId: string) {
    this.conversationId = conversationId;
    this.startCoachingUpdates();
  }

  async startCoachingUpdates() {
    // Get initial coaching recommendations
    const coaching = await this.getCoachingRecommendations();
    this.displayCoaching(coaching);

    // Set up periodic updates
    setInterval(async () => {
      const updatedCoaching = await this.getCoachingRecommendations();
      this.updateCoaching(updatedCoaching);
    }, 30000); // Update every 30 seconds
  }

  private async getCoachingRecommendations() {
    const response = await fetch(
      `/api/conversation-intelligence/coaching/${this.conversationId}`
    );
    return response.json();
  }

  private displayCoaching(coaching: any) {
    // Display urgent alerts
    coaching.data.urgentAlerts.forEach((alert: any) => {
      this.showAlert(alert);
    });

    // Show response guidance
    coaching.data.responseGuidance.forEach((guidance: any) => {
      this.showGuidance(guidance);
    });

    // Display opportunity highlights
    coaching.data.opportunityHighlights.forEach((opportunity: any) => {
      this.highlightOpportunity(opportunity);
    });
  }

  private showAlert(alert: any) {
    // Critical alert banner
    if (alert.priority === 'critical') {
      const alertBanner = document.createElement('div');
      alertBanner.className = 'alert-banner critical';
      alertBanner.innerHTML = `
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <h3>${alert.title}</h3>
          <p>${alert.description}</p>
          <button class="action-btn" onclick="takeAction('${alert.suggestedAction}')">
            ${alert.suggestedAction}
          </button>
        </div>
      `;
      document.body.prepend(alertBanner);
    }
  }

  private showGuidance(guidance: any) {
    const guidancePanel = document.getElementById('guidance-panel');
    const guidanceItem = document.createElement('div');
    guidanceItem.className = 'guidance-item';
    guidanceItem.innerHTML = `
      <h4>${guidance.title}</h4>
      <p>${guidance.description}</p>
      <p class="expected-outcome">Expected outcome: ${guidance.expectedOutcome}</p>
    `;
    guidancePanel?.appendChild(guidanceItem);
  }

  private highlightOpportunity(opportunity: any) {
    const opportunityPanel = document.getElementById('opportunity-panel');
    const opportunityItem = document.createElement('div');
    opportunityItem.className = 'opportunity-item';
    opportunityItem.innerHTML = `
      <div class="opportunity-header">
        <span class="opportunity-icon">🎯</span>
        <h4>${opportunity.title}</h4>
        <span class="confidence-score">${opportunity.confidence}% confidence</span>
      </div>
      <p>${opportunity.description}</p>
      <button class="opportunity-action" onclick="takeAction('${opportunity.suggestedAction}')">
        ${opportunity.suggestedAction}
      </button>
    `;
    opportunityPanel?.appendChild(opportunityItem);
  }
}

// Initialize coaching for active conversation
const coaching = new ConversationCoaching('current-conversation-id');
```

### Coaching Response to Specific Scenarios

```typescript
// Scenario: Customer expressing price concerns
async function handlePriceObjection(conversationId: string) {
  const coaching = await fetch(
    `/api/conversation-intelligence/coaching/${conversationId}`
  ).then(res => res.json());

  // Expected coaching response
  const priceObjectionCoaching = coaching.data.suggestions.find(
    (s: any) => s.type === 'response_guidance' && s.title.includes('Price')
  );
  
  console.log(priceObjectionCoaching);
  /* Output:
  {
    type: "response_guidance",
    priority: "high",
    title: "Price Objection Handling",
    description: "Customer expressing concerns about price",
    suggestedAction: "Focus on total value proposition - financing options, warranty, service packages",
    expectedOutcome: "Shift conversation from price to value",
    confidence: 88
  }
  */
}
```

## A/B Testing for Response Optimization

### Setting Up Response Tone A/B Test

```typescript
// Create A/B test for different response approaches
async function createResponseToneTest() {
  const testId = await conversationIntelligenceHub.createConversationABTest(
    'Response Tone Optimization',
    'Testing professional vs consultative tone for luxury vehicle inquiries',
    [
      {
        name: 'Professional & Direct',
        weight: 50,
        responseParameters: {
          tone: 'professional',
          personalizationLevel: 'moderate',
          responseLength: 'brief',
          includeOffers: false,
          urgencyLevel: 'low'
        }
      },
      {
        name: 'Consultative & Personalized',
        weight: 50,
        responseParameters: {
          tone: 'friendly',
          personalizationLevel: 'high',
          responseLength: 'detailed',
          includeOffers: true,
          urgencyLevel: 'medium'
        }
      }
    ],
    {
      // Target luxury vehicle inquiries only
      vehicleInterest: ['luxury', 'premium', 'BMW', 'Mercedes', 'Audi', 'Lexus'],
      leadScore: { min: 70, max: 100 }
    }
  );

  // Start the test
  await fetch(`/api/conversation-intelligence/optimization/ab-test/${testId}/start`, {
    method: 'POST'
  });

  console.log(`A/B test started with ID: ${testId}`);
  return testId;
}

// Monitor test results
async function monitorABTest(testId: string) {
  const tests = await fetch('/api/conversation-intelligence/optimization/ab-tests')
    .then(res => res.json());
  
  const test = tests.data.find((t: any) => t.id === testId);
  
  console.log('Test Performance:');
  test.variants.forEach((variant: any) => {
    console.log(`${variant.name}:`);
    console.log(`  Impressions: ${variant.performanceMetrics.impressions}`);
    console.log(`  Response Rate: ${(variant.performanceMetrics.responses / variant.performanceMetrics.impressions * 100).toFixed(1)}%`);
    console.log(`  Conversion Rate: ${(variant.performanceMetrics.conversions / variant.performanceMetrics.impressions * 100).toFixed(1)}%`);
  });
}
```

### Personalization Optimization

```typescript
// Optimize personalization for specific customer segments
async function optimizePersonalization() {
  // Optimize for luxury segment
  const luxuryOptimization = await fetch(
    '/api/conversation-intelligence/optimization/personalization/luxury',
    { method: 'POST' }
  ).then(res => res.json());

  console.log('Luxury Segment Optimization:');
  console.log(luxuryOptimization.data);
  /* Output:
  {
    leadSegment: "luxury",
    optimizations: {
      namingFrequency: 1, // Use name in every response
      vehicleReferenceFrquency: 2, // Reference specific vehicle every 2nd response
      contextualReferences: ["previous luxury experience", "premium features"],
      toneAdjustments: { default: "professional", high_value: "consultative" },
      contentPreferences: ["exclusive features", "premium service", "luxury benefits"]
    },
    effectiveness: 87,
    lastUpdated: "2024-01-15T10:30:00Z"
  }
  */

  // Apply optimizations to future conversations
  return luxuryOptimization.data;
}
```

## Advanced Analytics Integration

### Sentiment Analysis Dashboard

```typescript
// Build real-time sentiment tracking
class SentimentDashboard {
  private conversations: string[];

  constructor(conversations: string[]) {
    this.conversations = conversations;
    this.initializeDashboard();
  }

  async initializeDashboard() {
    const sentimentData = await Promise.all(
      this.conversations.map(async (convId) => {
        const sentiment = await fetch(
          `/api/conversation-intelligence/analytics/sentiment/${convId}`
        ).then(res => res.json());
        return { conversationId: convId, ...sentiment.data };
      })
    );

    this.renderSentimentChart(sentimentData);
    this.identifyCriticalConversations(sentimentData);
  }

  renderSentimentChart(data: any[]) {
    // Render sentiment progression charts
    data.forEach((conversation) => {
      const chart = new SentimentChart(conversation.conversationId);
      chart.render(conversation.progression);
      
      // Highlight critical points
      conversation.criticalPoints.forEach((point: any) => {
        chart.markCriticalPoint(point);
      });
    });
  }

  identifyCriticalConversations(data: any[]) {
    const critical = data.filter(conv => 
      conv.overallTrend === 'declining' || 
      conv.criticalPoints.some((p: any) => p.type === 'negative_dip')
    );

    // Alert for conversations needing attention
    critical.forEach((conv) => {
      this.alertCriticalConversation(conv);
    });
  }

  alertCriticalConversation(conversation: any) {
    console.warn(`ALERT: Conversation ${conversation.conversationId} showing negative sentiment trend`);
    console.log(`Recommendations: ${conversation.recommendations.join(', ')}`);
  }
}
```

### Buying Signal Analysis

```typescript
// Analyze buying signals across conversations
async function analyzeBuyingSignals(conversationIds: string[]) {
  const analyses = await Promise.all(
    conversationIds.map(async (convId) => {
      const signals = await fetch(
        `/api/conversation-intelligence/analytics/buying-signals/${convId}`
      ).then(res => res.json());
      return signals.data;
    })
  );

  // Aggregate insights
  const insights = {
    totalSignals: analyses.reduce((sum, a) => sum + a.signals.length, 0),
    strongSignals: analyses.reduce((sum, a) => 
      sum + a.signals.filter((s: any) => s.strength === 'strong' || s.strength === 'very_strong').length, 0),
    averageReadiness: analyses.reduce((sum, a) => sum + a.buyingReadiness.score, 0) / analyses.length,
    readyToBuy: analyses.filter(a => a.buyingReadiness.level === 'ready' || a.buyingReadiness.level === 'urgent').length
  };

  console.log('Buying Signal Insights:');
  console.log(`Total signals detected: ${insights.totalSignals}`);
  console.log(`Strong signals: ${insights.strongSignals}`);
  console.log(`Average readiness score: ${insights.averageReadiness.toFixed(1)}`);
  console.log(`Customers ready to buy: ${insights.readyToBuy}`);

  return insights;
}
```

### Outcome Prediction

```typescript
// Predict conversation outcomes for prioritization
async function predictAndPrioritizeConversations() {
  const conversations = await fetch('/api/conversations').then(res => res.json());
  
  const predictions = await Promise.all(
    conversations.map(async (conv: any) => {
      const prediction = await fetch(
        `/api/conversation-intelligence/analytics/prediction/${conv.id}`
      ).then(res => res.json());
      
      return {
        conversationId: conv.id,
        leadId: conv.leadId,
        conversionProbability: prediction.data.predictions.conversionProbability,
        expectedValue: prediction.data.predictions.expectedValue,
        dropOffRisk: prediction.data.predictions.dropOffRisk,
        scenarios: prediction.data.scenarioAnalysis
      };
    })
  );

  // Sort by conversion probability and expected value
  const prioritized = predictions.sort((a, b) => 
    (b.conversionProbability * b.expectedValue) - (a.conversionProbability * a.expectedValue)
  );

  console.log('Top Priority Conversations:');
  prioritized.slice(0, 10).forEach((conv, index) => {
    console.log(`${index + 1}. Conversation ${conv.conversationId}`);
    console.log(`   Conversion Probability: ${conv.conversionProbability}%`);
    console.log(`   Expected Value: $${conv.expectedValue.toLocaleString()}`);
    console.log(`   Drop-off Risk: ${conv.dropOffRisk}%`);
  });

  return prioritized;
}
```

## Dashboard and Monitoring

### Executive Dashboard Integration

```typescript
// Executive dashboard showing conversation intelligence KPIs
async function buildExecutiveDashboard() {
  const timeframe = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  };

  const dashboardData = await fetch(
    `/api/conversation-intelligence/dashboard?start=${timeframe.start.toISOString()}&end=${timeframe.end.toISOString()}`
  ).then(res => res.json());

  const kpis = {
    conversationVolume: dashboardData.data.overview.totalConversations,
    averageQuality: dashboardData.data.overview.averageQualityScore,
    conversionRate: dashboardData.data.overview.conversionRate,
    aiPerformance: dashboardData.data.optimizationImpact.performanceImprovement,
    coachingImplementation: dashboardData.data.coachingInsights.implementationRate,
    criticalAlerts: dashboardData.data.alertsAndOpportunities.reduce(
      (sum: number, alert: any) => sum + (alert.severity === 'critical' ? alert.count : 0), 0
    )
  };

  // Render executive summary
  console.log('=== OfferLogix Conversation Intelligence Dashboard ===');
  console.log(`Total Conversations: ${kpis.conversationVolume}`);
  console.log(`Average Quality Score: ${kpis.averageQuality}/100`);
  console.log(`Conversion Rate: ${kpis.conversionRate}%`);
  console.log(`AI Performance Improvement: +${kpis.aiPerformance}%`);
  console.log(`Coaching Implementation Rate: ${kpis.coachingImplementation}%`);
  console.log(`Critical Alerts: ${kpis.criticalAlerts}`);

  return kpis;
}
```

### Performance Monitoring

```typescript
// Monitor system performance and health
class ConversationIntelligenceMonitor {
  private alertThresholds = {
    qualityScore: 75,
    responseTime: 2000, // 2 seconds
    errorRate: 0.05 // 5%
  };

  async checkSystemHealth() {
    const health = await fetch('/api/conversation-intelligence/health')
      .then(res => res.json());

    const issues = [];

    // Check service health
    health.data.services.forEach((service: any) => {
      if (service.status !== 'up') {
        issues.push(`${service.name} is ${service.status}`);
      }
      if (service.responseTime > this.alertThresholds.responseTime) {
        issues.push(`${service.name} response time is high: ${service.responseTime}ms`);
      }
    });

    // Check overall performance
    if (health.data.metrics.averageQualityScore < this.alertThresholds.qualityScore) {
      issues.push(`Quality score below threshold: ${health.data.metrics.averageQualityScore}`);
    }

    if (issues.length > 0) {
      this.sendAlert(issues);
    }

    return { status: issues.length === 0 ? 'healthy' : 'degraded', issues };
  }

  private sendAlert(issues: string[]) {
    console.warn('🚨 Conversation Intelligence System Alert:');
    issues.forEach(issue => console.warn(`  - ${issue}`));
    
    // In production, send to monitoring system
    // sendSlackAlert(issues);
    // sendEmailAlert(issues);
  }

  async generatePerformanceReport() {
    const analytics = await fetch('/api/conversation-intelligence/optimization/analytics')
      .then(res => res.json());

    const report = {
      timestamp: new Date(),
      overallPerformance: analytics.data.overallPerformance,
      segmentPerformance: analytics.data.segmentPerformance,
      topOptimizations: analytics.data.optimizationOpportunities.slice(0, 5),
      abTestResults: analytics.data.abTestResults
    };

    console.log('📊 Performance Report:');
    console.log(`Average Score: ${report.overallPerformance.averageScore}`);
    console.log(`Total Responses: ${report.overallPerformance.totalResponses}`);
    console.log(`Quality Trend: ${report.overallPerformance.qualityTrend}`);

    return report;
  }
}

// Initialize monitoring
const monitor = new ConversationIntelligenceMonitor();
setInterval(() => monitor.checkSystemHealth(), 60000); // Check every minute
```

## Frontend Integration Examples

### React Component for Conversation Intelligence

```tsx
import React, { useState, useEffect } from 'react';

interface ConversationIntelligenceProps {
  conversationId: string;
}

export const ConversationIntelligence: React.FC<ConversationIntelligenceProps> = ({
  conversationId
}) => {
  const [insights, setInsights] = useState<any>(null);
  const [coaching, setCoaching] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversationIntelligence();
    
    // Set up real-time updates
    const interval = setInterval(loadConversationIntelligence, 30000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const loadConversationIntelligence = async () => {
    try {
      const [insightsRes, coachingRes] = await Promise.all([
        fetch(`/api/conversation-intelligence/insights/${conversationId}`),
        fetch(`/api/conversation-intelligence/coaching/${conversationId}`)
      ]);

      const insightsData = await insightsRes.json();
      const coachingData = await coachingRes.json();

      setInsights(insightsData.data);
      setCoaching(coachingData.data);
    } catch (error) {
      console.error('Failed to load conversation intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading conversation insights...</div>;
  }

  return (
    <div className="conversation-intelligence">
      {/* Critical Alerts */}
      {coaching?.urgentAlerts.length > 0 && (
        <div className="alert-section">
          {coaching.urgentAlerts.map((alert: any, index: number) => (
            <div key={index} className={`alert alert-${alert.priority}`}>
              <div className="alert-header">
                <span className="alert-icon">⚠️</span>
                <h4>{alert.title}</h4>
              </div>
              <p>{alert.description}</p>
              <button 
                className="alert-action"
                onClick={() => handleAlertAction(alert)}
              >
                {alert.suggestedAction}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Conversation Summary */}
      <div className="conversation-summary">
        <h3>Conversation Summary</h3>
        <div className="summary-metrics">
          <div className="metric">
            <label>Stage</label>
            <span className="stage-badge">{insights?.summary.stage}</span>
          </div>
          <div className="metric">
            <label>Progress</label>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${insights?.summary.progress}%` }}
              />
            </div>
          </div>
          <div className="metric">
            <label>Buying Readiness</label>
            <span className="readiness-score">
              {insights?.leadProfile.buyingReadiness}/100
            </span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics">
        <h3>Performance</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <h4>Quality Score</h4>
            <span className="metric-value">
              {insights?.performance.qualityScore}/100
            </span>
          </div>
          <div className="metric-card">
            <h4>Conversion Probability</h4>
            <span className="metric-value">
              {insights?.performance.conversionProbability}%
            </span>
          </div>
          <div className="metric-card">
            <h4>Customer Satisfaction</h4>
            <span className="metric-value">
              {insights?.performance.customerSatisfaction}/100
            </span>
          </div>
        </div>
      </div>

      {/* Coaching Suggestions */}
      <div className="coaching-section">
        <h3>Coaching Suggestions</h3>
        {coaching?.responseGuidance.map((guidance: any, index: number) => (
          <div key={index} className="coaching-card">
            <h4>{guidance.title}</h4>
            <p>{guidance.description}</p>
            <div className="guidance-action">
              <button onClick={() => implementGuidance(guidance)}>
                {guidance.suggestedAction}
              </button>
              <span className="confidence">
                {guidance.confidence}% confidence
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Opportunities */}
      <div className="opportunities-section">
        <h3>Opportunities</h3>
        {coaching?.opportunityHighlights.map((opportunity: any, index: number) => (
          <div key={index} className="opportunity-card">
            <div className="opportunity-header">
              <span className="opportunity-icon">🎯</span>
              <h4>{opportunity.title}</h4>
            </div>
            <p>{opportunity.description}</p>
            <button 
              className="opportunity-action"
              onClick={() => handleOpportunity(opportunity)}
            >
              {opportunity.suggestedAction}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  function handleAlertAction(alert: any) {
    // Handle alert action (escalate, schedule, etc.)
    console.log('Handling alert action:', alert.suggestedAction);
  }

  function implementGuidance(guidance: any) {
    // Implement coaching guidance
    console.log('Implementing guidance:', guidance.suggestedAction);
  }

  function handleOpportunity(opportunity: any) {
    // Handle opportunity action
    console.log('Handling opportunity:', opportunity.suggestedAction);
  }
};
```

### Vue.js Dashboard Component

```vue
<template>
  <div class="conversation-intelligence-dashboard">
    <div class="dashboard-header">
      <h2>Conversation Intelligence Dashboard</h2>
      <div class="date-range-picker">
        <input v-model="dateRange.start" type="date" />
        <span>to</span>
        <input v-model="dateRange.end" type="date" />
        <button @click="loadDashboard">Update</button>
      </div>
    </div>

    <div class="dashboard-content" v-if="dashboardData">
      <!-- KPI Cards -->
      <div class="kpi-cards">
        <div class="kpi-card">
          <h3>Total Conversations</h3>
          <span class="kpi-value">{{ dashboardData.overview.totalConversations }}</span>
          <span class="kpi-trend" :class="getTrendClass('conversations')">
            {{ getConversationTrend() }}
          </span>
        </div>
        
        <div class="kpi-card">
          <h3>Average Quality</h3>
          <span class="kpi-value">{{ dashboardData.overview.averageQualityScore }}/100</span>
          <span class="kpi-trend" :class="getTrendClass('quality')">
            {{ getQualityTrend() }}
          </span>
        </div>

        <div class="kpi-card">
          <h3>Conversion Rate</h3>
          <span class="kpi-value">{{ dashboardData.overview.conversionRate }}%</span>
          <span class="kpi-trend" :class="getTrendClass('conversion')">
            {{ getConversionTrend() }}
          </span>
        </div>

        <div class="kpi-card">
          <h3>AI Performance</h3>
          <span class="kpi-value">+{{ dashboardData.optimizationImpact.performanceImprovement }}%</span>
          <span class="kpi-improvement">improvement</span>
        </div>
      </div>

      <!-- Top Performing Conversations -->
      <div class="top-conversations">
        <h3>Top Performing Conversations</h3>
        <div class="conversation-list">
          <div 
            v-for="conv in dashboardData.topPerformingConversations" 
            :key="conv.conversationId"
            class="conversation-item"
          >
            <div class="conversation-info">
              <span class="conversation-id">{{ conv.conversationId }}</span>
              <span class="quality-score">Quality: {{ conv.qualityScore }}/100</span>
              <span class="conversion-prob">Conversion: {{ conv.conversionProbability }}%</span>
            </div>
            <button @click="viewConversation(conv.conversationId)">
              View Details
            </button>
          </div>
        </div>
      </div>

      <!-- Alerts and Opportunities -->
      <div class="alerts-opportunities">
        <h3>Alerts & Opportunities</h3>
        <div class="alert-list">
          <div 
            v-for="alert in dashboardData.alertsAndOpportunities" 
            :key="alert.type"
            class="alert-item"
            :class="`severity-${alert.severity}`"
          >
            <div class="alert-header">
              <span class="alert-type">{{ formatAlertType(alert.type) }}</span>
              <span class="alert-count">{{ alert.count }}</span>
            </div>
            <div class="alert-examples">
              <span v-for="example in alert.examples" :key="example">
                {{ example }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Coaching Insights -->
      <div class="coaching-insights">
        <h3>Coaching Impact</h3>
        <div class="coaching-stats">
          <div class="stat">
            <label>Total Suggestions</label>
            <span>{{ dashboardData.coachingInsights.totalSuggestions }}</span>
          </div>
          <div class="stat">
            <label>Implementation Rate</label>
            <span>{{ dashboardData.coachingInsights.implementationRate }}%</span>
          </div>
          <div class="stat">
            <label>Top Categories</label>
            <span>{{ dashboardData.coachingInsights.topCategories.join(', ') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="loading">
      Loading dashboard data...
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConversationIntelligenceDashboard',
  data() {
    return {
      dashboardData: null,
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      }
    };
  },
  
  mounted() {
    this.loadDashboard();
  },

  methods: {
    async loadDashboard() {
      try {
        const response = await fetch(
          `/api/conversation-intelligence/dashboard?start=${this.dateRange.start}&end=${this.dateRange.end}`
        );
        const result = await response.json();
        this.dashboardData = result.data;
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    },

    getTrendClass(metric) {
      const trends = this.dashboardData?.overview?.trends || {};
      const trend = trends[`${metric}Trend`];
      return trend === 'improving' ? 'trend-up' : trend === 'declining' ? 'trend-down' : 'trend-stable';
    },

    getConversationTrend() {
      return this.dashboardData?.overview?.trends?.conversationTrend || 'stable';
    },

    getQualityTrend() {
      return this.dashboardData?.overview?.trends?.qualityTrend || 'stable';
    },

    getConversionTrend() {
      return this.dashboardData?.overview?.trends?.conversionTrend || 'stable';
    },

    formatAlertType(type) {
      return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    },

    viewConversation(conversationId) {
      this.$router.push(`/conversations/${conversationId}`);
    }
  }
};
</script>

<style scoped>
.conversation-intelligence-dashboard {
  padding: 20px;
}

.kpi-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.kpi-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.kpi-value {
  font-size: 2rem;
  font-weight: bold;
  color: #2563eb;
}

.trend-up { color: #10b981; }
.trend-down { color: #ef4444; }
.trend-stable { color: #6b7280; }

.alert-item.severity-critical {
  border-left: 4px solid #ef4444;
}

.alert-item.severity-high {
  border-left: 4px solid #f59e0b;
}
</style>
```

These examples demonstrate practical implementation of OfferLogix's Conversation Intelligence System across various scenarios and technologies. The system provides comprehensive conversation analysis, real-time coaching, and optimization capabilities that can significantly improve automotive sales and customer service operations.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Create enhanced conversation AI service with automotive expertise and context-aware response generation", "status": "completed"}, {"id": "2", "content": "Build intelligent response router for analyzing context, intent, and routing responses appropriately", "status": "completed"}, {"id": "3", "content": "Enhance existing conversation analytics with sentiment progression tracking and improved intent classification", "status": "completed"}, {"id": "4", "content": "Implement response quality optimization framework with A/B testing and effectiveness scoring", "status": "completed"}, {"id": "5", "content": "Create integration layer to connect all new services with existing infrastructure", "status": "completed"}, {"id": "6", "content": "Add comprehensive documentation and usage examples", "status": "completed"}]