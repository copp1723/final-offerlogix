# OfferLogix - Render Deployment Guide

## 🚀 Deploy OfferLogix to Render Cloud Platform

This guide will help you deploy the OfferLogix AI-powered credit solutions platform to Render.

## 🚀 5-Minute Quick Start

**Prerequisites**: You already have the OfferLogix PostgreSQL database running on Render.

1. **Fork/Push this repository** to your GitHub account
2. Go to [render.com](https://render.com) → **"New"** → **"Web Service"**
3. Connect your GitHub and select the OfferLogix repository
4. **Configure the service**:
   ```yaml
   Name: offerlogix
   Environment: Node
   Build Command: npm ci && npm run build
   Start Command: npm start
   Health Check Path: /api/health/system
   ```

5. **Add these environment variables** in Render dashboard:
   ```bash
   NODE_ENV=production
   DATABASE_URL=your_existing_offerlogix_db_connection_string
   OPENROUTER_API_KEY=your_openrouter_key
   MAILGUN_API_KEY=your_mailgun_key
   MAILGUN_DOMAIN=mg.offerlogix.com
   SUPERMEMORY_API_KEY=your_supermemory_key
   SESSION_SECRET=generate_random_32_char_string
   ```

6. **Deploy and visit**: `https://your-offerlogix-app.onrender.com`

---

## 📋 Environment Variables Required

### Core System Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://offerlogix_db_user:password@host/offerlogix_db?sslmode=require
```

### AI & Knowledge Base
```bash
OPENROUTER_API_KEY=sk-or-v1-your-key
AI_MODEL=openai/gpt-4o-mini
SUPERMEMORY_API_KEY=sm_your-supermemory-key
SUPERMEMORY_RAG=on
```

### Email & Communication
```bash
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=mg.offerlogix.com
MAILGUN_FROM_EMAIL=noreply@offerlogix.com
EMAIL_FROM=noreply@offerlogix.com
```

### Security & Sessions
```bash
SESSION_SECRET=your_random_32_character_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
ENCRYPTION_KEY=your_encryption_key
```

### Optional Services
```bash
# SMS Integration (optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Email Monitoring (optional)
IMAP_HOST=imap.gmail.com
IMAP_USER=your_email@gmail.com
IMAP_PASSWORD=your_app_password
EMAIL_ALLOW_SELF_SIGNED_IMAP=true
```

---

## 🔧 Manual Web Service Setup

### Step 1: Create Web Service
1. In Render Dashboard, click **"New"** → **"Web Service"**
2. Connect your GitHub repository with OfferLogix code
3. Configure service settings:

```yaml
Service Name: offerlogix
Environment: Node
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /api/health/system
Plan: Starter (upgrade as needed)
```

### Step 2: Environment Configuration
In the **Environment** tab, add all the environment variables listed above.

**Important**: 
- Use your existing OfferLogix database connection string for `DATABASE_URL`
- Generate secure random strings for session/JWT secrets
- Configure your Mailgun domain for OfferLogix emails

### Step 3: Deploy
1. Click **"Create Web Service"**
2. Render will automatically build and deploy
3. Monitor build logs for any issues

---

## 🏥 Health Check Verification

After deployment, visit: `https://your-offerlogix-app.onrender.com/api/health/system`

**Expected Response**:
```json
{
  "ok": true,
  "timestamp": "2025-08-19T...",
  "checks": {
    "database": {"ok": true, "message": "Connected to OfferLogix database"},
    "ai": {"ok": true, "message": "OpenRouter API accessible"},
    "knowledge": {"ok": true, "message": "Supermemory integration active"},
    "email": {"ok": true, "message": "Mailgun service configured"}
  }
}
```

---

## 🎯 OfferLogix Features Verification

After successful deployment, verify these OfferLogix-specific features:

### 1. Multi-Persona AI System
- Visit: `https://your-app.onrender.com/personas`
- Verify Credit Solutions AI and Payments AI personas are active
- Test persona-specific responses

### 2. Credit Campaign Management
- Visit: `https://your-app.onrender.com/campaigns`
- Create a test "Credit Campaign" with persona assignment
- Verify campaign creation and execution workflows

### 3. Knowledge Base Integration
- Visit: `https://your-app.onrender.com/knowledge-base`
- Verify OfferLogix company information is available
- Test knowledge base search functionality

### 4. Customer Interactions
- Visit: `https://your-app.onrender.com/conversations`
- Verify "Customer Interactions" interface is functional
- Test AI-powered response suggestions

---

## 🔒 Security Configuration

### SSL Certificate
- Render provides free SSL certificates automatically
- Your OfferLogix app will be accessible via HTTPS

### Environment Security
- All sensitive variables are encrypted by Render
- Never commit API keys to your repository
- Use Render's secret management features

### Database Security
- Your existing OfferLogix database maintains its security settings
- Connection is encrypted with SSL/TLS
- Consider IP whitelisting for enhanced security

---

## 📊 Monitoring & Performance

### Built-in Monitoring
- **Health Checks**: Automatic monitoring at `/api/health/system`
- **Application Logs**: Real-time logs in Render dashboard
- **Performance Metrics**: CPU, memory, and request tracking
- **Error Tracking**: Automatic error detection and alerting

### OfferLogix-Specific Monitoring
- Monitor AI persona performance and response quality
- Track credit campaign engagement and conversion rates
- Monitor knowledge base utilization and accuracy
- Track customer interaction resolution times

---

## 💰 Cost Estimation

### Starter Configuration (Recommended for Testing)
- **Web Service (Starter)**: $7/month
- **Database**: Already provisioned
- **Total Additional Cost**: ~$7/month

### Production Configuration (Recommended for Live Use)
- **Web Service (Standard)**: $25/month  
- **Database**: Already provisioned
- **Total Additional Cost**: ~$25/month

### Enterprise Configuration (High Traffic)
- **Web Service (Pro)**: $85/month
- **Database**: Already provisioned  
- **Total Additional Cost**: ~$85/month

---

## 🛠️ Troubleshooting

### Common Deployment Issues

**Build Failures**
- Check Node.js version compatibility (requires Node.js 18+)
- Verify all dependencies are in package.json
- Review build logs in Render dashboard

**Database Connection Issues**
- Verify DATABASE_URL matches your existing OfferLogix database
- Check database service status in Render dashboard
- Ensure SSL mode is enabled (`?sslmode=require`)

**Environment Variable Issues**
- Double-check all required variables are set
- Restart service after changing environment variables
- Verify API keys are valid and have proper permissions

**OfferLogix-Specific Issues**
- Verify Supermemory API key is valid
- Check OpenRouter API key has sufficient credits
- Ensure Mailgun domain is properly configured

### Getting Support
- **Render Support**: [render.com/docs](https://render.com/docs)
- **Health Endpoints**: Use `/api/health/*` endpoints for diagnostics
- **Application Logs**: Check Render dashboard for detailed error logs

---

## ✅ Post-Deployment Checklist

- [ ] Web service is running and accessible
- [ ] Database connection is working (existing OfferLogix DB)
- [ ] Health check endpoint returns all systems "ok"
- [ ] Multi-persona AI system is functional
- [ ] Credit campaign creation works
- [ ] Knowledge base is accessible with OfferLogix content
- [ ] Customer interactions interface is operational
- [ ] Email delivery (Mailgun) is configured
- [ ] SSL certificate is active
- [ ] Environment variables are properly configured

---

## 🎉 Success!

Your OfferLogix platform is now deployed on Render with:

- ✅ **Multi-Persona AI System** - Credit Solutions AI & Payments AI
- ✅ **Credit Campaign Management** - Professional campaign creation and execution
- ✅ **Knowledge Base Integration** - OfferLogix company information accessible to AI
- ✅ **Customer Interaction Management** - Unified communication platform
- ✅ **Professional UI** - OfferLogix-branded interface with credit industry terminology
- ✅ **Production-Ready Architecture** - Scalable, secure, and monitored

**Your OfferLogix credit solutions platform is ready for dealer and vendor outreach!**

---

## 🎯 Next Steps

### For 300 Dealer Prospects
1. Upload dealer contact list through the Customers interface
2. Create credit campaigns using Credit Solutions AI persona
3. Launch dealer outreach with technical, ROI-focused messaging

### For 200 Vendor Prospects  
1. Upload vendor contact list through the Customers interface
2. Create payment campaigns using Payments AI persona
3. Launch vendor outreach with consultative, business-focused messaging

### HubSpot/Zoho Integration (Future Enhancement)
- Plan CRM integration for seamless lead handover
- Configure automated dossier generation and team notifications
- Set up bidirectional contact synchronization

---

*OfferLogix deployment completed - Multi-persona AI credit platform running on Render* ✅