# DNS Setup for kunesauto.vip

## Required DNS Records

Add these records to your `kunesauto.vip` DNS configuration:

### Main Domain Records
```
TXT @ "v=spf1 include:mailgun.org ~all"
```

### Subdomain Records (one for each dealership)
```
TXT kunesmacomb "v=spf1 include:mailgun.org ~all"
TXT kuneshonda "v=spf1 include:mailgun.org ~all"  
TXT kuneshyundai "v=spf1 include:mailgun.org ~all"
TXT kunesford "v=spf1 include:mailgun.org ~all"
TXT kunesnissan "v=spf1 include:mailgun.org ~all"
TXT kunestoyota "v=spf1 include:mailgun.org ~all"
```

### DKIM Records (Mailgun will provide these)
After adding domains to Mailgun, you'll get DKIM records like:
```
TXT krs._domainkey.kunesmacomb "k=rsa; p=[MAILGUN_PROVIDED_KEY]"
TXT krs._domainkey.kuneshonda "k=rsa; p=[MAILGUN_PROVIDED_KEY]"
# ... etc for each subdomain
```

## Mailgun Domain Setup

In your Mailgun dashboard, add these domains:
1. `kunesmacomb.kunesauto.vip`
2. `kuneshonda.kunesauto.vip`
3. `kuneshyundai.kunesauto.vip`
4. `kunesford.kunesauto.vip`
5. `kunesnissan.kunesauto.vip`
6. `kunestoyota.kunesauto.vip`

## Email Addresses That Will Be Used
- `noreply@kunesmacomb.kunesauto.vip`
- `noreply@kuneshonda.kunesauto.vip`
- `noreply@kuneshyundai.kunesauto.vip`
- `noreply@kunesford.kunesauto.vip`
- `noreply@kunesnissan.kunesauto.vip`
- `noreply@kunestoyota.kunesauto.vip`