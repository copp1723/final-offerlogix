# INTEGRITYLEADS Mailgun Configuration

## Domain Setup
1. **Add domain** `mg.integrityleads.com` to your Mailgun account
2. **Verify DNS** records for the domain
3. **Configure SPF/DKIM** for deliverability

## Route Configuration
In your Mailgun dashboard, create this route:

**Expression type**: Match Recipient  
**Recipient**: `swarm@mg.integrityleads.com`

**Actions**:
- ✅ **Forward**: `https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound`
- ✅ **Store and notify**: `https://ccl-3-final.onrender.com/api/webhooks/mailgun/store`
- ✅ **Stop**: (end of route processing)

## Environment Variables for INTEGRITYLEADS
Add these to your .env for testing:

```bash
# INTEGRITYLEADS specific config
INTEGRITYLEADS_MAILGUN_DOMAIN=mg.integrityleads.com
INTEGRITYLEADS_FROM_EMAIL=swarm@mg.integrityleads.com
```

## Testing the Setup
1. **Send test email** from `swarm@mg.integrityleads.com`
2. **Reply to the email** 
3. **Check logs** for webhook processing
4. **Verify response** is generated and sent

## Production Checklist
- [ ] Domain `mg.integrityleads.com` added to Mailgun
- [ ] DNS records configured and verified
- [ ] Route created for `swarm@mg.integrityleads.com`
- [ ] Database client record created
- [ ] AI agent config activated
- [ ] Test email sent and reply processed