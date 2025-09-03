#!/bin/bash

echo "Adding missing V2 environment variables..."

cat >> .env << 'EOF'

# V2 System Configuration
V2_MAILGUN_ENABLED=true
MAILGUN_DOMAIN_DEFAULT=mg.watchdogai.us
MAILGUN_ALLOWED_DOMAINS=kunesmacomb.kunesauto.vip,mg.watchdogai.us
MAILGUN_SIGNING_KEY=31420435df8ff885a971b2eab64ba00e
DATABASE_URL=postgresql://mailmind_user:u8cKdYf2eXWz@dpg-cqu6bsd6l47c739cqhng-a.oregon-postgres.render.com/mailmind

# Debug logging (optional)
V2_LOG_EVENTS=true
LOG_LEVEL=info
EOF

echo "✅ Environment variables added to .env"
echo ""
echo "🚨 IMPORTANT: You also need to add these same variables to your Render deployment:"
echo "1. Go to Render dashboard"
echo "2. Select your MailMind service"
echo "3. Go to Environment tab"
echo "4. Add these variables:"
echo ""
echo "V2_MAILGUN_ENABLED=true"
echo "MAILGUN_DOMAIN_DEFAULT=mg.watchdogai.us"  
echo "MAILGUN_ALLOWED_DOMAINS=kunesmacomb.kunesauto.vip,mg.watchdogai.us"
echo "MAILGUN_SIGNING_KEY=31420435df8ff885a971b2eab64ba00e"
echo "DATABASE_URL=postgresql://mailmind_user:u8cKdYf2eXWz@dpg-cqu6bsd6l47c739cqhng-a.oregon-postgres.render.com/mailmind"
echo "V2_LOG_EVENTS=true"
echo ""
echo "5. Deploy/Redeploy the service"