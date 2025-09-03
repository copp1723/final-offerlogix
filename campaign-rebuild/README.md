# Campaign Rebuild - Simple & Reliable Email Campaign System

## Overview

This is a **complete rebuild** of the campaign workflow system, designed to be simpler, more reliable, and easier to maintain. The system focuses on the core requirement: **intelligent two-way email conversations between AI agents and leads**.

## Key Features

✅ **Simple Agent Management** - One agent per business/subdomain  
✅ **Reliable Email Threading** - Proper Message-ID and threading headers  
✅ **Configurable AI Responses** - System prompts with placeholders  
✅ **Smart Handovers** - Keyword triggers and confidence thresholds  
✅ **Multi-tenant Ready** - Support multiple businesses in one system  
✅ **No Complexity** - No scoring, no memory systems, just conversations  

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │────▶│  Campaign   │────▶│    Leads    │
│ (Business)  │     │  (Outreach) │     │ (Recipients)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                    ┌─────────────┐
                    │Conversation │
                    │  (Thread)   │
                    └─────────────┘
                           │
                    ┌─────────────┐
                    │  Messages   │
                    │ (In/Out)    │
                    └─────────────┘
                           │
                    ┌─────────────┐
                    │  Handover   │
                    │  (Human)    │
                    └─────────────┘
```

## Setup Instructions

### 1. Database Setup

```bash
# Create database
createdb mailmind_v2

# Run migrations
psql mailmind_v2 < campaign-rebuild/schema.sql
```

### 2. Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mailmind_v2

# Mailgun
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_WEBHOOK_KEY=your-webhook-signing-key
BASE_DOMAIN=okcrm.ai

# OpenRouter (AI)
OPENROUTER_API_KEY=your-openrouter-key
AI_MODEL=openai/gpt-4-turbo-preview

# Server
PORT=3000
```

### 3. Install Dependencies

```bash
npm install express drizzle-orm postgres zod
npm install mailgun.js form-data
npm install @types/express @types/node typescript
```

### 4. Configure Mailgun

1. Add DNS records for each subdomain (e.g., `toyota.okcrm.ai`)
2. Verify domain in Mailgun dashboard
3. Set up webhook URL: `https://your-domain.com/webhooks/mailgun`

## Usage Guide

### Creating an Agent

```typescript
POST /api/agents
{
  "name": "Sarah - Toyota Sales",
  "businessName": "Toyota of Downtown",
  "subdomain": "toyota",
  "senderName": "Sarah Mitchell",
  "senderEmail": "sarah@toyota.okcrm.ai",
  "role": "Sales Consultant",
  "goal": "help customers find their perfect Toyota",
  "systemPrompt": "You are {agent_name}, a {role} at {business_name}...",
  "promptVariables": {
    "agent_name": "Sarah Mitchell",
    "role": "Sales Consultant",
    "business_name": "Toyota of Downtown"
  },
  "handoverTriggers": ["speak to human", "manager", "price"],
  "maxMessages": 8,
  "confidenceThreshold": 0.7,
  "handoverEmail": "manager@toyota.com"
}
```

### Creating a Campaign

```typescript
POST /api/campaigns
{
  "agentId": "agent-uuid-here",
  "name": "December Toyota Sale",
  "subject": "Exclusive Toyota Deals for You",
  "initialMessage": "Hi {first_name},\n\nI noticed you were interested in our Toyota lineup..."
}
```

### Adding Leads

```typescript
POST /api/campaigns/{campaign-id}/leads
{
  "emails": [
    "john@example.com",
    "jane@example.com",
    "bob@example.com"
  ]
}
```

### Launching a Campaign

```typescript
POST /api/campaigns/{campaign-id}/launch
{
  "batchSize": 10,
  "delayBetweenBatches": 2000
}
```

## Email Flow

### 1. Initial Email
- Campaign launches → Email sent from `sarah@toyota.okcrm.ai`
- Proper Message-ID and Thread-ID headers set
- Conversation created in database

### 2. Lead Replies
- Reply received at `sarah@toyota.okcrm.ai`
- Mailgun webhook triggered
- Message stored with threading info

### 3. AI Response
- Agent's system prompt used
- Response generated based on conversation history
- Checks for handover triggers

### 4. Threading Maintained
- Reply sent with proper In-Reply-To header
- References chain preserved
- Thread stays in same email conversation

### 5. Handover (if needed)
- Triggered by keywords, message count, or low confidence
- Human notified
- Conversation marked for review

## System Prompt Configuration

System prompts support placeholders that are replaced with agent-specific values:

```
You are {agent_name}, a {role} at {business_name}.
Your goal is to {goal}.

Keep responses concise and professional.
Focus on understanding customer needs.

If the customer mentions pricing or wants to speak to a human,
politely indicate you'll connect them with a specialist.
```

## Handover Logic

Handovers are triggered when:

1. **Keywords detected** - Customer mentions trigger words
2. **Message limit reached** - Conversation exceeds max messages
3. **Low confidence** - AI response confidence below threshold
4. **Manual trigger** - AI determines handover needed

## API Endpoints

### Agents
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents` - Create agent
- `PUT /api/agents/:id` - Update agent
- `GET /api/agents/:id/statistics` - Get agent stats

### Campaigns
- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/leads` - Add leads
- `POST /api/campaigns/:id/launch` - Launch campaign
- `GET /api/campaigns/:id/statistics` - Get campaign stats
- `POST /api/campaigns/:id/pause` - Pause campaign
- `POST /api/campaigns/:id/resume` - Resume campaign

### Leads
- `GET /api/leads` - List all leads
- `POST /api/leads` - Create lead
- `POST /api/leads/import` - Bulk import leads

### Conversations
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation with messages

### Handovers
- `GET /api/handovers` - List pending handovers
- `POST /api/handovers/:id/assign` - Assign to human
- `POST /api/handovers/:id/resolve` - Mark as resolved

### Webhooks
- `POST /webhooks/mailgun` - Mailgun inbound email webhook

## Testing

### 1. Test Email Threading

```bash
# Send test email
curl -X POST http://localhost:3000/api/campaigns/test-campaign-id/launch

# Check Mailgun logs for proper headers
# Reply to email and verify webhook receives it
```

### 2. Test AI Responses

```bash
# Simulate inbound email
curl -X POST http://localhost:3000/webhooks/mailgun \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "test@example.com",
    "recipient": "sarah@toyota.okcrm.ai",
    "subject": "Re: Toyota inquiry",
    "body-plain": "What colors does the Camry come in?",
    "timestamp": "1234567890",
    "token": "test-token",
    "signature": "test-signature"
  }'
```

### 3. Test Handover Triggers

Send messages with trigger keywords to verify handover:
- "I want to speak to a human"
- "What's the price?"
- "Can I talk to your manager?"

## Migration from Old System

### 1. Export existing leads
```sql
SELECT email, first_name, last_name FROM old_leads;
```

### 2. Import to new system
```bash
POST /api/leads/import
```

### 3. Create agents for each business
Map old agent configs to new simplified structure

### 4. Update webhook URLs
Point Mailgun webhooks to new endpoints

## Production Deployment

### 1. Database
- Use connection pooling
- Set up read replicas for scaling
- Regular backups

### 2. Email
- Verify all subdomains in Mailgun
- Set up SPF, DKIM, DMARC records
- Monitor delivery rates

### 3. Security
- Use HTTPS everywhere
- Validate webhook signatures
- Rate limit API endpoints
- Sanitize user inputs

### 4. Monitoring
- Track email delivery rates
- Monitor AI response times
- Alert on handover queue length
- Log conversation metrics

## Advantages Over Previous System

| Old System | New System |
|------------|------------|
| Complex scoring algorithms | Simple confidence threshold |
| Memory system overhead | Direct conversation context |
| Template versioning | Single message per campaign |
| Queue-based email | Direct send with retry |
| Scattered agent config | Centralized agent table |
| Complex handover logic | Clear trigger rules |

## Support & Maintenance

### Common Issues

**Email not threading properly**
- Check Message-ID headers
- Verify In-Reply-To is set
- Ensure thread-id is consistent

**AI responses not generating**
- Check OpenRouter API key
- Verify agent has system prompt
- Check confidence threshold

**Handovers not triggering**
- Verify trigger keywords are configured
- Check message count limits
- Monitor confidence scores

### Database Maintenance

```sql
-- Clean old webhook events (30 days)
DELETE FROM webhook_events 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Archive completed conversations (90 days)
UPDATE conversations 
SET status = 'archived' 
WHERE status = 'completed' 
AND updated_at < NOW() - INTERVAL '90 days';
```

## Next Steps

1. **Test the system** with a small campaign
2. **Monitor metrics** for first week
3. **Adjust AI prompts** based on responses
4. **Scale gradually** to more agents/campaigns
5. **Add features** only if truly needed

---

**Remember: Keep it simple, keep it reliable, keep it maintainable.**
