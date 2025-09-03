# MailMind V2 - Email Services

Core email threading and normalization services for MailMind V2.

## Overview

This module provides deterministic email threading with perfect continuity for agent-based email conversations. It handles:

- **Deterministic Message-ID generation** - Consistent format across all outbound emails
- **Perfect threading** - In-Reply-To and References header management
- **Agent identity** - Proper From/Reply-To formatting
- **Inbound normalization** - Robust Mailgun payload parsing
- **Database integration** - Conversation and message tracking

## Core Components

### MailgunThreading

The main service class that handles outbound email threading:

```typescript
import { MailgunThreading } from './MailgunThreading';

const service = new MailgunThreading(transport);

const result = await service.sendEmail({
  agent: {
    id: 'agent-123',
    name: 'Riley Donovan',
    domain: 'kunesmacomb.kunesauto.vip',
    localPart: 'riley',
  },
  to: 'customer@example.com',
  subject: 'Welcome to Kunes Macomb',
  html: '<p>Thank you for your interest!</p>',
});
```

### Inbound Normalizer

Normalizes Mailgun webhook payloads into consistent objects:

```typescript
import { normalizeMailgun } from './inbound-normalizer';

const inboundEmail = normalizeMailgun(mailgunPayload);
console.log(inboundEmail.agentLocalPart); // 'riley'
console.log(inboundEmail.fromEmail);      // 'customer@example.com'
```

## Key Features

### Deterministic Message-IDs

All outbound emails get Message-IDs in the format:
```
<{uuid}@{agent.domain}>
```

### Agent Identity

From and Reply-To headers are formatted as:
```
{agent.name} <{agent.localPart}@{agent.domain}>
```

### Perfect Threading

- New threads: Only Message-ID header
- Replies: Message-ID + In-Reply-To + References chain
- References capped at 10 entries to prevent header bloat

### Database Integration

- Automatic conversation lookup/creation by (agentId, leadEmail)
- Message storage with threading metadata
- lastMessageId tracking for perfect continuity

## Testing

Comprehensive test suite with snapshot verification:

```bash
# Run all email service tests
npm test -- --testPathPattern=v2/services/email

# Run specific test files
npm test MailgunThreading.test.ts
npm test inbound-normalizer.test.ts
npm test integration.test.ts
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Inbound       │    │  MailgunThreading │    │   Database      │
│   Normalizer    │───▶│     Service       │───▶│   Operations    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
   InboundEmail              OutboundResult           Conversation
     Object                   + MessageID              + Messages
```

## Contract Guarantees

1. **From/Reply-To** must always be agent identity
2. **Message-ID** format is deterministic and domain-specific  
3. **Threading headers** maintain perfect email client continuity
4. **No V1 dependencies** - completely isolated from legacy code
5. **Transport agnostic** - works with any EmailTransport implementation
