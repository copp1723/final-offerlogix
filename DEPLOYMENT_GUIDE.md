# OfferLogix Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying OfferLogix to Render.com as an independent copy of MailMind.

## Prerequisites
- Render.com account
- GitHub repository access to `https://github.com/copp1723/final-offerlogix.git`
- Database migration completed (see DATABASE_MIGRATION_GUIDE.md)
- API keys for required services

## Deployment Steps

### 1. Connect GitHub Repository to Render

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub account if not already connected
4. Select the repository: `copp1723/final-offerlogix`
5. Choose the `main` branch

### 2. Configure Web Service

Use these settings:

- **Name**: `offerlogix-app`
- **Region**: Oregon (US West)
- **Branch**: `main`
- **Root Directory**: (leave blank)
- **Environment**: Node
- **Build Command**: `NPM_CONFIG_PRODUCTION=false npm ci && npm run build:render`
- **Start Command**: `npm start`

### 3. Set Environment Variables

Add these environment variables in Render:

#### Required Variables
```
NODE_ENV=production
DATABASE_URL=[Your PostgreSQL connection string]
MAILGUN_API_KEY=[Your Mailgun API key]
MAILGUN_DOMAIN=mg.offerlogix.com
MAILGUN_FROM_EMAIL=agent@mg.offerlogix.com
OPENROUTER_API_KEY=[Your OpenRouter API key]
JWT_SECRET=[Generate a random 32+ character string]
SESSION_SECRET=[Generate a random 32+ character string]
API_KEY_ENCRYPTION_KEY=[Generate a random 32+ character string]
```

#### Optional Variables (configure as needed)
```
OPENAI_API_KEY=[Your OpenAI API key if using]
TWILIO_ACCOUNT_SID=[Your Twilio SID]
TWILIO_AUTH_TOKEN=[Your Twilio auth token]
TWILIO_PHONE_NUMBER=[Your Twilio phone number]
GMAIL_EMAIL=[Gmail for IMAP monitoring]
GMAIL_PASSWORD=[Gmail app password]
SUPERMEMORY_API_KEY=[If using Supermemory]
DEFAULT_HANDOVER_RECIPIENT=sales@offerlogix.com
ENABLE_AGENTS=true
DISABLE_AUTO_RESPONSES=false
RATE_LIMITING_ENABLED=true
SECURITY_ENABLED=true
LOG_LEVEL=info
```

### 4. Create Database

1. In Render Dashboard, click "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `offerlogix-postgres`
   - **Database**: `offerlogix_db`
   - **User**: `offerlogix_user`
   - **Region**: Oregon (US West)
   - **PostgreSQL Version**: 15
   - **Plan**: Starter or higher

3. Wait for database to be created
4. Copy the connection string from the database dashboard
5. Update the `DATABASE_URL` environment variable in your web service

### 5. Create Redis Instance (for rate limiting)

1. Click "New +" → "Redis"
2. Configure:
   - **Name**: `offerlogix-redis`
   - **Region**: Oregon (US West)
   - **Plan**: Starter

3. Copy the Redis connection string
4. Add as environment variable: `REDIS_URL=[Redis connection string]`

### 6. Deploy

1. Click "Manual Deploy" → "Deploy latest commit"
2. Monitor the build logs for any errors
3. Wait for the deployment to complete (usually 5-10 minutes)

### 7. Run Database Migrations

After first deployment:

1. Go to the web service dashboard
2. Click "Shell" tab
3. Run:
   ```bash
   npm run db:push
   ```

### 8. Verify Deployment

1. Visit your app URL: `https://offerlogix-app.onrender.com`
2. Check the health endpoint: `https://offerlogix-app.onrender.com/api/health`
3. Test login and basic functionality

## Post-Deployment Configuration

### Configure Mailgun

1. Log in to Mailgun
2. Add domain: `mg.offerlogix.com`
3. Configure DNS records as provided by Mailgun
4. Set up webhook endpoints:
   - Delivered: `https://offerlogix-app.onrender.com/api/webhooks/mailgun/delivered`
   - Opened: `https://offerlogix-app.onrender.com/api/webhooks/mailgun/opened`
   - Clicked: `https://offerlogix-app.onrender.com/api/webhooks/mailgun/clicked`
   - Complained: `https://offerlogix-app.onrender.com/api/webhooks/mailgun/complained`
   - Unsubscribed: `https://offerlogix-app.onrender.com/api/webhooks/mailgun/unsubscribed`
   - Failed: `https://offerlogix-app.onrender.com/api/webhooks/mailgun/failed`

### Configure Custom Domain (Optional)

1. In Render dashboard, go to your web service
2. Click "Settings" → "Custom Domains"
3. Add your domain (e.g., `app.offerlogix.com`)
4. Configure DNS as instructed

### Set Up SSL

Render provides free SSL certificates automatically for:
- Default `.onrender.com` domains
- Custom domains (after DNS verification)

## Monitoring & Logs

### View Logs
- In Render dashboard, click "Logs" tab
- Use filters to find specific events
- Download logs for offline analysis

### Set Up Alerts
1. Go to "Settings" → "Notifications"
2. Configure alerts for:
   - Deploy failures
   - Service downtime
   - High resource usage

## Troubleshooting

### Build Fails
- Check build logs for specific errors
- Verify all dependencies in package.json
- Ensure build command is correct

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check database is in same region as web service
- Ensure SSL mode is configured properly

### Application Errors
- Check runtime logs
- Verify all required environment variables are set
- Test locally with production configuration

### Performance Issues
- Monitor memory and CPU usage
- Consider upgrading to higher plan if needed
- Enable caching where appropriate

## Backup & Recovery

### Database Backups
1. Render automatically backs up databases daily
2. For manual backup:
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

### Application Rollback
1. Go to "Events" tab in Render
2. Find previous successful deployment
3. Click "Rollback to this deploy"

## Security Checklist

- [ ] All sensitive environment variables set
- [ ] JWT_SECRET is unique and secure
- [ ] Database uses SSL connection
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] API keys are encrypted
- [ ] Audit logging enabled

## Maintenance

### Regular Updates
```bash
# Update dependencies
npm update
npm audit fix

# Deploy updates
git add .
git commit -m "Update dependencies"
git push origin main
```

### Database Maintenance
```bash
# In Render shell
npm run db:migrate
npm run db:optimize
```

## Support Resources

- [Render Documentation](https://render.com/docs)
- [Application Logs](https://dashboard.render.com/services)
- [Database Dashboard](https://dashboard.render.com/databases)
- GitHub Issues: [https://github.com/copp1723/final-offerlogix/issues](https://github.com/copp1723/final-offerlogix/issues)

## Next Steps

1. ✅ Application deployed
2. ✅ Database connected
3. ✅ Environment configured
4. 📧 Configure email service (Mailgun)
5. 📱 Configure SMS service (Twilio) if needed
6. 🔐 Set up user accounts
7. 🚀 Create first campaign
8. 📊 Monitor performance