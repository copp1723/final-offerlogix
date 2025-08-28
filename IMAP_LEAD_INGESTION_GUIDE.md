# IMAP Lead Ingestion System - Complete Implementation

## 🎯 Two-Lane Email Architecture

OneKeel Swarm now implements the recommended two-lane email system with proper domain separation:

### Lane A: Campaign Replies (Mailgun Routes)
- **Purpose**: Handle replies to marketing campaigns
- **Domain**: `mg.onekeel.ai` / `mg.watchdogai.us`
- **Method**: Mailgun Routes → `/api/webhooks/mailgun/inbound`
- **Status**: ✅ **ACTIVE AND TESTED** (Real email sent to josh.copp@onekeel.ai)

### Lane B: New Lead Ingestion (IMAP Monitor)  
- **Purpose**: Process new leads from OEM forms, Cars.com, Autotrader, website forms
- **Domain**: Regular mailboxes like `sales@onekeel.ai`, `leads@onekeel.ai`
- **Method**: IMAP monitor → Lead parsing → Database storage
- **Status**: ✅ **IMPLEMENTED** (Needs IMAP credentials to activate)

## 🔧 IMAP Configuration

To enable lead ingestion from email sources, set these environment variables:

```bash
# Required IMAP Settings
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=sales@onekeel.ai
IMAP_PASSWORD=<app_password_or_oauth_token>

# Optional Advanced Settings
IMAP_FOLDER=INBOX                    # Folder to monitor
IMAP_IDLE=true                       # Real-time monitoring
IMAP_POLL_INTERVAL_MS=60000          # Fallback polling interval
IMAP_MOVE_PROCESSED=Processed        # Move processed emails
IMAP_MOVE_FAILED=Failed              # Move failed emails
LEAD_INGEST_ALLOWED_SENDERS=*        # Filter by sender domains
```

## 🛡️ Domain Guard Protection

The system automatically prevents overlap between the two lanes:

```typescript
// Skips emails sent to Mailgun domains
const mgDomains = [
  '@mg.onekeel.ai',
  '@mg.watchdogai.us',
  'reply@',
  'noreply@'
];
```

## 🔍 Lead Parsing Intelligence

The IMAP system automatically extracts:

- **Contact Info**: Email, phone, name (first/last)
- **Vehicle Interest**: Make, model, year from various formats
- **Lead Source**: Auto-detects Cars.com, Autotrader, KBB, CarGurus
- **Metadata**: Form fields, sender domain, content analysis

## 📊 Health Monitoring

Check system status:

- **Email Health**: `GET /api/health/email` - Mailgun status
- **IMAP Health**: `GET /api/health/imap` - Lead ingestion status  
- **System Health**: `GET /api/health/system` - Overall platform

## 🚀 After Deployment - Two-Way Conversations

When you deploy and configure IMAP credentials:

1. **Campaign Emails** → Sent via Mailgun (`mg.onekeel.ai`)
2. **Lead Replies** → Processed via Mailgun Routes (real-time)
3. **New Lead Forms** → Processed via IMAP monitor (Cars.com, etc.)
4. **AI Responses** → Generated for both lanes with automotive context
5. **WebSocket Updates** → Real-time dashboard notifications
6. **Conversation Threading** → Maintains context across all interactions

## ✅ Production Validation Results

**Core Email Delivery**: ✅ Successfully sent production email to josh.copp@onekeel.ai
**Mailgun Integration**: ✅ Domain configured and tested (`mg.watchdogai.us`)
**IMAP Service**: ✅ Code deployed, waiting for credentials to activate
**WebSocket Communication**: ✅ Real-time updates operational
**AI Response Generation**: ✅ Claude/GPT-4o integration active
**Lead Database**: ✅ PostgreSQL with proper schema
**Conversation Threading**: ✅ Full conversation management

## 🎉 Result

OneKeel Swarm is now production-ready with enterprise-grade two-way conversation capabilities. The dual-lane architecture ensures:

- **Zero Overlap**: Campaign replies and new leads processed separately
- **Real-Time Processing**: Both IMAP and webhook processing
- **Intelligent Parsing**: Automotive-specific lead extraction
- **Context Preservation**: Full conversation history maintained
- **AI-Powered Responses**: Context-aware automotive responses

The system will handle both outbound campaigns and inbound lead processing seamlessly after IMAP credentials are configured.