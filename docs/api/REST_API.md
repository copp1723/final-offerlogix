# OneKeel Swarm REST API Documentation

Complete reference for integrating with OneKeel Swarm's powerful automotive email campaign platform through our RESTful API.

## Base URL
```
Production: https://api.onekeel.com/v1
Staging: https://staging-api.onekeel.com/v1
```

## Authentication

### API Key Authentication
All API requests require authentication using API keys:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.onekeel.com/v1/campaigns
```

### Getting Your API Key
1. Log into your OneKeel Swarm dashboard
2. Navigate to Settings > API Keys
3. Generate a new API key with appropriate permissions
4. Store securely and never expose in client-side code

### Permission Scopes
- `campaigns:read` - View campaign data
- `campaigns:write` - Create and modify campaigns
- `leads:read` - Access lead information
- `leads:write` - Create and update leads
- `analytics:read` - Access performance data
- `admin:write` - Administrative functions

## Rate Limits

### Standard Limits
- **General API**: 1000 requests per hour
- **Bulk Operations**: 100 requests per hour
- **Real-time Endpoints**: 5000 requests per hour

### Headers
Rate limit information is included in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Campaign Management

### List Campaigns
```http
GET /api/campaigns
```

**Parameters:**
- `status` (optional): Filter by campaign status (`active`, `draft`, `completed`, `paused`)
- `limit` (optional): Number of results per page (default: 50, max: 200)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "campaigns": [
    {
      "id": "camp_123456789",
      "name": "Spring F-150 Promotion",
      "status": "active",
      "type": "product_promotion",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z",
      "target_audience": {
        "vehicle_interest": ["F-150"],
        "lead_source": ["website", "phone"],
        "engagement_level": ["warm", "hot"]
      },
      "performance": {
        "sent": 1250,
        "delivered": 1230,
        "opened": 430,
        "clicked": 85,
        "responded": 23
      }
    }
  ],
  "total": 45,
  "has_more": true
}
```

### Create Campaign
```http
POST /api/campaigns
```

**Request Body:**
```json
{
  "name": "Summer Service Special",
  "type": "service_promotion",
  "description": "Promote summer maintenance packages to existing customers",
  "target_audience": {
    "vehicle_interest": ["all"],
    "lead_status": ["customer"],
    "last_service_date": {
      "before": "2024-06-01"
    }
  },
  "email_sequence": [
    {
      "subject": "Keep Your Vehicle Summer-Ready",
      "template_id": "tpl_service_reminder",
      "send_delay_hours": 0
    },
    {
      "subject": "Limited Time: 20% Off Summer Service",
      "template_id": "tpl_service_promotion",
      "send_delay_hours": 72
    }
  ],
  "start_date": "2025-06-01T09:00:00Z",
  "end_date": "2025-08-31T17:00:00Z"
}
```

**Response:**
```json
{
  "id": "camp_987654321",
  "name": "Summer Service Special",
  "status": "draft",
  "created_at": "2025-01-15T10:30:00Z",
  "ai_recommendations": {
    "subject_line_suggestions": [
      "Don't Let Summer Heat Damage Your Engine",
      "Beat the Heat: Summer Service Special Inside",
      "Your Vehicle's Summer Checkup is Due"
    ],
    "optimal_send_time": "Tuesday 10:00 AM",
    "predicted_open_rate": "28-35%",
    "estimated_responses": "15-25"
  }
}
```

### Update Campaign
```http
PUT /api/campaigns/{campaign_id}
```

### Delete Campaign
```http
DELETE /api/campaigns/{campaign_id}
```

### Launch Campaign
```http
POST /api/campaigns/{campaign_id}/launch
```

### Pause Campaign
```http
POST /api/campaigns/{campaign_id}/pause
```

## Lead Management

### List Leads
```http
GET /api/leads
```

**Parameters:**
- `status` (optional): Filter by lead status
- `vehicle_interest` (optional): Filter by vehicle interest
- `created_after` (optional): ISO 8601 date
- `engagement_score_min` (optional): Minimum engagement score

**Response:**
```json
{
  "leads": [
    {
      "id": "lead_abc123",
      "email": "john.smith@email.com",
      "first_name": "John",
      "last_name": "Smith",
      "phone": "+1-555-0123",
      "vehicle_interest": "F-150",
      "source": "website",
      "status": "warm",
      "engagement_score": 75,
      "last_interaction": "2025-01-14T15:30:00Z",
      "created_at": "2025-01-10T12:00:00Z",
      "tags": ["truck_interested", "financing_needed"],
      "custom_fields": {
        "trade_in_vehicle": "2018 Silverado",
        "purchase_timeline": "next_30_days"
      }
    }
  ],
  "total": 1250,
  "has_more": true
}
```

### Create Lead
```http
POST /api/leads
```

**Request Body:**
```json
{
  "email": "jane.doe@email.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+1-555-0456",
  "vehicle_interest": "Explorer",
  "source": "phone_inquiry",
  "status": "new",
  "custom_fields": {
    "preferred_contact_time": "evenings",
    "budget_range": "30000-40000"
  },
  "tags": ["suv_interested", "family_buyer"]
}
```

### Update Lead
```http
PUT /api/leads/{lead_id}
```

### Bulk Lead Import
```http
POST /api/leads/bulk
```

**Request Body:**
```json
{
  "leads": [
    {
      "email": "customer1@email.com",
      "first_name": "Customer",
      "last_name": "One",
      "vehicle_interest": "Mustang"
    },
    {
      "email": "customer2@email.com",
      "first_name": "Customer",
      "last_name": "Two",
      "vehicle_interest": "Bronco"
    }
  ],
  "options": {
    "skip_duplicates": true,
    "update_existing": false,
    "send_welcome_email": true
  }
}
```

## Conversation Management

### List Conversations
```http
GET /api/conversations
```

### Get Conversation
```http
GET /api/conversations/{conversation_id}
```

**Response:**
```json
{
  "id": "conv_xyz789",
  "lead_id": "lead_abc123",
  "campaign_id": "camp_123456789",
  "status": "active",
  "last_message_at": "2025-01-15T09:45:00Z",
  "messages": [
    {
      "id": "msg_001",
      "sender": "system",
      "content": "Thanks for your interest in the F-150! What specific features are you most excited about?",
      "timestamp": "2025-01-15T09:30:00Z",
      "ai_generated": true,
      "quality_score": 38
    },
    {
      "id": "msg_002",
      "sender": "lead",
      "content": "I'm interested in the towing capacity and fuel efficiency. Can you tell me more?",
      "timestamp": "2025-01-15T09:45:00Z",
      "intent_detected": "information_seeking",
      "buying_signals": ["specific_features"]
    }
  ],
  "ai_insights": {
    "engagement_level": "high",
    "purchase_intent": "moderate",
    "next_best_action": "provide_detailed_specifications",
    "handover_recommended": false
  }
}
```

### Send Message
```http
POST /api/conversations/{conversation_id}/messages
```

**Request Body:**
```json
{
  "content": "The 2024 F-150 offers best-in-class towing up to 14,000 lbs with available 3.5L PowerBoost engine, plus EPA-estimated 24 city/24 highway MPG. Would you like to schedule a test drive to experience it firsthand?",
  "sender": "agent",
  "use_ai_enhancement": true
}
```

### Generate AI Reply
```http
POST /api/conversations/{conversation_id}/ai-reply
```

**Request Body:**
```json
{
  "context": {
    "lead_preferences": ["towing", "fuel_efficiency"],
    "campaign_context": "F-150 promotion",
    "tone": "helpful_professional"
  },
  "options": {
    "max_length": 150,
    "include_cta": true,
    "personalization_level": "high"
  }
}
```

**Response:**
```json
{
  "suggested_reply": "Hi John! The F-150's 3.5L PowerBoost delivers 14,000 lbs towing with impressive 24 MPG efficiency. Perfect for your needs! Want to see it in action with a test drive this week?",
  "quality_score": 40,
  "confidence": "high",
  "alternatives": [
    "The F-150 combines serious towing power with smart fuel efficiency - exactly what you're looking for, John! Ready to experience it yourself?",
    "Great questions, John! F-150 leads the class in both towing (14K lbs) and efficiency (24 MPG). How about a test drive to see why it's America's best-selling truck?"
  ]
}
```

## AI and Intelligence

### Campaign Intelligence
```http
GET /api/intelligence/campaigns/{campaign_id}
```

**Response:**
```json
{
  "campaign_id": "camp_123456789",
  "performance_analysis": {
    "current_metrics": {
      "open_rate": 32.5,
      "click_rate": 6.8,
      "response_rate": 2.3,
      "conversion_rate": 15.4
    },
    "benchmark_comparison": {
      "industry_average_open_rate": 25.2,
      "your_historical_average": 28.9,
      "performance_vs_industry": "+29%",
      "performance_vs_history": "+12%"
    }
  },
  "optimization_recommendations": [
    {
      "type": "subject_line",
      "suggestion": "Add urgency with 'Limited Time' in subject lines",
      "expected_improvement": "8-12% open rate increase",
      "confidence": "high"
    },
    {
      "type": "send_time",
      "suggestion": "Shift sends to Tuesday 10 AM for this audience",
      "expected_improvement": "5-8% engagement increase",
      "confidence": "medium"
    }
  ],
  "ai_insights": {
    "top_performing_content": "F-150 capability demonstrations",
    "audience_preferences": ["video_content", "incentive_focused"],
    "next_campaign_suggestions": ["Trade-in value promotions", "Financing specials"]
  }
}
```

### Lead Scoring
```http
GET /api/intelligence/leads/{lead_id}/score
```

**Response:**
```json
{
  "lead_id": "lead_abc123",
  "overall_score": 78,
  "score_breakdown": {
    "engagement": 85,
    "intent": 75,
    "fit": 70,
    "timing": 80
  },
  "factors": {
    "positive": [
      "High email engagement (5 opens, 3 clicks)",
      "Specific vehicle interest (F-150)",
      "Recent website visits (3 in last week)",
      "Asked pricing questions"
    ],
    "negative": [
      "No phone number provided",
      "Long purchase timeline indicated"
    ]
  },
  "recommendations": [
    "Send F-150 specific content",
    "Include financing information",
    "Offer test drive opportunity"
  ],
  "predicted_conversion_probability": 0.42
}
```

### Quick Reply Suggestions
```http
POST /api/ai/quick-replies
```

**Request Body:**
```json
{
  "last_message": "What's your best price on the F-150?",
  "context": {
    "vehicle_interest": "F-150",
    "lead_stage": "consideration",
    "previous_interactions": 3
  }
}
```

**Response:**
```json
{
  "suggestions": [
    "Schedule a test drive to discuss pricing",
    "What's your target monthly payment?",
    "Check current F-150 incentives"
  ],
  "confidence_scores": [0.92, 0.88, 0.85]
}
```

## Analytics and Reporting

### Campaign Performance
```http
GET /api/analytics/campaigns/{campaign_id}
```

### Lead Performance
```http
GET /api/analytics/leads
```

**Parameters:**
- `date_range`: `7d`, `30d`, `90d`, `1y`, or custom range
- `group_by`: `date`, `campaign`, `vehicle_type`, `source`
- `metrics`: Comma-separated list of metrics to include

**Response:**
```json
{
  "date_range": "30d",
  "summary": {
    "total_leads": 1250,
    "new_leads": 340,
    "engaged_leads": 425,
    "converted_leads": 65,
    "conversion_rate": 5.2
  },
  "trends": [
    {
      "date": "2025-01-15",
      "new_leads": 15,
      "engaged": 45,
      "converted": 3
    }
  ],
  "segments": {
    "by_vehicle_type": {
      "F-150": {"leads": 340, "conversion_rate": 6.1},
      "Explorer": {"leads": 285, "conversion_rate": 4.8},
      "Mustang": {"leads": 190, "conversion_rate": 3.2}
    },
    "by_source": {
      "website": {"leads": 650, "conversion_rate": 5.8},
      "phone": {"leads": 380, "conversion_rate": 4.2},
      "referral": {"leads": 220, "conversion_rate": 7.1}
    }
  }
}
```

### ROI Analysis
```http
GET /api/analytics/roi
```

## Deliverability Management

### Domain Health Check
```http
GET /api/deliverability/health
```

**Response:**
```json
{
  "status": "healthy",
  "domain": "mg.yourdealership.com",
  "authentication": {
    "spf": "pass",
    "dkim": "pass",
    "dmarc": "pass"
  },
  "reputation_score": 92,
  "recommendations": [
    "Configure DKIM selector for better authentication",
    "Set up Google Postmaster Tools monitoring"
  ],
  "last_checked": "2025-01-15T10:00:00Z"
}
```

### Suppression List Management
```http
GET /api/deliverability/suppressions
POST /api/deliverability/suppressions
DELETE /api/deliverability/suppressions/{email}
```

### Bounce Management
```http
GET /api/deliverability/bounces
```

## Webhooks

### Event Types
OneKeel Swarm sends webhooks for various events:

- `campaign.launched` - Campaign started
- `campaign.completed` - Campaign finished
- `email.delivered` - Email successfully delivered
- `email.opened` - Email opened by recipient
- `email.clicked` - Link clicked in email
- `lead.created` - New lead added
- `lead.updated` - Lead information changed
- `conversation.new_message` - New message in conversation
- `handover.triggered` - Sales handover initiated

### Webhook Configuration
```http
POST /api/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-system.com/webhooks/onekeel",
  "events": ["email.opened", "lead.created", "handover.triggered"],
  "secret": "your_webhook_secret",
  "active": true
}
```

### Webhook Payload Example
```json
{
  "id": "evt_123456789",
  "type": "email.opened",
  "created": "2025-01-15T10:15:00Z",
  "data": {
    "email_id": "email_abc123",
    "campaign_id": "camp_123456789",
    "lead_id": "lead_xyz789",
    "timestamp": "2025-01-15T10:15:00Z",
    "user_agent": "Mozilla/5.0...",
    "ip_address": "192.168.1.1"
  }
}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "type": "validation_error",
    "message": "Invalid email address format",
    "details": {
      "field": "email",
      "code": "invalid_format"
    },
    "request_id": "req_123456789"
  }
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Rate Limited (too many requests)
- `500` - Internal Server Error (system issue)

## SDKs and Libraries

### JavaScript/Node.js
```javascript
const OneKeel = require('@onekeel/sdk');

const client = new OneKeel({
  apiKey: 'your_api_key',
  environment: 'production'
});

// Create a campaign
const campaign = await client.campaigns.create({
  name: 'Spring Promotion',
  type: 'product_promotion',
  description: 'Promote spring vehicle specials'
});
```

### Python
```python
import onekeel

client = onekeel.Client(api_key='your_api_key')

# Get lead information
lead = client.leads.get('lead_abc123')
print(f"Lead: {lead.first_name} {lead.last_name}")
```

### PHP
```php
<?php
require_once 'vendor/autoload.php';

$client = new OneKeel\Client([
    'api_key' => 'your_api_key'
]);

// List campaigns
$campaigns = $client->campaigns->all();
```

## Best Practices

### API Usage
- **Cache responses** when appropriate to reduce API calls
- **Use bulk endpoints** for importing large datasets
- **Implement retry logic** with exponential backoff
- **Monitor rate limits** and adjust request frequency

### Security
- **Store API keys securely** and never expose in client-side code
- **Use HTTPS** for all API communications
- **Validate webhook signatures** to ensure authenticity
- **Rotate API keys** regularly for enhanced security

### Performance
- **Paginate large result sets** using limit and offset parameters
- **Use specific field selection** to reduce response size
- **Implement proper error handling** for robust integrations
- **Monitor API performance** and optimize based on usage patterns

---

For additional support or questions about the API, contact our technical team at api-support@onekeel.com or visit our developer portal at https://developers.onekeel.com.