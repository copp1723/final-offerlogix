# 🚀 Render Deployment Guide - MailMind Enhanced Features

## **Overview**
This guide covers deploying MailMind with all new enhanced features including intent-based handovers, A/B testing, advanced conversation AI, and comprehensive analytics.

## **Phase 1: Pre-Deployment Checklist**

### **1.1 New Features Summary**
✅ **Intent-Based Handover System**
- AI detects customer intents (pricing, test_drive, trade_in, etc.)
- Automatic handover emails to sales team
- Configurable criteria per campaign

✅ **Advanced Template Versioning & A/B Testing**
- Multiple template variants per campaign
- Deterministic lead assignment using SHA-256
- Real-time variant performance tracking

✅ **Enhanced Conversation Responder** 
- Unified polling + webhook trigger modes
- AI loop prevention (max 3 consecutive replies)
- Improved error handling and logging

✅ **Comprehensive Email Analytics**
- Campaign delivery metrics with rates
- Real-time event tracking
- Enhanced reporting dashboard

✅ **Environment Validation & Error Handling**
- Zod-based environment validation
- Standardized error handling across services
- Improved TypeScript configuration

## **Phase 2: Render Configuration**

### **2.1 Required Environment Variables**

#### **Core Application**
```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
API_KEY=your-api-key-for-external-access
```

#### **Email Services**
```bash
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=sender@mg.yourdomain.com
MAILGUN_WEBHOOK_SIGNING_KEY=webhook-signing-key-from-mailgun
```

#### **AI Services** (Required for new features)
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxx
# OR
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxx
```

#### **NEW: Intent Handover System**
```bash
DEFAULT_HANDOVER_RECIPIENT=sales@yourdomain.com
```

#### **SMS Services** (Optional)
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

#### **Rate Limiting & Security**
```bash
PREVIEW_RATE_LIMIT=100
SEND_RATE_LIMIT=50
WEBHOOK_RATE_LIMIT=1000
RATE_LIMIT_WINDOW_MS=900000
```

#### **Logging & Monitoring**
```bash
LOG_LEVEL=info
SECURITY_LOG_ENABLED=true
```

### **2.2 Render Service Settings**

#### **Build Command:**
```bash
npm ci && npm run build
```

#### **Start Command:**
```bash
NODE_ENV=production node dist/index.js
```

#### **Health Check Endpoint:**
```bash
/api/health
```

## **Phase 3: Database Migration**

### **3.1 Migration Files to Apply**
```bash
# Run this migration in your production database:
psql $DATABASE_URL -f drizzle/0013_intent_handover.sql
```

## **Phase 4: Deployment Execution**

### **4.1 Run the Deployment Script**
```bash
# Make sure you're in the project directory
cd /path/to/MailMind

# Set your production database URL
export DATABASE_URL="your-production-database-url"

# Run the deployment script
./deploy-enhanced.sh
```

### **4.2 Git Commit and Push**
```bash
# Commit all the new features
git add .
git commit -m "🚀 Enhanced Features: Intent-based handovers, A/B testing, conversation AI, analytics

Features added:
- Intent-based handover system with AI detection
- Advanced template versioning with A/B testing
- Enhanced conversation responder with loop prevention
- Comprehensive email analytics and metrics
- Environment validation and improved error handling
- TypeScript configuration improvements

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to your repository (Render will auto-deploy)
git push origin main
```

## **Phase 5: Post-Deployment Verification**

### **5.1 Health Check**
Visit your Render app URL + `/api/health` to verify the application is running.

### **5.2 Feature Testing**

#### **A. Intent-Based Handover Testing**
```bash
# Test the intent evaluation endpoint
curl -X POST https://your-app.onrender.com/api/handover/intent-evaluate \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"leadId": "test-lead", "campaignId": "test-campaign"}'
```

#### **B. Conversation Responder Testing**
```bash
# Test AI reply trigger
curl -X POST https://your-app.onrender.com/api/conversations/test-conversation/ai-reply \
  -H "Authorization: Bearer your-api-key"
```

#### **C. Campaign Metrics Testing**
```bash
# Test enhanced metrics
curl -X GET https://your-app.onrender.com/api/campaigns/test-campaign/metrics \
  -H "Authorization: Bearer your-api-key"
```

### **5.3 Database Verification**
```sql
-- Verify new tables and columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND column_name IN ('handover_criteria', 'handover_recipient');

-- Check handover_events table
SELECT COUNT(*) FROM handover_events;
```

## **Phase 6: UI Updates Required**

### **6.1 Campaign Form Enhancement**
The campaign form needs updates to support intent-based handovers:

**File**: `client/src/components/campaign/CampaignForm.tsx`

**Add these fields to the form schema:**
```tsx
// Add to formSchema
handoverCriteria: z.array(z.object({
  intent: z.enum(['pricing', 'test_drive', 'trade_in', 'vehicle_info', 'complaint', 'appointment', 'other']),
  action: z.literal('handover')
})).optional(),
handoverRecipient: z.string().email().optional(),
```

**Add UI section for intent configuration:**
```tsx
// Replace existing handover goals with intent-based configuration
<FormField
  control={form.control}
  name="handoverCriteria"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Handover Triggers - Handover to sales when lead shows these intents:</FormLabel>
      <div className="grid grid-cols-2 gap-3">
        {intentOptions.map((intent) => (
          <div key={intent.value} className="flex items-center space-x-2">
            <Checkbox
              id={intent.value}
              checked={field.value?.some(item => item.intent === intent.value) || false}
              onCheckedChange={(checked) => {
                const current = field.value || [];
                if (checked) {
                  field.onChange([...current, { intent: intent.value, action: 'handover' }]);
                } else {
                  field.onChange(current.filter(item => item.intent !== intent.value));
                }
              }}
            />
            <label htmlFor={intent.value} className="text-sm font-medium">
              {intent.label}
            </label>
          </div>
        ))}
      </div>
    </FormItem>
  )}
/>

<FormField
  control={form.control}
  name="handoverRecipient"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Handover Recipient Email</FormLabel>
      <FormControl>
        <Input
          placeholder="sales@yourdealership.com"
          type="email"
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### **6.2 Dashboard Analytics Enhancement**

**File**: `client/src/components/dashboard/QuickStats.tsx`

Add new metrics cards:
- Handover Events Count
- A/B Test Performance
- Conversation AI Status

### **6.3 Campaign Analytics Page**

Add A/B testing results and handover analytics to campaign detail pages.

## **Phase 7: Monitoring & Maintenance**

### **7.1 Log Monitoring**
Monitor these new log entries:
- Intent detection results
- Handover triggers
- A/B test assignments
- Conversation loop guards

### **7.2 Performance Metrics**
Track these new metrics:
- Intent detection accuracy
- Handover conversion rates
- A/B test statistical significance
- AI response latency

## **🎯 Success Criteria**

Your deployment is successful when:

✅ **All Health Checks Pass**
- `/api/health` returns 200 OK
- Database migrations completed
- All environment variables validated

✅ **New Features Functional**
- Intent handover endpoint responds correctly
- AI conversation responder triggers work
- A/B testing assigns leads to variants
- Campaign metrics show enhanced data

✅ **UI Integration Complete**
- Campaign forms support new intent configuration
- Analytics dashboards show enhanced metrics
- Conversation management includes AI controls

✅ **Production Ready**
- Error logging captures issues properly
- Rate limiting protects endpoints
- Security validations are active

## **🚨 Troubleshooting**

### **Common Issues:**

**1. Migration Fails**
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Re-run migration manually
psql $DATABASE_URL -f drizzle/0013_intent_handover.sql
```

**2. Environment Validation Errors**
```bash
# Check required variables are set
node -e "console.log(process.env.DATABASE_URL ? 'DB OK' : 'DB MISSING')"
```

**3. AI Features Not Working**
- Verify OPENAI_API_KEY or OPENROUTER_API_KEY is set
- Check API key has sufficient credits/permissions

**4. Build Failures**
```bash
# Clear node modules and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## **Next Steps After Deployment**

1. **Configure Campaign Handovers**: Set up your first intent-based handover criteria
2. **Create A/B Tests**: Set up template variants for your campaigns
3. **Monitor Analytics**: Watch the enhanced metrics for insights
4. **Train Sales Team**: Brief them on the new automated handover system
5. **Scale Usage**: Gradually increase AI conversation usage

Your MailMind platform is now enhanced with cutting-edge AI features! 🚀