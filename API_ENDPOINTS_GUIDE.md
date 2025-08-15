# OneKeel Swarm - External API Endpoints Guide

## INCOMING WEBHOOKS (Receive from External Systems)

### 1. Mailgun Inbound Email Processing
**Endpoint**: `POST /api/webhooks/mailgun/inbound`
- **Purpose**: Automatically process incoming emails and create leads
- **Features**: Signature verification, lead extraction, auto-response
- **Integration**: Configure in your Mailgun dashboard

### 2. Mailgun Delivery Events  
**Endpoint**: `POST /api/webhooks/mailgun/events`
- **Events**: delivered, opened, clicked, bounced, failed, unsubscribed
- **Purpose**: Track email campaign performance in real-time
- **Auto-updates**: Lead status and campaign analytics

### 3. Twilio SMS Webhooks
**Endpoint**: `POST /api/webhooks/twilio/sms`  
- **Purpose**: Handle inbound SMS messages and create conversations
- **Features**: Auto-lead creation, conversation threading
- **Response**: TwiML responses for automated replies

### 4. Campaign Execution Webhooks
**Endpoint**: `POST /api/webhooks/campaign/execute`
- **Purpose**: Trigger campaign execution from external schedulers
- **Features**: Batch processing, error handling, status reporting
- **Security**: Token-based authentication

### 5. Generic Test Webhook
**Endpoint**: `POST /api/webhooks/test`
- **Purpose**: Development testing and integration verification
- **Features**: Flexible payload handling, detailed logging

## OUTBOUND APIs (Send to External Systems)

### 1. Email Delivery (Mailgun Integration)
- **Service**: Mailgun API integration
- **Features**: Bulk sending, template personalization, delivery tracking
- **Endpoints**: Fully integrated in campaign execution

### 2. SMS Integration (Twilio)
- **Service**: Twilio API for SMS alerts and notifications  
- **Features**: Phone validation, delivery confirmation
- **Use cases**: Campaign alerts, handover notifications

### 3. AI Content Generation
- **Services**: OpenRouter API, OpenAI API
- **Features**: Campaign content, conversation responses, analytics
- **Models**: GPT-4o, specialized automotive prompts

### 4. Real-time WebSocket Communication
- **Service**: Native WebSocket server on `/ws`
- **Features**: Live conversations, real-time updates, notifications
- **Integration**: External systems can connect via WebSocket

## EXTERNAL SYSTEM INTEGRATION ENDPOINTS

### Lead Management APIs
```
GET    /api/leads              - Retrieve all leads
POST   /api/leads              - Create new lead  
PUT    /api/leads/:id          - Update existing lead
DELETE /api/leads/:id          - Delete lead
```

### Campaign Management APIs  
```
GET    /api/campaigns          - List all campaigns
POST   /api/campaigns          - Create new campaign
PUT    /api/campaigns/:id      - Update campaign
POST   /api/campaigns/:id/execute - Execute campaign
```

### Conversation APIs
```
GET    /api/conversations      - List conversations
POST   /api/conversations      - Create conversation
POST   /api/conversations/:id/messages - Send message
POST   /api/conversations/:id/evaluate-handover - Trigger handover evaluation
```

### Analytics & Intelligence APIs
```
GET    /api/intelligence/dashboard    - Get AI insights
GET    /api/campaigns/:id/analytics   - Campaign performance
GET    /api/leads/scoring             - Lead scoring data
```

## AUTHENTICATION & SECURITY

### API Key Authentication
- All external endpoints support API key authentication
- Configure in environment variables for security

### Webhook Security
- Mailgun: Signature verification implemented
- Twilio: Request validation available
- Custom tokens for campaign webhooks

### CORS Configuration
- Production domain: `https://ccl-3-final.onrender.com`
- Development: `localhost:5000` 
- Configurable for additional domains

## READY FOR EXTERNAL INTEGRATION

Your OneKeel Swarm platform is **production-ready** with:

✅ **Inbound Processing**: Mailgun emails, Twilio SMS, custom webhooks
✅ **Outbound Delivery**: Email campaigns, SMS alerts, API responses  
✅ **Real-time Communication**: WebSocket connections, live conversations
✅ **AI Integration**: OpenRouter/OpenAI APIs for intelligent responses
✅ **Database APIs**: Full CRUD operations for leads, campaigns, conversations
✅ **Analytics APIs**: Performance tracking, lead scoring, intelligence insights
✅ **Security**: Authentication, webhook verification, CORS protection

**Next Steps for External Integration:**
1. Configure webhook URLs in Mailgun/Twilio dashboards
2. Set up API keys for external system authentication  
3. Test webhook endpoints with your external services
4. Integrate real-time WebSocket for live features
5. Use analytics APIs for external reporting systems