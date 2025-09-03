#!/bin/bash

# Complete setup script for Kunes Auto Group dealerships
# Run this from your MailMind root directory

echo "🚗 Setting up Kunes Auto Group dealerships..."

# 1. Backup current database
echo "📦 Creating database backup..."
pg_dump $DATABASE_URL > backup_before_kunes_setup.sql

# 2. Run client setup
echo "🏢 Creating client records..."
psql $DATABASE_URL -f setup-kunes-dealerships.sql

# 3. Run agent setup  
echo "🤖 Creating AI agent configurations..."
psql $DATABASE_URL -f setup-kunes-agents.sql

# 4. Create admin users (you'll need to run these manually with actual client IDs)
echo "👥 Admin user creation commands:"
echo "Run these commands after getting client IDs from the database:"
echo ""
echo "Get client IDs first:"
echo "psql \$DATABASE_URL -c \"SELECT id, name FROM clients WHERE name LIKE 'Kunes%';\""
echo ""
echo "Then create users with the create-admin-user script:"
echo "node server/scripts/create-admin-user.ts --username admin_macomb --password SecurePassword123! --email admin@kunesautomacomb.com --client-id [CLIENT_ID]"
echo "# Repeat for each dealership..."

# 5. Verify setup
echo "✅ Verifying setup..."
psql $DATABASE_URL -c "
SELECT 
  c.name as dealership,
  c.domain,
  c.settings->>'mailgunDomain' as mailgun_domain,
  ac.name as agent_name,
  ac.agent_email_domain
FROM clients c 
LEFT JOIN ai_agent_config ac ON c.id = ac.client_id 
WHERE c.name LIKE 'Kunes%' 
ORDER BY c.name;
"

echo "🎉 Kunes Auto Group setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify DNS records for all domains"
echo "2. Test Mailgun domain verification"  
echo "3. Create admin users with actual client IDs"
echo "4. Test email sending from each domain"
echo "5. Set up campaigns for each dealership"