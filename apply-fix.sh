#!/bin/bash

# QUICK APPLY: Fix threading and remove plus-addressing
# Keeps Brittany as sender (as requested)

echo "🔧 APPLYING THREADING FIX (Keeping Brittany as sender)..."
echo ""

BASE_DIR="/Users/joshcopp/Desktop/Swarm/OFFERLOGIX"

# Backup original files
echo "1. Backing up files..."
cp "$BASE_DIR/server/services/mailgun-threaded.ts" "$BASE_DIR/server/services/mailgun-threaded.ts.backup.$(date +%s)" 2>/dev/null
cp "$BASE_DIR/server/services/inbound-email.ts" "$BASE_DIR/server/services/inbound-email.ts.backup.$(date +%s)" 2>/dev/null

# Apply the Node.js fix script
echo "2. Running fix script..."
cd "$BASE_DIR"
node fix-threading-keep-brittany.js

echo ""
echo "3. Running tests..."
node test-threading-fix.js

echo ""
echo "✅ FIXES APPLIED!"
echo ""
echo "📋 MANUAL STEP REQUIRED:"
echo ""
echo "You need to update server/services/inbound-email.ts:"
echo "  1. Open the file"
echo "  2. Add this import at the top:"
echo "     import { extractMessageId, buildThreadingHeaders } from '../utils/threading-helper';"
echo "  3. Find the Message-ID extraction section (around line 565-580)"
echo "  4. Replace it with the code from inbound-email-patch.txt"
echo ""
echo "Then rebuild and restart:"
echo "  npm run build"
echo "  npm start"
echo ""
echo "This will fix:"
echo "  ✓ Remove ugly plus-addressing (brittany+conv_xxx...)"
echo "  ✓ Keep clean sender: Brittany <brittany@mail.offerlogix.me>"
echo "  ✓ Emails stay in same thread"
