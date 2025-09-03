# Email Reliability System

## Overview

The MailMind Email Reliability System provides production-grade email delivery with comprehensive queue management, bounce handling, suppression lists, and deliverability monitoring. This system ensures reliable email conversations with leads and prevents delivery issues from impacting your campaigns.

## ✅ Phase 1: Email Queue & Retry System (COMPLETED)

### Features Implemented

- **Redis/Bull Queue System**: Asynchronous email processing with job management
- **Database Tables**: Comprehensive tracking with `email_queue`, `email_delivery_events`, `email_suppression_list`, `domain_health`, and `campaign_delivery_metrics`
- **Retry Logic**: Exponential backoff with configurable max attempts
- **Campaign Integration**: Replaced direct Mailgun calls with queued processing
- **Graceful Fallback**: Falls back to direct sending if queue system is unavailable

### Key Components

#### 1. Email Queue Service (`server/services/email-queue.ts`)
- **Job Processing**: Bull queue with Redis backend
- **Retry Logic**: Exponential backoff (200ms base, 2x multiplier, max 1.5s)
- **Concurrency Control**: Configurable concurrent job processing
- **Status Tracking**: Real-time job status monitoring
- **Cleanup**: Automatic removal of old completed/failed jobs

#### 2. Reliable Email Service (`server/services/reliable-email-service.ts`)
- **Suppression Checking**: Pre-send validation against suppression lists
- **Queue Integration**: Seamless integration with campaign execution
- **Priority Management**: High priority for auto-responses, normal for campaigns
- **Metadata Tracking**: Rich context for debugging and analytics

#### 3. Campaign Integration (`server/services/campaign-execution/ExecutionProcessor.ts`)
- **Queue-First Approach**: Uses reliable email service by default
- **Fallback Logic**: Gracefully falls back to direct sending if needed
- **Context Preservation**: Maintains campaign and lead context in queue jobs

## ✅ Phase 2: Bounce & Suppression Management (COMPLETED)

### Features Implemented

#### 1. Suppression List Manager (`server/services/suppression-manager.ts`)
- **Automated Suppression**: Process bounces, complaints, unsubscribes
- **Expiration Support**: Temporary suppressions (e.g., 7 days for soft bounces)
- **Lead Status Updates**: Automatic lead status changes for suppressed emails
- **Bulk Operations**: Efficient batch processing for large suppression lists

#### 2. Mailgun Webhook Handler (`server/services/mailgun-webhook-handler.ts`)
- **Event Processing**: Handles delivered, opened, clicked, bounced, complained, unsubscribed events
- **Signature Validation**: Secure webhook verification with timing checks
- **Campaign Metrics**: Real-time campaign performance tracking
- **Delivery Events**: Complete email lifecycle tracking

#### 3. Suppression Types
- **Hard Bounces**: Permanent suppression (invalid email addresses)
- **Soft Bounces**: Temporary suppression (7 days, mailbox full, etc.)
- **Complaints**: Permanent suppression (spam reports)
- **Unsubscribes**: Permanent suppression (user opt-out)
- **Manual**: Admin-controlled suppression

## 🔗 API Endpoints

### Email Queue Management
```
GET    /api/email-reliability/queue/stats           - Queue statistics
POST   /api/email-reliability/queue/send            - Queue single email
GET    /api/email-reliability/queue/job/:jobId      - Job details
DELETE /api/email-reliability/queue/job/:jobId      - Cancel job
POST   /api/email-reliability/queue/retry-failed    - Retry failed jobs
POST   /api/email-reliability/queue/pause           - Pause queue
POST   /api/email-reliability/queue/resume          - Resume queue
POST   /api/email-reliability/queue/cleanup         - Cleanup old jobs
```

### Suppression List Management
```
GET    /api/email-reliability/suppression/stats           - Suppression statistics
GET    /api/email-reliability/suppression/list            - Paginated suppression list
POST   /api/email-reliability/suppression/add             - Add email to suppression
GET    /api/email-reliability/suppression/:email          - Get suppression details
DELETE /api/email-reliability/suppression/:email          - Remove from suppression
POST   /api/email-reliability/suppression/cleanup         - Cleanup expired suppressions
```

### Delivery Events
```
GET    /api/email-reliability/delivery-events/campaign/:campaignId  - Campaign events
GET    /api/email-reliability/delivery-events/email/:email          - Email events
POST   /api/email-reliability/webhook/mailgun                       - Mailgun webhook (no auth)
```

## 🔧 Configuration

### Environment Variables

#### Redis Configuration
```bash
REDIS_HOST=localhost              # Redis hostname
REDIS_PORT=6379                   # Redis port
REDIS_PASSWORD=your-password      # Redis password (optional)
REDIS_DB=0                        # Redis database number
```

#### Email Queue Configuration
```bash
MAILGUN_MAX_RETRIES=3            # Max retry attempts per email
MAILGUN_RETRY_BASE_MS=200        # Base retry delay in milliseconds
MAILGUN_BULK_CONCURRENCY=5       # Concurrent email processing jobs
EXECUTION_BATCH_CONCURRENCY=10   # Campaign execution concurrency
```

#### Webhook Configuration
```bash
MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key  # Mailgun webhook signing key
```

### Database Migration

Run the database migration to create the email reliability tables:

```bash
npm run db:push
# or manually apply: drizzle/0011_email_reliability_system.sql
```

## 📊 Monitoring & Analytics

### Queue Statistics
- **Active Jobs**: Currently processing
- **Waiting Jobs**: Queued for processing
- **Completed Jobs**: Successfully sent
- **Failed Jobs**: Permanent failures
- **Delayed Jobs**: Scheduled for future delivery

### Suppression Statistics
- **Total Suppressions**: Overall count
- **By Type**: Bounces, complaints, unsubscribes, manual
- **Bounce Types**: Hard vs soft bounces
- **Expired**: Suppressions that have expired

### Campaign Metrics
- **Delivery Rates**: Percentage of emails delivered
- **Open Rates**: Engagement tracking
- **Bounce Rates**: Delivery failure rates
- **Complaint Rates**: Spam report rates

## 🚀 Deployment

### Production Setup

1. **Redis Server**: Deploy Redis with persistence enabled
2. **Database Migration**: Apply email reliability schema
3. **Webhook Setup**: Configure Mailgun webhook endpoint
4. **Environment Variables**: Set all required configuration
5. **Monitoring**: Set up alerts for queue health and delivery rates

### Health Checks

The system provides health check endpoints:
```bash
curl /api/email-reliability/queue/stats
curl /api/email-reliability/suppression/stats
```

### Maintenance Tasks

Automatic maintenance runs:
- **Queue Cleanup**: Every hour (removes old completed/failed jobs)
- **Suppression Cleanup**: Every 6 hours (removes expired suppressions)

## 🔧 Troubleshooting

### Common Issues

1. **Queue Not Processing**
   - Check Redis connection
   - Verify REDIS_HOST and REDIS_PORT
   - Check queue stats endpoint

2. **High Bounce Rates**
   - Review suppression list
   - Check domain health
   - Validate email list quality

3. **Webhook Not Working**
   - Verify MAILGUN_WEBHOOK_SIGNING_KEY
   - Check webhook URL configuration in Mailgun
   - Monitor webhook endpoint logs

### Monitoring Commands

```bash
# Check queue status
curl -H "Authorization: Bearer $TOKEN" /api/email-reliability/queue/stats

# Check recent delivery events
curl -H "Authorization: Bearer $TOKEN" /api/email-reliability/delivery-events/campaign/:id

# Check suppression list size
curl -H "Authorization: Bearer $TOKEN" /api/email-reliability/suppression/stats

# Retry failed jobs
curl -X POST -H "Authorization: Bearer $TOKEN" /api/email-reliability/queue/retry-failed
```

## 📋 Next Steps (Phases 3-4)

### Phase 3: Deliverability Monitoring
- [ ] SPF/DKIM domain validation checks
- [ ] Domain reputation monitoring service
- [ ] Send rate limiting per domain/campaign
- [ ] Email deliverability analytics dashboard

### Phase 4: Advanced Features
- [ ] Email template validation and spam score checking
- [ ] A/B testing capabilities for email templates
- [ ] Advanced send scheduling and throttling
- [ ] Comprehensive email delivery tracking system

## 🔒 Security

- **Webhook Validation**: All webhooks verified with HMAC signatures
- **API Authentication**: All management endpoints require authentication
- **Data Privacy**: Email content truncated in logs, sensitive data encrypted
- **Rate Limiting**: Built-in protection against abuse

## 📚 Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Campaign      │───▶│ Email Queue  │───▶│    Mailgun     │
│   Execution     │    │   Service    │    │   Delivery     │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │                       │
                              ▼                       ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Database      │    │    Redis     │    │   Webhooks     │
│   Tracking      │    │    Queue     │    │   Processing   │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

The system ensures reliable email delivery through:
1. **Queue-First Architecture**: All emails go through the queue system
2. **Comprehensive Tracking**: Every email lifecycle event is recorded
3. **Smart Retry Logic**: Exponential backoff with suppression awareness
4. **Real-Time Monitoring**: Live dashboard of email delivery health

---

**Status**: Phase 1 & 2 Complete ✅  
**Next**: Phase 3 - Deliverability Monitoring  
**Contact**: Email reliability specialist for production deployment guidance