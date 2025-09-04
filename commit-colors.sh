#!/bin/bash

echo "🎨 Committing OfferLogix Color Scheme Updates..."
echo ""

# Navigate to project directory
cd /Users/joshcopp/Desktop/Swarm/OFFERLOGIX

# Check git status
echo "📋 Current git status:"
git status --porcelain

echo ""
echo "➕ Adding modified color files..."
git add client/src/index.css dashboard/src/index.css

echo ""
echo "💾 Committing changes..."
git commit -m "🎨 Update to actual OfferLogix brand colors

- Implement teal primary (#4ECDC4) and orange accent (#FF9500)
- Add teal-to-dark-teal primary gradient  
- Remove orange-teal secondary gradient
- Update both light and dark themes
- Simplify color palette to match official OfferLogix branding
- Apply colors to client and dashboard CSS files"

echo ""
echo "🚀 Pushing to remote..."
git push

echo ""
echo "✅ Successfully committed and pushed OfferLogix color scheme updates!"
echo ""
echo "🎯 Applied Colors:"
echo "   • Teal Primary: #4ECDC4"  
echo "   • Orange Accent: #FF9500"
echo "   • Primary Gradient: Teal → Dark Teal"
echo "   • Clean, focused branding aligned with OfferLogix"
echo ""
echo "🔗 Changes applied to:"
echo "   • /client/src/index.css"
echo "   • /dashboard/src/index.css"
