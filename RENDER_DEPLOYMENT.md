# OneKeel Swarm - Render Deployment Guide

## 🚀 Deploy to Render Cloud Platform

This guide will help you deploy OneKeel Swarm to Render, a modern cloud platform with automatic builds, deployments, and scaling.

## 🚀 5-Minute Quick Start

If you want to deploy immediately without reading the full guide:

1. **Fork this repository** to your GitHub account
2. Go to [render.com](https://render.com) → **"New"** → **"Blueprint"**  
3. Connect your GitHub and select the forked repository
4. **Add these environment variables** after deployment:
   ```bash
   MAILGUN_API_KEY=your_mailgun_key
   MAILGUN_DOMAIN=mg.watchdogai.us
   SESSION_SECRET=generate_random_32_char_string
   ```
5. **Visit health check**: `https://your-app.onrender.com/api/health/system`

**Expected Response**:
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

**Cost**: ~$14/month (Web Service + PostgreSQL starter plans)

---

## 📋 Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **API Keys**: Gather required service credentials (listed below)

---

## 🔧 Step 1: Environment Configuration

You'll need these environment variables in Render:

### Required Variables
```bash
# Database (automatically provided by Render PostgreSQL)
DATABASE_URL=postgresql://...

# Email Service (Required for campaigns)
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=mg.watchdogai.us

# Session Security
SESSION_SECRET=your_random_session_secret
```

### Optional Variables (Enhanced Features)
```bash
# AI Capabilities
OPENROUTER_API_KEY=your_openrouter_key

# SMS Integration
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone

# Email Monitoring
IMAP_HOST=imap.gmail.com
IMAP_USER=your_email@gmail.com
IMAP_PASSWORD=your_app_password

# Memory Enhancement
SUPERMEMORY_API_KEY=your_supermemory_key
```

---

## 🗄️ Step 2: Database Setup

### Option A: Using render.yaml (Recommended)
The included `render.yaml` will automatically create a PostgreSQL database.

### Option B: Manual Setup
1. In Render Dashboard, click **"New"** → **"PostgreSQL"**
2. Name: `onekeel-postgres`
3. Database Name: `onekeel_swarm`
4. User: `onekeel_user`
5. Plan: Start with **Starter** plan ($7/month)
6. Note the connection details for environment variables

---

## 🌐 Step 3: Web Service Deployment

### Option A: Blueprint Deployment (Fastest)
1. Fork this repository to your GitHub
2. **IMPORTANT**: Remove Replit-specific dependencies before deployment:
   - The project includes `vite.config.render.ts` for production builds
   - Use `npm run build:render` command instead of `npm run build`
3. In Render Dashboard, click **"New"** → **"Blueprint"**
4. Connect your GitHub repository
5. Render will detect `render.yaml` and create all services automatically
6. Configure environment variables in the dashboard

### Option B: Manual Deployment
1. In Render Dashboard, click **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:

```yaml
Name: onekeel-swarm
Environment: Node
Build Command: npm ci && vite build --config vite.config.render.ts && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
Start Command: npm start
Health Check Path: /api/health/system
Pre-Deploy Command: npm run db:push (optional)
```

4. Add environment variables in the dashboard
5. Deploy

---

## ⚙️ Step 4: Environment Variables Setup

In your Render service dashboard:

1. Go to **Environment** tab
2. Add each environment variable:
   - **DATABASE_URL**: Link to your PostgreSQL database
   - **MAILGUN_API_KEY**: Your Mailgun API key
   - **MAILGUN_DOMAIN**: `mg.watchdogai.us`
   - **SESSION_SECRET**: Generate a random 32+ character string
   - Add optional variables as needed

3. Click **"Save Changes"**

---

## 🚀 Step 5: Deploy and Initialize

### Automatic Deployment
1. Render will automatically build and deploy on code changes
2. Monitor the build logs for any issues
3. Once deployed, visit your app URL

### Database Migration
The app will automatically run database migrations on startup using Drizzle.

### Health Check
Visit `https://your-app.onrender.com/api/health/system` to verify all services are operational.

---

## 🔒 Step 6: Security Configuration

### Custom Domain (Optional)
1. In Render Dashboard, go to **Settings** → **Custom Domains**
2. Add your domain and configure DNS
3. Render provides free SSL certificates

### Environment Security
- Never commit API keys to your repository
- Use Render's environment variable encryption
- Consider upgrading to paid plans for enhanced security features

---

## 📊 Step 7: Monitoring & Scaling

### Built-in Monitoring
- **Health Checks**: Automatic health monitoring at `/api/health/system`
- **Logs**: Real-time logs in Render dashboard
- **Metrics**: CPU, memory, and request metrics
- **Alerts**: Configure notifications for downtime

### Scaling
- **Horizontal Scaling**: Add more instances as traffic grows
- **Vertical Scaling**: Upgrade to larger instance types
- **Auto-scaling**: Available on higher plans

---

## 💰 Cost Estimation

### Starter Configuration
- **Web Service (Starter)**: $7/month
- **PostgreSQL (Starter)**: $7/month
- **Total**: ~$14/month

### Production Configuration
- **Web Service (Standard)**: $25/month
- **PostgreSQL (Standard)**: $20/month
- **Total**: ~$45/month

---

## 🛠️ Configuration Files

The following files have been created for Render deployment:

### `render.yaml` - Blueprint Configuration
```yaml
services:
  - type: web
    name: onekeel-swarm
    env: node
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    # ... (full configuration in file)
```

### `Dockerfile` - Container Configuration
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
# ... (full configuration in file)
```

---

## 🔧 Troubleshooting

### Common Issues

**Build Failures**
- **Replit Dependencies Issue**: The project uses `vite.config.render.ts` to avoid Replit-specific plugins (`@replit/vite-plugin-cartographer`, `@replit/vite-plugin-runtime-error-modal`) that don't exist on Render
- **Solution**: Always use `vite.config.render.ts` in the build command, not the regular `vite.config.ts`
- Check Node.js version compatibility (requires Node.js 18+)
- Verify all dependencies are in package.json
- Review build logs for specific errors

**Database Connection Issues**
- Verify DATABASE_URL is correctly set
- Check database service status in Render dashboard
- Ensure database and web service are in same region

**Environment Variable Issues**
- Double-check variable names and values
- Restart service after changing environment variables
- Use Render's secret management for sensitive values

### Getting Help
- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **OneKeel Support**: Check health endpoints for service status
- **Community**: Render community forums for platform-specific issues

---

## ✅ Post-Deployment Checklist

- [ ] Web service is running and accessible
- [ ] Database is connected and responding
- [ ] Health check endpoint returns "ok": true
- [ ] Email service (Mailgun) is configured
- [ ] Environment variables are set correctly
- [ ] SSL certificate is active
- [ ] Domain is configured (if using custom domain)
- [ ] Monitoring and alerts are set up

---

## 🎉 Success!

Your OneKeel Swarm platform is now deployed on Render with:

- **Automatic builds** on code changes
- **SSL certificates** and custom domains
- **Scalable infrastructure** with monitoring
- **Database backups** and maintenance
- **Zero-downtime deployments**

Your automotive email campaign platform is ready for production traffic!

---

*Deployment completed - OneKeel Swarm running on Render Cloud Platform* ✅