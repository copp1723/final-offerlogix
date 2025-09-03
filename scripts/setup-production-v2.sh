#!/bin/bash

# Production V2 Setup Script
# Run this script on your production server after deployment

set -e  # Exit on any error

echo "🚀 SETTING UP V2 SYSTEM IN PRODUCTION"
echo "====================================="
echo ""

# Check if we have the required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is required"
    echo "Please set your production DATABASE_URL"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Check if V2 is enabled
if [ "$V2_MAILGUN_ENABLED" != "true" ]; then
    echo "⚠️  Warning: V2_MAILGUN_ENABLED is not set to 'true'"
    echo "Please add V2_MAILGUN_ENABLED=true to your production environment"
    echo ""
fi

if [ "$VITE_ENABLE_V2_UI" != "true" ]; then
    echo "⚠️  Warning: VITE_ENABLE_V2_UI is not set to 'true'"
    echo "Please add VITE_ENABLE_V2_UI=true to your production environment"
    echo ""
fi

echo "🔧 Running V2 production setup..."
echo ""

# Step 1: Run V2 database migration
echo "1️⃣ Running V2 database migration..."
npx tsx scripts/run-v2-migration.ts
echo "✅ V2 migration completed"
echo ""

# Step 2: Bridge V2 agents to UI
echo "2️⃣ Bridging V2 agents to UI..."
npx tsx scripts/bridge-v2-agents-to-ui.ts
echo "✅ V2 agents bridged"
echo ""

# Step 3: Bridge V2 conversations to UI
echo "3️⃣ Bridging V2 conversations to UI..."
npx tsx scripts/bridge-v2-conversations-to-ui.ts
echo "✅ V2 conversations bridged"
echo ""

# Step 4: Fix V2 message statuses
echo "4️⃣ Fixing V2 message statuses..."
npx tsx scripts/fix-v2-message-statuses.ts
echo "✅ V2 message statuses fixed"
echo ""

# Step 5: Test V2 setup
echo "5️⃣ Testing V2 setup..."
npx tsx scripts/test-v2-setup.ts
echo "✅ V2 setup verified"
echo ""

echo "🎉 PRODUCTION V2 SETUP COMPLETE!"
echo "================================"
echo ""
echo "📋 What was configured:"
echo "   ✅ V2 database schema updated"
echo "   ✅ V2 agents visible in UI"
echo "   ✅ V2 conversations visible in UI"
echo "   ✅ V2 message statuses corrected"
echo "   ✅ V2 webhook handler active"
echo ""
echo "🔗 V2 endpoints now available:"
echo "   📡 Webhook: /v2/webhook/mailgun"
echo "   🏥 Health: /v2/health"
echo "   💬 Conversations: /v2/conversations"
echo "   🤖 Agents: /v2/agents"
echo ""
echo "⚙️  Required environment variables:"
echo "   V2_MAILGUN_ENABLED=true"
echo "   VITE_ENABLE_V2_UI=true"
echo ""
echo "🎯 Next steps:"
echo "   1. Restart your production application"
echo "   2. Configure Mailgun webhooks to point to /v2/webhook/mailgun"
echo "   3. Test V2 functionality with a sample conversation"
echo "   4. Monitor V2 message status updates"
echo ""
echo "📊 Your V2 system is now ready for real customer engagement!"
