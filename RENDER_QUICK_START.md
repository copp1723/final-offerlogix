# OneKeel Swarm - Quick Render Deployment

## 🚀 5-Minute Render Deployment

### Step 1: Fork & Connect Repository
1. Fork this repository to your GitHub account
2. Go to [render.com](https://render.com) and sign up/login
3. Click **"New"** → **"Blueprint"**
4. Connect your GitHub and select the forked repository

### Step 2: Environment Variables (Required)
Add these in Render dashboard after deployment:

```bash
# Required - Email Service
MAILGUN_API_KEY=your_mailgun_key_here
MAILGUN_DOMAIN=mg.watchdogai.us

# Required - Security  
SESSION_SECRET=generate_random_32_char_string

# Database URL (automatically provided by Render PostgreSQL)
DATABASE_URL=postgresql://... (auto-generated)
```

### Step 3: Optional API Keys (Enhanced Features)
```bash
# AI Capabilities
OPENROUTER_API_KEY=your_openrouter_key

# SMS Integration  
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Email Monitoring
IMAP_USER=your_email@gmail.com
IMAP_PASSWORD=your_app_password
```

### Step 4: Deploy
1. **IMPORTANT**: The project uses `vite.config.render.ts` to avoid Replit dependencies
2. Render automatically creates PostgreSQL database and web service
3. Build process runs with production-safe configuration
4. Database migrations run during startup
5. App deploys to: `https://your-app-name.onrender.com`

### Step 5: Verify Deployment
Visit: `https://your-app-name.onrender.com/api/health/system`

Expected response:
```json
{
  "ok": true,
  "timestamp": "2025-01-08T...",
  "checks": {
    "database": {"ok": true},
    "email": {"ok": true},
    "realtime": {"ok": true},
    "ai": {"ok": true}
  }
}
```

## 💰 Cost: ~$14/month
- Web Service (Starter): $7/month
- PostgreSQL (Starter): $7/month

## ✅ What You Get
- Production-ready automotive email platform
- Automatic SSL certificates
- Database backups
- Zero-downtime deployments
- Built-in monitoring and logging
- Scalable infrastructure

**Your OneKeel Swarm platform will be live and ready for automotive dealership onboarding!**