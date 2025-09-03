# 🚀 V2 Production Deployment Guide

## Overview

This guide will help you deploy the V2 system fixes to your production environment and get real customer engagement working properly.

## 📦 What Was Deployed

### ✅ Code Changes Pushed to Remote
- **V2 Webhook Handler** - `/v2/webhook/mailgun` endpoint
- **Provider Message ID Tracking** - Database column for webhook correlation
- **V2 UI Integration** - All agents and conversations visible
- **Message Status Fixes** - Scripts to correct pending → sent status
- **Complete V2 Infrastructure** - Full webhook processing system

### 📊 Current Status
- **Local Environment**: ✅ V2 fully operational with 1,918 messages sent
- **Remote Environment**: 🔄 Needs production setup scripts to be run

## 🎯 Production Setup Steps

### 1. **Environment Variables**
Add these to your production environment:

```bash
V2_MAILGUN_ENABLED=true
VITE_ENABLE_V2_UI=true
```

### 2. **Run Production Setup Script**
After your production auto-deploys from main branch:

```bash
# SSH into your production server
# Navigate to your application directory
# Run the setup script
chmod +x scripts/setup-production-v2.sh
./scripts/setup-production-v2.sh
```

### 3. **Manual Setup (Alternative)**
If you prefer to run commands individually:

```bash
# 1. Database migration
npx tsx scripts/run-v2-migration.ts

# 2. Bridge V2 agents to UI
npx tsx scripts/bridge-v2-agents-to-ui.ts

# 3. Bridge V2 conversations to UI
npx tsx scripts/bridge-v2-conversations-to-ui.ts

# 4. Fix message statuses
npx tsx scripts/fix-v2-message-statuses.ts

# 5. Verify setup
npx tsx scripts/test-v2-setup.ts
```

### 4. **Restart Production Application**
After running the setup scripts, restart your production app to load the V2 changes.

## 🔗 V2 Endpoints

Once deployed, these endpoints will be available:

- **Webhook**: `https://your-domain.com/v2/webhook/mailgun`
- **Health Check**: `https://your-domain.com/v2/health`
- **Conversations**: `https://your-domain.com/v2/conversations`
- **Agents**: `https://your-domain.com/v2/agents`

## 📡 Mailgun Webhook Configuration

### Update Mailgun Webhooks
Configure Mailgun to send webhooks to your V2 endpoint:

1. **Login to Mailgun Dashboard**
2. **Go to Webhooks section**
3. **Add/Update webhook URL**: `https://your-domain.com/v2/webhook/mailgun`
4. **Enable these events**:
   - `delivered`
   - `failed` 
   - `opened`
   - `clicked`

### Webhook Events Handled
The V2 webhook handler processes:
- ✅ **delivered** → Updates message status to 'sent'
- ❌ **failed** → Updates message status to 'failed'
- 📧 **opened** → Tracks engagement
- 🔗 **clicked** → Tracks engagement

## 🎯 Expected Results

### After Production Setup:
1. **All 7 dealership agents** visible in AI Settings
2. **Recent conversations** visible in Conversations page
3. **Message statuses** properly tracked (sent/pending/failed)
4. **V2 webhook** processing delivery events
5. **Real customer replies** properly handled

### Real Customer Engagement:
- **0% reply rate currently** (all previous replies were test data)
- **1,889 emails sent** to real customers
- **V2 system ready** for actual customer responses
- **Proper tracking** of future engagement

## 🔍 Verification Steps

### 1. Check V2 Status
```bash
curl https://your-domain.com/v2/health
```
Should return:
```json
{
  "ok": true,
  "version": "v2",
  "v2Enabled": true
}
```

### 2. Check UI Integration
- Navigate to **AI Settings** → Should see all 7 agents
- Navigate to **Conversations** → Should see recent conversations
- Look for **V2 debug badges** in development mode

### 3. Test Webhook
Send a test email and verify webhook processing in logs.

## 🚨 Troubleshooting

### If V2 agents don't appear in UI:
```bash
npx tsx scripts/bridge-v2-agents-to-ui.ts
```

### If conversations don't appear:
```bash
npx tsx scripts/bridge-v2-conversations-to-ui.ts
```

### If message statuses are wrong:
```bash
npx tsx scripts/fix-v2-message-statuses.ts
```

### If webhooks aren't working:
1. Check Mailgun webhook configuration
2. Verify `/v2/webhook/mailgun` endpoint is accessible
3. Check production logs for webhook errors

## 📊 Success Metrics

### You'll know it's working when:
- ✅ All 7 agents visible in UI
- ✅ Recent conversations displayed
- ✅ Message statuses show 'sent' instead of 'pending'
- ✅ V2 webhook endpoint responds to health checks
- ✅ Real customer replies are processed and displayed

### Real Customer Engagement Tracking:
- Monitor conversation replies in the UI
- Check for handover triggers when customers are ready
- Track engagement metrics in V2 system
- Watch for actual customer responses (not test data)

## 🎉 Final Result

Once deployed, your V2 system will be fully operational in production with:
- **Perfect email threading** for all customer conversations
- **Real-time status tracking** of message delivery
- **Automatic handover detection** when customers are ready
- **Complete UI integration** showing all agents and conversations
- **Proper webhook processing** for accurate engagement metrics

Your **1,889 emails to real customers** are now properly tracked, and the system is ready to handle actual customer replies and engagement! 🚀
