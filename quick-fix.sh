#!/bin/bash

# IMMEDIATE FIX FOR OFFERLOGIX EMAIL ISSUES
# Run this script to apply quick fixes right now

echo "🔧 APPLYING IMMEDIATE FIXES TO OFFERLOGIX..."
echo ""

BASE_DIR="/Users/joshcopp/Desktop/Swarm/OFFERLOGIX"

echo "1. Backing up original files..."
cp "$BASE_DIR/server/services/mailgun.ts" "$BASE_DIR/server/services/mailgun.ts.backup" 2>/dev/null
cp "$BASE_DIR/server/services/mailgun-threaded.ts" "$BASE_DIR/server/services/mailgun-threaded.ts.backup" 2>/dev/null
cp "$BASE_DIR/server/services/inbound-email.ts" "$BASE_DIR/server/services/inbound-email.ts.backup" 2>/dev/null

echo "2. Removing hardcoded Brittany Simpson from mailgun.ts..."
sed -i '' 's/Brittany Simpson/OfferLogix Assistant/g' "$BASE_DIR/server/services/mailgun.ts"
sed -i '' 's/brittany@/assistant@/g' "$BASE_DIR/server/services/mailgun.ts"

echo "3. Fixing mailgun-threaded.ts..."
sed -i '' 's/Brittany Simpson/OfferLogix Assistant/g' "$BASE_DIR/server/services/mailgun-threaded.ts"
sed -i '' 's/brittany+/assistant+/g' "$BASE_DIR/server/services/mailgun-threaded.ts"
sed -i '' 's/brittany@/assistant@/g' "$BASE_DIR/server/services/mailgun-threaded.ts"

echo "4. Updating system prompt in inbound-email.ts..."
sed -i '' 's/You are Brittany from OfferLogix/You are an OfferLogix specialist/g' "$BASE_DIR/server/services/inbound-email.ts"

echo "5. Setting environment variables..."
echo "" >> "$BASE_DIR/.env"
echo "# Email sender configuration (added by fix script)" >> "$BASE_DIR/.env"
echo "DEFAULT_SENDER_NAME=OfferLogix Assistant" >> "$BASE_DIR/.env"
echo "MAILGUN_FROM_EMAIL=assistant@mail.offerlogix.me" >> "$BASE_DIR/.env"

echo ""
echo "✅ IMMEDIATE FIXES APPLIED!"
echo ""
echo "📋 NEXT STEPS:"
echo "  1. Rebuild the application:"
echo "     cd $BASE_DIR && npm run build"
echo ""
echo "  2. Restart the server:"
echo "     npm start"
echo ""
echo "⚠️  NOTE: This is a quick fix. For complete resolution including threading issues,"
echo "    run: node fix-all-email-issues.js"
echo ""
echo "🧪 To test the fixes:"
echo "  - Send a test campaign email"
echo "  - Reply to it"
echo "  - Verify the reply comes from 'OfferLogix Assistant' (not Brittany Simpson)"
echo "  - Check if threading is maintained (may still need full fix for perfect threading)"
