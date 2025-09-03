# MailMind V2 Webhook Fix - Deployment Instructions

## Issue Summary
Replies to campaign emails weren't producing AI responses due to:
1. ✅ **FIXED**: Broken inline V2 webhook handler causing 400 "missing required fields"
2. 🔄 **PENDING**: Missing V2 database tables causing 500 "drizzle columns" errors

## Code Changes Deployed
- **Commit**: `ab8fb9d` - "Fix V2 webhook handler: Replace broken inline handler with proper V2 router"
- **Status**: Pushed to GitHub, waiting for Render deployment

## Required Database Setup

### 1. Run V2 Schema Migration
Execute on production database:
```sql
-- Run this file: server/v2/migrations/0001_v2_schema.sql
psql $DATABASE_URL -f server/v2/migrations/0001_v2_schema.sql
```

### 2. Seed V2 Data
Execute on production database:
```sql
-- Run this file: server/v2/migrations/0002_seed_data.sql
psql $DATABASE_URL -f server/v2/migrations/0002_seed_data.sql
```

### 3. Verify Environment Variables
Ensure these are set in Render:
- `V2_MAILGUN_ENABLED=true` ✅ (confirmed)
- `MAILGUN_WEBHOOK_SIGNING_KEY=<your-signing-key>` ❓ (needs verification)
- `V2_LOG_EVENTS=true` (for debugging)

## Testing After Deployment

### 1. Health Check
```bash
curl -s https://ccl-3-final.onrender.com/v2/health | jq
# Should show new commit hash (not e28acaa)
```

### 2. Webhook Signature Test
```bash
curl -i -X POST https://ccl-3-final.onrender.com/v2/inbound/mailgun \
  -H "Content-Type: application/json" \
  -d '{"ping":"pong"}'
# Should return: 401 {"message":"invalid signature"}
```

### 3. End-to-End Test
1. Send email from `/v2/outbound/test` (agent = Riley@kunesmacomb...)
2. Reply from Gmail
3. Check database:
```sql
SELECT direction, sender, recipient, in_reply_to, message_id, conversation_id, created_at
FROM messages_v2 ORDER BY created_at DESC LIMIT 10;
```

## Expected Results After Fix
- ✅ Dummy POST → 401 "invalid signature" (not 400/500)
- ✅ Real reply inserts inbound row in `messages_v2`
- ✅ Conversation linking works via headers/fallback
- ✅ AI responder triggers and sends reply
- ✅ Gmail shows threaded AI response

## Rollback Plan
If issues occur, the V2 system can be disabled:
```
V2_MAILGUN_ENABLED=false
```
This will fall back to the V1 webhook system.
