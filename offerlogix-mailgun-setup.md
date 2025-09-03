# OFFERLOGIX Mailgun Configuration

## Domain Setup
1. **Add domain** `mg.offerlogix.com` to your Mailgun account
2. **Verify DNS** records for the domain
3. **Configure SPF/DKIM** for deliverability

## Route Configuration
In your Mailgun dashboard, create this route:

**Expression type**: Match Recipient  
**Recipient**: `swarm@mg.offerlogix.com`

**Actions**:
- ✅ **Forward**: `https://ccl-3-final.onrender.com/api/webhooks/mailgun/inbound`
- ✅ **Store and notify**: `https://ccl-3-final.onrender.com/api/webhooks/mailgun/store`
- ✅ **Stop**: (end of route processing)

## Environment Variables for OFFERLOGIX
Add these to your .env for testing:

```bash
# OFFERLOGIX specific config
OFFERLOGIX_MAILGUN_DOMAIN=mg.offerlogix.com
OFFERLOGIX_FROM_EMAIL=swarm@mg.offerlogix.com
```

## Agent Personality Profile
- **Tonality**: Friendly and approachable
- **Focus**: Special offers and deal optimization
- **Style**: Creates appropriate urgency while building trust
- **Specialization**: Automotive financing and incentives

## Testing the Setup
1. **Send test email** from `swarm@mg.offerlogix.com`
2. **Reply to the email** 
3. **Check logs** for webhook processing
4. **Verify AI response** reflects OfferLogix personality

## Production Checklist
- [ ] Domain `mg.offerlogix.com` added to Mailgun
- [ ] DNS records configured and verified  
- [ ] Route created for `swarm@mg.offerlogix.com`
- [ ] Database client record created
- [ ] AI agent config activated
- [ ] Test email sent and reply processed
- [ ] Agent responses match OfferLogix brand voice

## Multi-Client Testing
Test both clients work independently:
- Send from `swarm@mg.integrityleads.com` → Professional tone
- Send from `swarm@mg.offerlogix.com` → Friendly, offer-focused tone